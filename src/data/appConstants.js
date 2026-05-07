/** 직무·알림 주기·채점 루브릭·요금제 등 앱 정적 설정 */

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
