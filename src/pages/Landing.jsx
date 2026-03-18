import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import '../styles/pages/Landing.css'

gsap.registerPlugin(ScrollTrigger)

export default function LandingPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    
    // 모바일 섹션 인디케이터 (현재 몇 번째 화면인지)
    const [activeSection, setActiveSection] = useState(0)
    const mobileContainerRef = useRef(null)
    
    // GSAP 애니메이션을 위한 refs
    const heroRef = useRef(null)
    const badgeRef = useRef(null)
    const titleRef = useRef(null)
    const descRef = useRef(null)
    const btnGroupRef = useRef(null)
    const featureCardsRef = useRef([])
    const stepCardsRef = useRef([])
    const ctaRef = useRef(null)
    const bgPatternRef = useRef(null)

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
        // 1) 카카오 OAuth 콜백이 랜딩으로 떨어진 경우 → /auth로 다시 전달
        // - 일반적으로는 쿼리(?code=...)로 오지만, 환경에 따라 해시(#code=...)로 오는 케이스도 방어
        const queryCode = searchParams.get('code')
        const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
        const hashCode = hashParams.get('code')
        const code = queryCode || hashCode

        if (code) {
            navigate(`/auth?mode=signup&code=${encodeURIComponent(code)}`, { replace: true })
            return
        }

        // 2) Settings 페이지에서 카카오 링크 연동 완료 후 돌아온 경우 처리
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

    // GSAP 애니메이션 설정
    useEffect(() => {
        const isMobile = window.innerWidth <= 768
        
        // 배경 패턴 애니메이션
        if (bgPatternRef.current) {
            gsap.to(bgPatternRef.current, {
                backgroundPosition: '64px 64px',
                duration: 20,
                repeat: -1,
                ease: 'none'
            })
        }

        // 초기 상태 설정 (애니메이션 전에 요소들을 숨김)
        const heroElements = [badgeRef.current, titleRef.current, descRef.current].filter(Boolean)
        if (heroElements.length > 0) {
            gsap.set(heroElements, {
                opacity: 0,
                y: 30
            })
        }

        if (btnGroupRef.current && btnGroupRef.current.children) {
            gsap.set(Array.from(btnGroupRef.current.children), {
                opacity: 0,
                y: 20
            })
        }

        featureCardsRef.current.forEach((card) => {
            if (card) {
                gsap.set(card, {
                    opacity: 0,
                    y: 60,
                    scale: 0.9
                })
            }
        })

        stepCardsRef.current.forEach((card) => {
            if (card) {
                gsap.set(card, {
                    opacity: 0,
                    x: 50,
                    rotation: 5
                })
            }
        })

        if (ctaRef.current) {
            gsap.set(ctaRef.current, {
                opacity: 0,
                scale: 0.95
            })
        }

        if (isMobile) {
            // 모바일: Hero 섹션 순차 등장
            const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } })
            
            if (badgeRef.current) {
                gsap.set(badgeRef.current, { y: -20, scale: 0.9 })
                heroTl.to(badgeRef.current, {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.6
                })
            }
            
            if (titleRef.current) {
                gsap.set(titleRef.current, { y: 30 })
                heroTl.to(titleRef.current, {
                    opacity: 1,
                    y: 0,
                    duration: 0.7
                }, '-=0.3')
            }
            
            if (descRef.current) {
                gsap.set(descRef.current, { y: 20 })
                heroTl.to(descRef.current, {
                    opacity: 1,
                    y: 0,
                    duration: 0.6
                }, '-=0.4')
            }

            // 모바일: IntersectionObserver로 카드들이 화면에 들어올 때 애니메이션
            const observerOptions = {
                root: mobileContainerRef.current,
                rootMargin: '0px',
                threshold: 0.2
            }

            const animateOnIntersect = (element, index, delay = 0, xOffset = 50) => {
                if (!element) return
                
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            gsap.to(entry.target, {
                                opacity: 1,
                                x: 0,
                                scale: 1,
                                duration: 0.8,
                                delay: delay,
                                ease: 'power2.out'
                            })
                            observer.unobserve(entry.target)
                        }
                    })
                }, observerOptions)
                
                observer.observe(element)
            }

            // 모바일: 카드들이 스크롤 시 나타나도록
            featureCardsRef.current.forEach((card, index) => {
                if (card) {
                    gsap.set(card, { x: index % 2 === 0 ? 50 : -50 })
                    animateOnIntersect(card, index, index * 0.1)
                }
            })

            // 모바일: 스텝 카드들
            stepCardsRef.current.forEach((card, index) => {
                if (card) {
                    gsap.set(card, { x: index % 2 === 0 ? -30 : 30 })
                    animateOnIntersect(card, index, index * 0.15)
                }
            })

            // 모바일: CTA 섹션
            if (ctaRef.current) {
                animateOnIntersect(ctaRef.current, 0, 0.2)
            }
        } else {
            // 데스크톱: Hero 섹션 애니메이션
            const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } })
            
            if (badgeRef.current) {
                gsap.set(badgeRef.current, { y: -20, scale: 0.9 })
                heroTl.to(badgeRef.current, {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.6
                })
            }
            
            if (titleRef.current) {
                gsap.set(titleRef.current, { y: 50 })
                heroTl.to(titleRef.current, {
                    opacity: 1,
                    y: 0,
                    duration: 0.8
                }, '-=0.3')
            }
            
            if (descRef.current) {
                gsap.set(descRef.current, { y: 30 })
                heroTl.to(descRef.current, {
                    opacity: 1,
                    y: 0,
                    duration: 0.7
                }, '-=0.4')
            }
            
            if (btnGroupRef.current) {
                heroTl.to(btnGroupRef.current.children, {
                    opacity: 1,
                    y: 0,
                    duration: 0.6,
                    stagger: 0.15
                }, '-=0.3')
            }

            // Features 섹션: ScrollTrigger로 카드 순차 등장
            featureCardsRef.current.forEach((card, index) => {
                if (card) {
                    gsap.to(card, {
                        scrollTrigger: {
                            trigger: card,
                            start: 'top 80%',
                            end: 'top 50%',
                            toggleActions: 'play none none reverse'
                        },
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        duration: 0.8,
                        delay: index * 0.15,
                        ease: 'back.out(1.2)'
                    })
                }
            })

            // Process 섹션: 단계별 순차 등장
            stepCardsRef.current.forEach((card, index) => {
                if (card) {
                    const xOffset = index % 2 === 0 ? -50 : 50
                    const rotation = index % 2 === 0 ? -5 : 5
                    gsap.set(card, { x: xOffset, rotation: rotation })
                    
                    gsap.to(card, {
                        scrollTrigger: {
                            trigger: card,
                            start: 'top 85%',
                            toggleActions: 'play none none reverse'
                        },
                        opacity: 1,
                        x: 0,
                        rotation: 0,
                        duration: 0.7,
                        delay: index * 0.2,
                        ease: 'power3.out'
                    })
                }
            })

            // CTA 섹션: 페이드인 + 스케일
            if (ctaRef.current) {
                gsap.to(ctaRef.current, {
                    scrollTrigger: {
                        trigger: ctaRef.current,
                        start: 'top 80%',
                        toggleActions: 'play none none reverse'
                    },
                    opacity: 1,
                    scale: 1,
                    duration: 1,
                    ease: 'power2.out'
                })

                // CTA 버튼들에 펄스 효과
                const ctaButtons = ctaRef.current?.querySelectorAll('.btn')
                if (ctaButtons && ctaButtons.length > 0) {
                    gsap.to(ctaButtons, {
                        scale: 1.02,
                        duration: 2,
                        repeat: -1,
                        yoyo: true,
                        ease: 'power1.inOut',
                        stagger: 0.3,
                        delay: 1
                    })
                }
            }
        }

        // 호버 애니메이션 강화
        featureCardsRef.current.forEach((card) => {
            if (card) {
                card.addEventListener('mouseenter', () => {
                    gsap.to(card, {
                        scale: 1.03,
                        y: -10,
                        duration: 0.3,
                        ease: 'power2.out'
                    })
                })
                
                card.addEventListener('mouseleave', () => {
                    gsap.to(card, {
                        scale: 1,
                        y: 0,
                        duration: 0.3,
                        ease: 'power2.out'
                    })
                })
            }
        })

        // ScrollTrigger 새로고침 (레이아웃 변경 후)
        ScrollTrigger.refresh()

        return () => {
            ScrollTrigger.getAll().forEach(trigger => trigger.kill())
        }
    }, [])

    return (
        <div className="landing-wrapper">
            {/* 데스크톱용 배경 패턴 (모바일은 깔끔하게 제거) */}
            <div className="bg-pattern desktop-only" ref={bgPatternRef}></div>

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
                <section className="page-section hero-section" ref={heroRef}>
                    <div className="content-box hero-content">
                        <div className="badge" ref={badgeRef}>🚀 합격률을 높이는 AI 코치</div>
                        <h1 className="hero-title" ref={titleRef}>
                            면접 준비,<br />
                            <span className="text-highlight">확실한 정답</span>을<br />
                            찾아드립니다.
                        </h1>
                        <p className="hero-desc" ref={descRef}>
                            하루 10분, 가장 빠른 합격 루틴.<br className="mobile-break"/>
                            지금 무료로 시작하세요.
                        </p>
                        <div className="btn-group" ref={btnGroupRef}>
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
                            <div 
                                className="feature-card" 
                                ref={el => featureCardsRef.current[0] = el}
                            >
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
                            <div 
                                className="feature-card" 
                                ref={el => featureCardsRef.current[1] = el}
                            >
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
                            <div 
                                className="feature-card" 
                                ref={el => featureCardsRef.current[2] = el}
                            >
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
                            <div 
                                className="step-card" 
                                ref={el => stepCardsRef.current[0] = el}
                            >
                                <div className="step-num">01</div>
                                <h3>질문 받기</h3>
                                <p>희망 직무 맞춤 질문이<br/>매일 도착합니다.</p>
                            </div>
                            <div className="step-arrow">→</div>
                            <div 
                                className="step-card" 
                                ref={el => stepCardsRef.current[1] = el}
                            >
                                <div className="step-num">02</div>
                                <h3>답변 연습</h3>
                                <p>텍스트나 영상으로<br/>자유롭게 답변하세요.</p>
                            </div>
                            <div className="step-arrow">→</div>
                            <div 
                                className="step-card" 
                                ref={el => stepCardsRef.current[2] = el}
                            >
                                <div className="step-num">03</div>
                                <h3>피드백 확인</h3>
                                <p>AI 코치의 분석으로<br/>부족한 점을 보완하세요.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. CTA Section */}
                <section className="page-section cta-section">
                    <div className="content-box cta-box" ref={ctaRef}>
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