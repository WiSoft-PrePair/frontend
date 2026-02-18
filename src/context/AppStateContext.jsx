import {createContext, useContext, useState, useEffect, useCallback} from 'react'
import {
  jobTracks,
  cadencePresets,
  scoringRubric,
  mockQuestions,
  mockScoreHistory,
  mockCompanyHistory,
  getMockActivity,
  mockPurchases,
  PRO_PLANS,
  mockUserDB,
} from '../data/mockDataForDemo'

const AppStateContext = createContext(null)

// 로컬 스토리지 키
const STORAGE_KEY = 'prepair_user'
const STORAGE_HISTORY_KEY = 'prepair_history'
const STORAGE_COMPANY_HISTORY_KEY = 'prepair_company_history'
const STORAGE_ACTIVITY_KEY = 'prepair_activity'
const STORAGE_PURCHASES_KEY = 'prepair_purchases'
const STORAGE_PRO_USAGE_KEY = 'prepair_pro_usage'

export function AppProvider({children}) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
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
      return saved ? JSON.parse(saved) : mockScoreHistory
    } catch {
      return mockScoreHistory
    }
  })

  const [companyHistory, setCompanyHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_COMPANY_HISTORY_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // 빈 배열이면 목데이터 사용, 아니면 저장된 데이터 사용
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : mockCompanyHistory
      }
      return mockCompanyHistory
    } catch {
      return mockCompanyHistory
    }
  })

  const [sentQuestions, setSentQuestions] = useState([])

  const [activity, setActivity] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ACTIVITY_KEY)
      return saved ? JSON.parse(saved) : getMockActivity()
    } catch {
      return getMockActivity()
    }
  })

  const [purchases, setPurchases] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PURCHASES_KEY)
      return saved ? JSON.parse(saved) : mockPurchases
    } catch {
      return mockPurchases
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

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

  // Mock 로그인 (이메일 형식 검증 없음)
  const login = useCallback(async ({email, password}) => {
    // 약간의 딜레이로 실제 API 호출처럼 보이게
    await new Promise(resolve => setTimeout(resolve, 300))

    // Mock DB에서 사용자 찾기 (이메일 앞부분을 ID로 사용)
    const userId = email.split('@')[0] || email
    const mockUser = mockUserDB[userId]

    if (mockUser && mockUser.password === password) {
      const userData = {
        id: `user-${userId}`,
        name: mockUser.name,
        email: email,
        points: mockUser.points,
        streak: mockUser.streak,
        jobRole: mockUser.jobRole,
        cadence: 'daily',
        notificationKakao: false,
      }
      setUser(userData)
      return userData
    }

    // Mock DB에 없으면 아무 입력이나 통과 (테스트 편의)
    const userData = {
      id: `user-${Date.now()}`,
      name: userId || '사용자',
      email: email || 'user@test.com',
      points: 1000,
      streak: 5,
      jobRole: '프론트엔드 개발자',
      cadence: 'daily',
      notificationKakao: false,
    }
    setUser(userData)
    return userData
  }, [])

  // Mock 회원가입 (이메일 형식 검증 없음)
  const signup = useCallback(async (formData) => {
    // 약간의 딜레이
    await new Promise(resolve => setTimeout(resolve, 500))

    const userData = {
      id: `user-${Date.now()}`,
      name: formData.name || '새사용자',
      email: formData.email || 'new@test.com',
      points: 500, // 신규 가입 보너스
      streak: 0,
      jobRole: formData.jobRole || formData.jobCategoryOther || '미정',
      cadence: formData.cadence?.id || 'daily',
      notificationKakao: formData.notificationKakao || false,
    }

    setUser(userData)
    return {userId: userData.id}
  }, [])

  // 로그아웃
  const logout = useCallback(() => {
    setIsLoggingOut(true)
    setUser(null)
    setCurrentQuestion(null)
    setLastFeedback(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // 회원 탈퇴
  const deleteAccount = useCallback(() => {
    setIsLoggingOut(true)
    setUser(null)
    setCurrentQuestion(null)
    setLastFeedback(null)
    setScoreHistory([])
    setActivity(getMockActivity())
    setPurchases([])
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_HISTORY_KEY)
    localStorage.removeItem(STORAGE_ACTIVITY_KEY)
    localStorage.removeItem(STORAGE_PURCHASES_KEY)
  }, [])

  // 프로필 업데이트
  const updateProfile = useCallback((updates) => {
    setUser(prev => prev ? {...prev, ...updates} : null)
  }, [])

  // Mock 오늘의 질문 가져오기
  const getTodayQuestion = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * mockQuestions.length)
    return mockQuestions[randomIndex]
  }, [])

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
    // Mock 업그레이드 (실제로는 결제 처리)
    setUser(prev => prev ? { ...prev, plan: 'pro' } : null)
    return { success: true }
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
    mockQuestions,
    PRO_PLANS,

    // Actions
    login,
    signup,
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
