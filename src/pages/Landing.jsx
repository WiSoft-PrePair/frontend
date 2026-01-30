import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import '../styles/pages/Landing.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import useMediaQuery from '../hooks/useMediaQuery'

const problems = [
    {
        stat: '71.9%',
        label: '취업 준비생이 면접을 가장 어렵다고 응답',
        source: '안잡핏 면접 실태 조사, 2025'
    },
    {
        stat: '3.2회',
        label: '평균 면접 실패 횟수',
        source: '취업준비생 설문조사'
    },
    {
        stat: '68%',
        label: '면접 준비를 혼자서 하는 취업준비생',
        source: '취업포털 통계'
    }
]

const solutions = [
    {
        icon: '💬',
        title: '매일 텍스트 면접',
        description: '매일 도착하는 맞춤 면접 질문으로 꾸준한 연습',
        details: [
            '개인 맞춤형 질문 추천',
            '실시간 답변 피드백',
            '면접 스킬 향상 추적'
        ]
    },
    {
        icon: '🤖',
        title: 'AI 피드백',
        description: 'AI 기반의 면접 분석 및 개선점 제시',
        details: [
            '답변 내용 분석 및 평가',
            '말투와 톤 분석',
            '구체적인 개선 제안'
        ]
    },
    {
        icon: '🎥',
        title: '3D 화상 면접',
        description: '면접을 위한 가상공간에서 실전 연습',
        details: [
            '실제 면접 환경 시뮬레이션',
            '다양한 면접관 유형 연습',
            '실시간 대응 능력 향상'
        ]
    },
    {
        icon: '🎁',
        title: '리워드 상점',
        description: '포인트를 모아 실제 혜택으로 교환',
        details: [
            '면접 연습으로 포인트 적립',
            '다양한 혜택으로 교환',
            '지속적인 동기 부여'
        ]
    }
]

const features = [
    {
        icon: '🎯',
        title: '맞춤형 학습 경로',
        description: '개인의 취업 목표와 경력에 맞춘 체계적인 면접 준비'
    },
    {
        icon: '⚡',
        title: '실시간 분석',
        description: '면접 답변을 즉시 분석하여 개선점을 바로 확인'
    },
    {
        icon: '📊',
        title: '성장 추적',
        description: '면접 실력 향상을 데이터로 확인하고 목표 달성'
    },
    {
        icon: '🔄',
        title: '다양한 면접 유형',
        description: '기술면접, 인성면접, PT면접 등 다양한 유형 연습'
    }
]

export default function LandingPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const isMobile = useMediaQuery('(max-width: 768px)')
    const [currentSlide, setCurrentSlide] = useState(0)
    const slidesContainerRef = useRef(null)
    const touchStartX = useRef(0)
    const touchEndX = useRef(0)
    const [showScrollIndicator, setShowScrollIndicator] = useState(true)

    // 카카오 인증 완료 후 Settings로 리다이렉트
    useEffect(() => {
        const kakaoSuccess = searchParams.get('kakao') === 'success'
        const email = searchParams.get('email')
        
        if (kakaoSuccess && email) {
            // localStorage에서 Settings에서 왔는지 확인
            const pendingAuth = localStorage.getItem('pendingKakaoAuth')
            if (pendingAuth) {
                try {
                    const data = JSON.parse(pendingAuth)
                    if (data.from === 'settings' && data.email === email) {
                        console.log('[Landing] Settings에서 온 카카오 인증 완료 - Settings로 리다이렉트')
                        localStorage.removeItem('pendingKakaoAuth')
                        navigate(`/settings?kakao=success&email=${encodeURIComponent(email)}`, { replace: true })
                        return
                    }
                } catch (e) {
                    console.error('[Landing] pendingKakaoAuth 파싱 오류:', e)
                }
            }
        }
    }, [searchParams, navigate])

    // 모바일 슬라이드 스와이프 제스처
    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX
    }

    const handleTouchMove = (e) => {
        touchEndX.current = e.touches[0].clientX
    }

    const handleTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return
        
        const distance = touchStartX.current - touchEndX.current
        const minSwipeDistance = 50

        if (distance > minSwipeDistance && currentSlide < 4) {
            // 왼쪽으로 스와이프 (다음 슬라이드)
            setCurrentSlide(currentSlide + 1)
        } else if (distance < -minSwipeDistance && currentSlide > 0) {
            // 오른쪽으로 스와이프 (이전 슬라이드)
            setCurrentSlide(currentSlide - 1)
        }

        touchStartX.current = 0
        touchEndX.current = 0
    }

    // 슬라이드 전환 애니메이션
    useEffect(() => {
        if (isMobile && slidesContainerRef.current) {
            slidesContainerRef.current.style.transform = `translateX(-${currentSlide * 100}vw)`
        }
    }, [currentSlide, isMobile])

    // 데스크톱용 GSAP 애니메이션 (모바일에서는 실행하지 않음)
    useEffect(() => {
        if (isMobile) return
        
        gsap.registerPlugin(ScrollTrigger)
        
        // 헤더 높이 측정 (동적으로 업데이트)
        const getHeaderHeight = () => {
          const header = document.querySelector('.header')
          if (!header) return 0
          // 스크롤 상태에 따라 높이가 변할 수 있으므로 실제 높이 측정
          return header.getBoundingClientRect().height
        }
        
        let headerHeight = getHeaderHeight()
        
        // 리사이즈 및 스크롤 시 헤더 높이 업데이트
        const updateHeaderHeight = () => {
          const newHeight = getHeaderHeight()
          if (newHeight !== headerHeight) {
            headerHeight = newHeight
            // CSS 변수로 헤더 높이 설정 (CSS에서 사용)
            document.documentElement.style.setProperty('--header-height', `${headerHeight}px`)
          }
        }
        
        // 초기 헤더 높이를 CSS 변수로 설정
        document.documentElement.style.setProperty('--header-height', `${headerHeight}px`)
        
        window.addEventListener('resize', updateHeaderHeight)
        window.addEventListener('scroll', updateHeaderHeight, { passive: true })
        
        // 초기 상태 설정 (GSAP가 제어)
        gsap.set('.hero-title-main, .hero-title-sub', { opacity: 0, y: 30 })
        gsap.set('.hero-button', { opacity: 0, y: 30 })
        gsap.set('.problem-title, .problem-subtitle', { opacity: 0, y: 30 })
        gsap.set('.problem-stat-card', { opacity: 0, y: 40 })
        gsap.set('.problem-insight', { opacity: 0, y: 30 })
        gsap.set('.solution-title, .solution-subtitle', { opacity: 0, y: 30 })
        gsap.set('.solution-card', { opacity: 0, y: 40 })
        gsap.set('.feature-title, .feature-subtitle', { opacity: 0, y: 30 })
        gsap.set('.feature-card', { opacity: 0, y: 40 })
        
        // DOM이 완전히 렌더링될 때까지 대기
        const timer = setTimeout(() => {
          // Hero 섹션: 페이지 로드 시 즉시 애니메이션
          const heroTl = gsap.timeline({ defaults: { ease: "power2.out" } })
          heroTl.to('.hero-title-main', {
            opacity: 1,
            y: 0,
            duration: 0.8
          })
          .to('.hero-title-sub', {
            opacity: 1,
            y: 0,
            duration: 0.8
          }, "-=0.6")
          .to('.hero-button', {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.1
          }, "-=0.4")
        }, 50)

        // Problem 섹션 애니메이션
        gsap.to('.problem-title, .problem-subtitle', {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power2.out",
          stagger: 0.1,
          scrollTrigger: {
            trigger: '.problem-section',
            start: 'top 80%',
            once: true
          }
        })

        gsap.to('.problem-stat-card', {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power2.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: '.problem-section',
            start: 'top 80%',
            once: true
          }
        })

        gsap.to('.problem-insight', {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power2.out",
          delay: 0.3,
          scrollTrigger: {
            trigger: '.problem-section',
            start: 'top 80%',
            once: true
          }
        })

        // Solution 섹션 애니메이션
        gsap.to('.solution-title, .solution-subtitle', {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power2.out",
          stagger: 0.1,
          scrollTrigger: {
            trigger: '.solution-section',
            start: 'top 80%',
            once: true
          }
        })

        // 카드 애니메이션
        gsap.to('.solution-card', {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power2.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: '.solution-section',
            start: 'top 80%',
            once: true
          }
        })

        // Feature 섹션 애니메이션
        gsap.to('.feature-title, .feature-subtitle', {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power2.out",
          stagger: 0.1,
          scrollTrigger: {
            trigger: '.feature-section',
            start: 'top 80%',
            once: true
          }
        })

        // Feature 카드 애니메이션
        gsap.to('.feature-card', {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power2.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: '.feature-section',
            start: 'top 80%',
            once: true
          }
        })


        // 스크롤 스냅 (헤더 높이 고려)
        const sections = gsap.utils.toArray('.hero-section, .problem-section, .solution-section, .feature-section')
        let currentSection = 0
        let isScrolling = false
        
        // 각 섹션의 실제 스크롤 위치 계산 (정확히 뷰포트에 맞춤)
        const getSectionScrollPosition = (index) => {
          if (!sections[index]) return 0
          
          // 헤더 높이를 최신으로 업데이트
          updateHeaderHeight()
          
          // 각 섹션이 정확히 100vh 높이이므로, 인덱스 * 뷰포트 높이로 계산
          // 헤더가 sticky이므로 섹션의 시작 위치는 정확히 index * windowHeight
          // 이렇게 하면 각 섹션이 정확히 뷰포트에 맞춰짐
          const viewportHeight = window.innerHeight
          const position = index * viewportHeight
          
          // 정확한 정수 값으로 반환
          return Math.round(position)
        }

        const goToSection = (index) => {
          if (isScrolling || !sections[index]) return
          isScrolling = true

          // 스크롤 위치 계산 (헤더 높이 고려하지 않음)
          const targetY = getSectionScrollPosition(index)
          
          // 정확한 스크롤 위치로 이동 (소수점 제거)
          const exactY = Math.round(targetY)
          
          gsap.to({ scrollY: window.scrollY }, {
            scrollY: Math.max(0, exactY),
            duration: 1.2,
            ease: "power2.inOut",
            onUpdate: function() {
              window.scrollTo(0, Math.round(this.targets()[0].scrollY))
            },
            onComplete: () => {
              // 완료 후 정확한 위치로 재조정
              window.scrollTo(0, exactY)
              isScrolling = false
            }
          })
        }

        const handleWheel = (e) => {
          if (isScrolling) {
            e.preventDefault()
            return
          }

          const delta = e.deltaY
          
          if (delta > 0 && currentSection < sections.length - 1) {

            currentSection++
            goToSection(currentSection)
            e.preventDefault()
          } else if (delta < 0 && currentSection > 0) {
            
            currentSection--
            goToSection(currentSection)
            e.preventDefault()
          }
        }

        
        window.addEventListener('wheel', handleWheel, { passive: false })

        
        const updateCurrentSection = () => {
          const scrollY = window.scrollY
          const windowHeight = window.innerHeight
          
          // 스크롤 위치를 기반으로 현재 섹션 계산
          // 각 섹션이 정확히 windowHeight 높이를 차지하므로 간단하게 계산
          // 반올림을 사용하여 섹션 전환 시점을 정확히 맞춤
          // 헤더 높이는 고려하지 않음 (섹션이 100vh로 설정되어 있으므로)
          const calculatedSection = Math.round(scrollY / windowHeight)
          
          // 섹션 인덱스 범위 제한
          const newSection = Math.max(0, Math.min(calculatedSection, sections.length - 1))
          
          // 섹션이 변경되었을 때만 업데이트
          if (newSection !== currentSection && !isScrolling) {
            // 스크롤 위치가 정확하지 않으면 조정
            const expectedScrollY = newSection * windowHeight
            const scrollDiff = Math.abs(scrollY - expectedScrollY)
            
            // 10px 이상 차이나면 자동으로 정확한 위치로 조정
            if (scrollDiff > 10) {
              window.scrollTo(0, expectedScrollY)
            }
            
            currentSection = newSection
          }
        }
        updateCurrentSection()

        
        let scrollTimeout
        const handleScroll = () => {
          if (isScrolling) return
          
          // 첫 번째 섹션을 벗어나면 스크롤 인디케이터 숨기기
          if (window.scrollY > window.innerHeight * 0.3) {
            setShowScrollIndicator(false)
          } else {
            setShowScrollIndicator(true)
          }
          
          clearTimeout(scrollTimeout)
          scrollTimeout = setTimeout(() => {
            if (!isScrolling) {
              updateCurrentSection()
              
              // 스크롤 위치가 정확하지 않으면 자동으로 조정
              const scrollY = window.scrollY
              const windowHeight = window.innerHeight
              const expectedSection = Math.round(scrollY / windowHeight)
              const expectedScrollY = expectedSection * windowHeight
              const scrollDiff = Math.abs(scrollY - expectedScrollY)
              
              // 5px 이상 차이나면 자동으로 정확한 위치로 조정
              if (scrollDiff > 5 && scrollDiff < 50) {
                window.scrollTo({
                  top: expectedScrollY,
                  behavior: 'auto'
                })
              }
            }
          }, 50)
        }
        window.addEventListener('scroll', handleScroll, { passive: true })
        
        return () => {
          clearTimeout(timer)
          ScrollTrigger.getAll().forEach(trigger => trigger.kill())
          window.removeEventListener('wheel', handleWheel)
          window.removeEventListener('scroll', handleScroll)
          window.removeEventListener('resize', updateHeaderHeight)
          window.removeEventListener('scroll', updateHeaderHeight)
        }
      }, [isMobile])

    // 모바일 랜딩 페이지 렌더링
    if (isMobile) {
        return (
            <div className="mobile-landing">
                <div 
                    className="mobile-slides-container"
                    ref={slidesContainerRef}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{
                        transform: `translateX(-${currentSlide * 100}vw)`,
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    {/* 화면 1: Hero */}
                    <div className="mobile-slide mobile-slide--hero">
                        <div className="mobile-hero-robot">
                            <img src={logoUrl} alt="PrePair AI" />
                        </div>
                        <h1 className="mobile-hero-title">완벽한 면접 준비, AI 파트너</h1>
                        <Link to="/auth?mode=signup" className="mobile-hero-button">
                            시작하기
                        </Link>
                        <div className="mobile-pagination">
                            {[0, 1, 2, 3, 4].map((index) => (
                                <button
                                    key={index}
                                    className={`mobile-pagination-dot ${currentSlide === index ? 'mobile-pagination-dot--active' : ''}`}
                                    onClick={() => setCurrentSlide(index)}
                                    aria-label={`슬라이드 ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* 화면 2: Problem */}
                    <div className="mobile-slide mobile-slide--problem">
                        <h2 className="mobile-problem-title">막막한 면접, 언제까지?</h2>
                        <div className="mobile-problem-robot">
                            <img src={logoUrl} alt="PrePair AI" />
                        </div>
                        <div className="mobile-problem-stat">
                            <div className="mobile-problem-stat-number">71.9%</div>
                            <div className="mobile-problem-stat-label">어려움</div>
                        </div>
                        <div className="mobile-pagination">
                            {[0, 1, 2, 3, 4].map((index) => (
                                <button
                                    key={index}
                                    className={`mobile-pagination-dot ${currentSlide === index ? 'mobile-pagination-dot--active' : ''}`}
                                    onClick={() => setCurrentSlide(index)}
                                    aria-label={`슬라이드 ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* 화면 3: Solution */}
                    <div className="mobile-slide mobile-slide--solution">
                        <h2 className="mobile-solution-title">핵심 기능</h2>
                        <div className="mobile-solution-cards">
                            <div className="mobile-solution-card">
                                <div className="mobile-solution-card-icon">🎥</div>
                                <h3 className="mobile-solution-card-title">3D 면접</h3>
                                <p className="mobile-solution-card-description">실전 같은 3D 면접 연습</p>
                            </div>
                            <div className="mobile-solution-card">
                                <div className="mobile-solution-card-icon">🤖</div>
                                <h3 className="mobile-solution-card-title">AI 피드</h3>
                                <p className="mobile-solution-card-description">AI 기반 맞춤 피드백</p>
                            </div>
                        </div>
                        <div className="mobile-pagination">
                            {[0, 1, 2, 3, 4].map((index) => (
                                <button
                                    key={index}
                                    className={`mobile-pagination-dot ${currentSlide === index ? 'mobile-pagination-dot--active' : ''}`}
                                    onClick={() => setCurrentSlide(index)}
                                    aria-label={`슬라이드 ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* 화면 4: Preview */}
                    <div className="mobile-slide mobile-slide--preview">
                        <h2 className="mobile-preview-title">실전 같은 3D 면접</h2>
                        <div className="mobile-preview-scene">
                            <div className="mobile-preview-scene-content">
                                {/* 3D 씬 미리보기 영역 - 나중에 실제 3D 씬으로 교체 가능 */}
                                <div style={{ 
                                    width: '100%', 
                                    height: '100%', 
                                    background: 'linear-gradient(135deg, rgba(102, 153, 255, 0.1) 0%, rgba(255, 182, 193, 0.1) 100%)',
                                    borderRadius: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#64748b',
                                    fontSize: '0.875rem'
                                }}>
                                    3D 면접 씬 미리보기
                                </div>
                            </div>
                        </div>
                        <Link to="/coach" className="mobile-preview-button">
                            체험해보기
                        </Link>
                        <div className="mobile-pagination">
                            {[0, 1, 2, 3, 4].map((index) => (
                                <button
                                    key={index}
                                    className={`mobile-pagination-dot ${currentSlide === index ? 'mobile-pagination-dot--active' : ''}`}
                                    onClick={() => setCurrentSlide(index)}
                                    aria-label={`슬라이드 ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* 화면 5: CTA */}
                    <div className="mobile-slide mobile-slide--cta">
                        <div className="mobile-cta-robot">
                            <img src={logoUrl} alt="PrePair AI" />
                        </div>
                        <h2 className="mobile-cta-title">면접 준비를 습관으로!</h2>
                        <div className="mobile-cta-buttons">
                            <Link to="/auth?mode=signup&provider=kakao" className="mobile-cta-button mobile-cta-button--kakao">
                                카카오로 시작하기
                            </Link>
                            <Link to="/auth?mode=signup" className="mobile-cta-button mobile-cta-button--email">
                                이메일로 가입
                            </Link>
                            <Link to="/auth?mode=login" className="mobile-cta-login-link">
                                로그인
                            </Link>
                        </div>
                        <div className="mobile-pagination">
                            {[0, 1, 2, 3, 4].map((index) => (
                                <button
                                    key={index}
                                    className={`mobile-pagination-dot ${currentSlide === index ? 'mobile-pagination-dot--active' : ''}`}
                                    onClick={() => setCurrentSlide(index)}
                                    aria-label={`슬라이드 ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // 데스크톱 랜딩 페이지 렌더링
    return (
        <div className="landing-new">
            {/* Section 1: Hero - 캐릭터와 서비스 이름 */}
            <section className="hero-section" data-section="hero">
                <div className="hero-container">
                    <h1 className="hero-title">
                        <span className="hero-title-main">PrePair</span>
                        <span className="hero-title-sub">완벽한 면접 준비, AI 파트너</span>
                    </h1>
                    <div className="hero-buttons">
                        <Link to="/auth?mode=login" className="hero-button hero-button--secondary">
                            로그인
                        </Link>
                        <Link to="/auth?mode=signup" className="hero-button hero-button--primary">
                            지금 시작하기
                        </Link>
                    </div>
                </div>
                {/* 스크롤 인디케이터 */}
                {showScrollIndicator && (
                    <div className="scroll-indicator" onClick={() => {
                        const problemSection = document.querySelector('.problem-section')
                        if (problemSection) {
                            problemSection.scrollIntoView({ behavior: 'smooth' })
                        }
                    }}>
                        <div className="scroll-indicator-text">더 알아보기</div>
                        <div className="scroll-indicator-arrow">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                    </div>
                )}
            </section>

            {/* Section 2: Problem - 문제 상황 */}
            <section className="problem-section" data-section="problem">
                <div className="problem-container">
                    <h2 className="problem-title">막막한 면접, 언제까지?</h2>
                    <p className="problem-subtitle">취업 준비생들이 겪는 면접의 현실</p>
                    <div className="problem-stats-grid">
                        {problems.map((problem, idx) => (
                            <div key={idx} className="problem-stat-card">
                                <div className="stat-number">{problem.stat}</div>
                                <div className="stat-label">{problem.label}</div>
                                <div className="stat-source">{problem.source}</div>
                            </div>
                        ))}
                    </div>
                    <div className="problem-insight">
                        <p>면접 준비는 혼자서 하기 어렵습니다. 체계적인 연습과 피드백이 필요합니다.</p>
                    </div>
                </div>
            </section>

            {/* Section 3: Solution - 솔루션 카드 */}
            <section className="solution-section" data-section="solution">
                <div className="solution-container">
                    <div className="solution-header">
                        <h2 className="solution-title">PrePair로 면접 준비를 시작하세요</h2>
                        <p className="solution-subtitle">AI 기반 맞춤형 면접 코칭으로 실전 감각을 기르세요</p>
                    </div>
                    <div className="solution-content">
                        <div className="solution-grid">
                            {solutions.map((solution, idx) => (
                                <div key={idx} className="solution-card" data-card-index={idx}>
                                    <div className="solution-card-icon">{solution.icon}</div>
                                    <h3 className="solution-card-title">{solution.title}</h3>
                                    <p className="solution-card-description">{solution.description}</p>
                                    <ul className="solution-card-details">
                                        {solution.details.map((detail, detailIdx) => (
                                            <li key={detailIdx}>{detail}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 4: Features - 서비스 특장점 */}
            <section className="feature-section" data-section="feature">
                <div className="feature-container">
                    <div className="feature-header">
                        <h2 className="feature-title">왜 PrePair인가요?</h2>
                        <p className="feature-subtitle">다른 면접 준비 서비스와 차별화된 PrePair만의 특장점</p>
                    </div>
                    <div className="feature-content">
                        <div className="feature-grid">
                            {features.map((feature, idx) => (
                                <div key={idx} className="feature-card" data-card-index={idx}>
                                    <div className="feature-card-icon">{feature.icon}</div>
                                    <h3 className="feature-card-title">{feature.title}</h3>
                                    <p className="feature-card-description">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
