import { useState, useRef, useEffect, useCallback } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { useAppState } from '../context/AppStateContext'
import { useTTS } from '../hooks/useTTS'
import { speechFromInterviewQuestion } from '../utils/interviewTts'
import {
  createVideoInterviewQuestion,
  extractVideoInterviewResultFromMessage,
  getVideoInterviewSessionDetail,
  collectRetakeQuestionIdCandidates,
  loadRetakeSessionDetail,
  registerRetakeChildSession,
  retryVideoInterviewQuestions,
  startVideoInterviewRetake,
  streamVideoInterviewResult,
  submitVideoInterviewAnswer,
  unwrapVideoResultPayload,
} from '../utils/interviewApi'
import Dropdown from './Dropdown'
import '../styles/components/MockInterview.css'

const MIN_QUESTIONS = 1
const MAX_QUESTIONS = 3

/**
 * TTS 등 장시간 await 동안 진행 바가 멈춘 뒤 한 번에 도약하는 느낌을 줄이기 위해,
 * capPct 이하로만 서서히 올린다. 완료 시에는 별도로 milestoneAfter를 설정한다.
 */
function startPreloadProgressRamp({ setProgress, signal, fromPct, capPct, intervalMs = 200 }) {
  let current = fromPct
  let stopped = false
  const tick = () => {
    if (stopped || signal.aborted) return
    const room = capPct - current
    if (room <= 0.35) {
      current = capPct
      setProgress(Math.round(current))
      return
    }
    const step = Math.max(0.35, room * 0.1)
    current = Math.min(capPct, current + step)
    setProgress(Math.round(current))
  }
  tick()
  const id = setInterval(tick, intervalMs)
  return () => {
    stopped = true
    clearInterval(id)
  }
}

const behaviorMetrics = [
  { id: 'eyeContact', label: '시선 처리', icon: '👁️', description: '카메라를 향한 시선 유지' },
  { id: 'expression', label: '표정', icon: '😊', description: '자연스럽고 밝은 표정' },
  { id: 'posture', label: '자세', icon: '🧍', description: '바른 자세 유지' },
  { id: 'speech', label: '말하기', icon: '🎤', description: '명확한 발음과 적절한 속도' },
]

/** 화상 면접 질문 API 응답 → TTS에 넘길 `text`만 추출 */
function normalizeVideoQuestionList(response) {
  const payload = response?.data ?? response
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.questions)
      ? payload.questions
      : Array.isArray(payload?.items)
        ? payload.items
        : []
  const sessionId = payload?.sessionId ?? payload?.session_id ?? null

  return list
    .map((item, idx) => ({
      id: item?.questionId ?? item?.question_id ?? item?.id ?? `video-q-${Date.now()}-${idx}`,
      text: item?.question ?? item?.text ?? '',
      category: item?.questionType ?? 'VIDEO',
      sessionId: item?.sessionId ?? item?.session_id ?? sessionId,
    }))
    .filter((item) => item.text)
}

function getPreferredVideoMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  return mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

/**
 * 화상 면접 최종 스트림에서 내려오는 피드백은 `sttFeedback` / `videoFeedback` 처럼
 * JSON 문자열이거나 객체일 수 있다. (good / improvement / recommendation)
 */
function parseStructuredFeedback(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const g = raw.good ?? raw.Good
    const i = raw.improvement ?? raw.Improvement
    const r = raw.recommendation ?? raw.Recommendation
    return {
      good: typeof g === 'string' ? g : g != null ? String(g) : '',
      improvement: typeof i === 'string' ? i : i != null ? String(i) : '',
      recommendation: typeof r === 'string' ? r : r != null ? String(r) : '',
    }
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    try {
      return parseStructuredFeedback(JSON.parse(trimmed))
    } catch {
      return { good: '', improvement: trimmed, recommendation: '' }
    }
  }
  return null
}

function toFeedbackTriple(parsed) {
  if (!parsed) {
    return { good: '없음', improvement: '없음', recommendation: '없음' }
  }
  return {
    good: parsed.good?.trim() || '없음',
    improvement: parsed.improvement?.trim() || '없음',
    recommendation: parsed.recommendation?.trim() || '없음',
  }
}

function isFeedbackTripleEmpty(t) {
  return t.good === '없음' && t.improvement === '없음' && t.recommendation === '없음'
}

function parseMaybeJson(value) {
  if (value == null) return null
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

function toNumericScore(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function mapApiQuestionToReportItem(item, idx) {
  const speechParsed =
    parseStructuredFeedback(item?.sttFeedback) ??
    parseStructuredFeedback(item?.speechFeedback) ??
    parseStructuredFeedback(item?.speech)
  const videoParsed =
    parseStructuredFeedback(item?.videoFeedback) ??
    parseStructuredFeedback(item?.video)
  return {
    index: idx + 1,
    questionId: item?.questionId ?? item?.id ?? null,
    question: item?.question || item?.questionText || '',
    score:
      toNumericScore(item?.combinedScore) ??
      toNumericScore(item?.score) ??
      toNumericScore(item?.latestScore),
    speech: toFeedbackTriple(speechParsed),
    video: toFeedbackTriple(videoParsed),
    narrative: item?.combinedFeedback || item?.feedback || '',
    videoUrl:
      item?.videoUrl ??
      item?.video_url ??
      item?.recordingUrl ??
      item?.recording_url ??
      item?.answerVideoUrl ??
      null,
  }
}

function normalizeFinalVideoReport(
  payload,
  fallbackAnswers = [],
  { selectedQuestions = [] } = {}
) {
  const root = unwrapVideoResultPayload(payload)
  if (!root || typeof root !== 'object') return null

  const questionItems = Array.isArray(root.questions)
    ? root.questions
    : Array.isArray(root.questionResults)
      ? root.questionResults
      : []

  const questions = questionItems.map((item, idx) => mapApiQuestionToReportItem(item, idx))

  if (!questions.length && selectedQuestions.length) {
    return {
      overallSummary:
        root.summary || root.overallSummary || '면접 결과 분석이 완료되었습니다.',
      overallScore:
        toNumericScore(root.finalScore) ??
        toNumericScore(root.overallScore) ??
        toNumericScore(root.averageScore),
      questions: selectedQuestions.map((q, idx) => ({
        index: idx + 1,
        questionId: q.id,
        question: q.text,
        score: null,
        speech: toFeedbackTriple(null),
        video: toFeedbackTriple(null),
        narrative: '',
      })),
      answers: fallbackAnswers,
    }
  }

  if (!questions.length) return null

  const overallScore =
    toNumericScore(root.finalScore) ??
    toNumericScore(root.overallScore) ??
    toNumericScore(root.averageScore)

  return {
    overallSummary:
      root.summary || root.overallSummary || '면접 결과 분석이 완료되었습니다.',
    overallScore,
    questions,
    answers: fallbackAnswers,
  }
}

function QuestionFeedbackSection({ q, ordinal, getScoreColor }) {
  const hasScore = typeof q.score === 'number'
  const hasSpeechBlock = q.speech && !isFeedbackTripleEmpty(q.speech)
  const hasVideoBlock = q.video && !isFeedbackTripleEmpty(q.video)
  const hasNarrative = Boolean(String(q.narrative ?? '').trim())
  const hasDetailedFeedback = hasSpeechBlock || hasVideoBlock || hasNarrative
  return (
    <div className="mock-interview__q-section card">
      <div className="mock-interview__q-section-body">
        <div className="mock-interview__q-section-header">
          <div className="mock-interview__q-section-header-text">
            <span className="mock-interview__q-section-badge">질문 {ordinal}</span>
            <p className="mock-interview__q-section-question">{q.question}</p>
          </div>
          {hasScore ? (
            <p
              className="mock-interview__q-section-score-value"
              style={{ color: getScoreColor(q.score) }}
            >
              {q.score}
              <span className="mock-interview__q-section-score-unit">점</span>
            </p>
          ) : null}
        </div>

        {hasDetailedFeedback ? (
          <>
            {hasSpeechBlock ? (
              <div className="mock-interview__q-block">
                <h4 className="mock-interview__q-block-title">스피치 분석</h4>
                <ul className="mock-interview__insight-list">
                  <li>
                    <span className="mock-interview__insight-tag mock-interview__insight-tag--ok">잘한 점</span>
                    <span className="mock-interview__insight-body">{q.speech.good}</span>
                  </li>
                  <li>
                    <span className="mock-interview__insight-tag mock-interview__insight-tag--warn">개선점</span>
                    <span className="mock-interview__insight-body">{q.speech.improvement}</span>
                  </li>
                  <li>
                    <span className="mock-interview__insight-tag mock-interview__insight-tag--tip">추천</span>
                    <span className="mock-interview__insight-body">{q.speech.recommendation}</span>
                  </li>
                </ul>
              </div>
            ) : null}

            {hasVideoBlock ? (
              <div className="mock-interview__q-block">
                <h4 className="mock-interview__q-block-title">비언어 분석</h4>
                <ul className="mock-interview__insight-list">
                  <li>
                    <span className="mock-interview__insight-tag mock-interview__insight-tag--ok">잘한 점</span>
                    <span className="mock-interview__insight-body">{q.video.good}</span>
                  </li>
                  <li>
                    <span className="mock-interview__insight-tag mock-interview__insight-tag--warn">개선점</span>
                    <span className="mock-interview__insight-body">{q.video.improvement}</span>
                  </li>
                  <li>
                    <span className="mock-interview__insight-tag mock-interview__insight-tag--tip">추천</span>
                    <span className="mock-interview__insight-body">{q.video.recommendation}</span>
                  </li>
                </ul>
              </div>
            ) : null}

            {hasNarrative ? (
              <div className="mock-interview__q-block mock-interview__q-block--narrative">
                <h4 className="mock-interview__q-block-title">종합 평가</h4>
                <p className="mock-interview__q-block-text">{q.narrative}</p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mock-interview__q-block">
            <h4 className="mock-interview__q-block-title">진행 결과</h4>
            <p className="mock-interview__q-block-text">
              답변 시간: {Math.floor((q.duration || 0) / 60)}:{String((q.duration || 0) % 60).padStart(2, '0')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MockInterview({
  historyRetakeRequest,
  onHistoryRetakeConsumed,
  onVideoRetakeComplete,
}) {
  const { getAccessToken, recordMockInterviewSession, updateMockInterviewSessionAfterRetake } =
    useAppState()
  const [phase, setPhase] = useState('ready') // ready | loading | interview | analyzing | feedback
  const [isRetakeMode, setIsRetakeMode] = useState(false)
  const [isStartingRetake, setIsStartingRetake] = useState(false)
  const isStartingRetakeRef = useRef(false)
  const historyRetakeMetaRef = useRef(null)
  const lastRetakeUpdatedSessionRef = useRef(null)
  const [isHistoryRetakeFeedback, setIsHistoryRetakeFeedback] = useState(false)
  const pendingUploadRef = useRef(null)
  const [selectedRetakeIndexes, setSelectedRetakeIndexes] = useState(() => new Set())
  const [retakeQueueMeta, setRetakeQueueMeta] = useState(null)
  const retakeQueueRef = useRef([])
  const [questionCount, setQuestionCount] = useState(3)
  const [selectedQuestions, setSelectedQuestions] = useState([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [answers, setAnswers] = useState([])
  const [behaviorAnalysis, setBehaviorAnalysis] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [isQuestionVisible, setIsQuestionVisible] = useState(false)
  const [videoSessionId, setVideoSessionId] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false)
  const [hasPendingRecording, setHasPendingRecording] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const ttsEnabledRef = useRef(true)
  const analysisAbortRef = useRef(null)
  const analysisRunIdRef = useRef(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const [analysisStatusMessage, setAnalysisStatusMessage] = useState('')

  // TTS 음성 선택
  const [selectedSpeaker, setSelectedSpeaker] = useState('alloy_calm')
  const { stop: stopTTS, isPlaying: isTTSPlaying, isLoading: isTTSLoading, speakers } = useTTS()

  // 프리로딩된 오디오
  const [isPreloading, setIsPreloading] = useState(false)
  const [preloadProgress, setPreloadProgress] = useState(0)
  const [preloadError, setPreloadError] = useState(null)
  const preloadedAudiosRef = useRef({})

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)
  const audioElementRef = useRef(null) // 모바일 오디오 재생용
  const preloadAbortControllerRef = useRef(null) // 프리로딩 취소용
  /** 언마운트 시에만 false — `phase` 전환 시 loading effect cleanup이 `cancelled`를 켜도 타이머는 계속 돌아야 함 */
  const mockInterviewMountedRef = useRef(true)
  const answersSnapshotRef = useRef([])
  const mediaRecorderRef = useRef(null)
  const recordingPromiseRef = useRef(null)
  const pendingAnswerFileRef = useRef(null)

  const [interviewReport, setInterviewReport] = useState(null)
  const [displayedOverallScore, setDisplayedOverallScore] = useState(0)
  /** 질문 생성 API 대기 중(로딩 단계 진입 전) */
  const [isFetchingInterviewSetup, setIsFetchingInterviewSetup] = useState(false)

  const disableTts = useCallback((reason) => {
    if (!ttsEnabledRef.current) return
    ttsEnabledRef.current = false
    setTtsEnabled(false)
    if (reason) {
      setPreloadError(reason)
    }
  }, [])

  useEffect(() => {
    mockInterviewMountedRef.current = true
    return () => {
      mockInterviewMountedRef.current = false
    }
  }, [])

  // isSpeaking 상태를 TTS 상태와 동기화
  useEffect(() => {
    setIsSpeaking(isTTSPlaying || isTTSLoading)
  }, [isTTSPlaying, isTTSLoading])

  const currentQuestion = selectedQuestions[currentQuestionIndex]
  const totalQuestions = selectedQuestions.length

  const getQuestionIdAtIndex = useCallback(
    (index) =>
      selectedQuestions[index]?.id ??
      interviewReport?.questions?.[index]?.questionId ??
      answers[index]?.questionId ??
      null,
    [selectedQuestions, interviewReport, answers]
  )

  const requestRetakeOnServer = useCallback(
    async (sortedIndexes) => {
      const previousSessionId = videoSessionId
      if (!previousSessionId) {
        throw new Error('화상 면접 세션 정보가 없습니다.')
      }
      const accessToken = getAccessToken?.()
      const questionRefs = sortedIndexes.map((index) => {
        const ref =
          selectedQuestions[index] ??
          interviewReport?.questions?.[index] ??
          answers[index] ??
          null
        const candidates = collectRetakeQuestionIdCandidates(ref)
        if (!candidates.length) {
          throw new Error(`질문 ${index + 1}의 ID를 찾을 수 없습니다.`)
        }
        return ref
      })

      const { sessionId: newSessionId } =
        questionRefs.length === 1
          ? await startVideoInterviewRetake(previousSessionId, questionRefs[0], accessToken)
          : await retryVideoInterviewQuestions(
              previousSessionId,
              questionRefs.flatMap((ref) => collectRetakeQuestionIdCandidates(ref)),
              accessToken
            )
      registerRetakeChildSession(newSessionId, previousSessionId)

      return { newSessionId, sortedIndexes }
    },
    [videoSessionId, getAccessToken, getQuestionIdAtIndex]
  )

  const buildRetakeQuestions = useCallback(
    async (newSessionId, sortedIndexes, historyFallback = null) => {
      const accessToken = getAccessToken?.()
      const detail = await loadRetakeSessionDetail(newSessionId, accessToken, {
        maxAttempts: 12,
        intervalMs: 500,
      })
      const apiQuestions = detail?.questions ?? []

      const resolvePrev = (prevIndex, mapIndex) =>
        selectedQuestions[prevIndex] ??
        (mapIndex === 0 ? historyFallback : null) ??
        null

      if (apiQuestions.length === sortedIndexes.length) {
        return apiQuestions.map((q, i) => {
          const prevIndex = sortedIndexes[i]
          const prev = resolvePrev(prevIndex, i)
          const prevText = prev?.text ?? answers[prevIndex]?.question ?? ''
          return {
            id: String(q.questionId ?? q.id ?? prev?.id ?? getQuestionIdAtIndex(prevIndex)),
            text: q.question || prevText,
            category: prev?.category ?? 'VIDEO',
            sessionId: newSessionId,
          }
        })
      }

      return sortedIndexes.map((prevIndex, mapIndex) => {
        const prev = resolvePrev(prevIndex, mapIndex)
        const prevText = prev?.text ?? answers[prevIndex]?.question ?? ''
        const prevId = prev?.id ?? getQuestionIdAtIndex(prevIndex)
        const matched =
          apiQuestions.find(
            (q) =>
              prevId != null &&
              String(q.questionId ?? q.id) === String(prevId)
          ) ??
          apiQuestions.find((q) => (q.question || '').trim() === prevText.trim()) ??
          apiQuestions[mapIndex] ??
          apiQuestions[0]

        const newQuestionId = matched?.questionId ?? matched?.id
        if (newQuestionId == null || newQuestionId === '') {
          throw new Error('재답변 질문 정보를 불러오지 못했습니다.')
        }

        const text = matched?.question || prevText
        if (!String(text).trim()) {
          throw new Error('재답변할 질문 내용이 없습니다.')
        }

        return {
          id: String(newQuestionId),
          text,
          category: prev?.category ?? 'VIDEO',
          sessionId: newSessionId,
        }
      })
    },
    [getAccessToken, selectedQuestions, answers, getQuestionIdAtIndex]
  )

  const startVideoRecording = useCallback((questionId) => {
    if (!streamRef.current) return
    if (typeof MediaRecorder === 'undefined') {
      setErrorMessage('현재 브라우저는 영상 녹화를 지원하지 않습니다.')
      setIsRecording(false)
      return
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }

    const mimeType = getPreferredVideoMimeType()
    const recorder = new MediaRecorder(
      streamRef.current,
      mimeType ? { mimeType } : undefined
    )
    const chunks = []
    const extension = (recorder.mimeType || mimeType).includes('mp4') ? 'mp4' : 'webm'

    pendingAnswerFileRef.current = null
    setHasPendingRecording(false)

    recordingPromiseRef.current = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunks.push(event.data)
      }
      recorder.onerror = () => {
        reject(new Error('영상 녹화 중 오류가 발생했습니다.'))
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'video/webm'
        const blob = new Blob(chunks, { type })
        if (!blob.size) {
          resolve(null)
          return
        }
        resolve(new File([blob], `video-answer-${questionId}.${extension}`, { type }))
      }
    })

    mediaRecorderRef.current = recorder
    recorder.start(1000)
  }, [])

  const stopCurrentRecording = useCallback(async () => {
    if (pendingAnswerFileRef.current) return pendingAnswerFileRef.current

    const recorder = mediaRecorderRef.current
    const recordingPromise = recordingPromiseRef.current
    if (!recorder || !recordingPromise) return null

    if (recorder.state !== 'inactive') {
      try {
        recorder.requestData()
      } catch {
        // 일부 브라우저는 stop 직전 requestData를 지원하지 않는다.
      }
      recorder.stop()
    }

    const videoFile = await recordingPromise
    mediaRecorderRef.current = null
    recordingPromiseRef.current = null
    pendingAnswerFileRef.current = videoFile
    setHasPendingRecording(Boolean(videoFile))
    return videoFile
  }, [])

  useEffect(() => {
    if (phase !== 'interview' || !isRecording || !currentQuestion?.id) return
    startVideoRecording(currentQuestion.id)
  }, [phase, isRecording, currentQuestion?.id, startVideoRecording])

  // 카메라 시작 (실패 시 UI에서 phase 복구를 위해 `{ stream, error }`로 반환)
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      streamRef.current = stream
      setCameraError(null)
      return { stream, error: null }
    } catch (err) {
      const msg = `카메라 접근 오류: ${err.message}`
      setCameraError(msg)
      return { stream: null, error: msg }
    }
  }, [])

  const attachStreamToVideo = useCallback(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return false
    if (video.srcObject !== stream) {
      video.srcObject = stream
    }
    void video.play().catch(() => {})
    return true
  }, [])

  /** AnimatePresence 전환 후 video가 마운트될 때 스트림 연결 */
  const bindVideoRef = useCallback(
    (node) => {
      videoRef.current = node
      if (node && phase === 'interview' && streamRef.current) {
        if (node.srcObject !== streamRef.current) {
          node.srcObject = streamRef.current
        }
        void node.play().catch(() => {})
      }
    },
    [phase]
  )

  useEffect(() => {
    if (phase !== 'interview' || !streamRef.current) return undefined

    if (attachStreamToVideo()) return undefined

    let attempts = 0
    const timer = setInterval(() => {
      attempts += 1
      if (attachStreamToVideo() || attempts >= 40) {
        clearInterval(timer)
      }
    }, 100)

    return () => clearInterval(timer)
  }, [phase, attachStreamToVideo])

  // 카메라 정지
  const stopCamera = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  // 오디오 레벨 분석 시작
  const startAudioAnalysis = useCallback((stream) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)

      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateLevel = () => {
        if (!analyserRef.current) return

        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        const normalizedLevel = Math.min(100, (average / 128) * 100)
        setAudioLevel(normalizedLevel)

        animationFrameRef.current = requestAnimationFrame(updateLevel)
      }

      updateLevel()
    } catch (err) {
      console.error('오디오 분석 시작 오류:', err)
    }
  }, [])

  // 오디오 레벨 분석 정지
  const stopAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null
    setAudioLevel(0)
  }, [])

  // 카운트다운 시작
  const startCountdown = useCallback(() => {
    setCountdown(3)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          setIsRecording(true)
          return null
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  // 질문 음성 프리로딩
  const preloadQuestionAudios = useCallback(async (questions) => {
    if (preloadAbortControllerRef.current) {
      preloadAbortControllerRef.current.abort()
    }

    const abortController = new AbortController()
    preloadAbortControllerRef.current = abortController

    setIsPreloading(true)
    setPreloadProgress(0)
    setPreloadError(null)
    const audios = {}

    const accessToken = getAccessToken?.()
    const options = {
      speaker: selectedSpeaker,
      ...(accessToken ? { accessToken } : {}),
    }

    try {
      for (let i = 0; i < questions.length; i++) {
        if (abortController.signal.aborted) {
          throw new DOMException('Preload cancelled', 'AbortError')
        }

        try {
          if (!ttsEnabledRef.current) break
          // Rate limit 회피: 요청 간 1초 대기 (Qwen3 TTS 제한)
          if (i > 0) {
            await new Promise((r) => setTimeout(r, 1000))
          }
          const n = questions.length
          const milestoneBefore = (i / n) * 100
          const milestoneAfter = ((i + 1) / n) * 100
          const segment = milestoneAfter - milestoneBefore
          const capPct = milestoneAfter - Math.max(0.75, segment * 0.07)

          setPreloadProgress(Math.round(milestoneBefore))
          const stopRamp = startPreloadProgressRamp({
            setProgress: setPreloadProgress,
            signal: abortController.signal,
            fromPct: milestoneBefore,
            capPct,
            intervalMs: 200,
          })
          let blob
          try {
            blob = await speechFromInterviewQuestion(
              questions[i].text,
              options,
              abortController.signal
            )
          } finally {
            stopRamp()
          }
          const url = URL.createObjectURL(blob)
          audios[questions[i].id] = url
          setPreloadProgress(Math.round(milestoneAfter))
        } catch (error) {
          if (error.name === 'AbortError') {
            throw error
          }
          console.error(`질문 ${i + 1} 프리로딩 실패:`, error)
          const msg = error.message || '음성 로딩에 실패했습니다.'
          disableTts(
            msg.includes('rate limit') || msg.includes('RateQuota')
              ? '요청 한도 초과. 잠시 후 다시 시도해주세요.'
              : msg
          )
          break
        }
      }

      preloadedAudiosRef.current = audios
      setIsPreloading(false)
      preloadAbortControllerRef.current = null
      return audios
    } catch (error) {
      if (error.name === 'AbortError') {
        Object.values(audios).forEach((url) => URL.revokeObjectURL(url))
        setIsPreloading(false)
        setPreloadError(null)
        preloadAbortControllerRef.current = null
        return null
      }
      throw error
    }
  }, [selectedSpeaker, getAccessToken])

  // 프리로딩 취소
  const cancelPreload = useCallback(() => {
    if (preloadAbortControllerRef.current) {
      preloadAbortControllerRef.current.abort()
      preloadAbortControllerRef.current = null
    }
    setPhase('ready')
    setIsPreloading(false)
    setPreloadProgress(0)
  }, [])

  // 모바일 오디오 재생을 위한 초기화 (사용자 인터랙션 시 호출)
  const initAudioForMobile = useCallback(() => {
    if (!audioElementRef.current) {
      const audio = new Audio()
      audio.playsInline = true
      audio.setAttribute('playsinline', '')
      audio.setAttribute('webkit-playsinline', '')
      audioElementRef.current = audio
    }
    // 빈 오디오로 재생 시도하여 오디오 컨텍스트 활성화
    audioElementRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
    audioElementRef.current.play().catch(() => {})
  }, [])

  // 질문 음성 재생 (프리로딩 또는 온디맨드 TTS)
  const speakQuestion = useCallback(
    async (question) => {
      const questionId = question?.id
      const questionText = question?.text
      // 문구는 TTS 성공 여부와 무관하게 먼저 노출 (빈 값이면 아래에서 조기 종료)
      if (questionText) {
        setIsQuestionVisible(true)
      }
      if (!questionId || !questionText) return

      if (!ttsEnabledRef.current) {
        setIsSpeaking(false)
        startCountdown()
        return
      }

      setIsSpeaking(true)

      const playAudio = async (urlOrBlob) => {
        const url = urlOrBlob instanceof Blob ? URL.createObjectURL(urlOrBlob) : urlOrBlob
        const audio = audioElementRef.current || new Audio()
        audio.playsInline = true
        audio.src = url

        await new Promise((resolve, reject) => {
          audio.onended = () => {
            if (urlOrBlob instanceof Blob) URL.revokeObjectURL(url)
            resolve()
          }
          audio.onerror = () => {
            if (urlOrBlob instanceof Blob) URL.revokeObjectURL(url)
            reject(new Error('오디오 재생 실패'))
          }
          audio.play().catch(reject)
        })
      }

      try {
        const audioUrl = preloadedAudiosRef.current[questionId]

        if (audioUrl) {
          await playAudio(audioUrl)
        } else {
          // 프리로딩 실패 시 온디맨드 TTS 폴백
          const accessToken = getAccessToken?.()
          const blob = await speechFromInterviewQuestion(questionText, {
            speaker: selectedSpeaker,
            ...(accessToken ? { accessToken } : {}),
          })
          await playAudio(blob)
        }
      } catch (error) {
        console.error('질문 음성 재생 오류:', error)
        disableTts(error?.message || 'TTS 서버 오류로 음성 안내를 중단합니다.')
      } finally {
        setTimeout(() => {
          setIsSpeaking(false)
          startCountdown()
        }, 300)
      }
    },
    [startCountdown, selectedSpeaker, disableTts, getAccessToken]
  )

  // 프리로드는 로딩 UI가 실제로 마운트된 뒤에만 시작한다.
  // (AnimatePresence mode="wait"면 ready 퇴장 중에는 loading이 없어, 동기로 preload를 돌리면 0→100만 보일 수 있음)
  useEffect(() => {
    if (phase !== 'loading') return undefined
    const questions = selectedQuestions
    if (!questions.length) return undefined

    let cancelled = false

    const run = async () => {
      try {
        const audios = await preloadQuestionAudios(questions)
        if (cancelled || !audios) return

        const { stream, error: cameraStartError } = await startCamera()
        if (cancelled) return
        if (!stream) {
          setPhase('ready')
          setErrorMessage(
            cameraStartError ||
              '카메라·마이크를 사용할 수 없어 면접을 시작할 수 없습니다. 브라우저에서 권한을 허용한 뒤 다시 시도해주세요.'
          )
          return
        }

        setPhase('interview')
        setCurrentQuestionIndex(0)
        setAnswers([])
        answersSnapshotRef.current = []
        pendingAnswerFileRef.current = null
        recordingPromiseRef.current = null
        mediaRecorderRef.current = null
        setHasPendingRecording(false)
        setIsSubmittingAnswer(false)
        // 첫 질문 문구는 즉시 표시 (loading effect cleanup이 `cancelled`를 켠 뒤에도 타이머가 speak를 호출해야 함)
        if (questions[0]?.text) {
          setIsQuestionVisible(true)
        }

        startAudioAnalysis(stream)

        setTimeout(() => {
          if (!mockInterviewMountedRef.current) return
          attachStreamToVideo()
        }, 500)

        setTimeout(() => {
          if (!mockInterviewMountedRef.current) return
          speakQuestion(questions[0])
        }, 1500)
      } catch (e) {
        if (cancelled) return
        console.error('[MockInterview] 면접 준비 단계 오류:', e)
        setPhase('ready')
        setErrorMessage(e?.message || '면접 준비 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      }
    }

    void run()

    return () => {
      cancelled = true
      if (preloadAbortControllerRef.current) {
        preloadAbortControllerRef.current.abort()
        preloadAbortControllerRef.current = null
      }
    }
  }, [
    phase,
    selectedQuestions,
    preloadQuestionAudios,
    startCamera,
    startAudioAnalysis,
    speakQuestion,
    attachStreamToVideo,
  ])

  // 녹화 시간 타이머
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isRecording])

  // 면접 시작
  const handleStart = async () => {
    if (isFetchingInterviewSetup) return
    setErrorMessage('')
    ttsEnabledRef.current = true
    setTtsEnabled(true)
    // 모바일 오디오 초기화 (사용자 인터랙션 직후 호출해야 함)
    initAudioForMobile()

    // 질문 선택: VIDEO API만 사용
    let questions = []
    setIsFetchingInterviewSetup(true)
    try {
      const accessToken = getAccessToken?.()
      const requestCount = Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, questionCount))
      const response = await createVideoInterviewQuestion({ count: requestCount }, accessToken)
      questions = normalizeVideoQuestionList(response)
      if (questions.length > 0) {
        setVideoSessionId(questions[0].sessionId || null)
      }
    } catch (error) {
      console.error('[MockInterview] createVideoInterviewQuestion error:', error)
      setErrorMessage(error?.message || '면접 질문 생성에 실패했습니다.')
      setIsFetchingInterviewSetup(false)
      return
    }
    if (questions.length === 0) {
      setVideoSessionId(null)
      setErrorMessage('면접 질문 생성 결과가 비어있습니다. 잠시 후 다시 시도해주세요.')
      setIsFetchingInterviewSetup(false)
      return
    }

    setSelectedQuestions(questions)
    setIsQuestionVisible(false)
    setIsFetchingInterviewSetup(false)

    // 질문 음성 프리로딩·카메라·면접 진입은 `phase === 'loading'` effect에서 처리
    setPhase('loading')
  }

  const transitionToAnalyzing = useCallback(
    (statusMessage) => {
      stopCamera()
      stopAudioAnalysis()
      stopTTS()
      setIsQuestionVisible(false)
      setIsRecording(false)
      setIsSubmittingAnswer(false)
      setAnalysisStatusMessage(statusMessage)
      setPhase('analyzing')
    },
    [stopCamera, stopAudioAnalysis, stopTTS]
  )

  const queueVideoUpload = useCallback(
    (questionId, videoFile) => {
      pendingUploadRef.current = submitVideoInterviewAnswer(
        questionId,
        { video: videoFile },
        getAccessToken?.()
      ).catch((error) => {
        pendingUploadRef.current = null
        console.error('[MockInterview] submitVideoInterviewAnswer error:', error)
        setErrorMessage(error?.message || '영상 답변 제출에 실패했습니다.')
        setHasPendingRecording(Boolean(videoFile))
        setPhase('interview')
        throw error
      })
      return pendingUploadRef.current
    },
    [getAccessToken]
  )

  // 답변 완료 (다음 질문으로)
  const handleNextQuestion = async () => {
    if (isSubmittingAnswer || !currentQuestion?.id) return

    setIsSubmittingAnswer(true)

    try {
      const videoFile = await stopCurrentRecording()
      if (!videoFile) {
        throw new Error('제출할 영상 파일을 생성하지 못했습니다. 다시 시도해주세요.')
      }
      setIsRecording(false)

      const behaviorScores = {
        eyeContact: Math.floor(Math.random() * 30) + 70,
        expression: Math.floor(Math.random() * 30) + 65,
        posture: Math.floor(Math.random() * 25) + 75,
        speech: Math.floor(Math.random() * 30) + 70,
      }

      const newAnswer = {
        questionId: currentQuestion.id,
        question: currentQuestion.text,
        duration: recordingTime,
        analysis: behaviorScores,
      }

      const isLast = currentQuestionIndex >= totalQuestions - 1
      pendingAnswerFileRef.current = null
      setHasPendingRecording(false)

      if (isRetakeMode) {
        setAnswers((prev) => {
          const next = [...prev]
          next[currentQuestionIndex] = newAnswer
          answersSnapshotRef.current = next
          return next
        })

        const pendingQueue = retakeQueueRef.current
        if (pendingQueue.length > 0) {
          await submitVideoInterviewAnswer(
            currentQuestion.id,
            { video: videoFile },
            getAccessToken?.()
          )
          setIsSubmittingAnswer(false)
          const [nextIndex, ...rest] = pendingQueue
          retakeQueueRef.current = rest
          setRetakeQueueMeta((prev) =>
            prev ? { ...prev, current: prev.current + 1 } : { current: 2, total: 2 }
          )
          setCurrentQuestionIndex(nextIndex)
          setIsQuestionVisible(false)
          setRecordingTime(0)
          setTimeout(() => {
            if (!mockInterviewMountedRef.current) return
            speakQuestion(selectedQuestions[nextIndex])
          }, 500)
          return
        }

        setIsRetakeMode(false)
        setRetakeQueueMeta(null)
        retakeQueueRef.current = []
        setSelectedRetakeIndexes(new Set())
        queueVideoUpload(currentQuestion.id, videoFile)
        transitionToAnalyzing('답변을 업로드하는 중…')
        return
      }

      if (!isLast) {
        await submitVideoInterviewAnswer(
          currentQuestion.id,
          { video: videoFile },
          getAccessToken?.()
        )
        setIsSubmittingAnswer(false)
        setAnswers((prev) => [...prev, newAnswer])
        setIsQuestionVisible(false)
        const nextIndex = currentQuestionIndex + 1
        setCurrentQuestionIndex(nextIndex)
        setTimeout(() => {
          speakQuestion(selectedQuestions[nextIndex])
        }, 500)
        return
      }

      setAnswers((prev) => {
        const next = [...prev, newAnswer]
        answersSnapshotRef.current = next
        return next
      })
      queueVideoUpload(currentQuestion.id, videoFile)
      transitionToAnalyzing('답변을 업로드하는 중…')
    } catch (error) {
      console.error('[MockInterview] handleNextQuestion error:', error)
      setErrorMessage(error?.message || '영상 답변 제출에 실패했습니다.')
      setHasPendingRecording(Boolean(pendingAnswerFileRef.current))
      setIsSubmittingAnswer(false)
      setIsRecording(false)
    }
  }

  const fetchFinalVideoResult = useCallback(async (runSignal, runId) => {
    const sessionId = videoSessionId
    if (!sessionId) {
      setErrorMessage('화상 면접 결과 세션이 없습니다. 다시 시도해주세요.')
      setPhase('ready')
      return
    }

    try {
      if (pendingUploadRef.current) {
        try {
          await pendingUploadRef.current
        } catch {
          return
        } finally {
          pendingUploadRef.current = null
        }
      }

      setAnalysisStatusMessage('면접 결과를 분석하고 있습니다…')

      const finalPayload = await streamVideoInterviewResult(sessionId, {
        accessToken: getAccessToken?.(),
        signal: runSignal,
        initialDelayMs: 1200,
        pollIntervalMs: 2500,
        maxWaitMs: 180000,
        streamAttemptTimeoutMs: 22000,
        onPollAttempt: () => {
          setAnalysisStatusMessage('면접 결과를 확인하는 중… ')
        },
        onMessage: (message) => {
          const extracted = extractVideoInterviewResultFromMessage(message)
          if (extracted && import.meta.env.DEV) {
            console.info('[MockInterview] stream message', message.event, extracted)
          }
        },
      })

      const normalized = normalizeFinalVideoReport(finalPayload, answersSnapshotRef.current, {
        selectedQuestions,
      })
      if (!normalized) {
        console.warn('[MockInterview] final video payload missing or empty', finalPayload)
        throw new Error('화상 면접 최종 결과를 확인할 수 없습니다.')
      }

      setInterviewReport(normalized)
      setBehaviorAnalysis({ overall: normalized.overallScore ?? 0 })
      setErrorMessage('')
      setAnalysisStatusMessage('')
      const historyRetakeMeta = historyRetakeMetaRef.current
      const mappedQuestions =
        normalized.questions?.map((q, idx) => ({
          index: q.index ?? idx + 1,
          questionId: q.questionId ?? selectedQuestions[idx]?.id ?? null,
          question: q.question || selectedQuestions[idx]?.text || '',
          score: q.score ?? null,
          combinedFeedback: q.combinedFeedback ?? q.feedback ?? '',
          narrative: q.narrative ?? q.combinedFeedback ?? '',
          speech: q.speech ?? null,
          video: q.video ?? null,
          videoUrl: q.videoUrl ?? null,
        })) ?? []

      if (historyRetakeMeta?.sourceSessionId && historyRetakeMeta?.sourceQuestionId != null) {
        const retakeQuestion =
          mappedQuestions.find(
            (q) => String(q.questionId) === String(historyRetakeMeta.sourceQuestionId)
          ) ?? mappedQuestions[0]

        const questionText =
          historyRetakeMeta.questionText || retakeQuestion?.question || ''
        const patchedQuestion = {
          index: retakeQuestion?.index ?? 1,
          questionId: historyRetakeMeta.sourceQuestionId,
          question: questionText,
          ...(retakeQuestion ?? {}),
        }

        updateMockInterviewSessionAfterRetake({
          sourceSessionId: historyRetakeMeta.sourceSessionId,
          sourceQuestionId: historyRetakeMeta.sourceQuestionId,
          questionText,
          questionPatch: patchedQuestion,
          overallScore: normalized.overallScore ?? retakeQuestion?.score ?? null,
          summary: normalized.overallSummary || '',
        })

        lastRetakeUpdatedSessionRef.current = {
          sessionId: String(historyRetakeMeta.sourceSessionId),
          status: null,
          date: new Date().toISOString(),
          overallScore: normalized.overallScore ?? retakeQuestion?.score ?? null,
          summary: normalized.overallSummary || '',
          questionCount: 1,
          questionsPreview: questionText ? [questionText] : [],
          questions: [patchedQuestion],
          source: 'local',
        }
      } else {
        recordMockInterviewSession({
          sessionId: videoSessionId,
          date: new Date().toISOString(),
          overallScore: normalized.overallScore ?? null,
          summary: normalized.overallSummary || '',
          questionCount: mappedQuestions.length,
          questionsPreview: mappedQuestions.map((q) => q.question).filter(Boolean),
          questions: mappedQuestions,
        })
      }
      setPhase('feedback')
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (runId != null && analysisRunIdRef.current !== runId) return
        if (phaseRef.current !== 'analyzing') return
        return
      }
      console.error('[MockInterview] streamVideoInterviewResult error:', error)
      const isGatewayTimeout = error?.statusCode === 504 || error?.isRetryable
      setErrorMessage(
        error?.message ||
          (isGatewayTimeout
            ? '서버 분석이 지연되었습니다. 잠시 후 다시 시도해주세요.'
            : '화상 면접 결과 조회에 실패했습니다.')
      )
      setAnalysisStatusMessage('')
      setPhase(interviewReport ? 'feedback' : 'ready')
    }
  }, [
    videoSessionId,
    getAccessToken,
    interviewReport,
    selectedQuestions,
    recordMockInterviewSession,
    updateMockInterviewSessionAfterRetake,
    onVideoRetakeComplete,
    stopCamera,
    stopAudioAnalysis,
    stopTTS,
  ])

  const fetchFinalVideoResultRef = useRef(fetchFinalVideoResult)
  fetchFinalVideoResultRef.current = fetchFinalVideoResult

  useEffect(() => {
    if (phase !== 'analyzing') return undefined

    const runId = ++analysisRunIdRef.current
    const controller = new AbortController()
    analysisAbortRef.current = controller
    setDisplayedOverallScore(0)
    void fetchFinalVideoResultRef.current(controller.signal, runId)

    return () => {
      if (analysisRunIdRef.current === runId) {
        controller.abort()
      }
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'feedback' || !behaviorAnalysis) return undefined
    const target = behaviorAnalysis.overall
    setDisplayedOverallScore(0)
    const start = performance.now()
    const duration = 900
    let raf
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      setDisplayedOverallScore(Math.round(target * t))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, behaviorAnalysis])

  const beginRetakeInterview = useCallback(
    async (questionIndex, questionOverride = null) => {
      const question = questionOverride ?? selectedQuestions[questionIndex]
      if (!question?.id) {
        throw new Error('재답변할 질문 정보가 없습니다.')
      }

      initAudioForMobile()

      const { stream, error: cameraStartError } = await startCamera()
      if (!stream) {
        throw new Error(
          cameraStartError || '카메라·마이크를 사용할 수 없어 재답변을 시작할 수 없습니다.'
        )
      }

      pendingAnswerFileRef.current = null
      recordingPromiseRef.current = null
      mediaRecorderRef.current = null
      setHasPendingRecording(false)
      setIsSubmittingAnswer(false)
      setIsRecording(false)
      setCountdown(null)
      setRecordingTime(0)
      setIsQuestionVisible(false)

      setIsRetakeMode(true)
      setCurrentQuestionIndex(questionIndex)
      setPhase('interview')
      startAudioAnalysis(stream)

      setTimeout(() => {
        if (!mockInterviewMountedRef.current) return
        attachStreamToVideo()
      }, 0)

      setTimeout(() => {
        if (!mockInterviewMountedRef.current) return
        speakQuestion(question)
      }, 800)
    },
    [selectedQuestions, initAudioForMobile, startCamera, startAudioAnalysis, speakQuestion, attachStreamToVideo]
  )

  const startRetakeQueue = useCallback(
    async (sortedIndexes) => {
      if (!sortedIndexes.length || isStartingRetake) return

      setErrorMessage('')
      setIsStartingRetake(true)

      try {
        const { newSessionId, sortedIndexes: indexes } =
          await requestRetakeOnServer(sortedIndexes)
        const retakeQuestions = await buildRetakeQuestions(newSessionId, indexes)
        const retakeAnswers = indexes.map((idx) => answers[idx]).filter(Boolean)

        setVideoSessionId(newSessionId)
        setSelectedQuestions(retakeQuestions)
        setAnswers(retakeAnswers)
        answersSnapshotRef.current = [...retakeAnswers]

        retakeQueueRef.current =
          retakeQuestions.length > 1
            ? Array.from({ length: retakeQuestions.length - 1 }, (_, i) => i + 1)
            : []
        setRetakeQueueMeta({ current: 1, total: retakeQuestions.length })
        await beginRetakeInterview(0, retakeQuestions[0])
      } catch (error) {
        console.error('[MockInterview] startRetakeQueue error:', error)
        setErrorMessage(error?.message || '재답변 준비에 실패했습니다.')
        retakeQueueRef.current = []
        setRetakeQueueMeta(null)
      } finally {
        setIsStartingRetake(false)
      }
    },
    [isStartingRetake, requestRetakeOnServer, buildRetakeQuestions, answers, beginRetakeInterview]
  )

  const handleStartSelectedRetakes = useCallback(() => {
    const sortedIndexes = [...selectedRetakeIndexes].sort((a, b) => a - b)
    if (!sortedIndexes.length) {
      setErrorMessage('다시 답변할 질문을 선택해주세요.')
      return
    }
    void startRetakeQueue(sortedIndexes)
  }, [selectedRetakeIndexes, startRetakeQueue])

  const handleStartAllRetakes = useCallback(() => {
    const sortedIndexes = answers.map((_, index) => index)
    if (!sortedIndexes.length) return
    setSelectedRetakeIndexes(new Set(sortedIndexes))
    void startRetakeQueue(sortedIndexes)
  }, [answers, startRetakeQueue])

  const startRetakeFromHistory = useCallback(
    async ({
      sourceSessionId,
      sessionId,
      questionId,
      questionText,
      newSessionId: prefetchedNewSessionId,
      questionIds: prefetchedQuestionIds = [],
    }) => {
      const originalSessionId = sourceSessionId ?? sessionId
      if (!originalSessionId || questionId == null || questionId === '') {
        throw new Error('재답변에 필요한 세션·질문 정보가 없습니다.')
      }
      if (isStartingRetakeRef.current) {
        throw new Error('재답변을 준비하는 중입니다.')
      }

      setErrorMessage('')
      isStartingRetakeRef.current = true
      setIsStartingRetake(true)

      try {
        initAudioForMobile()

        const accessToken = getAccessToken?.()
        const { sessionId: newSessionId } = prefetchedNewSessionId
          ? { sessionId: prefetchedNewSessionId }
          : await startVideoInterviewRetake(originalSessionId, questionId, accessToken)
        registerRetakeChildSession(newSessionId, originalSessionId)

        historyRetakeMetaRef.current = {
          sourceSessionId: originalSessionId,
          sourceQuestionId: questionId,
          questionText: questionText || '',
        }
        setIsHistoryRetakeFeedback(true)

        const historyFallback = {
          id: String(prefetchedQuestionIds[0] ?? questionId),
          text: questionText || '',
          category: 'VIDEO',
          sessionId: newSessionId,
        }
        const retakeQuestions = await buildRetakeQuestions(newSessionId, [0], historyFallback)
        const retakeQuestion = retakeQuestions[0]
        if (!retakeQuestion?.id || !retakeQuestion?.text?.trim()) {
          throw new Error('재답변할 질문 정보가 없습니다.')
        }

        setInterviewReport(null)
        setBehaviorAnalysis(null)
        setDisplayedOverallScore(0)
        setVideoSessionId(newSessionId)
        setSelectedQuestions(retakeQuestions)
        setAnswers([])
        answersSnapshotRef.current = []
        retakeQueueRef.current = []
        setRetakeQueueMeta({ current: 1, total: 1 })
        setSelectedRetakeIndexes(new Set())
        await beginRetakeInterview(0, retakeQuestion)
      } catch (error) {
        historyRetakeMetaRef.current = null
        console.error('[MockInterview] startRetakeFromHistory error:', error)
        setErrorMessage(error?.message || '재답변 준비에 실패했습니다.')
        throw error
      } finally {
        isStartingRetakeRef.current = false
        setIsStartingRetake(false)
      }
    },
    [initAudioForMobile, getAccessToken, buildRetakeQuestions, beginRetakeInterview]
  )

  const startRetakeFromHistoryRef = useRef(startRetakeFromHistory)
  startRetakeFromHistoryRef.current = startRetakeFromHistory
  const processedHistoryRetakeIdRef = useRef(null)

  useEffect(() => {
    if (!historyRetakeRequest?.requestId) return undefined
    if (processedHistoryRetakeIdRef.current === historyRetakeRequest.requestId) {
      return undefined
    }

    processedHistoryRetakeIdRef.current = historyRetakeRequest.requestId
    setErrorMessage('')
    let cancelled = false
    void startRetakeFromHistoryRef.current(historyRetakeRequest).catch((error) => {
      if (cancelled) return
      processedHistoryRetakeIdRef.current = null
      console.error('[MockInterview] history retake bootstrap error:', error)
    })

    return () => {
      cancelled = true
    }
  }, [historyRetakeRequest])

  const handleToggleRetakeSelection = useCallback((index) => {
    setSelectedRetakeIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const handleSelectAllRetakes = useCallback(() => {
    setSelectedRetakeIndexes(new Set(answers.map((_, index) => index)))
  }, [answers])

  const handleClearRetakeSelection = useCallback(() => {
    setSelectedRetakeIndexes(new Set())
  }, [])

  const handleCancelRetake = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // 이미 종료된 녹화는 무시한다.
      }
    }
    stopCamera()
    stopAudioAnalysis()
    stopTTS()
    setIsRetakeMode(false)
    setRetakeQueueMeta(null)
    retakeQueueRef.current = []
    setIsRecording(false)
    setCountdown(null)
    setRecordingTime(0)
    setHasPendingRecording(false)
    setIsSubmittingAnswer(false)
    pendingAnswerFileRef.current = null
    recordingPromiseRef.current = null
    mediaRecorderRef.current = null
    setPhase('feedback')
  }, [stopCamera, stopAudioAnalysis, stopTTS])

  // 다시 시작
  const handleGoToHistoryAfterRetake = useCallback(() => {
    stopCamera()
    stopAudioAnalysis()
    stopTTS()
    setIsHistoryRetakeFeedback(false)
    setIsRetakeMode(false)
    setRetakeQueueMeta(null)
    retakeQueueRef.current = []
    setPhase('ready')
    setInterviewReport(null)
    setBehaviorAnalysis(null)
    onVideoRetakeComplete?.({
      updatedSession: lastRetakeUpdatedSessionRef.current ?? undefined,
    })
    historyRetakeMetaRef.current = null
    lastRetakeUpdatedSessionRef.current = null
  }, [stopCamera, stopAudioAnalysis, stopTTS, onVideoRetakeComplete])

  // 다시 시작
  const handleRestart = () => {
    Object.values(preloadedAudiosRef.current).forEach((url) => {
      URL.revokeObjectURL(url)
    })
    preloadedAudiosRef.current = {}

    setPhase('ready')
    setIsRetakeMode(false)
    setIsStartingRetake(false)
    setRetakeQueueMeta(null)
    retakeQueueRef.current = []
    setSelectedRetakeIndexes(new Set())
    setIsFetchingInterviewSetup(false)
    setPreloadError(null)
    setCurrentQuestionIndex(0)
    setAnswers([])
    setBehaviorAnalysis(null)
    setInterviewReport(null)
    setAnalysisStatusMessage('')
    setCountdown(null)
    setRecordingTime(0)
    setIsQuestionVisible(false)
    setVideoSessionId(null)
    setErrorMessage('')
    setIsSubmittingAnswer(false)
    setHasPendingRecording(false)
    pendingAnswerFileRef.current = null
    recordingPromiseRef.current = null
    mediaRecorderRef.current = null
    setTtsEnabled(true)
    ttsEnabledRef.current = true
    setIsHistoryRetakeFeedback(false)
    historyRetakeMetaRef.current = null
  }

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (analysisAbortRef.current) analysisAbortRef.current.abort()
      if (mediaRecorderRef.current?.state === 'recording') {
        try {
          mediaRecorderRef.current.stop()
        } catch {
          // 이미 종료된 녹화는 무시한다.
        }
      }
      stopCamera()
      stopAudioAnalysis()
      stopTTS()
    }
  }, [stopCamera, stopAudioAnalysis, stopTTS])

  // 면접 진행 중일 때 브라우저 히스토리 관리
  useEffect(() => {
    if (phase === 'loading' || phase === 'interview' || phase === 'analyzing') {
      // 면접 시작 시 히스토리에 상태 추가
      window.history.pushState({ mockInterview: true }, '')

      const handlePopState = (event) => {
        // 뒤로가기 시 면접 종료하고 ready로 돌아가기

        // 프리로딩 취소
        if (preloadAbortControllerRef.current) {
          preloadAbortControllerRef.current.abort()
          preloadAbortControllerRef.current = null
        }

        stopCamera()
        if (mediaRecorderRef.current?.state === 'recording') {
          try {
            mediaRecorderRef.current.stop()
          } catch {
            // 이미 종료된 녹화는 무시한다.
          }
        }
        stopAudioAnalysis()
        stopTTS()

        Object.values(preloadedAudiosRef.current).forEach((url) => {
          URL.revokeObjectURL(url)
        })
        preloadedAudiosRef.current = {}

        setPhase('ready')
        setIsRetakeMode(false)
        setIsStartingRetake(false)
        setRetakeQueueMeta(null)
        retakeQueueRef.current = []
        setSelectedRetakeIndexes(new Set())
        setIsFetchingInterviewSetup(false)
        setCurrentQuestionIndex(0)
        setAnswers([])
        setInterviewReport(null)
        setAnalysisStatusMessage('')
        setCountdown(null)
        setRecordingTime(0)
        setIsRecording(false)
        setIsSubmittingAnswer(false)
        setHasPendingRecording(false)
        setIsSpeaking(false)
        setIsQuestionVisible(false)
        setIsPreloading(false)
        setPreloadProgress(0)
        pendingAnswerFileRef.current = null
        recordingPromiseRef.current = null
        mediaRecorderRef.current = null
      }

      window.addEventListener('popstate', handlePopState)

      return () => {
        window.removeEventListener('popstate', handlePopState)
      }
    }
  }, [phase, stopCamera, stopAudioAnalysis, stopTTS])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getScoreColor = (score) => {
    if (score >= 85) return 'var(--color-success)'
    if (score >= 70) return 'var(--color-blue-500)'
    if (score >= 50) return 'var(--color-warning)'
    return 'var(--color-error)'
  }

  return (
    <div className="mock-interview">
      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <Motion.div
            key="ready"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mock-interview__ready"
          >
            <div className="mock-interview__intro card">
              {errorMessage && (
                <div className="mock-interview__preload-error">
                  ⚠️ {errorMessage}
                </div>
              )}

              <div className="mock-interview__intro-icon">🎥</div>
              <h2>모의 면접</h2>
              <p>
                실제 면접처럼 카메라 앞에서 연습하고,
                <br />
                AI가 당신의 표정, 시선, 자세, 말하기를 분석해 피드백을 드립니다.
              </p>

              <div className="mock-interview__features">
                {behaviorMetrics.map((metric) => (
                  <div key={metric.id} className="mock-interview__feature">
                    <span className="mock-interview__feature-icon">{metric.icon}</span>
                    <div>
                      <strong>{metric.label}</strong>
                      <p>{metric.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* 질문 개수 선택 */}
              <div className="mock-interview__settings">
                <label className="mock-interview__settings-label">질문 개수</label>
                <div className="mock-interview__question-count">
                  <button
                    className="mock-interview__count-btn"
                    onClick={() => setQuestionCount((prev) => Math.max(MIN_QUESTIONS, prev - 1))}
                    disabled={isFetchingInterviewSetup || questionCount <= MIN_QUESTIONS}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className="mock-interview__count-input"
                    value={questionCount}
                    min={MIN_QUESTIONS}
                    max={MAX_QUESTIONS}
                    disabled={isFetchingInterviewSetup}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10)
                      if (!isNaN(value)) {
                        setQuestionCount(Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, value)))
                      }
                    }}
                  />
                  <button
                    className="mock-interview__count-btn"
                    onClick={() => setQuestionCount((prev) => Math.min(MAX_QUESTIONS, prev + 1))}
                    disabled={isFetchingInterviewSetup || questionCount >= MAX_QUESTIONS}
                  >
                    +
                  </button>
                </div>
                <span className="mock-interview__count-hint">최대 {MAX_QUESTIONS}개</span>
              </div>

              {/* 면접관 음성 선택 */}
              <div className="mock-interview__settings">
                <label className="mock-interview__settings-label">면접관 음성</label>
                <Dropdown
                  options={Object.entries(speakers)
                    .filter(([, info]) => info.lang === 'ko')
                    .map(([key, info]) => ({
                      value: key,
                      label: `${info.name} (${info.description})`,
                    }))}
                  value={selectedSpeaker}
                  onChange={setSelectedSpeaker}
                  placeholder="음성을 선택하세요"
                  disabled={isFetchingInterviewSetup}
                />
              </div>

              <div className="mock-interview__notice">
                <span>📌</span>
                <p>
                  카메라와 마이크 접근 권한이 필요합니다.
                  <br />질문당 약 1-2분 정도 답변해주세요.
                </p>
              </div>

              <button
                type="button"
                className={`btn btn--primary btn--lg mock-interview__start-btn${isFetchingInterviewSetup ? ' mock-interview__start-btn--busy' : ''}`}
                onClick={handleStart}
                disabled={isFetchingInterviewSetup}
                aria-busy={isFetchingInterviewSetup}
              >
                {isFetchingInterviewSetup ? (
                  <span className="mock-interview__start-btn-inner">
                    <span className="mock-interview__start-spinner" aria-hidden />
                    질문을 불러오는 중…
                  </span>
                ) : (
                  '면접 시작하기'
                )}
              </button>
            </div>
          </Motion.div>
        )}

        {phase === 'loading' && (
          <Motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mock-interview__ready"
          >
            <div className="mock-interview__intro mock-interview__intro--loading card">
              <div className="mock-interview__intro-icon">🎙️</div>
              <h2>면접 준비 중...</h2>
              <p>질문 음성을 미리 로딩하고 있습니다.</p>
              {preloadError && (
                <p className="mock-interview__preload-error">
                  ⚠️ {preloadError} (질문 표시 시 음성으로 시도합니다)
                </p>
              )}
              <div className="mock-interview__loading-progress">
                <div className="mock-interview__progress-bar">
                  <div
                    className="mock-interview__progress-fill"
                    style={{ width: `${preloadProgress}%` }}
                  />
                </div>
                <span>{preloadProgress}%</span>
              </div>
              <button
                className="btn btn--secondary btn--md mock-interview__cancel-btn"
                onClick={cancelPreload}
              >
                취소
              </button>
            </div>
          </Motion.div>
        )}

        {phase === 'interview' && (
          <Motion.div
            key="interview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mock-interview__session"
          >
            {isRetakeMode ? (
              <div className="mock-interview__retake-banner card">
                <div className="mock-interview__retake-banner-text">
                  <span className="mock-interview__retake-banner-label">재답변</span>
                  <p>
                    {retakeQueueMeta && retakeQueueMeta.total > 1
                      ? `선택한 질문 ${retakeQueueMeta.current}/${retakeQueueMeta.total} — Q${currentQuestionIndex + 1}에 다시 답변 중입니다.`
                      : `질문 ${currentQuestionIndex + 1}에 다시 답변하고 있습니다.`}
                    {retakeQueueMeta && retakeQueueMeta.total > 1
                      ? ' 모든 재답변을 마치면 결과를 다시 분석합니다.'
                      : ' 완료 후 결과를 다시 분석합니다.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={handleCancelRetake}
                >
                  취소
                </button>
              </div>
            ) : null}

            {/* 비디오 영역 */}
            <div className="mock-interview__video-container">
              <video
                ref={bindVideoRef}
                autoPlay
                muted
                playsInline
                className="mock-interview__video"
              />

              {cameraError && (
                <div className="mock-interview__camera-error">
                  <span>⚠️</span>
                  <p>{cameraError}</p>
                </div>
              )}

              {/* 녹화 상태 표시 */}
              {isRecording && (
                <div className="mock-interview__recording-badge">
                  <span className="mock-interview__recording-dot" />
                  REC {formatTime(recordingTime)}
                </div>
              )}

              {/* 카운트다운 오버레이 */}
              {countdown && (
                <div className="mock-interview__countdown">
                  <span>{countdown}</span>
                </div>
              )}

              {/* AI 말하는 중 표시 */}
              {isSpeaking && (
                <div className="mock-interview__speaking">
                  <div className="mock-interview__speaking-waves">
                    <span /><span /><span /><span /><span />
                  </div>
                  AI가 질문을 읽고 있습니다...
                </div>
              )}

              {/* 오디오 레벨 미터 */}
              <div className="mock-interview__audio-meter">
                <div className="mock-interview__audio-icon">🎤</div>
                <div className="mock-interview__audio-bar">
                  <div
                    className="mock-interview__audio-level"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
                <span className="mock-interview__audio-label">
                  {audioLevel > 10 ? '음성 감지 중' : '대기 중'}
                </span>
              </div>
            </div>

            {/* 질문 및 컨트롤 */}
            <div className="mock-interview__controls card">
              <div className="mock-interview__progress">
                <span>
                  {isRetakeMode && retakeQueueMeta
                    ? `재답변 ${retakeQueueMeta.current} / ${retakeQueueMeta.total}`
                    : `질문 ${currentQuestionIndex + 1} / ${totalQuestions}`}
                </span>
                <div className="mock-interview__progress-bar">
                  <div
                    className="mock-interview__progress-fill"
                    style={{
                      width: `${
                        isRetakeMode && retakeQueueMeta
                          ? (retakeQueueMeta.current / retakeQueueMeta.total) * 100
                          : ((currentQuestionIndex + 1) / totalQuestions) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="mock-interview__question">
                {isQuestionVisible ? (
                  <>
                    <span className="badge">{currentQuestion.category}</span>
                    <p>{currentQuestion.text}</p>
                  </>
                ) : (
                  <p className="mock-interview__question-hidden">잠시 후 질문이 표시됩니다...</p>
                )}
              </div>

              {errorMessage && (
                <p className="mock-interview__preload-error">
                  ⚠️ {errorMessage}
                </p>
              )}

              <div className="mock-interview__actions">
                {isRecording || hasPendingRecording || isSubmittingAnswer ? (
                  <button
                    className="btn btn--primary"
                    onClick={handleNextQuestion}
                    disabled={isSubmittingAnswer}
                  >
                    {isSubmittingAnswer
                      ? '답변 제출 중...'
                      : hasPendingRecording
                        ? '답변 다시 제출'
                        : isRetakeMode
                          ? retakeQueueMeta && retakeQueueMeta.current < retakeQueueMeta.total
                            ? '다음 재답변'
                            : '재답변 완료'
                          : currentQuestionIndex < totalQuestions - 1
                            ? '다음 질문'
                            : '면접 완료'}
                  </button>
                ) : (
                  <p className="mock-interview__waiting">
                    {isSpeaking ? '질문을 듣고 준비하세요' : countdown ? `${countdown}초 후 답변 시작` : '준비 중...'}
                  </p>
                )}
              </div>
            </div>
          </Motion.div>
        )}

        {phase === 'analyzing' && (
          <Motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mock-interview__analyzing card"
          >
            <div className="mock-interview__analyzing-inner">
              <div className="mock-interview__analyzing-visual" aria-hidden>
                <div className="mock-interview__analyzing-spinner" />
              </div>

              <Motion.h2
                className="mock-interview__analyzing-heading"
                animate={{ opacity: [1, 0.72, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                분석 중
              </Motion.h2>

              <p className="mock-interview__analyzing-lead">
                면접관 AI가 답변의 논리성과 태도를 종합적으로 검토하고 있습니다.
              </p>

              <div
                className="mock-interview__analyzing-progress"
                role="progressbar"
                aria-valuetext="처리 중"
              >
                <div className="mock-interview__analyzing-progress-track mock-interview__analyzing-progress-track--indeterminate">
                  <div className="mock-interview__analyzing-progress-fill mock-interview__analyzing-progress-fill--indeterminate" />
                </div>
              </div>

              <p className="mock-interview__analyzing-status" role="status" aria-live="polite">
                {analysisStatusMessage || '면접 결과를 서버에서 가져오는 중입니다.'}
              </p>
              <p className="mock-interview__analyzing-status" role="status" aria-live="polite">
                완료되는 대로 화면이 바뀝니다.
              </p>
            </div>
          </Motion.div>
        )}

        {phase === 'feedback' && behaviorAnalysis && interviewReport?.questions?.length > 0 && (
          <Motion.div
            key="feedback"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mock-interview__feedback mock-interview__feedback--report"
          >
            <div className="mock-interview__report-hero card mock-interview__glass">
              <div className="mock-interview__report-hero-text">
                <p className="mock-interview__report-eyebrow">
                  {isHistoryRetakeFeedback ? '재답변 결과' : '총평'}
                </p>
                <h3 className="mock-interview__report-headline">
                  {isHistoryRetakeFeedback ? '재답변 분석 결과' : '모의 면접 종합 평가'}
                </h3>
                <p className="mock-interview__report-summary">{interviewReport.overallSummary}</p>
                {isHistoryRetakeFeedback ? (
                  <p className="mock-interview__report-meta mock-interview__report-meta--note">
                    재답변 점수는 리워드에 반영되지 않으며, 면접 기록에 저장됩니다.
                  </p>
                ) : (
                  <p className="mock-interview__report-meta">총 {answers.length}문항</p>
                )}
              </div>
              <div className="mock-interview__report-hero-scorebox">
                <span className="mock-interview__report-hero-score-label">전체 평균</span>
                {typeof interviewReport?.overallScore === 'number' ? (
                  <p
                    className="mock-interview__report-hero-score-value"
                    style={{ color: getScoreColor(displayedOverallScore) }}
                  >
                    {displayedOverallScore}
                    <span className="mock-interview__report-hero-score-unit">점</span>
                  </p>
                ) : (
                  <p className="mock-interview__report-hero-score-value">-</p>
                )}
              </div>
            </div>

            <div className="mock-interview__q-feedbacks">
              {interviewReport.questions.map((q) => (
                <QuestionFeedbackSection
                  key={q.index}
                  q={q}
                  ordinal={q.index}
                  getScoreColor={getScoreColor}
                />
              ))}
            </div>

            {!isHistoryRetakeFeedback ? (
            <div className="mock-interview__answers card">
              <div className="mock-interview__answers-head">
                <h4>📝 질문별 답변 기록</h4>
                <p className="mock-interview__answers-hint">
                  다시 답변할 질문을 선택하거나 전체를 다시 진행할 수 있습니다.
                </p>
              </div>

              {errorMessage ? (
                <p className="mock-interview__preload-error">⚠️ {errorMessage}</p>
              ) : null}

              <div className="mock-interview__retake-toolbar">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={handleSelectAllRetakes}
                  disabled={isStartingRetake}
                >
                  전체 선택
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={handleClearRetakeSelection}
                  disabled={isStartingRetake}
                >
                  선택 해제
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={isStartingRetake || selectedRetakeIndexes.size === 0}
                  onClick={handleStartSelectedRetakes}
                >
                  {isStartingRetake
                    ? '준비 중…'
                    : `선택 질문 다시 답변${selectedRetakeIndexes.size > 0 ? ` (${selectedRetakeIndexes.size})` : ''}`}
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={isStartingRetake}
                  onClick={handleStartAllRetakes}
                >
                  {isStartingRetake ? '준비 중…' : '전체 다시 답변'}
                </button>
              </div>

              <div className="mock-interview__answer-list">
                {answers.map((answer, idx) => {
                  const isSelected = selectedRetakeIndexes.has(idx)
                  return (
                    <label
                      key={answer.questionId ?? idx}
                      className={`mock-interview__answer-item mock-interview__answer-item--selectable${isSelected ? ' mock-interview__answer-item--selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="mock-interview__answer-checkbox"
                        checked={isSelected}
                        disabled={isStartingRetake}
                        onChange={() => handleToggleRetakeSelection(idx)}
                      />
                      <div className="mock-interview__answer-item-body">
                        <div className="mock-interview__answer-header">
                          <span className="badge">Q{idx + 1}</span>
                          <span className="mock-interview__answer-time">
                            답변 시간: {formatTime(answer.duration)}
                          </span>
                        </div>
                        <p>{answer.question}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
            ) : null}

            {isHistoryRetakeFeedback ? (
              <button
                type="button"
                className="btn btn--primary btn--lg btn--block"
                onClick={handleGoToHistoryAfterRetake}
              >
                면접 기록에서 확인하기
              </button>
            ) : (
              <button className="btn btn--primary btn--lg btn--block" onClick={handleRestart}>
                새 질문으로 다시 연습하기
              </button>
            )}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
