/**
 * 서비스 소개/데모용 목데이터 - 한 파일에 통합
 * API 연동 시 이 파일을 삭제하고, AppStateContext·RewardShop 등에서
 * API 호출로 교체하면 됩니다.
 */

// ========== 직무·설정 (공통) ==========
export const jobTracks = [
  { id: 'frontend', label: '프론트엔드 개발자', category: 'technical' },
  { id: 'backend', label: '백엔드 개발자', category: 'technical' },
  { id: 'fullstack', label: '풀스택 개발자', category: 'technical' },
  { id: 'data', label: '데이터 분석가', category: 'technical' },
  { id: 'pm', label: 'PM/기획자', category: 'leadership' },
  { id: 'designer', label: 'UX/UI 디자이너', category: 'creative' },
  { id: 'marketer', label: '마케터', category: 'creative' },
  { id: 'hr', label: 'HR/인사', category: 'leadership' },
  { id: 'sales', label: '영업/세일즈', category: 'people' },
  { id: 'cs', label: '고객상담', category: 'people' },
]

export const cadencePresets = [
  { id: 'daily', label: '매일 (평일 오전 9시)' },
  { id: 'weekly', label: '주 1회 (월요일 오전 9시)' },
]

export const scoringRubric = [
  { id: 'structure', label: '구조화', weight: 0.25 },
  { id: 'clarity', label: '명료성', weight: 0.25 },
  { id: 'depth', label: '깊이', weight: 0.3 },
  { id: 'story', label: '스토리텔링', weight: 0.2 },
]

// ========== Pro 플랜 ==========
export const PRO_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    mockInterviewLimit: 3,
    jobPostLimit: 3,
    features: ['일일 면접 질문', 'AI 피드백', '기본 분석 리포트'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 9900,
    mockInterviewLimit: -1,
    jobPostLimit: -1,
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

// ========== 데모용 로그인 계정 (test/test, admin/admin, demo/demo) ==========
export const mockUserDB = {
  test: {
    password: 'test',
    name: '이은채',
    points: 3200,
    streak: 12,
    jobRole: '프론트엔드 개발자',
  },
  admin: {
    password: 'admin',
    name: '관리자',
    points: 8500,
    streak: 30,
    jobRole: 'PM/기획자',
  },
  demo: {
    password: 'demo',
    name: '데모사용자',
    points: 2100,
    streak: 7,
    jobRole: '백엔드 개발자',
  },
}

// ========== 오늘의 질문 풀 (면접 연습용) ==========
export const mockQuestions = [
  { id: 'q1', text: '지금까지 경험한 가장 어려웠던 프로젝트에 대해 설명하고, 어떻게 극복했는지 알려주세요.', category: '경험' },
  { id: 'q2', text: '팀 프로젝트에서 갈등이 발생했을 때 어떻게 해결했는지 경험을 공유해주세요.', category: '협업' },
  { id: 'q3', text: '본인의 가장 큰 강점과 약점은 무엇이라고 생각하시나요?', category: '자기분석' },
  { id: 'q4', text: '5년 후 자신의 모습을 어떻게 그리고 계신가요?', category: '비전' },
  { id: 'q5', text: '우리 회사에 지원한 이유와 입사 후 기여할 수 있는 점을 말씀해주세요.', category: '지원동기' },
  { id: 'q6', text: '실패했던 경험과 그로부터 배운 점을 알려주세요.', category: '경험' },
  { id: 'q7', text: '새로운 기술이나 트렌드를 어떻게 학습하시나요?', category: '성장' },
  { id: 'q8', text: '업무 우선순위를 어떻게 정하고 관리하시나요?', category: '업무방식' },
]

// ========== 연습 기록 (히스토리·대시보드용, 서비스 소개에 잘 보이도록 구성) ==========
const now = Date.now()
const day = 1000 * 60 * 60 * 24

export const mockScoreHistory = [
  { date: new Date(now - day).toISOString(), score: 92, breakdown: { structure: 90, clarity: 94, depth: 91, story: 90 }, question: '팀 프로젝트에서 갈등이 발생했을 때 어떻게 해결했는지 경험을 공유해주세요.', category: '협업', answer: '저는 프로젝트 일정 문제로 팀원과 의견 충돌이 있었습니다. 우선 서로의 일정과 우선순위를 공유하는 미팅을 잡았고, 중요도와 마감일 기준으로 태스크를 재조정했습니다. 그 결과 한 달 안에 목표를 달성했고, 팀원과의 신뢰도 더 쌓였습니다.', summary: '구체적인 상황과 해결 과정이 잘 드러났습니다. STAR 기법을 더 활용하면 좋겠습니다.', historyId: 'h-1' },
  { date: new Date(now - day * 2).toISOString(), score: 78, breakdown: { structure: 76, clarity: 80, depth: 78, story: 76 }, question: '본인의 가장 큰 강점과 약점은 무엇이라고 생각하시나요?', category: '자기분석', answer: '저의 강점은 문제 해결 능력과 꼼꼼함입니다. 약점은 완벽을 추구하다 일정을 놓치는 경우가 있다는 점입니다. 그래서 마감 2일 전에는 반드시 1차 결과물을 내도록 습관화하고 있습니다.', summary: '강점 설명이 좋았습니다. 약점에 대한 개선 노력을 더 구체적으로 말하면 좋겠습니다.', historyId: 'h-2' },
  { date: new Date(now - day * 3).toISOString(), score: 88, breakdown: { structure: 86, clarity: 90, depth: 88, story: 86 }, question: '지금까지 경험한 가장 어려웠던 프로젝트에 대해 설명하고, 어떻게 극복했는지 알려주세요.', category: '경험', answer: '대학교 졸업 프로젝트에서 실시간 채팅 시스템을 구현했는데, 동시 접속 100명 이상에서 지연이 발생했습니다. 프로파일링 후 DB 쿼리와 캐시 전략을 바꿨고, 최종적으로 500명까지 안정적으로 확장했습니다.', summary: '매우 훌륭한 답변입니다. 구체적인 수치와 결과가 인상적입니다.', historyId: 'h-3' },
  { date: new Date(now - day * 5).toISOString(), score: 85, breakdown: { structure: 84, clarity: 86, depth: 85, story: 84 }, question: '우리 회사에 지원한 이유와 입사 후 기여할 수 있는 점을 말씀해주세요.', category: '지원동기', answer: '귀사의 혁신적인 서비스와 성장 가능성에 매력을 느꼈습니다. 입사 후에는 사용자 경험 개선과 성능 최적화 경험을 살려 제품 품질 향상에 기여하고 싶습니다.', summary: '지원 동기가 명확하고 기여점도 잘 연결되었습니다.', historyId: 'h-4' },
  { date: new Date(now - day * 7).toISOString(), score: 72, breakdown: { structure: 70, clarity: 74, depth: 72, story: 70 }, question: '5년 후 자신의 모습을 어떻게 그리고 계신가요?', category: '비전', answer: '5년 후에는 시니어 개발자로 성장해 팀의 기술 방향을 이끌고, 주니어 분들의 멘토가 되고 싶습니다.', summary: '비전은 명확합니다. 구체적인 실행 계획을 한두 가지 추가하면 좋겠습니다.', historyId: 'h-5' },
  { date: new Date(now - day * 10).toISOString(), score: 81, breakdown: { structure: 80, clarity: 82, depth: 80, story: 80 }, question: '실패했던 경험과 그로부터 배운 점을 알려주세요.', category: '경험', answer: '첫 인턴십에서 데드라인을 맞추지 못한 경험이 있습니다. 그 후에는 작업을 작은 단위로 나누고 중간 체크포인트를 두어 관리하는 방식을 배웠습니다.', summary: '실패 경험을 솔직하게 공유했고, 배운 점도 잘 정리했습니다.', historyId: 'h-6' },
  { date: new Date(now - day * 12).toISOString(), score: 95, breakdown: { structure: 94, clarity: 96, depth: 95, story: 92 }, question: '새로운 기술이나 트렌드를 어떻게 학습하시나요?', category: '성장', answer: '저는 공식 문서와 기술 블로그를 먼저 읽고, 작은 사이드 프로젝트에 적용해 보며 익힙니다. 최근에는 React Server Components와 Next.js 14를 이렇게 학습했습니다.', summary: '체계적인 학습 방법과 실제 적용 사례가 인상적입니다.', historyId: 'h-7' },
  { date: new Date(now - day * 14).toISOString(), score: 76, breakdown: { structure: 74, clarity: 78, depth: 75, story: 74 }, question: '업무 우선순위를 어떻게 정하고 관리하시나요?', category: '업무방식', answer: '긴급도와 중요도를 기준으로 우선순위를 정하고, Notion과 캘린더로 일정을 관리합니다.', summary: '기본적인 방법론은 잘 알고 있습니다. 구체적인 예시를 하나만 더 들어보면 좋겠습니다.', historyId: 'h-8' },
  { date: new Date(now - day * 18).toISOString(), score: 89, breakdown: { structure: 88, clarity: 90, depth: 88, story: 87 }, question: '리더십을 발휘했던 경험에 대해 말씀해주세요.', category: '협업', answer: '동아리 프로젝트에서 팀장을 맡아 6명의 팀원을 이끌었습니다. 주간 회의와 역할 분담을 명확히 해서 3개월 만에 서비스를 출시했고, 사용자 1,000명을 달성했습니다.', summary: '리더로서의 역할과 성과가 잘 드러났습니다.', historyId: 'h-9' },
  { date: new Date(now - day * 21).toISOString(), score: 83, breakdown: { structure: 82, clarity: 85, depth: 82, story: 80 }, question: '스트레스 상황에서 어떻게 대처하시나요?', category: '자기분석', answer: '마감이 촉박할 때는 작업을 작은 단위로 나누고, 25분 집중 후 5분 휴식하는 포모도로 기법을 사용합니다.', summary: '구체적인 대처 방법이 좋습니다. 실제 사례를 한 가지 더 추가해보세요.', historyId: 'h-10' },
]

// ========== 활동 히트맵 (데모용 고정 데이터, 최근 몇 주 활발하게) ==========
function buildDemoActivity() {
  const activity = Array.from({ length: 53 }, () => Array(7).fill(0))
  // 주 인덱스 45~52: 최근 8주, 데모용으로 패턴 채우기
  const pattern = [
    [1, 2, 0, 1, 2, 1, 0],
    [0, 1, 2, 1, 0, 2, 1],
    [2, 1, 1, 2, 1, 0, 1],
    [1, 0, 2, 1, 2, 1, 2],
    [2, 2, 1, 1, 0, 1, 1],
    [1, 1, 2, 0, 2, 1, 2],
    [0, 2, 1, 2, 1, 2, 0],
    [2, 1, 1, 1, 2, 0, 1],
  ]
  for (let w = 0; w < pattern.length && 45 + w < 53; w++) {
    for (let d = 0; d < 7; d++) {
      activity[45 + w][d] = pattern[w][d]
    }
  }
  return activity
}

export const mockActivity = buildDemoActivity()

/** 데모용 활동 데이터 생성 (기본값으로 mockActivity 반환) */
export function getMockActivity() {
  return mockActivity.map((week) => [...week])
}

// ========== 리워드 샵 목록 (RewardShop + API 형식 호환) ==========
export const rewards = [
  { id: 'coffee-1', name: '스타벅스 아메리카노', description: '면접 준비하면서 마실 커피 한 잔', points: 500, icon: '☕', category: 'cafe' },
  { id: 'coffee-2', name: '투썸 아이스크림 음료', description: '달콤한 아이스크림 음료로 기분 전환', points: 600, icon: '🍨', category: 'cafe' },
  { id: 'cu-1', name: 'CU 편의점 2,000원권', description: '든든한 간식으로 에너지 충전', points: 400, icon: '🏪', category: 'convenience' },
  { id: 'gs-1', name: 'GS25 3,000원권', description: '간단한 식사나 간식 구매', points: 600, icon: '🛒', category: 'convenience' },
  { id: 'book-1', name: '교보문고 5,000원권', description: '면접 준비 도서 구매', points: 1000, icon: '📚', category: 'study' },
  { id: 'movie-1', name: 'CGV 영화 관람권', description: '면접 준비 스트레스 해소', points: 2000, icon: '🎬', category: 'entertainment' },
]

export const rewardCategories = [
  { id: 'all', label: '전체' },
  { id: 'cafe', label: '카페' },
  { id: 'convenience', label: '편의점' },
  { id: 'study', label: '자기계발' },
  { id: 'entertainment', label: '엔터테인먼트' },
]

// ========== 기업 면접 기록 (채용 공고 분석 후 연습한 기록, source: 'jobpost') ==========
export const mockCompanyHistory = [
  {
    id: 'ch-1',
    historyId: 'ch-1',
    source: 'jobpost',
    company: '토스',
    position: '프론트엔드 개발자',
    date: new Date(now - day * 2).toISOString(),
    score: 88,
    breakdown: { structure: 86, clarity: 90, depth: 87, story: 86 },
    question: '토스의 핵심 가치인 "번개처럼"을 본인의 경험에 빗대어 설명해주세요.',
    category: '지원동기',
    answer: '저는 대학 프로젝트에서 기존 2주 걸리던 배포 프로세스를 CI/CD 도입으로 30분 이내로 줄인 경험이 있습니다. 사용자에게 더 빠른 기능 전달이라는 점에서 "번개처럼"의 가치와 맞닿아 있다고 생각합니다.',
    summary: '회사 가치와 개인 경험이 잘 연결되었습니다. 구체적인 수치가 인상적입니다.',
  },
  {
    id: 'ch-2',
    historyId: 'ch-2',
    source: 'jobpost',
    company: '당근마켓',
    position: '백엔드 개발자',
    date: new Date(now - day * 5).toISOString(),
    score: 82,
    breakdown: { structure: 80, clarity: 84, depth: 82, story: 80 },
    question: '대규모 트래픽 환경에서의 개발 경험이 있다면 말씀해주세요.',
    category: '경험',
    answer: '동아리 서비스에서 동시 접속이 늘어나면서 DB 부하가 생겼습니다. 읽기 복제와 캐시 레이어를 도입하고, 비동기 처리로 개선해 응답 시간을 절반으로 줄였습니다.',
    summary: '문제 인식과 해결 과정이 명확합니다. 트래픽 수치를 추가하면 더 좋겠습니다.',
  },
  {
    id: 'ch-3',
    historyId: 'ch-3',
    source: 'jobpost',
    company: '카카오',
    position: '풀스택 개발자',
    date: new Date(now - day * 9).toISOString(),
    score: 90,
    breakdown: { structure: 89, clarity: 91, depth: 90, story: 88 },
    question: '사용자 경험을 개선한 경험을 구체적으로 설명해주세요.',
    category: '경험',
    answer: '이전 회사에서 결제 플로우 이탈률이 높았습니다. 퍼널 분석 후 단계를 줄이고 로딩 피드백을 추가해 이탈률을 15%에서 8%로 낮췄습니다.',
    summary: '데이터 기반 개선과 결과가 잘 드러났습니다. 훌륭한 답변입니다.',
  },
  {
    id: 'ch-4',
    historyId: 'ch-4',
    source: 'jobpost',
    company: '네이버',
    position: '프론트엔드 개발자',
    date: new Date(now - day * 14).toISOString(),
    score: 79,
    breakdown: { structure: 77, clarity: 81, depth: 78, story: 77 },
    question: '웹 접근성(a11y)을 고려해 개발한 경험이 있나요?',
    category: '기술',
    answer: '프로젝트에서 시맨틱 HTML과 ARIA를 적용하고, 키보드 네비게이션과 스크린 리더 테스트를 진행했습니다. WCAG 2.1 AA 수준을 목표로 개선 중입니다.',
    summary: '접근성에 대한 이해가 있습니다. 실제 개선 전후 수치가 있으면 더 좋겠습니다.',
  },
  {
    id: 'ch-5',
    historyId: 'ch-5',
    source: 'jobpost',
    company: '라인',
    position: '백엔드 개발자',
    date: new Date(now - day * 18).toISOString(),
    score: 85,
    breakdown: { structure: 84, clarity: 86, depth: 85, story: 83 },
    question: '마이크로서비스 환경에서의 협업 경험을 말씀해주세요.',
    category: '협업',
    answer: '3개 팀이 참여하는 결제 도메인에서 이벤트 드리븐 방식으로 연동했습니다. API 계약을 먼저 정의하고 테스트해 배포 시 충돌을 줄였습니다.',
    summary: '도메인 간 협업과 기술 선택 이유가 잘 설명되었습니다.',
  },
]

// ========== 구매 내역 (데모용 여러 건) ==========
export const mockPurchases = [
  { id: 'p-1', reward: { id: 'coffee-1', name: '스타벅스 아메리카노', points: 500, icon: '☕' }, purchasedAt: new Date(now - day * 3).toISOString() },
  { id: 'p-2', reward: { id: 'cu-1', name: 'CU 편의점 2,000원권', points: 400, icon: '🏪' }, purchasedAt: new Date(now - day * 14).toISOString() },
  { id: 'p-3', reward: { id: 'coffee-2', name: '투썸 아이스크림 음료', points: 600, icon: '🍨' }, purchasedAt: new Date(now - day * 21).toISOString() },
]
