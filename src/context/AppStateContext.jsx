import {createContext, useContext, useState, useEffect, useCallback} from 'react'

const AppStateContext = createContext(null)

// 직무 카테고리
const jobTracks = [
  {id: 'frontend', label: '프론트엔드 개발자', category: 'technical'},
  {id: 'backend', label: '백엔드 개발자', category: 'technical'},
  {id: 'fullstack', label: '풀스택 개발자', category: 'technical'},
  {id: 'data', label: '데이터 분석가', category: 'technical'},
  {id: 'pm', label: 'PM/기획자', category: 'leadership'},
  {id: 'designer', label: 'UX/UI 디자이너', category: 'creative'},
  {id: 'marketer', label: '마케터', category: 'creative'},
  {id: 'hr', label: 'HR/인사', category: 'leadership'},
  {id: 'sales', label: '영업/세일즈', category: 'people'},
  {id: 'cs', label: '고객상담', category: 'people'},
]

// 질문 주기 옵션
const cadencePresets = [
  {id: 'daily', label: '매일 (평일 오전 9시)'},
  {id: 'weekly', label: '주 1회 (월요일 오전 9시)'},
]

// 스코어링 기준
const scoringRubric = [
  {id: 'structure', label: '구조화', weight: 0.25},
  {id: 'clarity', label: '명료성', weight: 0.25},
  {id: 'depth', label: '깊이', weight: 0.30},
  {id: 'story', label: '스토리텔링', weight: 0.20},
]

// Mock 면접 질문 데이터
const mockQuestions = [
  {id: 'q1', text: '지금까지 경험한 가장 어려웠던 프로젝트에 대해 설명하고, 어떻게 극복했는지 알려주세요.', category: '경험'},
  {id: 'q2', text: '팀 프로젝트에서 갈등이 발생했을 때 어떻게 해결했는지 경험을 공유해주세요.', category: '협업'},
  {id: 'q3', text: '본인의 가장 큰 강점과 약점은 무엇이라고 생각하시나요?', category: '자기분석'},
  {id: 'q4', text: '5년 후 자신의 모습을 어떻게 그리고 계신가요?', category: '비전'},
  {id: 'q5', text: '우리 회사에 지원한 이유와 입사 후 기여할 수 있는 점을 말씀해주세요.', category: '지원동기'},
  {id: 'q6', text: '실패했던 경험과 그로부터 배운 점을 알려주세요.', category: '경험'},
  {id: 'q7', text: '새로운 기술이나 트렌드를 어떻게 학습하시나요?', category: '성장'},
  {id: 'q8', text: '업무 우선순위를 어떻게 정하고 관리하시나요?', category: '업무방식'},
]

// Mock 연습 기록 데이터
const mockScoreHistory = [
  {
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    score: 85,
    breakdown: {structure: 82, clarity: 88, depth: 85, story: 80},
    question: '팀 프로젝트에서 갈등이 발생했을 때 어떻게 해결했는지 경험을 공유해주세요.',
    category: '협업',
    answer: '저는 프로젝트 일정 문제로 팀원과 의견 충돌이 있었습니다...',
    summary: '구체적인 상황 설명이 좋았습니다. STAR 기법을 더 활용해보세요.',
    historyId: 'h-1',
  },
  {
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    score: 78,
    breakdown: {structure: 75, clarity: 80, depth: 78, story: 76},
    question: '본인의 가장 큰 강점과 약점은 무엇이라고 생각하시나요?',
    category: '자기분석',
    answer: '저의 강점은 문제 해결 능력이고...',
    summary: '강점 설명이 좋았으나, 약점에 대한 개선 노력을 더 구체화하면 좋겠습니다.',
    historyId: 'h-2',
  },
  {
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    score: 92,
    breakdown: {structure: 90, clarity: 95, depth: 90, story: 88},
    question: '지금까지 경험한 가장 어려웠던 프로젝트에 대해 설명하고, 어떻게 극복했는지 알려주세요.',
    category: '경험',
    answer: '대학교 졸업 프로젝트에서 실시간 채팅 시스템을 구현했는데...',
    summary: '매우 훌륭한 답변입니다! 구체적인 수치와 결과가 인상적입니다.',
    historyId: 'h-3',
  },
  {
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    score: 88,
    breakdown: {structure: 85, clarity: 90, depth: 88, story: 86},
    question: '우리 회사에 지원한 이유와 입사 후 기여할 수 있는 점을 말씀해주세요.',
    category: '지원동기',
    answer: '귀사의 혁신적인 서비스와 성장 가능성에 매력을 느꼈습니다...',
    summary: '지원 동기가 명확하고 기여점도 잘 연결되었습니다.',
    historyId: 'h-4',
  },
  {
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    score: 72,
    breakdown: {structure: 70, clarity: 75, depth: 70, story: 72},
    question: '5년 후 자신의 모습을 어떻게 그리고 계신가요?',
    category: '비전',
    answer: '5년 후에는 시니어 개발자로 성장하여...',
    summary: '비전은 명확하나 구체적인 실행 계획이 필요합니다.',
    historyId: 'h-5',
  },
  {
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    score: 81,
    breakdown: {structure: 80, clarity: 82, depth: 80, story: 78},
    question: '실패했던 경험과 그로부터 배운 점을 알려주세요.',
    category: '경험',
    answer: '첫 인턴십에서 데드라인을 맞추지 못한 경험이 있습니다...',
    summary: '실패 경험을 솔직하게 공유했고, 배운 점도 잘 정리했습니다.',
    historyId: 'h-6',
  },
  {
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    score: 95,
    breakdown: {structure: 95, clarity: 96, depth: 94, story: 92},
    question: '새로운 기술이나 트렌드를 어떻게 학습하시나요?',
    category: '성장',
    answer: '저는 공식 문서와 기술 블로그를 통해 새로운 기술을 학습합니다...',
    summary: '체계적인 학습 방법과 실제 적용 사례가 인상적입니다!',
    historyId: 'h-7',
  },
  {
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    score: 76,
    breakdown: {structure: 74, clarity: 78, depth: 75, story: 74},
    question: '업무 우선순위를 어떻게 정하고 관리하시나요?',
    category: '업무방식',
    answer: '긴급도와 중요도를 기준으로 우선순위를 정합니다...',
    summary: '기본적인 방법론은 알고 있으나 구체적인 예시가 부족합니다.',
    historyId: 'h-8',
  },
  {
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(),
    score: 89,
    breakdown: {structure: 88, clarity: 90, depth: 88, story: 87},
    question: '리더십을 발휘했던 경험에 대해 말씀해주세요.',
    category: '협업',
    answer: '동아리 프로젝트에서 팀장을 맡아 6명의 팀원을 이끌었습니다...',
    summary: '리더로서의 역할과 성과가 잘 드러났습니다.',
    historyId: 'h-9',
  },
  {
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 21).toISOString(),
    score: 83,
    breakdown: {structure: 82, clarity: 85, depth: 82, story: 80},
    question: '스트레스 상황에서 어떻게 대처하시나요?',
    category: '자기분석',
    answer: '마감이 촉박할 때는 먼저 작업을 작은 단위로 나누어...',
    summary: '구체적인 대처 방법이 좋습니다. 실제 사례를 더 추가해보세요.',
    historyId: 'h-10',
  },
]

// Mock 활동 히트맵 (약간의 랜덤 데이터)
const generateMockActivity = () => {
  const activity = Array.from({length: 53}, () => Array(7).fill(0))
  // 최근 몇 주에 랜덤 활동 추가
  for (let w = 45; w < 53; w++) {
    for (let d = 0; d < 7; d++) {
      if (Math.random() > 0.5) {
        activity[w][d] = Math.floor(Math.random() * 4) + 1
      }
    }
  }
  return activity
}

// Mock 구매 내역
const mockPurchases = [
  {
    id: 'p-1',
    reward: {id: 'coffee-1', name: '스타벅스 아메리카노', points: 500, icon: '☕'},
    purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
]

// Pro 플랜 설정
const PRO_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    mockInterviewLimit: 3, // 월 3회 무료 체험
    jobPostLimit: 3, // 월 3회 무료 체험
    features: ['일일 면접 질문', 'AI 피드백', '기본 분석 리포트'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 9900,
    mockInterviewLimit: -1, // 무제한
    jobPostLimit: -1, // 무제한
    features: [
      '일일 면접 질문',
      'AI 피드백',
      '상세 분석 리포트',
      '모의 면접 무제한',
      '채용 공고 분석 무제한',
      '우선 고객 지원',
    ],
  },
}

// 로컬 스토리지 키
const STORAGE_KEY = 'prepair_user'
const STORAGE_HISTORY_KEY = 'prepair_history'
const STORAGE_COMPANY_HISTORY_KEY = 'prepair_company_history'
const STORAGE_ACTIVITY_KEY = 'prepair_activity'
const STORAGE_PURCHASES_KEY = 'prepair_purchases'
const STORAGE_PRO_USAGE_KEY = 'prepair_pro_usage'

// Mock 사용자 DB (간단한 테스트용)
const mockUserDB = {
  'test': {password: 'test', name: '테스트유저', points: 1500, streak: 7, jobRole: '프론트엔드 개발자'},
  'admin': {password: 'admin', name: '관리자', points: 5000, streak: 30, jobRole: 'PM/기획자'},
  'demo': {password: 'demo', name: '데모사용자', points: 800, streak: 3, jobRole: '백엔드 개발자'},
}

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
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [sentQuestions, setSentQuestions] = useState([])

  const [activity, setActivity] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ACTIVITY_KEY)
      return saved ? JSON.parse(saved) : generateMockActivity()
    } catch {
      return generateMockActivity()
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
    setActivity(generateMockActivity())
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
