import { useState, useRef, useEffect, useCallback } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { useAppState } from '../context/AppStateContext'
import { useTTS } from '../hooks/useTTS'
import { textToSpeech } from '../utils/ttsApi'
import {
  createVideoInterviewQuestion,
  streamVideoInterviewResult,
  submitVideoInterviewAnswer,
} from '../utils/interviewApi'
import Dropdown from './Dropdown'
import '../styles/components/MockInterview.css'

const MIN_QUESTIONS = 1
const MAX_QUESTIONS = 3

const behaviorMetrics = [
  { id: 'eyeContact', label: '시선 처리', icon: '👁️', description: '카메라를 향한 시선 유지' },
  { id: 'expression', label: '표정', icon: '😊', description: '자연스럽고 밝은 표정' },
  { id: 'posture', label: '자세', icon: '🧍', description: '바른 자세 유지' },
  { id: 'speech', label: '말하기', icon: '🎤', description: '명확한 발음과 적절한 속도' },
]

const ANALYSIS_DURATION_MS = 3200

const ANALYSIS_STATUS_LABELS = [
  '음성 데이터 패턴을 분석하는 중…',
  '시선 처리·표정 신호를 정리하는 중…',
  '단어 선택·논리 구조를 요약하는 중…',
  '비언어적 태도와 말하기 리듬을 교차 검증하는 중…',
  '질문별 피드백 초안을 생성하는 중…',
]

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

const buildInterviewReport = (answersSnapshot) => {
  return {
    overallSummary: '모의 면접이 완료되었습니다. 서버 피드백 연동 시 상세 결과가 표시됩니다.',
    overallScore: null,
    questions: answersSnapshot.map((a, idx) => ({
      index: idx + 1,
      question: a.question,
      duration: a.duration,
    })),
  }
}

function normalizeFinalVideoReport(payload, fallbackAnswers = []) {
  if (!payload || typeof payload !== 'object') return null

  const questions = Array.isArray(payload.questions)
    ? payload.questions.map((item, idx) => ({
        index: idx + 1,
        question: item?.question || '',
        score: typeof item?.combinedScore === 'number' ? item.combinedScore : null,
        speech: {
          good: item?.speech?.good || '없음',
          improvement: item?.speech?.improvement || '없음',
          recommendation: item?.speech?.recommendation || '없음',
        },
        video: {
          good: item?.video?.good || '없음',
          improvement: item?.video?.improvement || '없음',
          recommendation: item?.video?.recommendation || '없음',
        },
        narrative: item?.combinedFeedback || '',
      }))
    : []

  if (!questions.length) return null

  return {
    overallSummary:
      payload.summary || '면접 결과 분석이 완료되었습니다.',
    overallScore: typeof payload.finalScore === 'number' ? payload.finalScore : null,
    questions,
    answers: fallbackAnswers,
  }
}

function QuestionFeedbackSection({ q, ordinal, getScoreColor }) {
  const hasScore = typeof q.score === 'number'
  const hasDetailedFeedback = Boolean(q.speech || q.video || q.narrative)
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
            <div className="mock-interview__q-block">
              <h4 className="mock-interview__q-block-title">스피치 분석</h4>
              <ul className="mock-interview__insight-list">
                <li>
                  <span className="mock-interview__insight-tag mock-interview__insight-tag--ok">잘한 점</span>
                  {q.speech?.good || '없음'}
                </li>
                <li>
                  <span className="mock-interview__insight-tag mock-interview__insight-tag--warn">개선점</span>
                  {q.speech?.improvement || '없음'}
                </li>
                <li>
                  <span className="mock-interview__insight-tag mock-interview__insight-tag--tip">추천</span>
                  {q.speech?.recommendation || '없음'}
                </li>
              </ul>
            </div>

            <div className="mock-interview__q-block">
              <h4 className="mock-interview__q-block-title">비언어 분석</h4>
              <ul className="mock-interview__insight-list">
                <li>
                  <span className="mock-interview__insight-tag mock-interview__insight-tag--ok">잘한 점</span>
                  {q.video?.good || '없음'}
                </li>
                <li>
                  <span className="mock-interview__insight-tag mock-interview__insight-tag--warn">개선점</span>
                  {q.video?.improvement || '없음'}
                </li>
                <li>
                  <span className="mock-interview__insight-tag mock-interview__insight-tag--tip">추천</span>
                  {q.video?.recommendation || '없음'}
                </li>
              </ul>
            </div>

            {q.narrative ? (
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

export default function MockInterview() {
  const { getAccessToken } = useAppState()
  const [phase, setPhase] = useState('ready') // ready | loading | interview | analyzing | feedback
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
  const answersSnapshotRef = useRef([])
  const mediaRecorderRef = useRef(null)
  const recordingPromiseRef = useRef(null)
  const pendingAnswerFileRef = useRef(null)

  const [interviewReport, setInterviewReport] = useState(null)
  const [analysisUiProgress, setAnalysisUiProgress] = useState(0)
  const [analysisStatusIndex, setAnalysisStatusIndex] = useState(0)
  const [displayedOverallScore, setDisplayedOverallScore] = useState(0)

  const disableTts = useCallback((reason) => {
    if (!ttsEnabledRef.current) return
    ttsEnabledRef.current = false
    setTtsEnabled(false)
    if (reason) {
      setPreloadError(reason)
    }
  }, [])

  // isSpeaking 상태를 TTS 상태와 동기화
  useEffect(() => {
    setIsSpeaking(isTTSPlaying || isTTSLoading)
  }, [isTTSPlaying, isTTSLoading])

  const currentQuestion = selectedQuestions[currentQuestionIndex]
  const totalQuestions = selectedQuestions.length

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

  // 카메라 시작
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      streamRef.current = stream
      setCameraError(null)
      return stream
    } catch (err) {
      setCameraError(`카메라 접근 오류: ${err.message}`)
      return null
    }
  }

  // 비디오 요소에 스트림 연결 (백업용)
  useEffect(() => {
    if (phase === 'interview' && videoRef.current && streamRef.current) {
      const video = videoRef.current
      if (!video.srcObject) {
        video.srcObject = streamRef.current
        video.play().catch(() => {})
      }
    }
  }, [phase])

  // 카메라 정지
  const stopCamera = useCallback(() => {
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

    const options = { speaker: selectedSpeaker }

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
          const blob = await textToSpeech(questions[i].text, options, abortController.signal)
          const url = URL.createObjectURL(blob)
          audios[questions[i].id] = url
          setPreloadProgress(Math.round(((i + 1) / questions.length) * 100))
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
  }, [selectedSpeaker])

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
      if (!questionId || !questionText) return

      setIsQuestionVisible(true)

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
          const blob = await textToSpeech(questionText, { speaker: selectedSpeaker })
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
    [startCountdown, selectedSpeaker, disableTts]
  )

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
    setErrorMessage('')
    ttsEnabledRef.current = true
    setTtsEnabled(true)
    // 모바일 오디오 초기화 (사용자 인터랙션 직후 호출해야 함)
    initAudioForMobile()

    // 질문 선택: VIDEO API만 사용
    let questions = []
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
      return
    }
    if (questions.length === 0) {
      setVideoSessionId(null)
      setErrorMessage('면접 질문 생성 결과가 비어있습니다. 잠시 후 다시 시도해주세요.')
      return
    }

    setSelectedQuestions(questions)
    setIsQuestionVisible(false)

    // 질문 음성 프리로딩 시작
    setPhase('loading')
    const audios = await preloadQuestionAudios(questions)

    // 프리로딩이 취소된 경우 중단
    if (!audios) return

    // 카메라 시작
    const stream = await startCamera()
    if (!stream) return // 카메라 오류 시 진행하지 않음

    setPhase('interview')
    setCurrentQuestionIndex(0)
    setAnswers([])
    answersSnapshotRef.current = []
    pendingAnswerFileRef.current = null
    recordingPromiseRef.current = null
    mediaRecorderRef.current = null
    setHasPendingRecording(false)
    setIsSubmittingAnswer(false)

    // 오디오 레벨 분석 시작
    startAudioAnalysis(stream)

    // 비디오 요소가 렌더링된 후 스트림 연결
    setTimeout(() => {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(() => {})
        }
      }
    }, 500)

    // 첫 질문 읽기
    setTimeout(() => {
      speakQuestion(questions[0])
    }, 1500)
  }

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

      await submitVideoInterviewAnswer(
        currentQuestion.id,
        { video: videoFile },
        getAccessToken?.()
      )
    } catch (error) {
      console.error('[MockInterview] submitVideoInterviewAnswer error:', error)
      setErrorMessage(error?.message || '영상 답변 제출에 실패했습니다.')
      setHasPendingRecording(Boolean(pendingAnswerFileRef.current))
      setIsSubmittingAnswer(false)
      setIsRecording(false)
      return
    }

    setIsQuestionVisible(false) // 다음 질문 전환 시 질문 숨김
    pendingAnswerFileRef.current = null
    setHasPendingRecording(false)
    setIsSubmittingAnswer(false)

    // 행동 분석 API 연동 전 클라이언트 임시 점수
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

    setAnswers((prev) => {
      const next = [...prev, newAnswer]
      if (isLast) answersSnapshotRef.current = next
      return next
    })

    if (!isLast) {
      const nextIndex = currentQuestionIndex + 1
      setCurrentQuestionIndex(nextIndex)
      setTimeout(() => {
        speakQuestion(selectedQuestions[nextIndex])
      }, 500)
    } else {
      stopCamera()
      stopAudioAnalysis()
      stopTTS()
      setPhase('analyzing')
    }
  }

  // 답변 스냅샷 기반 최소 보고서 생성 (서버 결과 실패 시에만 사용)
  const computeFinalFeedback = useCallback((snapshot) => {
    const report = buildInterviewReport(snapshot)
    setBehaviorAnalysis({ overall: 0 })
    setInterviewReport(report)
    setPhase('feedback')
  }, [])

  const fetchFinalVideoResult = useCallback(async () => {
    const sessionId = videoSessionId
    if (!sessionId) {
      computeFinalFeedback(answersSnapshotRef.current)
      return
    }

    try {
      const controller = new AbortController()
      analysisAbortRef.current = controller
      let finalPayload = null

      await streamVideoInterviewResult(sessionId, {
        accessToken: getAccessToken?.(),
        signal: controller.signal,
        onMessage: ({ event, data }) => {
          if (event === 'final-complete' && data && typeof data === 'object') {
            finalPayload = data
          }
        },
      })

      const normalized = normalizeFinalVideoReport(finalPayload, answersSnapshotRef.current)
      if (!normalized) {
        throw new Error('화상 면접 최종 결과를 확인할 수 없습니다.')
      }

      setInterviewReport(normalized)
      setBehaviorAnalysis({ overall: normalized.overallScore ?? 0 })
      setPhase('feedback')
    } catch (error) {
      console.error('[MockInterview] streamVideoInterviewResult error:', error)
      setErrorMessage(error?.message || '화상 면접 결과 조회에 실패했습니다.')
      computeFinalFeedback(answersSnapshotRef.current)
    } finally {
      analysisAbortRef.current = null
    }
  }, [videoSessionId, getAccessToken, computeFinalFeedback])

  useEffect(() => {
    if (phase !== 'analyzing') return undefined

    setAnalysisUiProgress(0)
    setAnalysisStatusIndex(0)
    setDisplayedOverallScore(0)

    const start = performance.now()
    const rafRef = { current: 0 }
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ANALYSIS_DURATION_MS)
      setAnalysisUiProgress(Math.round(t * 100))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    const statusTimer = setInterval(() => {
      setAnalysisStatusIndex((i) => (i + 1) % 5)
    }, 600)

    const doneTimer = setTimeout(() => {
      fetchFinalVideoResult()
    }, ANALYSIS_DURATION_MS)

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearInterval(statusTimer)
      clearTimeout(doneTimer)
    }
  }, [phase, fetchFinalVideoResult])

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

  // 다시 시작
  const handleRestart = () => {
    Object.values(preloadedAudiosRef.current).forEach((url) => {
      URL.revokeObjectURL(url)
    })
    preloadedAudiosRef.current = {}

    setPhase('ready')
    setPreloadError(null)
    setCurrentQuestionIndex(0)
    setAnswers([])
    setBehaviorAnalysis(null)
    setInterviewReport(null)
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

        // 프리로딩된 오디오 URL 정리
        Object.values(preloadedAudiosRef.current).forEach((url) => {
          URL.revokeObjectURL(url)
        })
        preloadedAudiosRef.current = {}

        setPhase('ready')
        setCurrentQuestionIndex(0)
        setAnswers([])
        setInterviewReport(null)
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
                    disabled={questionCount <= MIN_QUESTIONS}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className="mock-interview__count-input"
                    value={questionCount}
                    min={MIN_QUESTIONS}
                    max={MAX_QUESTIONS}
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
                    disabled={questionCount >= MAX_QUESTIONS}
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
                />
              </div>

              <div className="mock-interview__notice">
                <span>📌</span>
                <p>
                  카메라와 마이크 접근 권한이 필요합니다.
                  <br />질문당 약 1-2분 정도 답변해주세요.
                </p>
              </div>

              <button className="btn btn--primary btn--lg" onClick={handleStart}>
                면접 시작하기
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
            {/* 비디오 영역 */}
            <div className="mock-interview__video-container">
              <video
                ref={videoRef}
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
                <span>질문 {currentQuestionIndex + 1} / {totalQuestions}</span>
                <div className="mock-interview__progress-bar">
                  <div
                    className="mock-interview__progress-fill"
                    style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
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

              <div className="mock-interview__analyzing-progress">
                <div className="mock-interview__analyzing-progress-track">
                  <div
                    className="mock-interview__analyzing-progress-fill"
                    style={{ width: `${analysisUiProgress}%` }}
                  />
                </div>
                <span className="mock-interview__analyzing-progress-pct">{analysisUiProgress}%</span>
              </div>

              <p className="mock-interview__analyzing-status" role="status" aria-live="polite">
                {ANALYSIS_STATUS_LABELS[analysisStatusIndex]}
              </p>

              <p className="mock-interview__analyzing-hint">
                잠시만 기다려 주세요. 곧 결과 화면으로 이동합니다.
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
                <p className="mock-interview__report-eyebrow">총평</p>
                <h3 className="mock-interview__report-headline">모의 면접 종합 평가</h3>
                <p className="mock-interview__report-summary">{interviewReport.overallSummary}</p>
                <p className="mock-interview__report-meta">총 {answers.length}문항</p>
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

            <div className="mock-interview__answers card">
              <h4>📝 질문별 답변 기록</h4>
              <div className="mock-interview__answer-list">
                {answers.map((answer, idx) => (
                  <div key={idx} className="mock-interview__answer-item">
                    <div className="mock-interview__answer-header">
                      <span className="badge">Q{idx + 1}</span>
                      <span className="mock-interview__answer-time">
                        답변 시간: {formatTime(answer.duration)}
                      </span>
                    </div>
                    <p>{answer.question}</p>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn btn--primary btn--lg btn--block" onClick={handleRestart}>
              다시 연습하기
            </button>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
