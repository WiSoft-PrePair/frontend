import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import '../styles/pages/Landing.css'

export default function LandingPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    
    // 모바일 섹션 인디케이터 (현재 몇 번째 화면인지)
    const [activeSection, setActiveSection] = useState(0)
    const mobileContainerRef = useRef(null)

    // 모바일 가로 스크롤 위치 감지
    const handleMobileScroll = () => {
        if (mobileContainerRef.current) {
            const scrollLeft = mobileContainerRef.current.scrollLeft
            const width = window.innerWidth
            // 절반 이상 넘어가면 페이지 인식
            const index = Math.round(scrollLeft / width)
            setActiveSection(index)
        }
    }

    // 페이지네이션 점 클릭 시 해당 섹션으로 이동
    const handleDotClick = (index) => {
        if (mobileContainerRef.current) {
            const width = window.innerWidth
            mobileContainerRef.current.scrollTo({
                left: width * index,
                behavior: 'smooth'
            })
        }
    }

    useEffect(() => {
        const kakaoSuccess = searchParams.get('kakao') === 'success'
        const email = searchParams.get('email')
        
        if (kakaoSuccess && email) {
            const pendingAuth = localStorage.getItem('pendingKakaoAuth')
            if (pendingAuth) {
                try {
                    const data = JSON.parse(pendingAuth)
                    if (data.from === 'settings' && data.email === email) {
                        localStorage.removeItem('pendingKakaoAuth')
                        navigate(`/settings?kakao=success&email=${encodeURIComponent(email)}`, { replace: true })
                    }
                } catch (e) {
                    console.error(e)
                }
            }
        }
    }, [searchParams, navigate])

    return (
        <div className="landing-wrapper">
            {/* 데스크톱용 배경 패턴 (모바일은 깔끔하게 제거) */}
            <div className="bg-pattern desktop-only"></div>

            {/* [구조 설명]
               desktop-scroll-flow: 데스크톱에서는 일반적인 세로 스크롤 (window scroll)
               mobile-snap-wrapper: 모바일에서는 가로 스와이프 (overflow-x)
            */}
            <div 
                className="main-container" 
                ref={mobileContainerRef}
                onScroll={handleMobileScroll}
            >
                
                {/* 1. Hero Section */}
                <section className="page-section hero-section">
                    <div className="content-box hero-content">
                        <div className="badge">🚀 합격률을 높이는 AI 코치</div>
                        <h1 className="hero-title">
                            면접 준비,<br />
                            <span className="text-highlight">확실한 정답</span>을<br />
                            찾아드립니다.
                        </h1>
                        <p className="hero-desc">
                            하루 10분, 가장 빠른 합격 루틴.<br className="mobile-break"/>
                            지금 무료로 시작하세요.
                        </p>
                        <div className="btn-group">
                            <Link to="/auth?mode=signup" className="btn btn-primary">
                                무료로 시작하기
                            </Link>
                            <Link to="/auth?mode=login" className="btn btn-secondary">
                                로그인
                            </Link>
                        </div>
                    </div>
                </section>

                {/* 2. Features Section (모바일에서 카드가 가로로 배열됨) */}
                <section className="page-section feature-section">
                    <div className="content-box">
                        <div className="section-header">
                            <h2>왜 <span className="text-blue">PrePair</span>인가요?</h2>
                            <p>비효율적인 준비 방식을 혁신했습니다.</p>
                        </div>
                        
                        {/* 모바일에서는 이 그리드가 가로 스크롤 영역이 됩니다 */}
                        <div className="card-scroll-container">
                            {/* Card 1 */}
                            <div className="feature-card">
                                <div className="card-icon">📅</div>
                                <div className="card-info">
                                    <h3>매일 배달되는 질문</h3>
                                    <p>직무별 최신 기출 질문을<br/>매일 아침 받아보세요.</p>
                                </div>
                                <div className="mockup-mini chat-ui">
                                    <span>Q. 본인의 강점은?</span>
                                </div>
                            </div>

                            {/* Card 2 */}
                            <div className="feature-card">
                                <div className="card-icon">🤖</div>
                                <div className="card-info">
                                    <h3>AI 정밀 분석</h3>
                                    <p>답변의 논리성, 감정,<br/>키워드를 즉시 분석합니다.</p>
                                </div>
                                <div className="mockup-mini graph-ui">
                                    <div className="bar" style={{height:'40%'}}></div>
                                    <div className="bar active" style={{height:'80%'}}></div>
                                    <div className="bar" style={{height:'60%'}}></div>
                                </div>
                            </div>

                            {/* Card 3 */}
                            <div className="feature-card">
                                <div className="card-icon">📹</div>
                                <div className="card-info">
                                    <h3>실전 화상 면접</h3>
                                    <p>실제 면접장 환경을 구현한<br/>모의 면접실</p>
                                </div>
                                <div className="mockup-mini cam-ui">
                                    <div className="rec-dot"></div>
                                    <span>REC</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* 모바일용 스크롤 힌트 (카드 더 있다는 표시) */}
                        <div className="mobile-scroll-hint mobile-only">
                            <span>← 옆으로 넘겨보세요 →</span>
                        </div>
                    </div>
                </section>

                {/* 3. Process Section */}
                <section className="page-section process-section">
                    <div className="content-box">
                        <div className="section-header">
                            <h2>합격까지 <span className="text-blue">3단계</span></h2>
                        </div>
                        
                        <div className="step-scroll-container">
                            <div className="step-card">
                                <div className="step-num">01</div>
                                <h3>질문 받기</h3>
                                <p>희망 직무 맞춤 질문이<br/>매일 도착합니다.</p>
                            </div>
                            <div className="step-arrow">→</div>
                            <div className="step-card">
                                <div className="step-num">02</div>
                                <h3>답변 연습</h3>
                                <p>텍스트나 영상으로<br/>자유롭게 답변하세요.</p>
                            </div>
                            <div className="step-arrow">→</div>
                            <div className="step-card">
                                <div className="step-num">03</div>
                                <h3>피드백 확인</h3>
                                <p>AI 코치의 분석으로<br/>부족한 점을 보완하세요.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. CTA Section */}
                <section className="page-section cta-section">
                    <div className="content-box cta-box">
                        <h2>준비된 인재가<br/>되는 시간</h2>
                        <p className="cta-sub">하루 10분이면 충분합니다.<br/>지금 바로 시작하세요.</p>
                        
                        <div className="cta-actions">
                            <Link to="/auth?mode=signup&provider=kakao" className="btn btn-kakao">
                                <span>💬</span> 카카오로 3초 시작
                            </Link>
                            <Link to="/auth?mode=signup" className="btn btn-email">
                                이메일로 가입하기
                            </Link>
                        </div>
                    </div>
                </section>

            </div>

            {/* 모바일 하단 페이지 인디케이터 (네비게이션 점) */}
            <div className="mobile-nav-dots mobile-only">
                {[0, 1, 2, 3].map((idx) => (
                    <div 
                        key={idx} 
                        className={`dot ${activeSection === idx ? 'active' : ''}`}
                        onClick={() => handleDotClick(idx)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                handleDotClick(idx)
                            }
                        }}
                        aria-label={`섹션 ${idx + 1}로 이동`}
                    />
                ))}
            </div>
        </div>
    )
}