import { useEffect } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { useAppState } from '../context/AppStateContext'
import '../styles/components/pro-upgrade.css'

export default function ProUpgradeModal({ isOpen, onClose, feature = 'all' }) {
  // 모달이 열릴 때 배경 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.overflow = 'hidden'
    }

    return () => {
      const scrollY = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      window.scrollTo(0, parseInt(scrollY || '0') * -1)
    }
  }, [isOpen])

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])
  const { PRO_PLANS, upgradeToPro, canUseMockInterview, canUseJobPost } = useAppState()

  const mockUsage = canUseMockInterview()
  const jobPostUsage = canUseJobPost()

  const featureInfo = {
    all: {
      title: 'Pro 플랜',
      icon: '✨',
      description: '모의 면접과 채용 공고 분석을 무제한으로 이용하세요',
      usage: null,
    },
    mock: {
      title: '모의 면접',
      icon: '🎙️',
      description: 'AI 면접관과 실시간 음성 대화로 실전처럼 면접을 준비하세요',
      usage: mockUsage,
    },
    jobpost: {
      title: '채용 공고 분석',
      icon: '📋',
      description: '채용 공고를 분석해 맞춤형 면접 질문을 받아보세요',
      usage: jobPostUsage,
    },
  }

  const currentFeature = featureInfo[feature] || featureInfo.all
  const freePlan = PRO_PLANS.free
  const proPlan = PRO_PLANS.pro

  const handleUpgrade = () => {
    upgradeToPro()
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          className="pro-modal__overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <Motion.div
            className="pro-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="pro-modal__close" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="pro-modal__header">
              <div className="pro-modal__icon-wrapper">
                <span className="pro-modal__icon">{currentFeature.icon}</span>
              </div>
              <h2 className="pro-modal__title">
                {feature === 'all' ? (
                  <>PrePair <span className="pro-modal__title-highlight">Pro</span></>
                ) : (
                  <>{currentFeature.title} <span className="pro-modal__pro-badge">PRO</span></>
                )}
              </h2>
              <p className="pro-modal__subtitle">{currentFeature.description}</p>
            </div>

            {/* Pro Features Highlight */}
            {feature === 'all' && (
              <div className="pro-modal__highlights">
                <div className="pro-modal__highlight">
                  <div className="pro-modal__highlight-icon">🎙️</div>
                  <div className="pro-modal__highlight-content">
                    <span className="pro-modal__highlight-title">모의 면접 무제한</span>
                    <span className="pro-modal__highlight-desc">AI 면접관과 실전처럼 연습</span>
                  </div>
                  <span className="pro-modal__highlight-status">
                    {mockUsage.remaining > 0 ? `${mockUsage.remaining}회 남음` : '체험 완료'}
                  </span>
                </div>
                <div className="pro-modal__highlight">
                  <div className="pro-modal__highlight-icon">📋</div>
                  <div className="pro-modal__highlight-content">
                    <span className="pro-modal__highlight-title">공고 분석 무제한</span>
                    <span className="pro-modal__highlight-desc">맞춤형 면접 질문 생성</span>
                  </div>
                  <span className="pro-modal__highlight-status">
                    {jobPostUsage.remaining > 0 ? `${jobPostUsage.remaining}회 남음` : '체험 완료'}
                  </span>
                </div>
                <div className="pro-modal__highlight">
                  <div className="pro-modal__highlight-icon">📊</div>
                  <div className="pro-modal__highlight-content">
                    <span className="pro-modal__highlight-title">상세 분석 리포트</span>
                    <span className="pro-modal__highlight-desc">심층 피드백으로 빠른 성장</span>
                  </div>
                  <span className="pro-modal__highlight-badge">Pro</span>
                </div>
              </div>
            )}

            {/* Usage Status (for specific feature) */}
            {feature !== 'all' && (
              <>
                {!currentFeature.usage?.allowed && (
                  <div className="pro-modal__usage-alert">
                    <span className="pro-modal__usage-icon">⚠️</span>
                    <span>이번 달 무료 체험 횟수를 모두 사용했습니다</span>
                  </div>
                )}

                {currentFeature.usage?.allowed && currentFeature.usage?.remaining > 0 && (
                  <div className="pro-modal__usage-info">
                    <span className="pro-modal__usage-icon">💡</span>
                    <span>무료 체험 <strong>{currentFeature.usage.remaining}회</strong> 남음 (월 {currentFeature.usage.limit}회)</span>
                  </div>
                )}
              </>
            )}

            {/* Pricing */}
            <div className="pro-modal__pricing">
              <div className="pro-modal__pricing-card">
                <div className="pro-modal__pricing-header">
                  <span className="pro-modal__pricing-label">Pro 플랜</span>
                  <div className="pro-modal__pricing-price">
                    <span className="pro-modal__pricing-amount">{proPlan.price.toLocaleString()}</span>
                    <span className="pro-modal__pricing-unit">원/월</span>
                  </div>
                </div>
                <button className="pro-modal__pricing-btn" onClick={handleUpgrade}>
                  Pro 시작하기
                </button>
                <p className="pro-modal__pricing-note">언제든지 취소 가능</p>
              </div>
            </div>

            {/* Plan Comparison */}
            <div className="pro-modal__plans-compare">
              <h4 className="pro-modal__plans-compare-title">플랜 비교</h4>
              <div className="pro-modal__plans-cards">
                {/* Free Plan */}
                <div className="pro-modal__plan-card pro-modal__plan-card--free">
                  <div className="pro-modal__plan-header">
                    <span className="pro-modal__plan-name">Free</span>
                    <div className="pro-modal__plan-price">
                      <span className="pro-modal__plan-amount">0</span>
                      <span className="pro-modal__plan-unit">원/월</span>
                    </div>
                  </div>
                  <ul className="pro-modal__plan-features">
                    <li className="pro-modal__plan-feature">
                      <span className="pro-modal__plan-check">✓</span>
                      <span>일일 면접 질문</span>
                    </li>
                    <li className="pro-modal__plan-feature">
                      <span className="pro-modal__plan-check">✓</span>
                      <span>AI 피드백</span>
                    </li>
                    <li className="pro-modal__plan-feature">
                      <span className="pro-modal__plan-limit">3회</span>
                      <span>모의 면접 (월)</span>
                    </li>
                    <li className="pro-modal__plan-feature">
                      <span className="pro-modal__plan-limit">3회</span>
                      <span>채용 공고 분석 (월)</span>
                    </li>
                    <li className="pro-modal__plan-feature pro-modal__plan-feature--disabled">
                      <span className="pro-modal__plan-x">✕</span>
                      <span>상세 분석 리포트</span>
                    </li>
                    <li className="pro-modal__plan-feature pro-modal__plan-feature--disabled">
                      <span className="pro-modal__plan-x">✕</span>
                      <span>역량 요약 분석</span>
                    </li>
                  </ul>
                </div>

                {/* Pro Plan */}
                <div className="pro-modal__plan-card pro-modal__plan-card--pro">
                  <div className="pro-modal__plan-badge">추천</div>
                  <div className="pro-modal__plan-header">
                    <span className="pro-modal__plan-name">Pro</span>
                    <div className="pro-modal__plan-price">
                      <span className="pro-modal__plan-amount">{proPlan.price.toLocaleString()}</span>
                      <span className="pro-modal__plan-unit">원/월</span>
                    </div>
                  </div>
                  <ul className="pro-modal__plan-features">
                    <li className="pro-modal__plan-feature">
                      <span className="pro-modal__plan-check pro-modal__plan-check--pro">✓</span>
                      <span>일일 면접 질문</span>
                    </li>
                    <li className="pro-modal__plan-feature">
                      <span className="pro-modal__plan-check pro-modal__plan-check--pro">✓</span>
                      <span>AI 피드백</span>
                    </li>
                    <li className="pro-modal__plan-feature">
                      <span className="pro-modal__plan-unlimited">무제한</span>
                      <span>모의 면접</span>
                    </li>
                    <li className="pro-modal__plan-feature">
                      <span className="pro-modal__plan-unlimited">무제한</span>
                      <span>채용 공고 분석</span>
                    </li>
                    <li className="pro-modal__plan-feature">
                      <span className="pro-modal__plan-check pro-modal__plan-check--pro">✓</span>
                      <span>상세 분석 리포트</span>
                    </li>
                    <li className="pro-modal__plan-feature">
                      <span className="pro-modal__plan-check pro-modal__plan-check--pro">✓</span>
                      <span>역량 요약 분석</span>
                    </li>
                  </ul>
                  <button className="pro-modal__plan-btn" onClick={handleUpgrade}>
                    Pro 시작하기
                  </button>
                </div>
              </div>
            </div>
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  )
}

// Pro 배지 컴포넌트
export function ProBadge({ size = 'sm' }) {
  return (
    <span className={`pro-badge pro-badge--${size}`}>
      PRO
    </span>
  )
}

// Pro 탭 컴포넌트
export function ProTab({ children, isActive, onClick, feature, className = '' }) {
  const { isPro } = useAppState()

  return (
    <button
      className={`coach__tab ${isActive ? 'coach__tab--active' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
      {!isPro && (
        <span className="coach__tab-pro">PRO</span>
      )}
    </button>
  )
}
