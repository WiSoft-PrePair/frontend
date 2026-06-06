import {createContext, useContext, useState, useEffect, useCallback} from 'react'
import {
  jobTracks,
  cadencePresets,
  scoringRubric,
  PRO_PLANS,
} from '../data/appConstants'
import * as memberApi from '../utils/memberApi'
import {
  collectRetakeQuestionIdCandidates,
  filterRetakeChildSessions,
  isRetakeChildSession,
} from '../utils/interviewApi'

const AppStateContext = createContext(null)

// 세션 스토리지 키 (브라우저 탭/창을 닫으면 로그인 상태 해제)
const STORAGE_KEY = 'prepair_user'
const STORAGE_ACCESS_TOKEN_KEY = 'prepair_access_token'
const STORAGE_REFRESH_TOKEN_KEY = 'prepair_refresh_token'
const authStorage = sessionStorage
const STORAGE_HISTORY_KEY = 'prepair_history'
const STORAGE_COMPANY_HISTORY_KEY = 'prepair_company_history'
const STORAGE_ACTIVITY_KEY = 'prepair_activity'
const STORAGE_PURCHASES_KEY = 'prepair_purchases'
const STORAGE_PRO_USAGE_KEY = 'prepair_pro_usage'
const STORAGE_MOCK_HISTORY_KEY = 'prepair_mock_interview_history'

function getMockHistoryStorageKey(userId) {
  return userId ? `${STORAGE_MOCK_HISTORY_KEY}_${userId}` : STORAGE_MOCK_HISTORY_KEY
}

function loadMockInterviewHistory(userId) {
  if (!userId) return []
  try {
    const saved = localStorage.getItem(getMockHistoryStorageKey(userId))
    const parsed = saved ? JSON.parse(saved) : []
    return filterRetakeChildSessions(Array.isArray(parsed) ? parsed : [])
  } catch {
    return []
  }
}
// 사용자별 포인트/스트릭 영속 저장 (로그아웃 후 재로그인해도 유지)
const STORAGE_USER_PROGRESS_KEY = 'prepair_user_progress'

/** localStorage에 저장된 사용자별 진행도(포인트/스트릭) 조회 */
function getStoredProgress(userId) {
  if (!userId) return null
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_USER_PROGRESS_KEY) || '{}')
    return all[userId] || null
  } catch {
    return null
  }
}

/** localStorage에 사용자별 진행도(포인트/스트릭) 저장 */
function saveStoredProgress(userId, progress) {
  if (!userId) return
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_USER_PROGRESS_KEY) || '{}')
    all[userId] = { ...(all[userId] || {}), ...progress }
    localStorage.setItem(STORAGE_USER_PROGRESS_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

/** 회원 탈퇴 등에서 사용자별 진행도 제거 */
function clearStoredProgress(userId) {
  if (!userId) return
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_USER_PROGRESS_KEY) || '{}')
    if (userId in all) {
      delete all[userId]
      localStorage.setItem(STORAGE_USER_PROGRESS_KEY, JSON.stringify(all))
    }
  } catch {
    /* ignore */
  }
}

/** 활동 히트맵 빈 그리드 (53주 × 7일) */
function emptyActivityHeatmap() {
  return Array.from({ length: 53 }, () => Array(7).fill(0))
}

/** 로그인·/auth/me 등 응답에서 member 페이로드 추출 (중첩 member, member_info 등 지원) */
function extractApiUser(response) {
  if (response == null) return null
  return (
    response?.data?.member_info ??
    response?.data?.user ??
    response?.data?.member ??
    response?.member_info ??
    response?.member ??
    response?.data ??
    response?.user ??
    response
  )
}

function getEntryQuestionText(entry) {
  if (!entry) return ''
  return typeof entry.question === 'object' ? entry.question?.text ?? '' : entry.question ?? ''
}

function getTextHistoryEntryKey(entry) {
  const key = entry?.historyId ?? entry?.id ?? getEntryQuestionText(entry)
  return key != null && key !== '' ? String(key) : null
}

function matchesInterviewHistoryEntry(entry, historyId, { questionId, questionText } = {}) {
  if (!entry) return false
  const entryId = entry.historyId ?? entry.id
  if (historyId != null && entryId != null && String(entryId) === String(historyId)) {
    return true
  }
  if (questionId != null) {
    const sourceIds = collectRetakeQuestionIdCandidates({ questionId, id: questionId })
    const entryIds = collectRetakeQuestionIdCandidates(entry)
    if (sourceIds.some((id) => entryIds.includes(id))) return true
  }
  const normalizedQuestionText = (questionText || '').trim()
  if (normalizedQuestionText && getEntryQuestionText(entry).trim() === normalizedQuestionText) {
    return true
  }
  return false
}

function questionIdsMatch(sourceQuestionId, question) {
  const sourceIds = collectRetakeQuestionIdCandidates({
    questionId: sourceQuestionId,
    id: sourceQuestionId,
  })
  if (!sourceIds.length) return false
  const targetIds = collectRetakeQuestionIdCandidates(question)
  return sourceIds.some((id) => targetIds.includes(id))
}

function patchSessionQuestions(questions, sourceQuestionId, questionText, questionPatch) {
  const list = Array.isArray(questions) ? [...questions] : []
  let targetIndex = list.findIndex((q) => questionIdsMatch(sourceQuestionId, q))
  if (targetIndex === -1 && questionText) {
    targetIndex = list.findIndex(
      (q) => (q?.question || q?.text || '').trim() === questionText.trim()
    )
  }
  if (targetIndex === -1 && list.length === 1) targetIndex = 0
  if (targetIndex === -1) {
    list.push({
      questionId: sourceQuestionId,
      question: questionText || '',
      index: list.length + 1,
      ...questionPatch,
    })
    return list
  }
  list[targetIndex] = { ...list[targetIndex], ...questionPatch }
  return list
}

export function AppProvider({children}) {
  const [user, setUser] = useState(() => {
    try {
      const saved = authStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const [currentQuestion, setCurrentQuestion] = useState(null)

  const [scoreHistory, setScoreHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_HISTORY_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [companyHistory, setCompanyHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_COMPANY_HISTORY_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return Array.isArray(parsed) ? parsed : []
      }
      return []
    } catch {
      return []
    }
  })

  const [sentQuestions, setSentQuestions] = useState([])

  const [activity, setActivity] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ACTIVITY_KEY)
      return saved ? JSON.parse(saved) : emptyActivityHeatmap()
    } catch {
      return emptyActivityHeatmap()
    }
  })

  const [purchases, setPurchases] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PURCHASES_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [lastFeedback, setLastFeedback] = useState(null)

  const [mockInterviewHistory, setMockInterviewHistory] = useState([])

  // Pro 플랜 상태 관리
  const [proUsage, setProUsage] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PRO_USAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // 월이 바뀌었으면 사용량 리셋
        const currentMonth = new Date().toISOString().slice(0, 7)
        if (parsed.month !== currentMonth) {
          return { month: currentMonth, mockInterview: 0, jobPost: 0 }
        }
        return parsed
      }
      return { month: new Date().toISOString().slice(0, 7), mockInterview: 0, jobPost: 0 }
    } catch {
      return { month: new Date().toISOString().slice(0, 7), mockInterview: 0, jobPost: 0 }
    }
  })

  // 사용자 상태 저장
  useEffect(() => {
    if (user) {
      authStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      authStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  // 포인트/스트릭은 사용자별로 localStorage에 영속 저장 → 로그아웃/재로그인해도 유지
  useEffect(() => {
    if (user?.id) {
      saveStoredProgress(user.id, {
        points: user.points || 0,
        streak: user.streak || 0,
      })
    }
  }, [user?.id, user?.points, user?.streak])

  useEffect(() => {
    setMockInterviewHistory(loadMockInterviewHistory(user?.id))
  }, [user?.id])

  // API 응답 user를 앱 user 형태로 정규화
  // - 로그인/회원가입: data.member_info 또는 data.user
  // - member_info 필드: point, isPro, memberId 등
  const normalizeUser = useCallback((apiUser) => {
    if (!apiUser) return null

    // 백엔드 notification(email | kakao | both) → FE 채널 체크 상태
    // 주의: notificationKakao 는 boolean 으로 오는 경우가 많아 문자열 폴백에 넣으면 "true" 로 깨짐
    const rawStr =
      typeof apiUser.notification === 'string' && apiUser.notification !== ''
        ? apiUser.notification
        : typeof apiUser.notificationChannel === 'string' && apiUser.notificationChannel !== ''
          ? apiUser.notificationChannel
          : typeof apiUser.notification_type === 'string' && apiUser.notification_type !== ''
            ? apiUser.notification_type
            : null

    let notificationKakao = false
    let notificationEmail = true

    if (rawStr != null) {
      const n = String(rawStr).toLowerCase()
      const isBoth = n === 'both'
      notificationKakao = n === 'kakao' || isBoth
      notificationEmail = n === 'email' || isBoth
    } else {
      const kOn =
        apiUser.notificationKakao === true || apiUser.notification_kakao === true
      const kOff =
        apiUser.notificationKakao === false || apiUser.notification_kakao === false
      const eOn =
        apiUser.notificationEmail === true || apiUser.notification_email === true
      const eOff =
        apiUser.notificationEmail === false || apiUser.notification_email === false
      if (kOn || kOff || eOn || eOff) {
        notificationKakao = kOn && !kOff
        if (eOff && !eOn) notificationEmail = false
        else if (eOn) notificationEmail = true
        else notificationEmail = true
      }
    }

    // 백엔드 frequency(weekly | every) → 기존 cadence 필드에 매핑
    const rawFrequency =
      apiUser.frequency ??
      apiUser.cadence ??
      apiUser.cadenceId
    const cadence = rawFrequency || 'daily'

    // plan: BE가 isPro(boolean) 또는 plan('free'|'pro')로 내려줌
    const plan =
      apiUser.plan ??
      (apiUser.isPro === true ? 'pro' : apiUser.isPro === false ? 'free' : 'free')

    const id =
      apiUser.id ??
      apiUser.userId ??
      apiUser.memberId ??
      `user-${apiUser.email?.replace('@', '-')}`

    // 백엔드가 아직 포인트/스트릭을 누적 추적하지 않으므로,
    // 로컬에 저장된 진행도가 있으면 그 값을 사용해 로그아웃 후에도 유지한다.
    const apiPoints = apiUser.points ?? apiUser.point ?? 0
    const apiStreak = apiUser.streak ?? 0
    const savedProgress = getStoredProgress(id)

    return {
      id,
      nickname: apiUser.nickname ?? apiUser.name ?? '',
      name: apiUser.nickname ?? apiUser.name ?? '',
      email: apiUser.email ?? '',
      points: savedProgress?.points ?? apiPoints,
      streak: savedProgress?.streak ?? apiStreak,
      jobRole: apiUser.job ?? apiUser.jobRole ?? apiUser.job_role ?? '',
      cadence,
      notificationKakao,
      notificationEmail,
      plan,
    }
  }, [])

  // 히스토리 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(scoreHistory))
  }, [scoreHistory])

  // 기업 면접 히스토리 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_COMPANY_HISTORY_KEY, JSON.stringify(companyHistory))
  }, [companyHistory])

  // 활동 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_ACTIVITY_KEY, JSON.stringify(activity))
  }, [activity])

  // 구매 내역 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_PURCHASES_KEY, JSON.stringify(purchases))
  }, [purchases])

  // Pro 사용량 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_PRO_USAGE_KEY, JSON.stringify(proUsage))
  }, [proUsage])

  // 로그인 (memberApi 연동)
  const login = useCallback(async ({ email, password }) => {
    const response = await memberApi.login({ email, password })
    const apiUser = extractApiUser(response)
    const accessToken = response.data?.accessToken ?? response.accessToken
    const refreshToken = response.data?.refreshToken ?? response.refreshToken

    const userData = normalizeUser(apiUser)
    setUser(userData)
    if (accessToken) {
      authStorage.setItem(STORAGE_ACCESS_TOKEN_KEY, accessToken)
    }
    if (refreshToken) {
      authStorage.setItem(STORAGE_REFRESH_TOKEN_KEY, refreshToken)
    }
    return userData
  }, [normalizeUser])

  // 회원가입 (memberApi.registerMember 연동, 이메일 인증 완료 후 호출)
  const signup = useCallback(async (formData) => {
    // cadence(id: 'daily' | 'weekly') → frequency('every' | 'weekly') 매핑
    const cadenceId = formData.cadence?.id ?? formData.cadence
    const frequency = cadenceId === 'weekly' ? 'weekly' : 'every'

    // 알림 채널: email | kakao | both (BE 스펙 소문자)
    const notification = formData.notificationKakao ? 'both' : 'email'

    const payload = {
      email: formData.email?.trim(),
      password: formData.password,
      job: formData.jobRole,
      nickname: formData.name,
      notification,
      frequency,
    }
    const response = await memberApi.registerMember(payload)
    // 회원가입 성공 후 자동 로그인하지 않음 → 로그인 화면으로 보내기 위해 user/토큰 저장 생략
    return { success: true, response }
  }, [])

  // 로그인/회원가입 API 응답으로 사용자 상태 설정 (Auth 페이지에서 사용)
  const setUserFromAuthResponse = useCallback((response) => {
    const apiUser = extractApiUser(response)
    const accessToken = response?.data?.accessToken ?? response?.accessToken
    const refreshToken = response?.data?.refreshToken ?? response?.refreshToken

    const userData = normalizeUser(apiUser)
    setUser(userData)
    if (accessToken) {
      authStorage.setItem(STORAGE_ACCESS_TOKEN_KEY, accessToken)
    }
    if (refreshToken) {
      authStorage.setItem(STORAGE_REFRESH_TOKEN_KEY, refreshToken)
    }
  }, [normalizeUser])

  // 로그아웃 (백엔드 API + 로컬 상태 정리)
  const logout = useCallback(async () => {
    setIsLoggingOut(true)
    const accessToken = authStorage.getItem(STORAGE_ACCESS_TOKEN_KEY)
    const refreshToken = authStorage.getItem(STORAGE_REFRESH_TOKEN_KEY)

    try {
      if (accessToken || refreshToken) {
        await memberApi.logout({ accessToken, refreshToken })
      } else {
        await memberApi.logout()
      }
    } catch (error) {
      console.error('[AppStateContext] logout api error:', error)
      // 네트워크/서버 오류가 있어도 클라이언트에서는 일단 로그아웃 진행
    } finally {
      setUser(null)
      setCurrentQuestion(null)
      setLastFeedback(null)
      authStorage.removeItem(STORAGE_KEY)
      authStorage.removeItem(STORAGE_ACCESS_TOKEN_KEY)
      authStorage.removeItem(STORAGE_REFRESH_TOKEN_KEY)
      setIsLoggingOut(false)
    }
  }, [])

  // 회원 탈퇴 (백엔드 API 성공 시에만 로컬 상태/히스토리 정리)
  const deleteAccount = useCallback(async () => {
    setIsLoggingOut(true)
    const accessToken = authStorage.getItem(STORAGE_ACCESS_TOKEN_KEY)
    const currentUserId = user?.id

    try {
      if (accessToken) {
        await memberApi.deleteMember(accessToken)
      }
      setUser(null)
      setCurrentQuestion(null)
      setLastFeedback(null)
      setScoreHistory([])
      setCompanyHistory([])
      setActivity(emptyActivityHeatmap())
      setPurchases([])
      authStorage.removeItem(STORAGE_KEY)
      authStorage.removeItem(STORAGE_ACCESS_TOKEN_KEY)
      authStorage.removeItem(STORAGE_REFRESH_TOKEN_KEY)
      localStorage.removeItem(STORAGE_HISTORY_KEY)
      localStorage.removeItem(STORAGE_COMPANY_HISTORY_KEY)
      localStorage.removeItem(STORAGE_ACTIVITY_KEY)
      localStorage.removeItem(STORAGE_PURCHASES_KEY)
      clearStoredProgress(currentUserId)
    } catch (error) {
      console.error('[AppStateContext] deleteAccount api error:', error)
      throw error
    } finally {
      setIsLoggingOut(false)
    }
  }, [user?.id])

  // 프로필 업데이트
  const updateProfile = useCallback((updates) => {
    setUser(prev => prev ? {...prev, ...updates} : null)
  }, [])

  /** API에서 질문을 불러오므로 컨텍스트에는 폴백 없음 */
  const getTodayQuestion = useCallback(() => null, [])

  // 임시 목데이터 생성은 비활성화한다.
  const generateMockFeedback = useCallback(() => {
    throw new Error('목데이터 피드백이 비활성화되었습니다. API 연동을 사용해주세요.')
  }, [])

  // AI 재피드백도 API 연동 전까지 비활성화한다.
  const generateReFeedback = useCallback(() => {
    throw new Error('재피드백 목데이터가 비활성화되었습니다. API 연동을 사용해주세요.')
  }, [])

  // 면접 결과 기록 (options.skipRewards: 재답변 등 리워드·활동 미반영)
  const recordInterviewResult = useCallback((result, options = {}) => {
    const skipRewards = options?.skipRewards === true
    const allHistory = [...scoreHistory, ...companyHistory]
    const isFirstToday = !allHistory.some(
      (entry) => new Date(entry.date).toDateString() === new Date().toDateString(),
    )

    const earnedPoints = skipRewards ? 0 : (result.earnedPoints ?? result.score ?? 0)

    if (!skipRewards && isFirstToday && earnedPoints > 0) {
      setUser(prev => prev ? {
        ...prev,
        points: (prev.points || 0) + earnedPoints,
        streak: (prev.streak || 0) + 1,
      } : null)
    }

    const newEntry = {
      date: new Date().toISOString(),
      score: result.score,
      breakdown: result.breakdown,
      summary: result.summary,
      question: result.question,
      category: result.category,
      answer: result.answer,
      historyId: result.historyId ?? `h-${Date.now()}`,
      questionId: result.questionId ?? null,
      strengths: result.strengths ?? [],
      improvements: result.improvements ?? [],
      recommendations: result.recommendations ?? [],
      earnedPoints: skipRewards ? 0 : earnedPoints,
      // 기업 면접 관련 필드
      source: result.source,
      company: result.company,
      position: result.position,
    }

    // source가 'jobpost'면 기업 면접 히스토리에, 아니면 일반 히스토리에 저장
    if (result.source === 'jobpost') {
      setCompanyHistory((prev) => {
        const next = [newEntry, ...prev]
        localStorage.setItem(STORAGE_COMPANY_HISTORY_KEY, JSON.stringify(next))
        return next
      })
    } else {
      setScoreHistory((prev) => {
        const next = [newEntry, ...prev]
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(next))
        return next
      })
    }

    if (!skipRewards) {
      setLastFeedback(result)

      // 활동 히트맵 업데이트
      const today = new Date()
      const weekIndex = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
      const dayIndex = today.getDay()

      setActivity(prev => {
        const newActivity = prev.map(week => [...week])
        if (newActivity[weekIndex]) {
          newActivity[weekIndex][dayIndex] = Math.min(4, (newActivity[weekIndex][dayIndex] || 0) + 1)
        }
        return newActivity
      })
    }

    return {earnedPoints, isFirstToday}
  }, [scoreHistory, companyHistory])

  const updateInterviewHistoryEntry = useCallback((historyId, patch, matchHints = {}) => {
    if (historyId == null && !matchHints.questionId && !matchHints.questionText) return false

    let updated = false
    const applyPatch = (entry) => {
      if (!matchesInterviewHistoryEntry(entry, historyId, matchHints)) return entry
      updated = true
      return {
        ...entry,
        ...patch,
        historyId: entry.historyId ?? historyId ?? patch.historyId,
        date: patch.date ?? entry.date,
      }
    }

    setScoreHistory((prev) => prev.map(applyPatch))
    setCompanyHistory((prev) => prev.map(applyPatch))
    return updated
  }, [])

  /** 일반·기업 면접 기록 재답변 반영 (모의 면접 updateMockInterviewSessionAfterRetake 패턴) */
  const updateTextInterviewHistoryAfterRetake = useCallback(
    ({
      sourceHistoryId,
      questionId,
      questionText,
      patch,
      target = 'score',
      sourceEntrySnapshot,
      sourceEntryDate,
    }) => {
      let updatedEntry = null
      const retakeUpdatedAt = new Date().toISOString()
      const resolvedHistoryId =
        sourceHistoryId ??
        sourceEntrySnapshot?.historyId ??
        sourceEntrySnapshot?.id ??
        null

      const findEntryIndex = (list) => {
        if (resolvedHistoryId != null) {
          const byHistoryId = list.findIndex((entry) => {
            const entryId = entry?.historyId ?? entry?.id
            return entryId != null && String(entryId) === String(resolvedHistoryId)
          })
          if (byHistoryId !== -1) return byHistoryId
        }

        if (questionId != null) {
          const sourceIds = collectRetakeQuestionIdCandidates({ questionId, id: questionId })
          const byQuestionId = list.findIndex((entry) => {
            const entryIds = collectRetakeQuestionIdCandidates(entry)
            return sourceIds.some((id) => entryIds.includes(id))
          })
          if (byQuestionId !== -1) return byQuestionId
        }

        const normalizedQuestionText = (questionText || '').trim()
        if (!normalizedQuestionText) return -1
        return list.findIndex(
          (entry) => getEntryQuestionText(entry).trim() === normalizedQuestionText
        )
      }

      const buildUpdatedEntry = (entry) => {
        const base = entry ?? sourceEntrySnapshot ?? {}
        const stableHistoryId =
          entry?.historyId ??
          entry?.id ??
          resolvedHistoryId ??
          sourceEntrySnapshot?.historyId ??
          sourceEntrySnapshot?.id ??
          getTextHistoryEntryKey(base) ??
          null
        return {
          ...base,
          ...patch,
          historyId: stableHistoryId ?? `h-retake-${Date.now()}`,
          questionId: patch.questionId ?? entry?.questionId ?? questionId ?? base.questionId ?? null,
          question: patch.question ?? questionText ?? getEntryQuestionText(base),
          answer: patch.answer ?? entry?.answer ?? base.answer,
          category: patch.category ?? entry?.category ?? base.category,
          source: patch.source ?? entry?.source ?? base.source,
          company: patch.company ?? entry?.company ?? base.company,
          position: patch.position ?? entry?.position ?? base.position,
          date: sourceEntryDate ?? entry?.date ?? base.date ?? patch.date,
          earnedPoints: entry?.earnedPoints ?? base.earnedPoints,
          retakeUpdatedAt,
          isRetake: true,
        }
      }

      const applyToList = (prev) => {
        const targetIndex = findEntryIndex(prev)
        if (targetIndex !== -1) {
          const next = [...prev]
          updatedEntry = buildUpdatedEntry(prev[targetIndex])
          next[targetIndex] = updatedEntry
          return next
        }

        updatedEntry = buildUpdatedEntry(null)
        const normalizedQuestionText = (questionText || '').trim()
        const deduped = normalizedQuestionText
          ? prev.filter(
              (entry) => getEntryQuestionText(entry).trim() !== normalizedQuestionText
            )
          : prev
        return [updatedEntry, ...deduped]
      }

      if (target === 'company') {
        setCompanyHistory((prev) => {
          const next = applyToList(prev)
          localStorage.setItem(STORAGE_COMPANY_HISTORY_KEY, JSON.stringify(next))
          return next
        })
        return updatedEntry
      }

      setScoreHistory((prev) => {
        const next = applyToList(prev)
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(next))
        return next
      })
      return updatedEntry
    },
    []
  )

  const updateMockInterviewSessionAfterRetake = useCallback(
    ({
      sourceSessionId,
      sourceQuestionId,
      questionPatch,
      overallScore,
      summary,
      questionText,
      sourceQuestionsSnapshot,
      sourceSessionDate,
    }) => {
      if (!sourceSessionId || sourceQuestionId == null || sourceQuestionId === '') return null

      let updatedSession = null
      const retakeUpdatedAt = new Date().toISOString()

      setMockInterviewHistory((prev) => {
        const cleanedPrev = filterRetakeChildSessions(prev)
        const applyQuestionPatch = (questions) =>
          patchSessionQuestions(questions, sourceQuestionId, questionText, questionPatch)

        const hasSession = cleanedPrev.some(
          (session) => String(session.sessionId) === String(sourceSessionId)
        )

        const buildUpdatedSession = (session) => {
          const questions = applyQuestionPatch(
            session?.questions?.length
              ? session.questions
              : sourceQuestionsSnapshot?.length
                ? sourceQuestionsSnapshot
                : []
          )
          const scores = questions
            .map((q) => q.score)
            .filter((score) => typeof score === 'number')
          const computedOverall =
            overallScore ??
            (scores.length
              ? Math.round(scores.reduce((acc, cur) => acc + cur, 0) / scores.length)
              : session?.overallScore)

          return {
            ...(session ?? {}),
            sessionId: String(sourceSessionId),
            status: session?.status ?? null,
            questions,
            overallScore: computedOverall,
            summary: summary || session?.summary || '',
            date: sourceSessionDate ?? session?.date ?? retakeUpdatedAt,
            retakeUpdatedAt,
            questionCount: questions.length,
            questionsPreview: questions
              .slice(0, 3)
              .map((q) => q.question)
              .filter(Boolean),
            source: 'local',
            isRetake: true,
          }
        }

        const next = hasSession
          ? cleanedPrev.map((session) => {
              if (String(session.sessionId) !== String(sourceSessionId)) return session
              const updated = buildUpdatedSession(session)
              updatedSession = updated
              return updated
            })
          : [
              buildUpdatedSession(null),
              ...cleanedPrev,
            ].slice(0, 50)

        if (!updatedSession) {
          updatedSession = next.find(
            (session) => String(session.sessionId) === String(sourceSessionId)
          )
        }

        const filteredNext = filterRetakeChildSessions(next)
        if (user?.id) {
          localStorage.setItem(getMockHistoryStorageKey(user.id), JSON.stringify(filteredNext))
        }
        return filteredNext
      })

      return updatedSession
    },
    [user?.id]
  )

  const syncMockInterviewHistories = useCallback((sessions) => {
    const filteredSessions = filterRetakeChildSessions(sessions)
    if (!Array.isArray(filteredSessions) || filteredSessions.length === 0) return

    setMockInterviewHistory((prev) => {
      const map = new Map()
      for (const item of filterRetakeChildSessions(prev)) {
        if (item?.sessionId) map.set(String(item.sessionId), item)
      }

      for (const session of filteredSessions) {
        if (!session?.sessionId) continue
        const key = String(session.sessionId)
        const existing = map.get(key)
        const hasLocalRetake = Boolean(existing?.retakeUpdatedAt || existing?.isRetake)

        if (hasLocalRetake && existing) {
          map.set(key, {
            ...session,
            ...existing,
            questions: existing.questions?.length ? existing.questions : session.questions || [],
            overallScore:
              existing.overallScore !== undefined && existing.overallScore !== null
                ? existing.overallScore
                : session.overallScore,
            summary: existing.summary || session.summary || '',
            questionsPreview: existing.questionsPreview?.length
              ? existing.questionsPreview
              : session.questionsPreview || [],
            questionCount:
              existing.questionCount ??
              existing.questions?.length ??
              session.questionCount ??
              session.questions?.length ??
              0,
            date: existing.date ?? session.date,
            retakeUpdatedAt: existing.retakeUpdatedAt,
            isRetake: existing.isRetake,
            source: existing.source || 'local',
          })
          continue
        }

        const existingIsNewer =
          existing?.date &&
          session.date &&
          new Date(existing.date).getTime() >= new Date(session.date).getTime()
        const entry = {
          sessionId: key,
          status: session.status ?? existing?.status ?? null,
          date: existingIsNewer
            ? existing.date
            : session.date || existing?.date || new Date().toISOString(),
          overallScore: existingIsNewer
            ? existing.overallScore
            : session.overallScore !== undefined
              ? session.overallScore
              : (existing?.overallScore ?? null),
          summary: existingIsNewer
            ? existing.summary || session.summary || ''
            : session.summary || existing?.summary || '',
          questionCount: existingIsNewer
            ? existing.questionCount ?? existing.questions?.length ?? 0
            : session.questionCount ??
              session.questions?.length ??
              existing?.questionCount ??
              0,
          questionsPreview: existingIsNewer
            ? existing.questionsPreview?.length
              ? existing.questionsPreview
              : session.questionsPreview || []
            : session.questionsPreview?.length
              ? session.questionsPreview
              : existing?.questionsPreview || [],
          questions: existingIsNewer
            ? existing.questions?.length
              ? existing.questions
              : session.questions || []
            : session.questions?.length
              ? session.questions
              : existing?.questions || [],
          source: existing?.source || session.source || 'api',
        }
        map.set(key, existing ? { ...session, ...existing, ...entry } : entry)
      }

      const next = filterRetakeChildSessions(
        Array.from(map.values())
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 50)
      )

      if (user?.id) {
        localStorage.setItem(getMockHistoryStorageKey(user.id), JSON.stringify(next))
      }
      return next
    })
  }, [user?.id])

  const recordMockInterviewSession = useCallback((session) => {
    if (!session?.sessionId || isRetakeChildSession(session.sessionId)) return
    setMockInterviewHistory((prev) => {
      const entry = {
        sessionId: String(session.sessionId),
        status: session.status ?? null,
        date: session.date || new Date().toISOString(),
        overallScore: session.overallScore ?? null,
        summary: session.summary || '',
        questionCount: session.questionCount ?? session.questions?.length ?? 0,
        questionsPreview: session.questionsPreview || [],
        questions: session.questions || [],
        source: 'local',
      }
      const next = filterRetakeChildSessions([
        entry,
        ...prev.filter((item) => item.sessionId !== entry.sessionId),
      ]).slice(0, 50)
      if (user?.id) {
        localStorage.setItem(getMockHistoryStorageKey(user.id), JSON.stringify(next))
      }
      return next
    })
  }, [user?.id])

  // 포인트 차감
  const deductPoints = useCallback((amount) => {
    if (!user || user.points < amount) {
      return {success: false, reason: '포인트가 부족합니다.'}
    }
    setUser(prev => prev ? {...prev, points: prev.points - amount} : null)
    return {success: true}
  }, [user])

  // 리워드 교환
  const redeemReward = useCallback((reward) => {
    const result = deductPoints(reward.points)
    if (!result.success) return result

    setPurchases(prev => [{
      id: `p-${Date.now()}`,
      reward,
      purchasedAt: new Date().toISOString(),
    }, ...prev])

    return {success: true}
  }, [deductPoints])

  // Pro 플랜 관련 함수들
  const isPro = user?.plan === 'pro'

  const getProPlan = useCallback(() => {
    return PRO_PLANS[user?.plan || 'free']
  }, [user?.plan])

  const canUseMockInterview = useCallback(() => {
    if (isPro) return { allowed: true, remaining: -1 }
    const limit = PRO_PLANS.free.mockInterviewLimit
    const used = proUsage.mockInterview
    return {
      allowed: used < limit,
      remaining: limit - used,
      limit,
    }
  }, [isPro, proUsage.mockInterview])

  const canUseJobPost = useCallback(() => {
    if (isPro) return { allowed: true, remaining: -1 }
    const limit = PRO_PLANS.free.jobPostLimit
    const used = proUsage.jobPost
    return {
      allowed: used < limit,
      remaining: limit - used,
      limit,
    }
  }, [isPro, proUsage.jobPost])

  const useMockInterview = useCallback(() => {
    if (isPro) return true
    const check = canUseMockInterview()
    if (!check.allowed) return false
    setProUsage(prev => ({ ...prev, mockInterview: prev.mockInterview + 1 }))
    return true
  }, [isPro, canUseMockInterview])

  const useJobPost = useCallback(() => {
    if (isPro) return true
    const check = canUseJobPost()
    if (!check.allowed) return false
    setProUsage(prev => ({ ...prev, jobPost: prev.jobPost + 1 }))
    return true
  }, [isPro, canUseJobPost])

  const upgradeToPro = useCallback(() => {
    // 결제 연동 전까지 클라이언트에서 Pro 적용
    setUser(prev => prev ? { ...prev, plan: 'pro' } : null)
    return { success: true }
  }, [])

  const getAccessToken = useCallback(() => {
    return authStorage.getItem(STORAGE_ACCESS_TOKEN_KEY) || null
  }, [])

  // 예전 버전에서 localStorage에 남은 인증 키는 제거 (세션 전환 후 혼선 방지)
  useEffect(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_ACCESS_TOKEN_KEY)
    localStorage.removeItem(STORAGE_REFRESH_TOKEN_KEY)
  }, [])

  const value = {
    // State
    user,
    currentQuestion,
    scoreHistory,
    companyHistory,
    sentQuestions,
    activity,
    purchases,
    lastFeedback,
    mockInterviewHistory,
    isLoggingOut,
    proUsage,

    // Constants
    jobTracks,
    cadencePresets,
    scoringRubric,
    PRO_PLANS,

    // Actions
    login,
    signup,
    setUserFromAuthResponse,
    getAccessToken,
    logout,
    deleteAccount,
    updateProfile,
    recordInterviewResult,
    updateInterviewHistoryEntry,
    updateTextInterviewHistoryAfterRetake,
    updateMockInterviewSessionAfterRetake,
    syncMockInterviewHistories,
    recordMockInterviewSession,
    deductPoints,
    redeemReward,
    setCurrentQuestion,
    setSentQuestions,
    getTodayQuestion,
    generateMockFeedback,
    generateReFeedback,

    // Pro 플랜 관련
    isPro,
    getProPlan,
    canUseMockInterview,
    canUseJobPost,
    useMockInterview,
    useJobPost,
    upgradeToPro,
  }

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState() {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error('useAppState must be used within an AppProvider')
  }
  return context
}
