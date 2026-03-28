import { useState, useRef, useEffect, useCallback } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { useTTS } from '../hooks/useTTS'
import { textToSpeech } from '../utils/ttsApi'
import Dropdown from './Dropdown'
import '../styles/components/MockInterview.css'

const allQuestions = [
  { id: 1, text: '자기소개를 해주세요.', category: '기본' },
  { id: 2, text: '지원 동기가 무엇인가요?', category: '동기' },
  { id: 3, text: '본인의 강점과 약점을 말씀해주세요.', category: '역량' },
  { id: 4, text: '팀에서 갈등이 생겼을 때 어떻게 해결하시나요?', category: '협업' },
  { id: 5, text: '5년 후 본인의 모습을 어떻게 그리고 계신가요?', category: '비전' },
  { id: 6, text: '가장 어려웠던 프로젝트와 어떻게 극복했는지 말씀해주세요.', category: '경험' },
  { id: 7, text: '리더십을 발휘했던 경험이 있나요?', category: '리더십' },
  { id: 8, text: '실패했던 경험과 그로부터 배운 점을 말씀해주세요.', category: '성장' },
  { id: 9, text: '스트레스를 어떻게 관리하시나요?', category: '자기관리' },
  { id: 10, text: '우리 회사에 대해 알고 계신 것이 있나요?', category: '기업분석' },
]

const MIN_QUESTIONS = 1
const MAX_QUESTIONS = 10

const behaviorMetrics = [
  { id: 'eyeContact', label: '시선 처리', icon: '👁️', description: '카메라를 향한 시선 유지' },
  { id: 'expression', label: '표정', icon: '😊', description: '자연스럽고 밝은 표정' },
  { id: 'posture', label: '자세', icon: '🧍', description: '바른 자세 유지' },
  { id: 'speech', label: '말하기', icon: '🎤', description: '명확한 발음과 적절한 속도' },
]

function HexInsightChart({ analysis, className }) {
  const cx = 60
  const cy = 54
  const rMax = 36
  const keys = ['speech', 'eyeContact', 'expression', 'posture', 'speech', 'eyeContact']
  const angles = keys.map((_, i) => ((i * 60 - 90) * Math.PI) / 180)
  const dataPoints = keys.map((k, i) => {
    const rad = (analysis[k] / 100) * rMax
    return [cx + rad * Math.cos(angles[i]), cy + rad * Math.sin(angles[i])]
  })
  const dataPoly = dataPoints.map((p) => p.join(',')).join(' ')
  const hexOuter = angles.map((a) => `${cx + rMax * Math.cos(a)},${cy + rMax * Math.sin(a)}`).join(' ')

  return (
    <svg className={className} viewBox="0 0 120 108" aria-hidden>
      <polygon points={hexOuter} className="mock-interview__hex-ring" />
      <polygon points={dataPoly} className="mock-interview__hex-data" />
    </svg>
  )
}

const ANALYSIS_DURATION_MS = 3200

const ANALYSIS_STATUS_LABELS = [
  '음성 데이터 패턴을 분석하는 중…',
  '시선 처리·표정 신호를 정리하는 중…',
  '단어 선택·논리 구조를 요약하는 중…',
  '비언어적 태도와 말하기 리듬을 교차 검증하는 중…',
  '질문별 피드백 초안을 생성하는 중…',
]

const buildInterviewReport = (answersSnapshot, overallScore) => {
  const prototypeSpeech = {
    strengths: ['적절한 말하기 속도', '명확한 발음'],
    weaknesses: ["'어...', '그...' 등 불필요한 추임새가 잦음"],
    improvement: '문장과 문장 사이에 포즈(Pause)를 두는 연습을 해보세요.',
  }
  const prototypeBehavior = {
    strengths: ['면접관(카메라)과 안정적인 아이컨택 유지'],
    weaknesses: ['답변 중 무의식적으로 어깨를 으쓱거리는 행동이 감지됨'],
    improvement: '허리를 펴고 손을 무릎 위에 안정적으로 올리는 자세를 의식하세요.',
  }

  const questions = answersSnapshot.map((a, idx) => {
    const avg = Math.round(
      (a.analysis.eyeContact + a.analysis.expression + a.analysis.posture + a.analysis.speech) / 4
    )
    const isFirst = idx === 0
    return {
      index: idx + 1,
      question: a.question,
      score: avg,
      speech: isFirst
        ? prototypeSpeech
        : {
            strengths: ['질문 의도 파악에 맞춘 답변 흐름'],
            weaknesses: ['일부 구간에서 속도가 다소 빠름'],
            improvement: '핵심 메시지 전에 한 박자 쉬어 가독성을 높여보세요.',
          },
      behavior: isFirst
        ? prototypeBehavior
        : {
            strengths: ['자연스러운 제스처'],
            weaknesses: ['장시간 답변 시 시선이 아래로 향하는 경향'],
            improvement: '핵심 문장에서는 카메라를 향해 말하는 습관을 들이면 좋습니다.',
          },
      narrative: isFirst
        ? `「${a.question}」에 대해 직무 이해도와 논리성이 양호했습니다. 핵심을 짚으려는 태도가 돋보이며, 실무 사례나 수치를 한두 가지 더하면 설득력이 더 높아질 것입니다.`
        : `질문 ${idx + 1}에 대해 핵심을 요약해 답변하려는 태도가 좋았습니다. 구체적 사례를 한 가지 더 덧붙이면 완성도가 올라갑니다.`,
    }
  })

  return {
    overallSummary:
      '이번 모의 면접에서는 답변의 구조와 비언어적 신호가 전반적으로 안정적이었습니다. 강점을 유지하면서 추임새와 자세만 다듬으면 실전에서도 좋은 인상을 줄 수 있을 것입니다.',
    overallScore,
    questions,
  }
}

export default function MockInterview() {
  const [phase, setPhase] = useState('ready') // ready | loading | interview | analyzing | feedback
  const [questionCount, setQuestionCount] = useState(5)
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

  const [interviewReport, setInterviewReport] = useState(null)
  const [analysisUiProgress, setAnalysisUiProgress] = useState(0)
  const [analysisStatusIndex, setAnalysisStatusIndex] = useState(0)
  const [displayedOverallScore, setDisplayedOverallScore] = useState(0)
  const [mobileInsightSlide, setMobileInsightSlide] = useState(0)

  // isSpeaking 상태를 TTS 상태와 동기화
  useEffect(() => {
    setIsSpeaking(isTTSPlaying || isTTSLoading)
  }, [isTTSPlaying, isTTSLoading])

  const currentQuestion = selectedQuestions[currentQuestionIndex]
  const totalQuestions = selectedQuestions.length

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
          setPreloadError(
            msg.includes('rate limit') || msg.includes('RateQuota')
              ? '요청 한도 초과. 잠시 후 다시 시도해주세요.'
              : msg
          )
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

      setIsSpeaking(true)
      setIsQuestionVisible(true)

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
      } finally {
        setTimeout(() => {
          setIsSpeaking(false)
          startCountdown()
        }, 300)
      }
    },
    [startCountdown, selectedSpeaker]
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

  // 질문 랜덤 선택
  const selectRandomQuestions = (count) => {
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  // 면접 시작
  const handleStart = async () => {
    // 모바일 오디오 초기화 (사용자 인터랙션 직후 호출해야 함)
    initAudioForMobile()

    // 질문 선택
    const questions = selectRandomQuestions(questionCount)
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
  const handleNextQuestion = () => {
    setIsRecording(false)
    setIsQuestionVisible(false) // 다음 질문 전환 시 질문 숨김

    // Mock 행동 분석 결과 저장
    const mockAnalysis = {
      eyeContact: Math.floor(Math.random() * 30) + 70,
      expression: Math.floor(Math.random() * 30) + 65,
      posture: Math.floor(Math.random() * 25) + 75,
      speech: Math.floor(Math.random() * 30) + 70,
    }

    const newAnswer = {
      questionId: currentQuestion.id,
      question: currentQuestion.text,
      duration: recordingTime,
      analysis: mockAnalysis,
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

  // 답변 스냅샷으로 최종 피드백 계산 (API는 그대로 두고 클라이언트 목업만 확장)
  const computeFinalFeedback = useCallback((snapshot) => {
    const overallAnalysis = {
      eyeContact: Math.floor(Math.random() * 20) + 75,
      expression: Math.floor(Math.random() * 20) + 70,
      posture: Math.floor(Math.random() * 15) + 80,
      speech: Math.floor(Math.random() * 20) + 75,
      overall: 0,
      strengths: [
        '전반적으로 자신감 있는 태도를 보여주셨습니다.',
        '질문에 대한 답변 구조가 명확했습니다.',
        '적절한 예시를 들어 설명하셨습니다.',
      ],
      improvements: [
        '가끔 시선이 카메라에서 벗어나는 경향이 있습니다.',
        '답변 중간에 "음...", "어..." 같은 습관어를 줄여보세요.',
        '답변 시간을 조금 더 간결하게 조절해보세요.',
      ],
      tips: [
        '면접 전 거울 앞에서 연습하면 표정 관리에 도움이 됩니다.',
        'STAR 기법을 활용하면 답변을 더 구조화할 수 있습니다.',
        '예상 질문 리스트를 만들어 반복 연습해보세요.',
      ],
    }
    overallAnalysis.overall = Math.floor(
      (overallAnalysis.eyeContact +
        overallAnalysis.expression +
        overallAnalysis.posture +
        overallAnalysis.speech) /
        4
    )

    const report = buildInterviewReport(snapshot, overallAnalysis.overall)
    setBehaviorAnalysis(overallAnalysis)
    setInterviewReport(report)
    setPhase('feedback')
  }, [])

  useEffect(() => {
    if (phase !== 'analyzing') return undefined

    setAnalysisUiProgress(0)
    setAnalysisStatusIndex(0)
    setDisplayedOverallScore(0)
    setMobileInsightSlide(0)

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
      computeFinalFeedback(answersSnapshotRef.current)
    }, ANALYSIS_DURATION_MS)

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearInterval(statusTimer)
      clearTimeout(doneTimer)
    }
  }, [phase, computeFinalFeedback])

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
  }

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
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
        setIsSpeaking(false)
        setIsQuestionVisible(false)
        setIsPreloading(false)
        setPreloadProgress(0)
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

  const reportQ1 = interviewReport?.questions?.[0]

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

              <div className="mock-interview__actions">
                {isRecording ? (
                  <button className="btn btn--primary" onClick={handleNextQuestion}>
                    {currentQuestionIndex < totalQuestions - 1 ? '다음 질문' : '면접 완료'}
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

        {phase === 'feedback' && behaviorAnalysis && interviewReport && reportQ1 && (
          <Motion.div
            key="feedback"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mock-interview__feedback mock-interview__feedback--report"
          >
            {/* 웹·태블릿: 총평 + 평균 점수 + 육각 차트 */}
            <div className="mock-interview__report-hero card mock-interview__glass">
              <div className="mock-interview__report-hero-text">
                <p className="mock-interview__report-eyebrow">총평 및 종합 점수</p>
                <h3 className="mock-interview__report-headline">모의 면접 종합 평가</h3>
                <p className="mock-interview__report-summary">{interviewReport.overallSummary}</p>
                <p className="mock-interview__report-meta">
                  총 {answers.length}문항 · 전체 평균{' '}
                  <strong style={{ color: getScoreColor(displayedOverallScore) }}>
                    {displayedOverallScore}점
                  </strong>
                </p>
              </div>
              <Motion.div
                className="mock-interview__report-hex-wrap mock-interview__report-hex-wrap--hero"
                animate={{ rotate: 360 }}
                transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
              >
                <HexInsightChart analysis={behaviorAnalysis} className="mock-interview__hex-svg" />
              </Motion.div>
            </div>

            {/* 웹: 벤토 그리드 */}
            <div className="mock-interview__bento mock-interview__bento--web">
              <div className="mock-interview__bento-card mock-interview__bento-card--q card mock-interview__clay">
                <span className="mock-interview__bento-label">질문 1</span>
                <p className="mock-interview__bento-qtext">{reportQ1.question}</p>
                <p className="mock-interview__bento-score">
                  해당 질문 점수{' '}
                  <strong style={{ color: getScoreColor(reportQ1.score) }}>{reportQ1.score}점</strong>
                </p>
              </div>

              <div className="mock-interview__bento-card card mock-interview__glass">
                <h4 className="mock-interview__bento-title">스피치 분석</h4>
                <ul className="mock-interview__insight-list">
                  <li>
                    <span className="mock-interview__insight-tag mock-interview__insight-tag--ok">
                      잘한 점
                    </span>
                    {reportQ1.speech.strengths.join(', ')}
                  </li>
                  <li>
                    <span className="mock-interview__insight-tag mock-interview__insight-tag--warn">
                      부족한 점
                    </span>
                    {reportQ1.speech.weaknesses.join(', ')}
                  </li>
                  <li>
                    <span className="mock-interview__insight-tag mock-interview__insight-tag--tip">
                      개선 방향
                    </span>
                    {reportQ1.speech.improvement}
                  </li>
                </ul>
              </div>

              <div className="mock-interview__bento-card card mock-interview__glass">
                <h4 className="mock-interview__bento-title">행동 · 태도 분석</h4>
                <ul className="mock-interview__insight-list">
                  <li>
                    <span className="mock-interview__insight-tag mock-interview__insight-tag--ok">
                      잘한 점
                    </span>
                    {reportQ1.behavior.strengths.join(', ')}
                  </li>
                  <li>
                    <span className="mock-interview__insight-tag mock-interview__insight-tag--warn">
                      부족한 점
                    </span>
                    {reportQ1.behavior.weaknesses.join(', ')}
                  </li>
                  <li>
                    <span className="mock-interview__insight-tag mock-interview__insight-tag--tip">
                      개선 방향
                    </span>
                    {reportQ1.behavior.improvement}
                  </li>
                </ul>
              </div>

              <div className="mock-interview__bento-card mock-interview__bento-card--wide card mock-interview__glass mock-interview__glass--strong">
                <h4 className="mock-interview__bento-title">질문 1 종합 서술 평가</h4>
                <p className="mock-interview__bento-narrative">{reportQ1.narrative}</p>
              </div>
            </div>

            {/* 모바일: 스티키 헤더 + 캐러셀 */}
            <div className="mock-interview__report-mobile">
              <div className="mock-interview__report-mobile-sticky card mock-interview__glass">
                <div>
                  <p className="mock-interview__report-eyebrow">내 점수</p>
                  <p
                    className="mock-interview__report-mobile-score"
                    style={{ color: getScoreColor(displayedOverallScore) }}
                  >
                    {displayedOverallScore}
                    <span>점</span>
                  </p>
                </div>
                <Motion.div
                  className="mock-interview__report-hex-wrap mock-interview__report-hex-wrap--sm"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
                >
                  <HexInsightChart analysis={behaviorAnalysis} className="mock-interview__hex-svg" />
                </Motion.div>
              </div>

              <div className="mock-interview__report-mobile-intro card mock-interview__glass">
                <h3 className="mock-interview__report-headline mock-interview__report-headline--sm">
                  모의 면접 종합 평가
                </h3>
                <p className="mock-interview__report-summary">{interviewReport.overallSummary}</p>
              </div>

              <div className="mock-interview__bento-card card mock-interview__clay">
                <span className="mock-interview__bento-label">질문 1</span>
                <p className="mock-interview__bento-qtext">{reportQ1.question}</p>
                <p className="mock-interview__bento-score">
                  해당 질문 점수{' '}
                  <strong style={{ color: getScoreColor(reportQ1.score) }}>{reportQ1.score}점</strong>
                </p>
              </div>

              <div className="mock-interview__mobile-carousel card mock-interview__glass">
                <div className="mock-interview__mobile-carousel-header">
                  <button
                    type="button"
                    className={`mock-interview__chip ${mobileInsightSlide === 0 ? 'is-active' : ''}`}
                    onClick={() => setMobileInsightSlide(0)}
                  >
                    스피치 분석
                  </button>
                  <button
                    type="button"
                    className={`mock-interview__chip ${mobileInsightSlide === 1 ? 'is-active' : ''}`}
                    onClick={() => setMobileInsightSlide(1)}
                  >
                    행동 분석
                  </button>
                </div>
                <div className="mock-interview__mobile-carousel-viewport">
                  <div
                    className="mock-interview__mobile-carousel-track"
                    style={{ transform: `translateX(-${mobileInsightSlide * 100}%)` }}
                  >
                    <div className="mock-interview__mobile-carousel-slide">
                      <h4 className="mock-interview__bento-title">스피치 분석</h4>
                      <ul className="mock-interview__insight-list">
                        <li>
                          <span className="mock-interview__insight-tag mock-interview__insight-tag--ok">
                            잘한 점
                          </span>
                          {reportQ1.speech.strengths.join(', ')}
                        </li>
                        <li>
                          <span className="mock-interview__insight-tag mock-interview__insight-tag--warn">
                            부족한 점
                          </span>
                          {reportQ1.speech.weaknesses.join(', ')}
                        </li>
                        <li>
                          <span className="mock-interview__insight-tag mock-interview__insight-tag--tip">
                            개선 방향
                          </span>
                          {reportQ1.speech.improvement}
                        </li>
                      </ul>
                    </div>
                    <div className="mock-interview__mobile-carousel-slide">
                      <h4 className="mock-interview__bento-title">행동 · 태도 분석</h4>
                      <ul className="mock-interview__insight-list">
                        <li>
                          <span className="mock-interview__insight-tag mock-interview__insight-tag--ok">
                            잘한 점
                          </span>
                          {reportQ1.behavior.strengths.join(', ')}
                        </li>
                        <li>
                          <span className="mock-interview__insight-tag mock-interview__insight-tag--warn">
                            부족한 점
                          </span>
                          {reportQ1.behavior.weaknesses.join(', ')}
                        </li>
                        <li>
                          <span className="mock-interview__insight-tag mock-interview__insight-tag--tip">
                            개선 방향
                          </span>
                          {reportQ1.behavior.improvement}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mock-interview__bento-card card mock-interview__glass mock-interview__glass--strong">
                <h4 className="mock-interview__bento-title">질문 1 종합 서술 평가</h4>
                <p className="mock-interview__bento-narrative">{reportQ1.narrative}</p>
              </div>
            </div>

            {/* 기존 지표·팁·기록 (목업 데이터 유지) */}
            <div className="mock-interview__legacy-block card card--gradient">
              <h4 className="mock-interview__legacy-title">세부 지표</h4>
              <div className="mock-interview__metrics">
                {behaviorMetrics.map((metric) => (
                  <div key={metric.id} className="mock-interview__metric">
                    <div className="mock-interview__metric-header">
                      <span>
                        {metric.icon} {metric.label}
                      </span>
                      <strong style={{ color: getScoreColor(behaviorAnalysis[metric.id]) }}>
                        {behaviorAnalysis[metric.id]}점
                      </strong>
                    </div>
                    <div className="mock-interview__metric-bar">
                      <div
                        className="mock-interview__metric-fill"
                        style={{
                          width: `${behaviorAnalysis[metric.id]}%`,
                          background: getScoreColor(behaviorAnalysis[metric.id]),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mock-interview__feedback-grid">
              <div className="mock-interview__feedback-card card">
                <h4>💪 강점</h4>
                <ul>
                  {behaviorAnalysis.strengths.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="mock-interview__feedback-card card">
                <h4>📈 개선점</h4>
                <ul>
                  {behaviorAnalysis.improvements.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mock-interview__tips card">
              <h4>💡 면접 팁</h4>
              <ul>
                {behaviorAnalysis.tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
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
