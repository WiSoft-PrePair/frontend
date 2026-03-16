import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { useAppState } from '../../context/AppStateContext'
import useMediaQuery from '../../hooks/useMediaQuery'
import ProUpgradeModal from '../../components/ProUpgradeModal'
import '../../styles/pages/Rewards.css'
import '../../styles/components/pro-upgrade.css'

const scoringCategories = [
  { id: 'structure', label: '구조화', icon: '🏗️' },
  { id: 'clarity', label: '명료성', icon: '💡' },
  { id: 'depth', label: '깊이', icon: '🔍' },
  { id: 'story', label: '스토리텔링', icon: '📖' },
]

const getScoreColor = (score) => {
  if (score >= 85) return 'var(--color-success)'
  if (score >= 70) return 'var(--color-blue-500)'
  if (score >= 50) return 'var(--color-warning)'
  return 'var(--color-error)'
}

// Activity Heatmap Component (Desktop) - GitHub 스타일 과거 365일
function ActivityHeatmap({ activity }) {
  const today = new Date()
  const todayDayOfWeek = today.getDay() // 0 = 일요일

  // 오늘 기준 과거 365일 계산
  // 마지막 주는 오늘까지만, 첫 주는 365일 전부터 시작
  const totalDays = 365
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - totalDays + 1)
  const startDayOfWeek = startDate.getDay()

  // 주 단위로 그룹화 (일요일 시작)
  // 첫 주의 시작 요일 전은 빈 칸
  const weeks = []
  let currentWeek = Array(startDayOfWeek).fill(null) // 첫 주 앞부분 빈 칸

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)

    // activity 데이터에서 해당 날짜의 연습 횟수 가져오기
    const weekIndex = Math.floor(
      (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
    )
    const dayIndex = date.getDay()
    const count = activity?.[weekIndex]?.[dayIndex] || 0

    currentWeek.push({ count, date: new Date(date) })

    // 토요일이면 주 마감
    if (date.getDay() === 6) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  // 마지막 주 처리 (토요일이 아닌 날에 끝난 경우)
  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }

  const getLevel = (count) => {
    if (count === 0) return 0
    if (count === 1) return 1
    if (count === 2) return 2
    if (count === 3) return 3
    return 4
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="heatmap">
      <div className="heatmap__grid">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="heatmap__week">
            {week.map((cell, dayIdx) => (
              cell === null ? (
                <div key={dayIdx} className="heatmap__cell heatmap__cell--empty" />
              ) : (
                <div
                  key={dayIdx}
                  className={`heatmap__cell heatmap__cell--level-${getLevel(cell.count)}`}
                  title={`${formatDate(cell.date)}: ${cell.count}회 연습`}
                />
              )
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap__legend">
        <span>Less</span>
        <div className="heatmap__cell heatmap__cell--level-0" />
        <div className="heatmap__cell heatmap__cell--level-1" />
        <div className="heatmap__cell heatmap__cell--level-2" />
        <div className="heatmap__cell heatmap__cell--level-3" />
        <div className="heatmap__cell heatmap__cell--level-4" />
        <span>More</span>
      </div>
    </div>
  )
}

// Weekly Activity Component (Mobile)
function WeeklyActivity({ activity }) {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const today = new Date()
  const todayDay = today.getDay()

  // Get current week's data from activity
  const currentWeekIndex = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
  )
  const currentWeek = activity?.[currentWeekIndex] || Array(7).fill(0)

  // Calculate week total
  const weekTotal = currentWeek.reduce((sum, count) => sum + count, 0)

  const getLevel = (count) => {
    if (count === 0) return 0
    if (count === 1) return 1
    if (count === 2) return 2
    if (count === 3) return 3
    return 4
  }

  return (
    <div className="weekly-activity">
      <div className="weekly-activity__summary">
        이번 주 <strong>{weekTotal}회</strong> 연습
      </div>
      <div className="weekly-activity__days">
        {days.map((day, idx) => (
          <div
            key={idx}
            className={`weekly-activity__day ${idx === todayDay ? 'weekly-activity__day--today' : ''}`}
          >
            <span className="weekly-activity__label">{day}</span>
            <div className={`weekly-activity__cell weekly-activity__cell--level-${getLevel(currentWeek[idx])}`}>
              {currentWeek[idx] > 0 && currentWeek[idx]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RewardsOverview() {
  const { user, scoreHistory, activity, getTodayQuestion, isPro, canUseMockInterview, canUseJobPost } = useAppState()
  const [todayQuestion, setTodayQuestion] = useState(null)
  const [selectedFeedback, setSelectedFeedback] = useState(null)
  const [currentFeedbackIndex, setCurrentFeedbackIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showProModal, setShowProModal] = useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')

  useEffect(() => {
    const question = getTodayQuestion()
    setTodayQuestion(question)
  }, [getTodayQuestion])

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedFeedback) {
        handleCloseModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFeedback])

  const recentScores = scoreHistory?.slice(0, 5) || []
  const averageScore = recentScores.length > 0
    ? Math.round(recentScores.reduce((sum, s) => sum + (s.score || 0), 0) / recentScores.length)
    : 0

  const totalPractices = scoreHistory?.length || 0

  const handleFeedbackClick = (item) => {
    if (!isDragging) {
      setSelectedFeedback(item)
    }
  }

  const handleCloseModal = () => {
    setSelectedFeedback(null)
  }

  // 스와이프 제스처 핸들러
  const handleSwipe = (direction) => {
    if (recentScores.length <= 1) return
    if (direction === 'left') {
      setCurrentFeedbackIndex((prev) => (prev + 1) % recentScores.length)
    } else {
      setCurrentFeedbackIndex((prev) => (prev - 1 + recentScores.length) % recentScores.length)
    }
  }

  return (
    <div className="rewards">
      <div className="rewards__container">
        {/* Welcome Header */}
        <header className="rewards__header">
          <div className="rewards__welcome">
            <h1>안녕하세요, {user?.name || user?.nickname || '회원'}님!</h1>
            <p>오늘도 면접 준비 화이팅하세요</p>
          </div>
        </header>

        {/* Today's Question */}
        {todayQuestion && (
          <Motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="today-question card card--gradient"
          >
            <div className="today-question__content">
              <div className="today-question__header">
                <span className="today-question__badge">오늘의 질문</span>
                <span className="today-question__category">{todayQuestion.category}</span>
              </div>
              <p className="today-question__text">{todayQuestion.text}</p>
            </div>
            <Link to="/interview" className="btn btn--primary today-question__btn">
              지금 답변하기
            </Link>
          </Motion.section>
        )}

        {/* Pro Upgrade Banner - Free 유저에게만 표시 */}
        {!isPro && (
          <Motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="pro-banner"
          >
            <div className="pro-banner__content">
              <div className="pro-banner__badge">
                <span>PRO</span>
              </div>
              <h3 className="pro-banner__title">Pro로 업그레이드하세요</h3>
              <p className="pro-banner__desc">모의 면접과 채용 공고 분석을 무제한으로 이용하세요</p>
              <div className="pro-banner__features">
                <span className="pro-banner__feature">
                  <span>🎙️</span> 모의 면접 무제한
                </span>
                <span className="pro-banner__feature">
                  <span>📋</span> 공고 분석 무제한
                </span>
                <span className="pro-banner__feature">
                  <span>📊</span> 상세 리포트
                </span>
              </div>
              <div className="pro-banner__actions">
                <button
                  className="pro-banner__btn pro-banner__btn--primary"
                  onClick={() => setShowProModal(true)}
                >
                  자세히 보기
                </button>
                <Link to="/interview?tab=mock" className="pro-banner__btn pro-banner__btn--secondary">
                  무료 체험하기 ({canUseMockInterview().remaining}회 남음)
                </Link>
              </div>
            </div>
          </Motion.section>
        )}

        {/* Pro 유저에게는 기존 프로모 배너 표시 */}
        {isPro && (
          <Motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="promo-banner card"
          >
            <div className="promo-banner__icon">🎙️</div>
            <div className="promo-banner__content">
              <div className="promo-banner__badge promo-banner__badge--pro">PRO</div>
              <h3 className="promo-banner__title">모의 면접으로 실전 감각 키우기</h3>
              <p className="promo-banner__desc">AI 면접관과 실시간 음성 대화로 면접을 준비하세요</p>
            </div>
            <Link to="/interview?tab=mock" className="btn btn--primary promo-banner__btn">
              시작하기
            </Link>
          </Motion.section>
        )}

        {/* Stats Cards */}
        <div className="rewards__stats">
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="stat-card card"
          >
            <div className="stat-card__icon">💰</div>
            <div className="stat-card__value">{user?.points?.toLocaleString() || 0}</div>
            <div className="stat-card__label">보유 포인트</div>
            <Link to="/reward" className="stat-card__link">
              리워드 교환하기
            </Link>
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="stat-card card"
          >
            <div className="stat-card__icon">🔥</div>
            <div className="stat-card__value">{user?.streak || 0}일</div>
            <div className="stat-card__label">연속 연습</div>
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="stat-card card"
          >
            <div className="stat-card__icon">📊</div>
            <div className="stat-card__value">{averageScore}점</div>
            <div className="stat-card__label">최근 평균</div>
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="stat-card card"
          >
            <div className="stat-card__icon">✅</div>
            <div className="stat-card__value">{totalPractices}회</div>
            <div className="stat-card__label">총 연습 횟수</div>
          </Motion.div>
        </div>

        {/* Activity Heatmap / Weekly Activity */}
        <section className="rewards__section card">
          <div className="rewards__section-header">
            <h2>활동 잔디</h2>
            <span className="badge">{isMobile ? '이번 주' : '최근 1년'}</span>
          </div>
          {isMobile ? (
            <WeeklyActivity activity={activity} />
          ) : (
            <ActivityHeatmap activity={activity} />
          )}
        </section>

        {/* Recent Questions */}
        <section className="rewards__section card">
          <div className="rewards__section-header">
            <h2>최근 질문</h2>
            <Link to="/interview?tab=history" className="rewards__link">전체보기</Link>
          </div>

          {recentScores.length > 0 ? (
            <div className="rewards__carousel">
              <Motion.div
                className="rewards__recent-item rewards__recent-item--clickable"
                onClick={() => handleFeedbackClick(recentScores[currentFeedbackIndex])}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={(e, { offset, velocity }) => {
                  const swipeThreshold = 50
                  if (offset.x < -swipeThreshold || velocity.x < -500) {
                    handleSwipe('left')
                  } else if (offset.x > swipeThreshold || velocity.x > 500) {
                    handleSwipe('right')
                  }
                  setTimeout(() => setIsDragging(false), 100)
                }}
                key={currentFeedbackIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="rewards__recent-info">
                  <span className="rewards__recent-date">
                    {new Date(recentScores[currentFeedbackIndex].date).toLocaleDateString('ko-KR')}
                  </span>
                  <p className="rewards__recent-question">
                    {typeof recentScores[currentFeedbackIndex].question === 'object'
                      ? recentScores[currentFeedbackIndex].question?.text
                      : recentScores[currentFeedbackIndex].question}
                  </p>
                  <span className="rewards__recent-more">더보기</span>
                </div>
                <span className="rewards__recent-score">{recentScores[currentFeedbackIndex].score}점</span>
              </Motion.div>
              {recentScores.length > 1 && (
                <div className="rewards__carousel-dots">
                  {recentScores.map((_, idx) => (
                    <button
                      key={idx}
                      className={`rewards__carousel-dot ${idx === currentFeedbackIndex ? 'rewards__carousel-dot--active' : ''}`}
                      onClick={() => setCurrentFeedbackIndex(idx)}
                      aria-label={`피드백 ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rewards__empty">
              <p>아직 연습 기록이 없습니다</p>
              <Link to="/interview" className="btn btn--primary btn--sm">
                첫 연습 시작하기
              </Link>
            </div>
          )}
        </section>

        {/* Quick Links */}
        <div className="rewards__quick-links">
          <Link to="/reward?tab=shop" className="rewards__quick-link card card--hover">
            <span className="rewards__quick-icon">🎁</span>
            <div>
              <strong>리워드 상점</strong>
              <p>포인트로 혜택 받기</p>
            </div>
          </Link>
          <Link to="/reward?tab=history" className="rewards__quick-link card card--hover">
            <span className="rewards__quick-icon">📋</span>
            <div>
              <strong>교환 내역</strong>
              <p>구매 기록 확인</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Feedback Detail Modal */}
      <AnimatePresence>
        {selectedFeedback && (
          <Motion.div
            className="feedback-modal__overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseModal}
          >
            <Motion.div
              className="feedback-modal__content"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="feedback-modal__header">
                <div className="feedback-modal__meta">
                  <span className="badge">{selectedFeedback.category || '경험'}</span>
                  <span className="feedback-modal__date">
                    {new Date(selectedFeedback.date).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <button className="feedback-modal__close" onClick={handleCloseModal}>
                  ✕
                </button>
              </div>

              {/* Question */}
              <div className="feedback-modal__question">
                <p>
                  {typeof selectedFeedback.question === 'object'
                    ? selectedFeedback.question?.text
                    : selectedFeedback.question}
                </p>
              </div>

              {/* Score */}
              <div className="feedback-modal__score">
                <div
                  className="feedback-modal__score-circle"
                  style={{ '--score-color': getScoreColor(selectedFeedback.score || 0) }}
                >
                  <span className="feedback-modal__score-value">{selectedFeedback.score || 0}</span>
                  <span className="feedback-modal__score-label">점</span>
                </div>
                <div className="feedback-modal__score-info">
                  <p>{selectedFeedback.summary}</p>
                </div>
              </div>

              {/* Score Breakdown */}
              {selectedFeedback.breakdown && (
                <div className="feedback-modal__breakdown">
                  {scoringCategories.map((cat) => (
                    <div key={cat.id} className="feedback-modal__breakdown-item">
                      <div className="feedback-modal__breakdown-header">
                        <span>{cat.icon} {cat.label}</span>
                        <strong style={{ color: getScoreColor(selectedFeedback.breakdown[cat.id] || 0) }}>
                          {selectedFeedback.breakdown[cat.id] || 0}점
                        </strong>
                      </div>
                      <div className="feedback-modal__bar">
                        <div
                          className="feedback-modal__bar-fill"
                          style={{
                            width: `${selectedFeedback.breakdown[cat.id] || 0}%`,
                            background: getScoreColor(selectedFeedback.breakdown[cat.id] || 0),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Strengths & Improvements */}
              <div className="feedback-modal__feedback-grid">
                <div className="feedback-modal__feedback-card">
                  <h4>💪 강점</h4>
                  <ul>
                    {(selectedFeedback.strengths || []).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="feedback-modal__feedback-card">
                  <h4>📈 개선점</h4>
                  <ul>
                    {(selectedFeedback.improvements || []).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Answer */}
              <div className="feedback-modal__answer">
                <h4>내가 작성한 답변</h4>
                <p>{selectedFeedback.answer}</p>
              </div>

              {/* Action */}
              <div className="feedback-modal__actions">
                <Link
                  to={`/interview?tab=history&historyId=${selectedFeedback.historyId}`}
                  className="btn btn--primary"
                >
                  재피드백 받기
                </Link>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Pro Upgrade Modal */}
      <ProUpgradeModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        feature="all"
      />
    </div>
  )
}
