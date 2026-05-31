import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { useAppState } from '../context/AppStateContext'
import {
  getVideoInterviewHistories,
  getVideoInterviewSessionDetail,
  fetchVideoInterviewRecording,
} from '../utils/interviewApi'

const ITEMS_PER_PAGE = 5

function getScoreColor(score) {
  if (score >= 90) return 'var(--color-success)'
  if (score >= 70) return 'var(--color-blue-500)'
  if (score >= 50) return 'var(--color-warning)'
  return 'var(--color-error)'
}

function formatSessionDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mergeMockHistories(apiList, localList) {
  const map = new Map()
  for (const item of localList) {
    if (item?.sessionId) map.set(String(item.sessionId), { ...item, source: item.source || 'local' })
  }
  for (const item of apiList) {
    if (!item?.sessionId) continue
    const key = String(item.sessionId)
    const existing = map.get(key)
    map.set(key, existing ? { ...existing, ...item, source: 'api' } : item)
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

function AuthenticatedVideoPlayer({ sessionId, questionId, videoUrl, getAccessToken }) {
  const [objectUrl, setObjectUrl] = useState(null)
  const [status, setStatus] = useState('loading')
  const objectUrlRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    const load = async () => {
      setStatus('loading')
      setObjectUrl(null)
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }

      try {
        const accessToken = getAccessToken?.()
        const blob = await fetchVideoInterviewRecording(
          { sessionId, questionId, videoUrl },
          accessToken,
          { signal: controller.signal }
        )
        if (!active) return
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url
        setObjectUrl(url)
        setStatus('ready')
      } catch (error) {
        if (error?.name === 'AbortError') return
        if (active) setStatus('error')
      }
    }

    void load()

    return () => {
      active = false
      controller.abort()
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [sessionId, questionId, videoUrl, getAccessToken])

  if (status === 'loading') {
    return (
      <div className="mock-history__video mock-history__video--loading">
        <div className="spinner" />
        <p>녹화 영상을 불러오는 중...</p>
      </div>
    )
  }

  if (status === 'error' || !objectUrl) {
    return (
      <div className="mock-history__video mock-history__video--error">
        <span className="mock-history__video-error-icon">🎬</span>
        <p>녹화 영상을 불러올 수 없습니다.</p>
        <span className="mock-history__video-error-hint">서버에 저장된 영상이 없거나 만료되었을 수 있습니다.</span>
      </div>
    )
  }

  return (
    <div className="mock-history__video">
      <video
        className="mock-history__video-player"
        src={objectUrl}
        controls
        playsInline
        preload="metadata"
      />
    </div>
  )
}

export default function MockInterviewHistory({ isMobile, onStartMockInterview }) {
  const { mockInterviewHistory, getAccessToken } = useAppState()
  const [apiHistories, setApiHistories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessionDetail, setSessionDetail] = useState(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)

  const mergedHistories = useMemo(
    () => mergeMockHistories(apiHistories, mockInterviewHistory || []),
    [apiHistories, mockInterviewHistory]
  )

  const filteredHistories = useMemo(() => {
    if (!searchQuery.trim()) return mergedHistories
    const query = searchQuery.toLowerCase()
    return mergedHistories.filter((item) => {
      const preview = (item.questionsPreview || []).join(' ').toLowerCase()
      const summary = (item.summary || '').toLowerCase()
      return preview.includes(query) || summary.includes(query)
    })
  }, [mergedHistories, searchQuery])

  const totalPages = Math.ceil(filteredHistories.length / ITEMS_PER_PAGE) || 1
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedHistories = filteredHistories.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const loadHistories = useCallback(async (signal) => {
    setIsLoading(true)
    setLoadError('')
    try {
      const accessToken = getAccessToken?.()
      if (!accessToken) {
        setApiHistories([])
        return
      }
      const list = await getVideoInterviewHistories(accessToken, { signal })
      setApiHistories(list)
    } catch (error) {
      if (error?.name === 'AbortError') return
      setApiHistories([])
      // 서버 목록 API 오류 시 로컬 기록이 있으면 에러 배너를 숨긴다.
      if (!mockInterviewHistory?.length) {
        setLoadError(error?.message || '모의 면접 기록을 불러오지 못했습니다.')
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [getAccessToken, mockInterviewHistory])

  useEffect(() => {
    const controller = new AbortController()
    void loadHistories(controller.signal)
    return () => controller.abort()
  }, [loadHistories])

  useEffect(() => {
    if (!selectedSession) {
      setSessionDetail(null)
      setDetailError('')
      setActiveQuestionIndex(0)
      return undefined
    }

    const controller = new AbortController()
    setIsDetailLoading(true)
    setDetailError('')
    setActiveQuestionIndex(0)

    const loadDetail = async () => {
      try {
        const accessToken = getAccessToken?.()
        const detail = await getVideoInterviewSessionDetail(
          selectedSession.sessionId,
          accessToken,
          { signal: controller.signal }
        )
        if (detail?.questions?.length) {
          setSessionDetail(detail)
        } else if (selectedSession.questions?.length) {
          setSessionDetail(selectedSession)
        } else {
          setSessionDetail(selectedSession)
        }
      } catch (error) {
        if (error?.name === 'AbortError') return
        setSessionDetail(selectedSession)
        if (!selectedSession?.questions?.length) {
          setDetailError(error?.message || '상세 정보를 불러오지 못했습니다.')
        }
      } finally {
        if (!controller.signal.aborted) setIsDetailLoading(false)
      }
    }

    void loadDetail()
    return () => controller.abort()
  }, [selectedSession, getAccessToken])

  useEffect(() => {
    if (selectedSession) {
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
    } else {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [selectedSession])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedSession) {
        setSelectedSession(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedSession])

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  const activeQuestion = sessionDetail?.questions?.[activeQuestionIndex] ?? null

  if (isLoading && mergedHistories.length === 0) {
    return (
      <div className="mock-history__loading card">
        <div className="spinner" />
        <p>모의 면접 기록을 불러오는 중...</p>
      </div>
    )
  }

  if (mergedHistories.length === 0) {
    return (
      <div className="coach__empty card">
        <span className="coach__empty-icon">🎙️</span>
        <h3>모의 면접 기록이 없습니다</h3>
        <p>화상 모의 면접을 완료하면 녹화 영상과 피드백을 여기에서 다시 볼 수 있습니다.</p>
        <button type="button" className="btn btn--primary" onClick={onStartMockInterview}>
          모의 면접 시작하기
        </button>
      </div>
    )
  }

  return (
    <>
      {loadError ? (
        <div className="coach__error mock-history__banner-error">
          <span>⚠️</span> {loadError}
        </div>
      ) : null}

      <div className="coach__search">
        <div className="coach__search-input-wrapper">
          <span className="coach__search-icon">🔍</span>
          <input
            type="text"
            className="coach__search-input"
            placeholder="질문 또는 피드백 검색..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
          {searchQuery ? (
            <button
              type="button"
              className="coach__search-clear"
              onClick={() => {
                setSearchQuery('')
                setCurrentPage(1)
              }}
            >
              ✕
            </button>
          ) : null}
        </div>
        <span className="coach__search-count">총 {filteredHistories.length}개의 기록</span>
      </div>

      <div className="coach__history-card card mock-history__list-card">
        {filteredHistories.length === 0 ? (
          <div className="coach__history-empty">
            <span className="coach__empty-icon">🔍</span>
            <h3>검색 결과가 없습니다</h3>
            <p>다른 키워드로 검색해보세요</p>
          </div>
        ) : (
          <div className="coach__history-list">
            {paginatedHistories.map((item) => {
              const preview =
                item.questionsPreview?.[0] ||
                item.questions?.[0]?.question ||
                item.summary ||
                '모의 면접 세션'
              const questionCount =
                item.questionCount || item.questions?.length || 0

              return (
                <button
                  key={item.sessionId}
                  type="button"
                  className="coach__history-item mock-history__item"
                  onClick={() => setSelectedSession(item)}
                >
                  <div className="coach__history-content">
                    <div className="coach__history-main">
                      <div className="coach__history-header">
                        <span className="badge mock-history__badge">모의 면접</span>
                        <span className="mock-history__video-chip">🎬 녹화</span>
                        <span className="coach__history-date">
                          {formatSessionDate(item.date)}
                        </span>
                      </div>
                      <p className="coach__history-question">{preview}</p>
                      <p className="mock-history__meta">
                        {questionCount > 0 ? `${questionCount}문항` : '문항 정보 없음'}
                        {item.summary ? ` · ${item.summary.slice(0, 48)}${item.summary.length > 48 ? '…' : ''}` : ''}
                      </p>
                    </div>
                    <div
                      className="coach__history-score"
                      style={{
                        '--score-color': getScoreColor(
                          typeof item.overallScore === 'number' ? item.overallScore : 0
                        ),
                      }}
                    >
                      <span className="coach__history-score-value">
                        {typeof item.overallScore === 'number' ? item.overallScore : '-'}
                      </span>
                      <span className="coach__history-score-label">점</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="coach__pagination">
          {(() => {
            const maxVisible = isMobile ? 3 : 5
            const currentGroup = Math.floor((currentPage - 1) / maxVisible)
            const startPage = currentGroup * maxVisible + 1
            const endPage = Math.min(startPage + maxVisible - 1, totalPages)
            const pages = []
            for (let i = startPage; i <= endPage; i += 1) pages.push(i)

            return (
              <>
                <button
                  type="button"
                  className="coach__pagination-btn"
                  onClick={() => setCurrentPage(startPage - 1)}
                  disabled={startPage === 1}
                >
                  ‹
                </button>
                {pages.map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`coach__pagination-btn ${currentPage === page ? 'coach__pagination-btn--active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  className="coach__pagination-btn"
                  onClick={() => setCurrentPage(endPage + 1)}
                  disabled={endPage >= totalPages}
                >
                  ›
                </button>
              </>
            )
          })()}
        </div>
      </div>

      <AnimatePresence>
        {selectedSession ? (
          <Motion.div
            className="coach__modal-overlay mock-history__modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedSession(null)}
          >
            <Motion.div
              className="coach__modal mock-history__modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="coach__modal-header">
                <div>
                  <span className="badge mock-history__badge">모의 면접</span>
                  <span className="coach__modal-date">
                    {formatSessionDate(selectedSession.date)}
                  </span>
                </div>
                <button
                  type="button"
                  className="coach__modal-close"
                  onClick={() => setSelectedSession(null)}
                >
                  ✕
                </button>
              </div>

              <div className="mock-history__modal-summary">
                <div
                  className="coach__modal-score-circle mock-history__modal-score"
                  style={{
                    '--score-color': getScoreColor(
                      typeof (sessionDetail ?? selectedSession).overallScore === 'number'
                        ? (sessionDetail ?? selectedSession).overallScore
                        : 0
                    ),
                  }}
                >
                  <span className="coach__modal-score-value">
                    {typeof (sessionDetail ?? selectedSession).overallScore === 'number'
                      ? (sessionDetail ?? selectedSession).overallScore
                      : '-'}
                  </span>
                  <span className="coach__modal-score-label">점</span>
                </div>
                <p className="mock-history__modal-summary-text">
                  {(sessionDetail ?? selectedSession).summary || '모의 면접 피드백 요약'}
                </p>
              </div>

              <div className="mock-history__modal-body">
              {isDetailLoading ? (
                <div className="mock-history__detail-loading">
                  <div className="spinner" />
                  <p>면접 상세 정보를 불러오는 중...</p>
                </div>
              ) : (
                <>
                  {detailError ? (
                    <p className="mock-history__detail-error">⚠️ {detailError}</p>
                  ) : null}

                  {(sessionDetail?.questions?.length ?? 0) > 1 ? (
                    <div className="mock-history__question-tabs" role="tablist">
                      {(sessionDetail?.questions || []).map((q, idx) => (
                        <button
                          key={q.questionId ?? idx}
                          type="button"
                          role="tab"
                          aria-selected={activeQuestionIndex === idx}
                          className={`mock-history__question-tab${activeQuestionIndex === idx ? ' mock-history__question-tab--active' : ''}`}
                          onClick={() => setActiveQuestionIndex(idx)}
                        >
                          질문 {q.index ?? idx + 1}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {activeQuestion ? (
                    <div className="mock-history__question-panel">
                      <div className="mock-history__question-text">
                        <span className="mock-history__question-label">질문</span>
                        <p>{activeQuestion.question || '질문 내용 없음'}</p>
                      </div>

                      <AuthenticatedVideoPlayer
                        sessionId={selectedSession.sessionId}
                        questionId={activeQuestion.questionId}
                        videoUrl={activeQuestion.videoUrl}
                        getAccessToken={getAccessToken}
                      />

                      {typeof activeQuestion.score === 'number' ? (
                        <p className="mock-history__question-score">
                          이 질문 점수:{' '}
                          <strong style={{ color: getScoreColor(activeQuestion.score) }}>
                            {activeQuestion.score}점
                          </strong>
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mock-history__video mock-history__video--error">
                      <span className="mock-history__video-error-icon">📋</span>
                      <p>질문별 녹화 정보가 없습니다.</p>
                    </div>
                  )}
                </>
              )}
              </div>
            </Motion.div>
          </Motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
