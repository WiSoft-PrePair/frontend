import {useEffect, useState} from 'react'
import {Link, NavLink, Outlet, useLocation, useNavigate} from 'react-router-dom'
import {useAppState} from '../context/AppStateContext'
import logo from '../assets/logo.png'
import '../styles/layouts/AppLayout.css'

const navItems = [
  {to: '/mypage', label: 'Home'},
  {to: '/interview', label: 'Interview'},
  {to: '/reward', label: 'Reward'},
  {to: '/settings', label: 'Settings'},
]

const activeLinkClass = ({isActive}) =>
  isActive ? 'nav__link nav__link--active' : 'nav__link'

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const {user, logout} = useAppState()
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  const isLanding = location.pathname === '/'
  const isAuth = location.pathname.startsWith('/auth')
  const showNavElements = !isLanding && !isAuth && user
  const showAuthCtas = isLanding || (!user && !isAuth)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    // 초기 로드 시에도 스크롤 위치 체크
    handleScroll()
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setIsNavOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/', {replace: true})
  }

  const handleLogoClick = (e) => {
    e.preventDefault()
    navigate(user ? '/mypage' : '/', {replace: true})
  }

  return (
    <div className="shell">
      {/* Gradient Background */}
      <div className="shell__gradient" aria-hidden="true"/>

      {!isLanding && (
        <header className={`header ${isScrolled ? 'header--scrolled' : ''}`}>
          <div className="header__container">
            <a href={user ? '/mypage' : '/'} onClick={handleLogoClick} className="header__brand">
              <img src={logo} alt="PrePair" className="header__logo"/>
              <span className="header__brand-name">PrePair</span>
            </a>

            {showNavElements && (
              <>
                <nav className={`nav ${isNavOpen ? 'nav--open' : ''}`} aria-label="주요 메뉴">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={activeLinkClass}
                      end={item.to === '/mypage'}
                    >
                      <span className="nav__label">{item.label}</span>
                    </NavLink>
                  ))}
                </nav>

                <div className="header__actions">
                  {user && (
                    <div className="header__user">
                      <span className="header__points">
                        💰 {user.points?.toLocaleString() || 0}
                      </span>
                      <span className="header__name">
                        {user.name?.trim() ? `${user.name}님` : '회원님'}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="btn btn--ghost btn--sm"
                  >
                    로그아웃
                  </button>
                  <button
                    type="button"
                    className="nav-toggle"
                    aria-controls="primary-navigation"
                    aria-expanded={isNavOpen}
                    onClick={() => setIsNavOpen((prev) => !prev)}
                  >
                    <span className="nav-toggle__bar"/>
                    <span className="nav-toggle__bar"/>
                    <span className="nav-toggle__bar"/>
                    <span className="sr-only">{isNavOpen ? '메뉴 닫기' : '메뉴 열기'}</span>
                  </button>
                </div>
              </>
            )}

            {showAuthCtas && !isLanding && (
              <div className="header__actions">
                <Link to="/auth?mode=login" className="btn btn--ghost">
                  로그인
                </Link>
                <Link to="/auth?mode=signup" className="btn btn--primary">
                  시작하기
                </Link>
              </div>
            )}
          </div>
        </header>
      )}

      <main className="main">
        <div className="main__content">
          <Outlet/>
        </div>
      </main>

      <footer className="footer">
        <div className="footer__container">
          <div className="footer__brand">
            <div className="footer__logo-wrap">
              <img src={logo} alt="PrePair" className="footer__logo"/>
              <span className="footer__brand-name">PrePair</span>
            </div>
            <p className="footer__tagline">
              AI 기반 면접 코칭 플랫폼으로<br/>
              취업 준비생의 성공적인 커리어를 응원합니다.
            </p>
          </div>

          {!user && (
            <>
              <div className="footer__links">
                <h4>서비스</h4>
                <Link to="/auth?mode=signup">회원가입</Link>
                <Link to="/auth?mode=login">로그인</Link>
                <a href="#features">기능 소개</a>
              </div>
              <div className="footer__links">
                <h4>문의</h4>
                <a href="mailto:team.maeilmail@gmail.com">이메일 문의</a>
                <a href="https://github.com/SeSAC-PrePair" target="_blank" rel="noopener noreferrer">GitHub</a>
              </div>
            </>
          )}

          <div className="footer__bottom">
            <span>© {new Date().getFullYear()} PrePair. All rights reserved.</span>
            <div className="footer__bottom-links">
              <a href="/terms">이용약관</a>
              <a href="/privacy">개인정보처리방침</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Nav Overlay */}
      {isNavOpen && (
        <div
          className="nav-overlay"
          onClick={() => setIsNavOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
