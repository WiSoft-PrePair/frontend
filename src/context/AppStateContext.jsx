import {createContext, useContext, useState, useEffect, useCallback} from 'react'
import {
  jobTracks,
  cadencePresets,
  scoringRubric,
  PRO_PLANS,
} from '../data/appConstants'
import * as memberApi from '../utils/memberApi'

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

    return {
      id:
        apiUser.id ??
        apiUser.userId ??
        apiUser.memberId ??
        `user-${apiUser.email?.replace('@', '-')}`,
      nickname: apiUser.nickname ?? apiUser.name ?? '',
      name: apiUser.nickname ?? apiUser.name ?? '',
      email: apiUser.email ?? '',
      points: apiUser.points ?? apiUser.point ?? 0,
      streak: apiUser.streak ?? 0,
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
    } catch (error) {
      console.error('[AppStateContext] deleteAccount api error:', error)
      throw error
    } finally {
      setIsLoggingOut(false)
    }
  }, [])

  // 프로필 업데이트
  const updateProfile = useCallback((updates) => {
    setUser(prev => prev ? {...prev, ...updates} : null)
  }, [])

  /** API에서 질문을 불러오므로 컨텍스트에는 폴백 없음 */
  const getTodayQuestion = useCallback(() => null, [])

  // Mock AI 피드백 생성
  const generateMockFeedback = useCallback((question, answer) => {
    const score = Math.floor(Math.random() * 25) + 70 // 70-95점
    const breakdown = {
      structure: Math.floor(Math.random() * 20) + 70,
      clarity: Math.floor(Math.random() * 20) + 75,
      depth: Math.floor(Math.random() * 20) + 70,
      story: Math.floor(Math.random() * 20) + 65,
    }

    const summaries = [
      '전반적으로 좋은 답변입니다. 구체적인 예시를 더 추가하면 좋겠습니다.',
      '논리적인 구조가 잘 잡혀있습니다. 결과에 대한 수치화를 시도해보세요.',
      'STAR 기법을 잘 활용했습니다. 개인의 역할을 더 강조해보세요.',
      '명확한 답변이었습니다. 배운 점이나 성장 포인트를 추가하면 더 좋겠습니다.',
    ]

    const strengths = [
      ['논리적인 흐름', '명확한 결론'],
      ['구체적인 예시', '자신감 있는 표현'],
      ['STAR 기법 활용', '긍정적인 마무리'],
      ['문제 해결 과정 설명', '팀워크 강조'],
    ]

    const improvements = [
      ['STAR 기법 활용', '수치화된 성과 추가'],
      ['더 구체적인 상황 설명', '결과 강조'],
      ['개인 역할 명확화', '교훈 추가'],
      ['시간 순서 정리', '핵심 메시지 강화'],
    ]

    const idx = Math.floor(Math.random() * summaries.length)

    return {
      score,
      breakdown,
      summary: summaries[idx],
      strengths: strengths[idx],
      improvements: improvements[idx],
      question: question?.text || question,
      category: question?.category,
      answer,
      historyId: `h-${Date.now()}`,
      earnedPoints: Math.max(40, Math.floor(score * 0.6)),
    }
  }, [])

  // AI 재피드백 생성 (기존 답변에 대해 다시 분석)
  const generateReFeedback = useCallback((historyItem, updatedAnswer) => {
    const answer = updatedAnswer || historyItem.answer
    const score = Math.floor(Math.random() * 25) + 70
    const breakdown = {
      structure: Math.floor(Math.random() * 20) + 70,
      clarity: Math.floor(Math.random() * 20) + 75,
      depth: Math.floor(Math.random() * 20) + 70,
      story: Math.floor(Math.random() * 20) + 65,
    }

    const reSummaries = [
      '이전 답변보다 더 구체적인 예시가 추가되어 좋습니다.',
      '논리 전개가 더욱 명확해졌습니다. 수치를 더 추가해보세요.',
      '개선된 부분이 눈에 띕니다. STAR 기법을 더 활용해보세요.',
      '성장이 보이는 답변입니다! 결론 부분을 더 강화하면 좋겠습니다.',
    ]

    const strengths = [
      ['개선된 논리 구조', '더 명확한 표현'],
      ['구체적인 수치 추가', '자연스러운 흐름'],
      ['경험의 깊이 전달', '성장 포인트 강조'],
      ['효과적인 스토리텔링', '인상적인 결론'],
    ]

    const improvements = [
      ['시작 부분 더 임팩트 있게', '결과 강조'],
      ['개인 기여도 더 명확히', '배운 점 구체화'],
      ['상황 설명 더 간결하게', '핵심 메시지 부각'],
      ['감정적 연결 추가', '미래 적용 계획'],
    ]

    const idx = Math.floor(Math.random() * reSummaries.length)

    return {
      score,
      breakdown,
      summary: reSummaries[idx],
      strengths: strengths[idx],
      improvements: improvements[idx],
      question: historyItem.question,
      category: historyItem.category,
      answer,
      historyId: `h-${Date.now()}`,
      earnedPoints: Math.max(40, Math.floor(score * 0.6)),
      isReFeedback: true,
      originalHistoryId: historyItem.historyId,
    }
  }, [])

  // 면접 결과 기록
  const recordInterviewResult = useCallback((result) => {
    const allHistory = [...scoreHistory, ...companyHistory]
    const isFirstToday = !allHistory.some(
      (entry) => new Date(entry.date).toDateString() === new Date().toDateString(),
    )

    const earnedPoints = result.earnedPoints ?? Math.max(40, Math.floor(result.score * 0.6))

    if (isFirstToday && earnedPoints > 0) {
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
      historyId: result.historyId,
      // 기업 면접 관련 필드
      source: result.source,
      company: result.company,
      position: result.position,
    }

    // source가 'jobpost'면 기업 면접 히스토리에, 아니면 일반 히스토리에 저장
    if (result.source === 'jobpost') {
      setCompanyHistory(prev => [newEntry, ...prev])
    } else {
      setScoreHistory(prev => [newEntry, ...prev])
    }
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

    return {earnedPoints, isFirstToday}
  }, [scoreHistory, companyHistory])

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
