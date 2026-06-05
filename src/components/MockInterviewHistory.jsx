import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { useAppState } from '../context/AppStateContext'
import {
  getVideoInterviewHistories,
  getVideoInterviewSessionDetail,
  fetchVideoInterviewRecording,
  isInterviewFeedbackTripleEmpty,
  resolveInterviewMediaUrl,
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

function getSessionQuestionTitle(item) {
  const fromPreview = item?.questionsPreview?.find(
    (text) => typeof text === 'string' && text.trim()
  )
  if (fromPreview) return fromPreview.trim()

  const fromQuestions = item?.questions
    ?.map((q) => q?.question)
    .find((text) => typeof text === 'string' && text.trim())
  if (fromQuestions) return fromQuestions.trim()

  const fallback =
    item?.firstQuestion ??
    item?.first_question ??
    item?.representativeQuestion ??
    item?.questionPreview ??
    item?.question_preview
  if (typeof fallback === 'string' && fallback.trim()) return fallback.trim()

  return null
}

async function enrichSessionsWithQuestionPreviews(sessions, accessToken, signal) {
  if (!accessToken || !sessions?.length) return sessions

  return Promise.all(
    sessions.map(async (session) => {
      if (getSessionQuestionTitle(session)) return session
      try {
        const detail = await getVideoInterviewSessionDetail(session.sessionId, accessToken, {
          signal,
        })
        const previews =
          detail?.questions?.map((q) => q.question).filter(Boolean) ??
          detail?.questionsPreview ??
          []
        if (!previews.length) return session
        return {
          ...session,
          questionsPreview: previews,
          questions: detail.questions ?? session.questions,
          questionCount: detail.questionCount || previews.length,
        }
      } catch {
        return session
      }
    })
  )
}

function QuestionFeedbackPanel({ question, getScoreColor }) {
  const hasSpeech = question?.speech && !isInterviewFeedbackTripleEmpty(question.speech)
  const hasVideo = question?.video && !isInterviewFeedbackTripleEmpty(question.video)
  const narrative = String(question?.narrative ?? question?.combinedFeedback ?? '').trim()
  const hasNarrative = Boolean(narrative)

  if (!hasSpeech && !hasVideo && !hasNarrative) return null

  return (
    <div className="mock-history__feedback">
      {hasSpeech ? (
        <div className="mock-interview__q-block">
          <h4 className="mock-interview__q-block-title">스피치 분석</h4>
          <ul className="mock-interview__insight-list">
            <li>
              <span className="mock-interview__insight-tag mock-interview__insight-tag--ok">잘한 점</span>
              <span className="mock-interview__insight-body">{question.speech.good}</span>
            </li>
            <li>
              <span className="mock-interview__insight-tag mock-interview__insight-tag--warn">개선점</span>
              <span className="mock-interview__insight-body">{question.speech.improvement}</span>
            </li>
            <li>
              <span className="mock-interview__insight-tag mock-interview__insight-tag--tip">추천</span>
              <span className="mock-interview__insight-body">{question.speech.recommendation}</span>
            </li>
          </ul>
        </div>
      ) : null}

      {hasVideo ? (
        <div className="mock-interview__q-block">
          <h4 className="mock-interview__q-block-title">비언어 분석</h4>
          <ul className="mock-interview__insight-list">
            <li>
              <span className="mock-interview__insight-tag mock-interview__insight-tag--ok">잘한 점</span>
              <span className="mock-interview__insight-body">{question.video.good}</span>
            </li>
            <li>
              <span className="mock-interview__insight-tag mock-interview__insight-tag--warn">개선점</span>
              <span className="mock-interview__insight-body">{question.video.improvement}</span>
            </li>
            <li>
              <span className="mock-interview__insight-tag mock-interview__insight-tag--tip">추천</span>
              <span className="mock-interview__insight-body">{question.video.recommendation}</span>
            </li>
          </ul>
        </div>
      ) : null}

      {hasNarrative ? (
        <div className="mock-interview__q-block mock-interview__q-block--narrative">
          <h4 className="mock-interview__q-block-title">종합 평가</h4>
          <p className="mock-interview__q-block-text">{narrative}</p>
        </div>
      ) : null}

      {typeof question.score === 'number' ? (
        <p className="mock-history__question-score">
          이 질문 점수:{' '}
          <strong style={{ color: getScoreColor(question.score) }}>{question.score}점</strong>
        </p>
      ) : null}
    </div>
  )
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

function AuthenticatedVideoPlayer({ mediaUrl, videoUrl, getAccessToken }) {
  const [objectUrl, setObjectUrl] = useState(null)
  const [status, setStatus] = useState('loading')
  const objectUrlRef = useRef(null)
  const playbackSource = mediaUrl || videoUrl

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

      if (!playbackSource) {
        if (active) setStatus('empty')
        return
      }

      const resolvedUrl = resolveInterviewMediaUrl(playbackSource)
      const isPublicHttpUrl =
        /^https?:\/\//i.test(playbackSource) &&
        resolvedUrl &&
        !resolvedUrl.includes('/api/')

      try {
        if (isPublicHttpUrl) {
          if (!active) return
          setObjectUrl(resolvedUrl)
          setStatus('ready')
          return
        }

        const accessToken = getAccessToken?.()
        const blob = await fetchVideoInterviewRecording(
          { mediaUrl: playbackSource, videoUrl: playbackSource },
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
  }, [playbackSource, getAccessToken])

  if (status === 'loading') {
    return (
      <div className="mock-history__video mock-history__video--loading">
        <div className="spinner" />
        <p>녹화 영상을 불러오는 중...</p>
      </div>
    )
  }

  if (status === 'empty') {
    return (
      <div className="mock-history__video mock-history__video--error">
        <span className="mock-history__video-error-icon">🎬</span>
        <p>녹화 영상 URL이 없습니다.</p>
        <span className="mock-history__video-error-hint">상세 조회 응답의 mediaUrl을 확인해 주세요.</span>
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

export default function MockInterviewHistory({ isMobile, onStartMockInterview, onStartRetake }) {
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
  const [loadingSessionIds, setLoadingSessionIds] = useState(() => new Set())
  const [retakeError, setRetakeError] = useState('')

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
      const enriched = await enrichSessionsWithQuestionPreviews(list, accessToken, signal)
      if (!signal?.aborted) setApiHistories(enriched)
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

  const ensureSessionQuestions = useCallback(
    async (session) => {
      if (!session?.sessionId) return session
      if (session.questions?.length) return session

      const accessToken = getAccessToken?.()
      if (!accessToken) return session

      const sessionId = String(session.sessionId)
      setLoadingSessionIds((prev) => new Set(prev).add(sessionId))

      try {
        const detail = await getVideoInterviewSessionDetail(sessionId, accessToken)
        if (!detail?.questions?.length) return session

        const enriched = {
          ...session,
          questions: detail.questions,
          questionCount: detail.questionCount || detail.questions.length,
          questionsPreview:
            detail.questions?.map((q) => q.question).filter(Boolean) ??
            session.questionsPreview ??
            [],
        }

        setApiHistories((prev) =>
          prev.map((item) =>
            String(item.sessionId) === sessionId ? { ...item, ...enriched } : item
          )
        )
        return enriched
      } catch {
        return session
      } finally {
        setLoadingSessionIds((prev) => {
          const next = new Set(prev)
          next.delete(sessionId)
          return next
        })
      }
    },
    [getAccessToken]
  )

  useEffect(() => {
    if (!paginatedHistories.length) return undefined

    const controller = new AbortController()
    void Promise.all(
      paginatedHistories
        .filter((session) => !session.questions?.length)
        .map((session) => ensureSessionQuestions(session))
    )

    return () => controller.abort()
  }, [paginatedHistories, ensureSessionQuestions])

  const handleOpenSessionDetail = useCallback((session, questionIndex = 0) => {
    setSelectedSession(session)
    setActiveQuestionIndex(questionIndex)
  }, [])

  const handleStartQuestionRetake = useCallback(
    async (session, question) => {
      setRetakeError('')
      if (!onStartRetake) {
        setRetakeError('재답변을 시작할 수 없습니다.')
        return
      }
      if (session?.status === 'IN_PROGRESS') {
        setRetakeError('진행 중인 면접은 재답변할 수 없습니다.')
        return
      }

      let resolvedSession = session
      if (!question?.questionId) {
        resolvedSession = await ensureSessionQuestions(session)
        const matched =
          resolvedSession?.questions?.find(
            (q) => (q.question || '').trim() === (question?.question || '').trim()
          ) ?? resolvedSession?.questions?.[0]
        question = matched ?? question
      }

      if (!question?.questionId) {
        setRetakeError('질문 ID를 찾을 수 없어 재답변을 시작할 수 없습니다.')
        return
      }

      onStartRetake({
        sessionId: resolvedSession.sessionId,
        questionId: question.questionId,
        questionText: question.question || '',
      })
    },
    [onStartRetake, ensureSessionQuestions]
  )

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

      {retakeError ? (
        <div className="coach__error mock-history__banner-error">
          <span>⚠️</span> {retakeError}
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

      <p className="mock-history__retake-note">재답변 점수는 리워드에 반영되지 않습니다.</p>

      <div className="coach__history-card card mock-history__list-card">
        {filteredHistories.length === 0 ? (
          <div className="coach__history-empty">
            <span className="coach__empty-icon">🔍</span>
            <h3>검색 결과가 없습니다</h3>
            <p>다른 키워드로 검색해보세요</p>
          </div>
        ) : (
          <div className="coach__history-list mock-history__session-list">
            {paginatedHistories.map((item) => {
              const isSessionLoading = loadingSessionIds.has(String(item.sessionId))
              const questionBlocks =
                item.questions?.length > 0
                  ? item.questions
                  : [
                      {
                        questionId: null,
                        question: getSessionQuestionTitle(item) || '질문 내용을 불러오지 못했습니다',
                        score: null,
                        index: 1,
                      },
                    ]

              return (
                <div key={item.sessionId} className="mock-history__session-card">
                  <div className="mock-history__session-card-header">
                    <div className="mock-history__session-card-meta">
                      <span className="badge mock-history__badge">모의 면접</span>
                      <span className="coach__history-date">{formatSessionDate(item.date)}</span>
                    </div>
                    <div
                      className="coach__history-score mock-history__session-score"
                      style={{
                        '--score-color': getScoreColor(
                          typeof item.overallScore === 'number' ? item.overallScore : 0
                        ),
                      }}
                    >
                      <span className="coach__history-score-value">
                        {typeof item.overallScore === 'number'
                          ? item.overallScore
                          : item.status === 'IN_PROGRESS'
                            ? '—'
                            : '-'}
                      </span>
                      <span className="coach__history-score-label">점</span>
                    </div>
                  </div>

                  <div className="mock-history__question-blocks">
                    {questionBlocks.map((question, idx) => (
                      <div key={question.questionId ?? `q-${idx}`} className="mock-history__question-block">
                        <button
                          type="button"
                          className="mock-history__question-block-main"
                          onClick={() => handleOpenSessionDetail(item, idx)}
                        >
                          <span className="badge">Q{question.index ?? idx + 1}</span>
                          <p className="mock-history__question-block-text">
                            {question.question || '질문 내용 없음'}
                          </p>
                        </button>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm mock-history__retake-btn"
                          disabled={
                            isSessionLoading ||
                            item.status === 'IN_PROGRESS' ||
                            !onStartRetake
                          }
                          onClick={() => void handleStartQuestionRetake(item, question)}
                        >
                          {isSessionLoading ? '불러오는 중…' : '다시 답변하기'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="coach__pagination mock-history__pagination">
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
                  {(sessionDetail ?? selectedSession).summary ||
                    ((sessionDetail ?? selectedSession).status === 'IN_PROGRESS'
                      ? '면접이 진행 중입니다. 완료 후 종합 피드백이 표시됩니다.'
                      : '모의 면접 피드백 요약')}
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
                        mediaUrl={activeQuestion.mediaUrl}
                        videoUrl={activeQuestion.videoUrl}
                        getAccessToken={getAccessToken}
                      />

                      <QuestionFeedbackPanel
                        question={activeQuestion}
                        getScoreColor={getScoreColor}
                      />
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
