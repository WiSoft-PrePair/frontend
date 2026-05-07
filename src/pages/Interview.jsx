import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { useAppState } from '../context/AppStateContext'
import useMediaQuery from '../hooks/useMediaQuery'
import MockInterview from '../components/MockInterview'
import ProUpgradeModal, { ProTab } from '../components/ProUpgradeModal'
import {
  createCompanyInterviewQuestion,
  getInterviewQuestions,
  submitTextInterviewAnswer,
} from '../utils/interviewApi'
import '../styles/pages/Interview.css'
import '../styles/components/pro-upgrade.css'

// 육각형 차트 카테고리
const hexagonCategories = [
  { id: 'proactivity', label: '적극성', angle: -90 },
  { id: 'values', label: '가치관', angle: -30 },
  { id: 'collaboration', label: '협동성', angle: 30 },
  { id: 'workEthic', label: '성실성', angle: 90 },
  { id: 'creativity', label: '창의력', angle: 150 },
  { id: 'logicalThinking', label: '논리력', angle: 210 },
]

// 육각형 차트 컴포넌트
function HexagonChart({ scores, size = 280, isMobile = false }) {
  const padding = isMobile ? 50 : 40
  const center = size / 2
  const maxRadius = (size - padding * 2) * 0.4
  const gridLines = [0.2, 0.4, 0.6, 0.8, 1.0]
  const labelRadius = maxRadius + (isMobile ? 28 : 24)

  const getPoint = (angle, radius) => {
    const rad = (angle * Math.PI) / 180
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    }
  }

  const dataPath = hexagonCategories
    .map((cat, idx) => {
      const score = scores[cat.id] || 0
      const radius = (score / 100) * maxRadius
      const point = getPoint(cat.angle, radius)
      return `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    })
    .join(' ') + ' Z'

  return (
    <div className="hexagon-chart">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size} ${size}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* 그리드 */}
        {gridLines.map((scale) => (
          <polygon
            key={scale}
            points={hexagonCategories
              .map((cat) => {
                const point = getPoint(cat.angle, maxRadius * scale)
                return `${point.x},${point.y}`
              })
              .join(' ')}
            fill="none"
            stroke="rgba(174, 197, 242, 0.3)"
            strokeWidth="1.5"
          />
        ))}

        {/* 축 */}
        {hexagonCategories.map((cat) => {
          const endPoint = getPoint(cat.angle, maxRadius)
          return (
            <line
              key={cat.id}
              x1={center}
              y1={center}
              x2={endPoint.x}
              y2={endPoint.y}
              stroke="rgba(174, 197, 242, 0.5)"
              strokeWidth="1"
            />
          )
        })}

        {/* 데이터 영역 */}
        <Motion.path
          d={dataPath}
          fill="rgba(174, 197, 242, 0.35)"
          stroke="var(--color-blue-400)"
          strokeWidth="2.5"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        {/* 라벨 */}
        {hexagonCategories.map((cat) => {
          const point = getPoint(cat.angle, labelRadius)
          return (
            <text
              key={cat.id}
              x={point.x}
              y={point.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={isMobile ? 11 : 12}
              fill="var(--color-dark-600)"
              fontWeight="500"
            >
              {cat.label}
            </text>
          )
        })}

        {/* 점수 */}
        {hexagonCategories.map((cat) => {
          const score = scores[cat.id] || 0
          const radius = (score / 100) * maxRadius
          const point = getPoint(cat.angle, radius)
          return (
            <g key={`score-${cat.id}`}>
              <Motion.circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="var(--color-blue-500)"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, duration: 0.3 }}
              />
              <text
                x={point.x}
                y={point.y - 14}
                textAnchor="middle"
                fontSize={isMobile ? 10 : 11}
                fill="var(--color-blue-600)"
                fontWeight="600"
              >
                {Math.round(score)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// scoreHistory 기반 카테고리 점수 계산
function calculateCategoryScores(scoreHistory) {
  if (!scoreHistory || scoreHistory.length === 0) {
    return {
      proactivity: 0,
      values: 0,
      collaboration: 0,
      workEthic: 0,
      creativity: 0,
      logicalThinking: 0,
    }
  }

  const totals = {
    proactivity: 0,
    values: 0,
    collaboration: 0,
    workEthic: 0,
    creativity: 0,
    logicalThinking: 0,
  }

  scoreHistory.forEach((entry) => {
    const breakdown = entry.breakdown || {}
    const overall = entry.score || 75

    totals.logicalThinking += breakdown.structure || overall
    totals.values += breakdown.clarity || overall
    totals.workEthic += breakdown.depth || overall
    totals.creativity += breakdown.story || overall

    const avg = Object.values(breakdown).length > 0
      ? Object.values(breakdown).reduce((a, b) => a + b, 0) / Object.values(breakdown).length
      : overall
    totals.proactivity += overall * 0.6 + avg * 0.4
    totals.collaboration += overall * 0.5 + avg * 0.5
  })

  const count = scoreHistory.length
  return {
    proactivity: Math.round(totals.proactivity / count),
    values: Math.round(totals.values / count),
    collaboration: Math.round(totals.collaboration / count),
    workEthic: Math.round(totals.workEthic / count),
    creativity: Math.round(totals.creativity / count),
    logicalThinking: Math.round(totals.logicalThinking / count),
  }
}

// 강점/약점 분석
function analyzeStrengthsWeaknesses(scores) {
  const labels = {
    proactivity: '적극성',
    values: '가치관',
    collaboration: '협동성',
    workEthic: '성실성',
    creativity: '창의력',
    logicalThinking: '논리력',
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  return {
    strengths: sorted.slice(0, 2).map(([k, v]) => ({ label: labels[k], score: v })),
    weaknesses: sorted.slice(-2).map(([k, v]) => ({ label: labels[k], score: v })),
  }
}

const VALID_TABS = ['practice', 'history', 'mock', 'jobpost']
const JOB_POST_HISTORY_STORAGE_KEY = 'prepair_job_post_history'

function normalizeQuestion(raw, fallbackId = Date.now()) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id ?? raw.questionId ?? raw.question_id ?? fallbackId,
    text: raw.text ?? raw.question ?? raw.content ?? '',
    category: raw.category ?? raw.type ?? '일반',
    source: 'api',
  }
}

function pickQuestionListPayload(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.questions)) return response.questions
  if (Array.isArray(response?.data?.questions)) return response.data.questions
  if (Array.isArray(response?.data?.items)) return response.data.items
  if (Array.isArray(response?.items)) return response.items
  return []
}

function splitListText(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return String(value)
    .split(/[\n\r]|(?<=\.)\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function splitTagText(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeCompanyAnalysis(raw) {
  const content = raw?.content ?? {}
  return {
    company: content.companyName ?? raw?.companyName ?? '',
    position: content.jobTitle ?? raw?.jobTitle ?? '',
    department: content.employmentType ?? raw?.employmentType ?? '',
    requirements: splitListText(content.responsibilities || content.requirements),
    preferredQualifications: splitListText(content.preferredQualifications),
    keywords: splitTagText(content.techStack),
  }
}

function normalizeCompanyQuestions(list = []) {
  return list.map((item, index) => ({
    id: item?.id ?? `company-q-${Date.now()}-${index}`,
    category: item?.questionType ?? 'COMPANY',
    text: item?.question ?? item?.text ?? '',
    relevance: item?.questionTag ?? '',
    questionId: item?.id,
    source: 'api',
  }))
}

function isUuid(value) {
  if (typeof value !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function toFeedbackList(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (!value) return []
  return [String(value)]
}

function loadJobPostHistoryFromStorage() {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem(JOB_POST_HISTORY_STORAGE_KEY)
    if (!saved) return []
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeFeedbackResponse(response, question, answer) {
  const payload = response?.data ?? response ?? {}
  const score = payload?.score ?? payload?.totalScore ?? payload?.overallScore
  if (typeof score !== 'number') {
    throw new Error('피드백 응답 형식이 올바르지 않습니다.')
  }

  const feedback = payload?.feedback ?? {}
  const strengths = toFeedbackList(payload?.strengths ?? payload?.pros ?? feedback?.good)
  const improvements = toFeedbackList(
    payload?.improvements ??
      payload?.cons ??
      payload?.weaknesses ??
      feedback?.improvement
  )
  const recommendations = toFeedbackList(feedback?.recommendation)

  return {
    score,
    breakdown: payload?.breakdown ?? payload?.scores ?? {},
    summary:
      payload?.summary ??
      payload?.comment ??
      recommendations[0] ??
      '피드백이 생성되었습니다.',
    strengths,
    improvements,
    recommendations,
    question: question?.text ?? '',
    category: question?.category,
    answer,
    historyId: payload?.historyId ?? payload?.id ?? `h-${Date.now()}`,
    earnedPoints: payload?.earnedPoints ?? payload?.point ?? Math.max(40, Math.floor(score * 0.6)),
  }
}

export default function CoachPage() {
  const { user, recordInterviewResult, lastFeedback, scoreHistory, companyHistory, isPro, canUseMockInterview, canUseJobPost, useMockInterview, useJobPost, getAccessToken } = useAppState()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [question, setQuestion] = useState(null)
  const [answer, setAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [histories, setHistories] = useState([])
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true)
  const [error, setError] = useState('')

  const resolveAccessToken = useCallback(() => {
    const tokenFromContext = getAccessToken?.()
    if (tokenFromContext) return tokenFromContext
    if (typeof window === 'undefined') return null
    return (
      window.sessionStorage.getItem('prepair_access_token') ||
      window.localStorage.getItem('prepair_access_token') ||
      null
    )
  }, [getAccessToken])

  // Get active tab from URL, default to 'practice'
  const tabParam = searchParams.get('tab')
  const activeTab = VALID_TABS.includes(tabParam) ? tabParam : 'practice'
  const historyIdParam = searchParams.get('historyId')

  const setActiveTab = (tab) => {
    setSearchParams({ tab }, { replace: true })
  }

  // Pro 탭 클릭 핸들러
  const handleProTabClick = (tab, feature) => {
    const usage = feature === 'mock' ? canUseMockInterview() : canUseJobPost()

    if (!isPro && !usage.allowed) {
      // 무료 횟수 소진 시 모달 표시
      setProModalFeature(feature)
      setShowProModal(true)
    } else {
      setActiveTab(tab)
    }
  }

  // History sub-tab: 'general', 'company', or 'summary'
  const [historySubTab, setHistorySubTab] = useState('general')

  // Mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)')

  // History search and pagination
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 5

  // History detail modal & re-feedback states
  const [selectedHistory, setSelectedHistory] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editedAnswer, setEditedAnswer] = useState('')
  const [isReFeedbackMode, setIsReFeedbackMode] = useState(false)
  const [isSubmittingReFeedback, setIsSubmittingReFeedback] = useState(false)
  const [reFeedback, setReFeedback] = useState(null)

  // 모달 열릴 때 body 스크롤 막기
  useEffect(() => {
    if (isDetailOpen) {
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
  }, [isDetailOpen])

  // Job Post Analysis states
  const [jobPostUrl, setJobPostUrl] = useState('')
  const [isAnalyzingJobPost, setIsAnalyzingJobPost] = useState(false)
  const [jobPostAnalysis, setJobPostAnalysis] = useState(null)
  const [jobPostQuestions, setJobPostQuestions] = useState([])
  const [selectedJobQuestion, setSelectedJobQuestion] = useState(null)
  const [jobAnswer, setJobAnswer] = useState('')
  const [isSubmittingJobAnswer, setIsSubmittingJobAnswer] = useState(false)
  const [jobFeedback, setJobFeedback] = useState(null)
  const [jobPostHistory, setJobPostHistory] = useState(() => loadJobPostHistoryFromStorage())
  const [jobPostHistoryPage, setJobPostHistoryPage] = useState(1)
  const [jobPostSearchQuery, setJobPostSearchQuery] = useState('')
  const JOB_POST_ITEMS_PER_PAGE = isMobile ? 3 : 5

  // Pro 업그레이드 모달 상태
  const [showProModal, setShowProModal] = useState(false)
  const [proModalFeature, setProModalFeature] = useState('mock')

  // Filter job post history by search query
  const filteredJobPostHistory = jobPostHistory.filter((item) => {
    if (!jobPostSearchQuery.trim()) return true
    const query = jobPostSearchQuery.toLowerCase()
    return (
      item.company?.toLowerCase().includes(query) ||
      item.position?.toLowerCase().includes(query) ||
      item.keywords?.some(k => k.toLowerCase().includes(query))
    )
  })

  const textareaRef = useRef(null)
  const editTextareaRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(JOB_POST_HISTORY_STORAGE_KEY, JSON.stringify(jobPostHistory))
  }, [jobPostHistory])

  // Filter histories by search query
  const filteredHistories = histories.filter((item) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const questionText = typeof item.question === 'object' ? item.question?.text : item.question
    return (
      questionText?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query) ||
      item.company?.toLowerCase().includes(query)
    )
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredHistories.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedHistories = filteredHistories.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  // Reset to page 1 when search query changes
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  const fetchTextQuestion = useCallback(async () => {
    const accessToken = resolveAccessToken()
    try {
      const response = await getInterviewQuestions(
        { type: 'TEXT', userId: user?.id },
        accessToken
      )
      const list = pickQuestionListPayload(response)
      const normalizedList = list.map((item, idx) => normalizeQuestion(item, Date.now() + idx)).filter(Boolean)
      if (normalizedList.length > 0) {
        setQuestion(normalizedList[0])
        return
      }
    } catch (err) {
      console.error('[Interview] fetchTextQuestion error:', err)
    }

    // API 실패/빈 응답 시 질문 없음
    setQuestion(null)
  }, [resolveAccessToken, user?.id])

  // Fetch today's question (TEXT API 우선)
  useEffect(() => {
    if (!user?.id) return
    setIsLoadingQuestion(true)
    fetchTextQuestion().finally(() => setIsLoadingQuestion(false))
  }, [user?.id, fetchTextQuestion])

  // 히스토리는 컨텍스트(로컬 저장)에서 로드
  useEffect(() => {
    if (activeTab === 'history') {
      if (historySubTab === 'company') {
        setHistories(companyHistory || [])
      } else if (historySubTab === 'general') {
        setHistories(scoreHistory || [])
      }
      // 서브탭 변경 시 검색어와 페이지 초기화
      setSearchQuery('')
      setCurrentPage(1)
    }
  }, [activeTab, scoreHistory, companyHistory, historySubTab])

  // URL에서 historyId가 있으면 해당 히스토리 상세 모달 열기
  useEffect(() => {
    if (historyIdParam && scoreHistory?.length > 0) {
      const targetHistory = scoreHistory.find(
        (item) => item.historyId === historyIdParam || item.historyId === parseInt(historyIdParam, 10)
      )
      if (targetHistory) {
        handleHistoryClick(targetHistory)
        // URL에서 historyId 제거 (모달 열린 후)
        setSearchParams({ tab: 'history' }, { replace: true })
      }
    }
  }, [historyIdParam, scoreHistory])

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isDetailOpen) {
        handleCloseDetail()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDetailOpen])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [answer])

  const handleSubmit = async () => {
    if (!answer.trim() || !question?.id) return

    setIsSubmitting(true)
    setError('')
    try {
      if (!(question?.source === 'api' && isUuid(String(question.id)))) {
        throw new Error('유효한 API 질문이 아닙니다. 새로운 질문을 불러와 주세요.')
      }

      const accessToken = resolveAccessToken()
      const response = await submitTextInterviewAnswer(
        question.id,
        { answer: answer.trim() },
        accessToken
      )
      const feedbackData = normalizeFeedbackResponse(response, question, answer.trim())
      setFeedback(feedbackData)
      recordInterviewResult(feedbackData)
    } catch (err) {
      setError(err?.message || '답변 제출에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNewQuestion = async () => {
    setFeedback(null)
    setAnswer('')
    setQuestion(null)
    setIsLoadingQuestion(true)
    try {
      await fetchTextQuestion()
    } finally {
      setIsLoadingQuestion(false)
    }
  }

  const getScoreColor = (score) => {
    if (score >= 90) return 'var(--color-success)'
    if (score >= 70) return 'var(--color-blue-500)'
    if (score >= 50) return 'var(--color-warning)'
    return 'var(--color-error)'
  }

  // Open history detail modal
  const handleHistoryClick = (item) => {
    setSelectedHistory(item)
    setEditedAnswer(item.answer || '')
    setIsDetailOpen(true)
    setIsReFeedbackMode(false)
    setReFeedback(null)
  }

  // Close detail modal
  const handleCloseDetail = () => {
    setIsDetailOpen(false)
    setSelectedHistory(null)
    setEditedAnswer('')
    setIsReFeedbackMode(false)
    setReFeedback(null)
  }

  // Start re-feedback mode (allows editing answer)
  const handleStartReFeedback = () => {
    setIsReFeedbackMode(true)
  }

  // Submit re-feedback request
  const handleSubmitReFeedback = () => {
    if (!selectedHistory || !editedAnswer.trim()) return

    setIsSubmittingReFeedback(true)
    setError('재피드백 API가 아직 연결되지 않았습니다. 임시 데이터는 비활성화되었습니다.')
    setIsSubmittingReFeedback(false)
  }

  // Auto-resize edit textarea
  useEffect(() => {
    if (editTextareaRef.current && isReFeedbackMode) {
      editTextareaRef.current.style.height = 'auto'
      editTextareaRef.current.style.height = editTextareaRef.current.scrollHeight + 'px'
    }
  }, [editedAnswer, isReFeedbackMode])

  // Job Post Analysis handlers
  const handleAnalyzeJobPost = async () => {
    if (!jobPostUrl.trim()) return

    setIsAnalyzingJobPost(true)
    setJobPostAnalysis(null)
    setJobPostQuestions([])
    setSelectedJobQuestion(null)
    setJobFeedback(null)

    setError('')
    try {
      const accessToken = resolveAccessToken()
      const response = await createCompanyInterviewQuestion(
        { url: jobPostUrl.trim() },
        accessToken
      )
      const payload = response?.data ?? response ?? {}
      const normalizedAnalysis = normalizeCompanyAnalysis(payload.jobPosting)
      const normalizedQuestions = normalizeCompanyQuestions(payload.questions || [])

      if (!normalizedQuestions.length) {
        throw new Error('생성된 질문이 없습니다. 다른 공고로 다시 시도해주세요.')
      }

      setJobPostAnalysis(normalizedAnalysis)
      setJobPostQuestions(normalizedQuestions)

      const historyItem = {
        id: payload?.jobPosting?.id ?? Date.now(),
        url: jobPostUrl.trim(),
        company: normalizedAnalysis.company,
        position: normalizedAnalysis.position,
        department: normalizedAnalysis.department,
        keywords: normalizedAnalysis.keywords,
        date: new Date().toISOString(),
        analysis: normalizedAnalysis,
        questions: normalizedQuestions,
      }
      setJobPostHistory((prev) => [historyItem, ...prev])
      window.history.pushState({ jobpostStep: 'analysis' }, '')
    } catch (err) {
      setError(err?.message || '공고 분석에 실패했습니다.')
    } finally {
      setIsAnalyzingJobPost(false)
    }
  }

  // 히스토리에서 공고 선택
  const handleSelectJobPostHistory = (item) => {
    setJobPostUrl(item.url)
    setJobPostAnalysis(item.analysis)
    setJobPostQuestions(item.questions)
    setSelectedJobQuestion(null)
    setJobFeedback(null)
    // 브라우저 히스토리에 상태 추가
    window.history.pushState({ jobpostStep: 'analysis' }, '')
  }

  // 공고 분석 결과에서 뒤로가기 (URL 입력 화면으로)
  const handleBackToUrlInput = () => {
    setJobPostAnalysis(null)
    setJobPostQuestions([])
    setSelectedJobQuestion(null)
    setJobFeedback(null)
  }

  const handleSelectJobQuestion = (question) => {
    setSelectedJobQuestion(question)
    setJobAnswer('')
    setJobFeedback(null)
    // 브라우저 히스토리에 상태 추가
    window.history.pushState({ jobpostStep: 'question' }, '')
    // 맨 위로 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmitJobAnswer = async () => {
    if (!jobAnswer.trim() || !selectedJobQuestion) return

    setIsSubmittingJobAnswer(true)
    setError('')

    try {
      const resolvedQuestionId = selectedJobQuestion.questionId || selectedJobQuestion.id
      const shouldCallApi =
        selectedJobQuestion?.source === 'api' && isUuid(String(resolvedQuestionId))

      if (!shouldCallApi) {
        throw new Error('유효한 API 질문이 아닙니다. 공고를 다시 분석해 주세요.')
      }

      const feedbackData = normalizeFeedbackResponse(
        await submitTextInterviewAnswer(
          resolvedQuestionId,
          { answer: jobAnswer.trim() },
          resolveAccessToken()
        ),
        {
          id: selectedJobQuestion.id,
          text: selectedJobQuestion.text,
          category: selectedJobQuestion.category,
        },
        jobAnswer.trim()
      )

      setJobFeedback(feedbackData)
      recordInterviewResult({
        ...feedbackData,
        source: 'jobpost',
        company: jobPostAnalysis?.company,
        position: jobPostAnalysis?.position,
      })
      window.history.pushState({ jobpostStep: 'feedback' }, '')
    } catch (err) {
      setError(err?.message || '답변 제출에 실패했습니다.')
    } finally {
      setIsSubmittingJobAnswer(false)
    }
  }

  const handleResetJobPost = () => {
    setJobPostUrl('')
    setJobPostAnalysis(null)
    setJobPostQuestions([])
    setSelectedJobQuestion(null)
    setJobAnswer('')
    setJobFeedback(null)
  }

  const handleBackToQuestions = () => {
    setSelectedJobQuestion(null)
    setJobAnswer('')
    setJobFeedback(null)
  }

  // 브라우저 뒤로가기 처리를 위한 ref (클로저 문제 방지)
  const jobpostStateRef = useRef({ activeTab, jobPostAnalysis, selectedJobQuestion, jobFeedback })

  useEffect(() => {
    jobpostStateRef.current = { activeTab, jobPostAnalysis, selectedJobQuestion, jobFeedback }
  }, [activeTab, jobPostAnalysis, selectedJobQuestion, jobFeedback])

  useEffect(() => {
    const handlePopState = (event) => {
      const { activeTab: tab, jobPostAnalysis: analysis, selectedJobQuestion: question, jobFeedback: feedback } = jobpostStateRef.current

      // jobpost 탭이 아니면 무시
      if (tab !== 'jobpost') return

      // 현재 스크롤 위치 저장
      const currentScrollY = window.scrollY

      // 현재 상태에 따라 뒤로가기 처리
      if (feedback) {
        // 피드백 화면 -> 질문 연습 화면
        setJobFeedback(null)
      } else if (question) {
        // 질문 연습 화면 -> 분석 결과 화면
        setSelectedJobQuestion(null)
        setJobAnswer('')
      } else if (analysis) {
        // 분석 결과 화면 -> URL 입력 화면
        setJobPostAnalysis(null)
        setJobPostQuestions([])
      } else {
        // URL 입력 화면에서 뒤로가기 -> 기본 동작 (다른 페이지로 이동)
        return
      }

      // 스크롤 위치 복원 (렌더링 후)
      setTimeout(() => {
        window.scrollTo(0, currentScrollY)
      }, 50)

      // 기본 동작 방지를 위해 히스토리 다시 추가
      window.history.pushState({ jobpostStep: 'handled' }, '')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <div className="coach">
      <div className="coach__container">
        {/* Header */}
        <header className="coach__header">
          <div>
            <h1>AI 면접 코칭</h1>
          </div>
          <div className="coach__tabs">
            <button
              className={`coach__tab ${activeTab === 'practice' ? 'coach__tab--active' : ''}`}
              onClick={() => setActiveTab('practice')}
            >
              오늘의 면접
            </button>
            <ProTab
              isActive={activeTab === 'jobpost'}
              onClick={() => handleProTabClick('jobpost', 'jobpost')}
              feature="jobpost"
            >
              공고 분석
            </ProTab>
            <ProTab
              isActive={activeTab === 'mock'}
              onClick={() => handleProTabClick('mock', 'mock')}
              feature="mock"
            >
              모의 면접
            </ProTab>
            <button
              className={`coach__tab ${activeTab === 'history' ? 'coach__tab--active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              면접 기록
            </button>
          </div>
        </header>

        {error && (
          <div className="coach__error">
            <span>⚠️</span> {error}
          </div>
        )}

        {activeTab === 'practice' ? (
          <div className="coach__content">
            <AnimatePresence mode="wait">
              {!feedback ? (
                <Motion.div
                  key="question"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="coach__practice"
                >
                  {/* Question Card */}
                  <div className="coach__question card">
                    {isLoadingQuestion ? (
                      <div className="coach__loading">
                        <div className="spinner" />
                        <p>질문을 불러오는 중...</p>
                      </div>
                    ) : (
                      <>
                        <div className="coach__question-header">
                          <span className="badge">{question?.category}</span>
                          <span className="coach__question-label">오늘의 면접 질문</span>
                        </div>
                        <p className="coach__question-text">{question?.text}</p>
                      </>
                    )}
                  </div>

                  {/* Answer Input */}
                  <div className="coach__answer card">
                    <label className="coach__answer-label">나의 답변</label>
                    <textarea
                      ref={textareaRef}
                      className="coach__textarea"
                      placeholder="STAR 기법을 활용하여 답변해보세요.&#10;&#10;• Situation: 상황 설명&#10;• Task: 맡은 역할&#10;• Action: 구체적 행동&#10;• Result: 결과 및 배운점"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={8}
                      disabled={isSubmitting}
                    />
                    <div className="coach__answer-footer">
                      <span className="coach__char-count">{answer.length}자</span>
                      <button
                        className="btn btn--primary"
                        onClick={handleSubmit}
                        disabled={!answer.trim() || isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <span className="spinner spinner--sm" />
                            분석 중...
                          </>
                        ) : (
                          'AI 피드백 받기'
                        )}
                      </button>
                    </div>
                  </div>
                </Motion.div>
              ) : (
                <Motion.div
                  key="feedback"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="coach__feedback"
                >
                  {/* Score Overview */}
                  <div className="coach__score-card card card--gradient">
                    <div className="coach__score-main">
                      <div
                        className="coach__score-circle"
                        style={{ '--score-color': getScoreColor(feedback.score) }}
                      >
                        <span className="coach__score-value">{feedback.score}</span>
                        <span className="coach__score-label">점</span>
                      </div>
                      <div className="coach__score-info">
                        <h3>수고하셨습니다! 🎉</h3>
                        <p>{feedback.summary}</p>
                      </div>
                    </div>

                  </div>

                  {/* Feedback Details */}
                  <div className="coach__feedback-grid">
                    <div className="coach__feedback-card card">
                      <h4>💪 강점</h4>
                      <ul>
                        {(feedback.strengths || []).map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="coach__feedback-card card">
                      <h4>📈 개선점</h4>
                      <ul>
                        {(feedback.improvements || []).map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* My Answer */}
                  <div className="coach__my-answer card">
                    <h4>내가 작성한 답변</h4>
                    <p>{feedback.answer}</p>
                  </div>

                  <button className="btn btn--primary btn--lg btn--block" onClick={handleNewQuestion}>
                    새로운 질문 받기
                  </button>
                </Motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : activeTab === 'history' ? (
          <div className="coach__history">
            {/* History Sub Tabs */}
            <div className="coach__history-subtabs">
              <button
                className={`coach__history-subtab ${historySubTab === 'general' ? 'coach__history-subtab--active' : ''}`}
                onClick={() => setHistorySubTab('general')}
              >
                일반 면접
              </button>
              <button
                className={`coach__history-subtab ${historySubTab === 'company' ? 'coach__history-subtab--active' : ''}`}
                onClick={() => setHistorySubTab('company')}
              >
                기업 면접
              </button>
              <button
                className={`coach__history-subtab coach__history-subtab--pro ${historySubTab === 'summary' ? 'coach__history-subtab--active' : ''}`}
                onClick={() => {
                  if (!isPro) {
                    setProModalFeature('all')
                    setShowProModal(true)
                  } else {
                    setHistorySubTab('summary')
                  }
                }}
              >
                요약 분석
                {!isPro && <span className="coach__subtab-pro-badge">PRO</span>}
              </button>
            </div>

            {/* 요약 분석 탭 */}
            {historySubTab === 'summary' ? (
              <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="coach__summary"
              >
                <div className="coach__summary-header card">
                  <div className="coach__summary-title">
                    <h3>나의 면접 역량 분석</h3>
                    <p>지금까지의 면접 연습을 바탕으로 분석한 결과입니다</p>
                  </div>
                  <div className="coach__summary-stats">
                    <div className="coach__summary-stat">
                      <span className="coach__summary-stat-value">{(scoreHistory?.length || 0) + (companyHistory?.length || 0)}</span>
                      <span className="coach__summary-stat-label">총 연습</span>
                    </div>
                    <div className="coach__summary-stat">
                      <span className="coach__summary-stat-value">
                        {scoreHistory?.length > 0
                          ? Math.round(scoreHistory.reduce((acc, cur) => acc + (cur.score || 0), 0) / scoreHistory.length)
                          : 0}
                      </span>
                      <span className="coach__summary-stat-label">평균 점수</span>
                    </div>
                  </div>
                </div>

                <div className="coach__summary-chart card">
                  <h4>역량 분포</h4>
                  <HexagonChart
                    scores={calculateCategoryScores(scoreHistory)}
                    size={isMobile ? 260 : 320}
                    isMobile={isMobile}
                  />
                </div>

                <div className="coach__summary-analysis">
                  {(() => {
                    const scores = calculateCategoryScores(scoreHistory)
                    const { strengths, weaknesses } = analyzeStrengthsWeaknesses(scores)

                    // 강점/약점 설명 텍스트 생성
                    const strengthDescriptions = {
                      '적극성': '자기 PR과 성공 경험을 효과적으로 표현하고 있어요.',
                      '가치관': '기업의 가치관과 본인의 가치를 잘 연결하고 있어요.',
                      '협동성': '팀워크와 협업 경험을 구체적으로 설명하고 있어요.',
                      '성실성': '꾸준함과 책임감을 잘 어필하고 있어요.',
                      '창의력': '문제 해결과 창의적 사고를 잘 보여주고 있어요.',
                      '논리력': '답변을 논리적으로 구조화하는 능력이 뛰어나요.',
                    }
                    const weaknessDescriptions = {
                      '적극성': '자기 PR과 성공 경험 표현을 더 연습해 보세요.',
                      '가치관': '기업 가치관과의 연결고리를 더 명확히 해보세요.',
                      '협동성': '팀 프로젝트 경험을 더 구체적으로 준비해 보세요.',
                      '성실성': '성과를 수치화하고 꾸준함을 보여주는 사례를 준비해 보세요.',
                      '창의력': '문제 해결 경험과 창의적 접근 사례를 정리해 보세요.',
                      '논리력': 'STAR 기법을 활용한 논리적 구조화를 연습해 보세요.',
                    }

                    // 약점 기반 추천 학습 생성
                    const recommendationMap = {
                      '적극성': ['자기 PR 연습하기', '성공 경험 정리하기'],
                      '가치관': ['기업 가치관 분석법', '가치관 답변 프레임워크'],
                      '협동성': ['팀 프로젝트 경험 구체화', '갈등 해결 사례 정리'],
                      '성실성': ['성과 수치화 연습', '꾸준함을 보여주는 사례 정리'],
                      '창의력': ['문제 해결 경험 정리', '창의적 접근 사례 준비'],
                      '논리력': ['STAR 기법 심화 학습', '논리적 구조화 연습'],
                    }
                    const recommendations = weaknesses.flatMap(w => recommendationMap[w.label] || [])

                    return (
                      <>
                        <div className="coach__summary-card card">
                          <h4>💪 강점</h4>
                          <div className="coach__summary-text-items">
                            {strengths.map((item, idx) => (
                              <div key={idx} className="coach__summary-text-item">
                                <span className="coach__summary-text-label">{item.label}</span>
                                <p className="coach__summary-text-desc">{strengthDescriptions[item.label]}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="coach__summary-card card">
                          <h4>📉 약점</h4>
                          <div className="coach__summary-text-items">
                            {weaknesses.map((item, idx) => (
                              <div key={idx} className="coach__summary-text-item coach__summary-text-item--weakness">
                                <span className="coach__summary-text-label">{item.label}</span>
                                <p className="coach__summary-text-desc">{weaknessDescriptions[item.label]}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="coach__summary-card coach__summary-card--full card">
                          <h4>📚 추천 학습</h4>
                          <div className="coach__summary-recommendations">
                            {recommendations.slice(0, 4).map((rec, idx) => (
                              <div key={idx} className="coach__summary-recommendation">
                                <span className="coach__summary-recommendation-icon">📖</span>
                                <span>{rec}</span>
                              </div>
                            ))}
                          </div>
                          <p className="coach__summary-tip">
                            💡 약점 영역에 집중해서 연습하면 빠르게 성장할 수 있어요!
                          </p>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </Motion.div>
            ) : histories.length === 0 ? (
              <div className="coach__empty card">
                <span className="coach__empty-icon">📝</span>
                <h3>{historySubTab === 'company' ? '기업 면접 기록이 없습니다' : '연습 기록이 없습니다'}</h3>
                <p>{historySubTab === 'company' ? '공고 분석에서 면접 연습을 시작해보세요!' : '첫 면접 연습을 시작해보세요!'}</p>
                <button className="btn btn--primary" onClick={() => setActiveTab(historySubTab === 'company' ? 'jobpost' : 'practice')}>
                  {historySubTab === 'company' ? '공고 분석하기' : '연습 시작하기'}
                </button>
              </div>
            ) : (
              <>
                {/* Search Input */}
                <div className="coach__search">
                  <div className="coach__search-input-wrapper">
                    <span className="coach__search-icon">🔍</span>
                    <input
                      type="text"
                      className="coach__search-input"
                      placeholder="면접 질문 검색..."
                      value={searchQuery}
                      onChange={handleSearchChange}
                    />
                    {searchQuery && (
                      <button
                        className="coach__search-clear"
                        onClick={() => {
                          setSearchQuery('')
                          setCurrentPage(1)
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <span className="coach__search-count">
                    총 {filteredHistories.length}개의 기록
                  </span>
                </div>

                {/* History Card Container */}
                <div className="coach__history-card card">
                  {/* History List */}
                  {filteredHistories.length === 0 ? (
                    <div className="coach__history-empty">
                      <span className="coach__empty-icon">🔍</span>
                      <h3>검색 결과가 없습니다</h3>
                      <p>다른 키워드로 검색해보세요</p>
                    </div>
                  ) : (
                    <div className="coach__history-list">
                      {paginatedHistories.map((item, idx) => (
                        <div
                          key={item.historyId || idx}
                          className="coach__history-item"
                          onClick={() => handleHistoryClick(item)}
                        >
                          <div className="coach__history-content">
                            <div className="coach__history-main">
                              <div className="coach__history-header">
                                <span className="badge">{item.category || '경험'}</span>
                                {item.company && (
                                  <span className="coach__history-company">{item.company}</span>
                                )}
                                <span className="coach__history-date">
                                  {new Date(item.date).toLocaleDateString('ko-KR')}
                                </span>
                              </div>
                              <p className="coach__history-question">
                                {typeof item.question === 'object' ? item.question?.text : item.question}
                              </p>
                            </div>
                            <div
                              className="coach__history-score"
                              style={{ '--score-color': getScoreColor(item.score || 0) }}
                            >
                              <span className="coach__history-score-value">{item.score || 0}</span>
                              <span className="coach__history-score-label">점</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination - 항상 표시 */}
                  <div className="coach__pagination">
                    {(() => {
                      const maxVisible = isMobile ? 3 : 5
                      const currentGroup = Math.floor((currentPage - 1) / maxVisible)
                      const startPage = currentGroup * maxVisible + 1
                      const endPage = Math.min(startPage + maxVisible - 1, totalPages || 1)
                      const pages = []
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(i)
                      }

                      return (
                        <>
                          {/* 이전 그룹으로 */}
                          <button
                            className="coach__pagination-btn"
                            onClick={() => setCurrentPage(startPage - 1)}
                            disabled={startPage === 1}
                          >
                            ‹
                          </button>
                          {/* 페이지 번호들 */}
                          {pages.map((page) => (
                            <button
                              key={page}
                              className={`coach__pagination-btn ${currentPage === page ? 'coach__pagination-btn--active' : ''}`}
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </button>
                          ))}
                          {/* 다음 그룹으로 */}
                          <button
                            className="coach__pagination-btn"
                            onClick={() => setCurrentPage(endPage + 1)}
                            disabled={endPage >= (totalPages || 1)}
                          >
                            ›
                          </button>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : activeTab === 'mock' ? (
          <div className="coach__mock">
            {/* Pro 안내 배너 */}
            {!isPro && (
              <div className="coach__pro-notice">
                <div className="coach__pro-notice-content">
                  <span className="coach__pro-notice-icon">🎙️</span>
                  <div className="coach__pro-notice-text">
                    <span className="coach__pro-notice-label">무료 체험</span>
                    <span className="coach__pro-notice-count">
                      {canUseMockInterview().remaining > 0
                        ? `이번 달 ${canUseMockInterview().remaining}회 남음`
                        : '이번 달 체험 완료'}
                    </span>
                  </div>
                </div>
                <button
                  className="coach__pro-notice-btn"
                  onClick={() => { setProModalFeature('mock'); setShowProModal(true); }}
                >
                  Pro 업그레이드
                </button>
              </div>
            )}
            <MockInterview />
          </div>
        ) : (
          <div className="coach__jobpost">
            {/* Pro 안내 배너 */}
            {!isPro && (
              <div className="coach__pro-notice">
                <div className="coach__pro-notice-content">
                  <span className="coach__pro-notice-icon">📋</span>
                  <div className="coach__pro-notice-text">
                    <span className="coach__pro-notice-label">무료 체험</span>
                    <span className="coach__pro-notice-count">
                      {canUseJobPost().remaining > 0
                        ? `이번 달 ${canUseJobPost().remaining}회 남음`
                        : '이번 달 체험 완료'}
                    </span>
                  </div>
                </div>
                <button
                  className="coach__pro-notice-btn"
                  onClick={() => { setProModalFeature('jobpost'); setShowProModal(true); }}
                >
                  Pro 업그레이드
                </button>
              </div>
            )}
            <AnimatePresence mode="wait">
              {!jobPostAnalysis ? (
                <Motion.div
                  key="url-input"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="coach__jobpost-input"
                >
                  <div className="card">
                    <div className="coach__jobpost-header">
                      <h3>채용 공고 기반 면접 준비</h3>
                      <p>지원하려는 채용 공고 URL을 입력하면, AI가 해당 공고를 분석하여 맞춤형 면접 질문을 생성합니다.</p>
                    </div>
                    <div className="coach__jobpost-form">
                      <div className="coach__jobpost-url-wrapper">
                        <span className="coach__jobpost-url-icon">🔗</span>
                        <input
                          type="url"
                          className="coach__jobpost-url-input"
                          placeholder="채용 공고 URL을 입력하세요 (예: https://career.naver.com/...)"
                          value={jobPostUrl}
                          onChange={(e) => setJobPostUrl(e.target.value)}
                          disabled={isAnalyzingJobPost}
                        />
                      </div>
                      <button
                        className="btn btn--primary"
                        onClick={handleAnalyzeJobPost}
                        disabled={!jobPostUrl.trim() || isAnalyzingJobPost}
                      >
                        {isAnalyzingJobPost ? (
                          <>
                            <span className="spinner spinner--sm" />
                            분석 중...
                          </>
                        ) : (
                          '공고 분석하기'
                        )}
                      </button>
                    </div>
                    <div className="coach__jobpost-tips">
                      <h4>채용 사이트 바로가기</h4>
                      <div className="coach__jobpost-platforms">
                        <a href="https://www.wanted.co.kr" target="_blank" rel="noopener noreferrer" className="coach__jobpost-platform coach__jobpost-platform--link">
                          <img src="https://static.wanted.co.kr/favicon/new/favicon.ico" alt="" className="coach__jobpost-platform-icon" />
                          원티드
                        </a>
                        <a href="https://www.jobkorea.co.kr" target="_blank" rel="noopener noreferrer" className="coach__jobpost-platform coach__jobpost-platform--link">
                          <img src="https://www.jobkorea.co.kr/favicon.ico" alt="" className="coach__jobpost-platform-icon" />
                          잡코리아
                        </a>
                        <a href="https://www.saramin.co.kr" target="_blank" rel="noopener noreferrer" className="coach__jobpost-platform coach__jobpost-platform--link">
                          <img src="https://www.saramin.co.kr/favicon.ico" alt="" className="coach__jobpost-platform-icon" />
                          사람인
                        </a>
                        <a href="https://www.linkedin.com/jobs" target="_blank" rel="noopener noreferrer" className="coach__jobpost-platform coach__jobpost-platform--link">
                          <img src="https://static.licdn.com/aero-v1/sc/h/akt4ae504epesldzj74dzred8" alt="" className="coach__jobpost-platform-icon" />
                          링크드인
                        </a>
                        <a href="https://www.catch.co.kr" target="_blank" rel="noopener noreferrer" className="coach__jobpost-platform coach__jobpost-platform--link">
                          <img src="https://www.catch.co.kr/favicon.ico" alt="" className="coach__jobpost-platform-icon" />
                          캐치
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* 분석 히스토리 */}
                  {jobPostHistory.length > 0 && (
                    <div className="coach__jobpost-history card">
                      <div className="coach__jobpost-history-header">
                        <h4>최근 분석한 공고</h4>
                        <div className="coach__jobpost-search">
                          <span className="coach__jobpost-search-icon">🔍</span>
                          <input
                            type="text"
                            className="coach__jobpost-search-input"
                            placeholder="회사, 포지션, 키워드 검색..."
                            value={jobPostSearchQuery}
                            onChange={(e) => {
                              setJobPostSearchQuery(e.target.value)
                              setJobPostHistoryPage(1)
                            }}
                          />
                          {jobPostSearchQuery && (
                            <button
                              className="coach__jobpost-search-clear"
                              onClick={() => {
                                setJobPostSearchQuery('')
                                setJobPostHistoryPage(1)
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="coach__jobpost-history-wrapper">
                        <div className="coach__jobpost-history-list">
                          {filteredJobPostHistory.length === 0 ? (
                            <div className="coach__jobpost-history-empty">
                              검색 결과가 없습니다
                            </div>
                          ) : (
                            filteredJobPostHistory
                              .slice((jobPostHistoryPage - 1) * JOB_POST_ITEMS_PER_PAGE, jobPostHistoryPage * JOB_POST_ITEMS_PER_PAGE)
                              .map((item) => (
                                <div
                                  key={item.id}
                                  className="coach__jobpost-history-item"
                                  onClick={() => handleSelectJobPostHistory(item)}
                                >
                                  <div className="coach__jobpost-history-content">
                                    <div className="coach__jobpost-history-info">
                                      <strong>{item.company}</strong>
                                      <span>{item.position}</span>
                                    </div>
                                    <span className="coach__jobpost-history-date">
                                      {new Date(item.date).toLocaleDateString('ko-KR')}
                                    </span>
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                        {(() => {
                          const totalPages = Math.ceil(filteredJobPostHistory.length / JOB_POST_ITEMS_PER_PAGE)

                          // 3개씩 표시 (1-3, 4-6, 7-9 ...)
                          const currentGroup = Math.floor((jobPostHistoryPage - 1) / 3)
                          const startPage = currentGroup * 3 + 1
                          const endPage = Math.min(startPage + 2, totalPages)
                          const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)

                          return (
                            <div
                              className="coach__pagination coach__pagination--sm"
                              style={{ visibility: totalPages <= 1 ? 'hidden' : 'visible' }}
                            >
                              <button
                                className="coach__pagination-btn"
                                onClick={() => setJobPostHistoryPage(p => Math.max(1, p - 1))}
                                disabled={jobPostHistoryPage === 1}
                              >
                                ‹
                              </button>
                              {pages.map((page) => (
                                <button
                                  key={page}
                                  className={`coach__pagination-btn ${jobPostHistoryPage === page ? 'coach__pagination-btn--active' : ''}`}
                                  onClick={() => setJobPostHistoryPage(page)}
                                >
                                  {page}
                                </button>
                              ))}
                              <button
                                className="coach__pagination-btn"
                                onClick={() => setJobPostHistoryPage(p => Math.min(totalPages, p + 1))}
                                disabled={jobPostHistoryPage === totalPages}
                              >
                                ›
                              </button>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </Motion.div>
              ) : !selectedJobQuestion ? (
                <Motion.div
                  key="analysis-result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="coach__jobpost-result"
                >
                  {/* Back Button */}
                  <div className="coach__jobpost-back-wrapper">
                    <button className="btn btn--primary btn--sm" onClick={handleBackToUrlInput}>
                      이전으로
                    </button>
                  </div>

                  {/* Company Info Card */}
                  <div className="coach__jobpost-company card">
                    <div className="coach__jobpost-company-header">
                      <div>
                        <h3>{jobPostAnalysis.company}</h3>
                        <p>{jobPostAnalysis.position} · {jobPostAnalysis.department}</p>
                      </div>
                    </div>
                    <div className="coach__jobpost-keywords">
                      {jobPostAnalysis.keywords.map((keyword, idx) => (
                        <span key={idx} className="coach__jobpost-keyword">{keyword}</span>
                      ))}
                    </div>
                  </div>

                  {/* Requirements */}
                  <div className="coach__jobpost-requirements card">
                    <h4>주요 자격요건</h4>
                    <ul>
                      {jobPostAnalysis.requirements.map((req, idx) => (
                        <li key={idx}>{req}</li>
                      ))}
                    </ul>
                    {jobPostAnalysis.preferredQualifications.length > 0 && (
                      <>
                        <h4>우대사항</h4>
                        <ul className="coach__jobpost-preferred">
                          {jobPostAnalysis.preferredQualifications.map((pref, idx) => (
                            <li key={idx}>{pref}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>

                  {/* Generated Questions */}
                  <div className="coach__jobpost-questions">
                    <h4>맞춤형 면접 질문</h4>
                    <p className="coach__jobpost-questions-desc">공고 분석을 바탕으로 예상되는 면접 질문입니다. 클릭하여 연습해보세요.</p>
                    <div className="coach__jobpost-questions-list">
                      {jobPostQuestions.map((q) => (
                        <div
                          key={q.id}
                          className="coach__jobpost-question-item card card--hover"
                          onClick={() => handleSelectJobQuestion(q)}
                        >
                          <div className="coach__jobpost-question-content">
                            <span className="badge">{q.category}</span>
                            <p>{q.text}</p>
                            <span className="coach__jobpost-question-relevance">{q.relevance}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Motion.div>
              ) : (
                <Motion.div
                  key="practice"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="coach__jobpost-practice"
                >
                  {!jobFeedback ? (
                    <>
                      {/* Back Button */}
                      <div className="coach__jobpost-back-wrapper">
                        <button className="btn btn--primary btn--sm" onClick={handleBackToQuestions}>
                          이전으로
                        </button>
                      </div>

                      {/* Question Card */}
                      <div className="coach__question card">
                        <div className="coach__question-header">
                          <span className="badge">{selectedJobQuestion.category}</span>
                          <span className="coach__question-label">{jobPostAnalysis.company} · {jobPostAnalysis.position}</span>
                        </div>
                        <p className="coach__question-text">{selectedJobQuestion.text}</p>
                        <span className="coach__jobpost-question-relevance">{selectedJobQuestion.relevance}</span>
                      </div>

                      {/* Answer Input */}
                      <div className="coach__answer card">
                        <label className="coach__answer-label">나의 답변</label>
                        <textarea
                          className="coach__textarea"
                          placeholder="STAR 기법을 활용하여 답변해보세요.&#10;&#10;• Situation: 상황 설명&#10;• Task: 맡은 역할&#10;• Action: 구체적 행동&#10;• Result: 결과 및 배운점"
                          value={jobAnswer}
                          onChange={(e) => setJobAnswer(e.target.value)}
                          rows={8}
                          disabled={isSubmittingJobAnswer}
                        />
                        <div className="coach__answer-footer">
                          <span className="coach__char-count">{jobAnswer.length}자</span>
                          <button
                            className="btn btn--primary"
                            onClick={handleSubmitJobAnswer}
                            disabled={!jobAnswer.trim() || isSubmittingJobAnswer}
                          >
                            {isSubmittingJobAnswer ? (
                              <>
                                <span className="spinner spinner--sm" />
                                분석 중...
                              </>
                            ) : (
                              'AI 피드백 받기'
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Score Overview */}
                      <div className="coach__score-card card card--gradient">
                        <div className="coach__score-main">
                          <div
                            className="coach__score-circle"
                            style={{ '--score-color': getScoreColor(jobFeedback.score) }}
                          >
                            <span className="coach__score-value">{jobFeedback.score}</span>
                            <span className="coach__score-label">점</span>
                          </div>
                          <div className="coach__score-info">
                            <h3>수고하셨습니다!</h3>
                            <p>{jobFeedback.summary}</p>
                          </div>
                        </div>

                      </div>

                      {/* Feedback Details */}
                      <div className="coach__feedback-grid">
                        <div className="coach__feedback-card card">
                          <h4>강점</h4>
                          <ul>
                            {(jobFeedback.strengths || []).map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="coach__feedback-card card">
                          <h4>개선점</h4>
                          <ul>
                            {(jobFeedback.improvements || []).map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* My Answer */}
                      <div className="coach__my-answer card">
                        <h4>내가 작성한 답변</h4>
                        <p>{jobFeedback.answer}</p>
                      </div>

                      <div className="coach__jobpost-actions">
                        <button className="btn btn--primary" onClick={handleBackToQuestions}>
                          이전으로
                        </button>
                        <button className="btn btn--secondary" onClick={handleResetJobPost}>
                          새로운 공고 분석
                        </button>
                      </div>
                    </>
                  )}
                </Motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* History Detail Modal */}
      <AnimatePresence>
        {isDetailOpen && selectedHistory && (
          <Motion.div
            className="coach__modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseDetail}
          >
            <Motion.div
              className="coach__modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="coach__modal-header">
                <div>
                  <span className="badge">{selectedHistory.category || '경험'}</span>
                  <span className="coach__modal-date">
                    {new Date(selectedHistory.date).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <button className="coach__modal-close" onClick={handleCloseDetail}>
                  ✕
                </button>
              </div>

              {/* Question */}
              <div className="coach__modal-question">
                <span className="coach__modal-question-label">질문</span>
                <p>
                  {typeof selectedHistory.question === 'object'
                    ? selectedHistory.question?.text
                    : selectedHistory.question}
                </p>
              </div>

              {/* Score & Points Header */}
              <div className="coach__modal-result">
                <div className="coach__modal-result-score">
                  <div
                    className="coach__modal-score-circle"
                    style={{ '--score-color': getScoreColor(selectedHistory.score || 0) }}
                  >
                    <span className="coach__modal-score-value">{selectedHistory.score ?? '-'}</span>
                    <span className="coach__modal-score-label">점</span>
                  </div>
                  <div className="coach__modal-score-info">
                    <p>{selectedHistory.summary}</p>
                  </div>
                </div>
                <div className="coach__modal-result-points">
                  <span className="coach__modal-result-points-label">획득</span>
                  <span className="coach__modal-result-points-value">
                    {typeof selectedHistory.earnedPoints === 'number'
                      ? `+${selectedHistory.earnedPoints}P`
                      : '-'}
                  </span>
                </div>
              </div>

              {/* Feedback Cards */}
              <div className="coach__modal-feedback">
                <div className="coach__modal-feedback-card coach__modal-feedback-card--strength">
                  <h5>💪 잘한 점</h5>
                  <ul>
                    {(selectedHistory.strengths || []).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="coach__modal-feedback-card coach__modal-feedback-card--improvement">
                  <h5>📈 개선할 점</h5>
                  <ul>
                    {(selectedHistory.improvements || []).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="coach__modal-feedback-card coach__modal-feedback-card--study">
                  <h5>📚 추천 학습</h5>
                  <ul>
                    {(selectedHistory.recommendations || []).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Answer Section */}
              <div className="coach__modal-answer">
                <h4>내가 작성한 답변</h4>
                {isReFeedbackMode ? (
                  <textarea
                    ref={editTextareaRef}
                    className="coach__textarea"
                    value={editedAnswer}
                    onChange={(e) => setEditedAnswer(e.target.value)}
                    placeholder="답변을 수정해보세요..."
                    rows={6}
                    disabled={isSubmittingReFeedback}
                  />
                ) : (
                  <p className="coach__modal-answer-text">{selectedHistory.answer}</p>
                )}
              </div>

              {/* Re-Feedback Result */}
              {reFeedback && (
                <Motion.div
                  className="coach__modal-refeedback"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h4>AI 재피드백 결과</h4>
                  <div className="coach__modal-refeedback-score">
                    <div
                      className="coach__modal-score-circle coach__modal-score-circle--sm"
                      style={{ '--score-color': getScoreColor(reFeedback.score) }}
                    >
                      <span className="coach__modal-score-value">{reFeedback.score}</span>
                      <span className="coach__modal-score-label">점</span>
                    </div>
                    <p>{reFeedback.summary}</p>
                  </div>

                  <div className="coach__modal-feedback">
                    <div className="coach__modal-feedback-card coach__modal-feedback-card--strength">
                      <h5>💪 잘한 점</h5>
                      <ul>
                        {(reFeedback.strengths || []).map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="coach__modal-feedback-card coach__modal-feedback-card--improvement">
                      <h5>📈 개선할 점</h5>
                      <ul>
                        {(reFeedback.improvements || []).map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="coach__modal-feedback-card coach__modal-feedback-card--study">
                      <h5>📚 추천 학습</h5>
                      <ul>
                        {(reFeedback.recommendations || []).map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Motion.div>
              )}

              {/* Action Buttons */}
              <div className="coach__modal-actions">
                {!reFeedback && (
                  <>
                    {isReFeedbackMode ? (
                      <>
                        <button
                          className="btn btn--secondary"
                          onClick={() => {
                            setIsReFeedbackMode(false)
                            setEditedAnswer(selectedHistory.answer || '')
                          }}
                          disabled={isSubmittingReFeedback}
                        >
                          취소
                        </button>
                        <button
                          className="btn btn--primary"
                          onClick={handleSubmitReFeedback}
                          disabled={!editedAnswer.trim() || isSubmittingReFeedback}
                        >
                          {isSubmittingReFeedback ? (
                            <>
                              <span className="spinner spinner--sm" />
                              분석 중...
                            </>
                          ) : (
                            'AI 재피드백 받기'
                          )}
                        </button>
                      </>
                    ) : (
                      <button className="btn btn--primary btn--block" onClick={handleStartReFeedback}>
                        답변 수정 후 AI 재피드백 받기
                      </button>
                    )}
                  </>
                )}
                {reFeedback && (
                  <button className="btn btn--primary btn--block" onClick={handleCloseDetail}>
                    확인
                  </button>
                )}
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Pro Upgrade Modal */}
      <ProUpgradeModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        feature={proModalFeature}
      />
    </div>
  )
}
