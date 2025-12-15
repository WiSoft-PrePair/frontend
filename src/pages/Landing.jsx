import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion as Motion } from 'framer-motion'
import useMediaQuery from '../hooks/useMediaQuery'
import logo from '../assets/logo.png'
import '../styles/pages/Landing.css'

const features = [
  {
    icon: '🎯',
    title: '직무 맞춤 AI 질문',
    description: '개발, 기획, 마케팅 등 내 직무에 최적화된 AI가 생성하는 면접 질문을 받아보세요.',
  },
  {
    icon: '🤖',
    title: '실시간 AI 피드백',
    description: 'AI가 답변을 분석하고 구체적인 개선점과 강점을 즉시 알려드립니다.',
  },
  {
    icon: '📊',
    title: '성장 분석 리포트',
    description: '면접 역량의 변화를 시각적으로 확인하고 약점을 파악할 수 있어요.',
  },
  {
    icon: '🎁',
    title: '리워드 시스템',
    description: '꾸준한 연습으로 포인트를 모아 실제 혜택으로 교환하세요.',
  },
]

const steps = [
  {
    number: '01',
    title: '간편 회원가입',
    description: '이메일로 30초만에 가입하고 목표 직무를 설정하세요.',
    icon: '📝',
  },
  {
    number: '02',
    title: '매일 질문 수신',
    description: '설정한 시간에 AI가 생성한 맞춤 면접 질문이 도착합니다.',
    icon: '📬',
  },
  {
    number: '03',
    title: '답변 작성',
    description: 'STAR 기법을 활용해 구조화된 답변을 작성해보세요.',
    icon: '✍️',
  },
  {
    number: '04',
    title: 'AI 피드백 확인',
    description: 'AI의 상세한 분석 결과와 개선 포인트를 확인하세요.',
    icon: '🎯',
  },
]

const testimonials = [
  {
    name: '김서연',
    role: '프론트엔드 개발자',
    company: '네이버 합격',
    text: '매일 꾸준히 연습하니 실전 면접에서 자신감이 생겼어요. AI 피드백 덕분에 논리적으로 말하는 법을 배웠습니다.',
    avatar: '👩‍💻',
  },
  {
    name: '박지훈',
    role: 'PM',
    company: '카카오 합격',
    text: '포인트 시스템이 동기부여가 되어서 포기하지 않고 끝까지 할 수 있었어요. 정말 감사합니다!',
    avatar: '👨‍💼',
  },
  {
    name: '이수민',
    role: 'UX 디자이너',
    company: '토스 합격',
    text: '디자이너에 맞는 질문들이 나와서 실전 준비에 딱이었어요. 포트폴리오 설명 연습에 큰 도움이 됐습니다.',
    avatar: '👩‍🎨',
  },
]

const stats = [
  { value: '10,000+', label: '생성된 질문' },
  { value: '95%', label: '사용자 만족도' },
  { value: '3,000+', label: '합격 후기' },
]

export default function LandingPage() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [activeFeature, setActiveFeature] = useState(0)

  return (
    <div className="landing">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero__content">
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="hero__text"
          >
            <span className="hero__badge">AI 면접 코칭 플랫폼</span>
            <h1 className="hero__title">
              면접 준비,<br />
              <span className="hero__title-gradient">AI와 함께라면 완벽하게</span>
            </h1>
            <p className="hero__description">
              매일 맞춤형 면접 질문을 받고, AI의 실시간 피드백으로<br className="hide-mobile" />
              면접 실력을 체계적으로 향상시키세요.
            </p>
            <div className="hero__stats">
              {stats.map((stat, idx) => (
                <div key={idx} className="hero__stat">
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
            <div className="hero__cta">
              <Link to="/auth?mode=signup" className="btn btn--primary btn--lg">
                무료로 시작하기
              </Link>
              <Link to="/auth?mode=login" className="btn btn--secondary btn--lg">
                로그인
              </Link>
            </div>
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hero__visual"
          >
            <div className="hero__orb hero__orb--1" />
            <div className="hero__orb hero__orb--2" />
            <div className="hero__orb hero__orb--3" />

            <div className="hero__mascot">
              <img src={logo} alt="PrePair AI" />
              <div className="hero__mascot-glow" />
            </div>
          </Motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features" id="features">
        <div className="section-container">
          <div className="section-header">
            <span className="section-badge">Features</span>
            <h2>PrePair만의 특별한 기능</h2>
            <p>AI 기반 맞춤 코칭으로 면접 준비를 더 효과적으로</p>
          </div>

          <div className="features__grid">
            {features.map((feature, idx) => (
              <Motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="feature-card card card--hover"
              >
                <div className="feature-card__icon">{feature.icon}</div>
                <h3 className="feature-card__title">{feature.title}</h3>
                <p className="feature-card__description">{feature.description}</p>
              </Motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works">
        <div className="section-container">
          <div className="section-header">
            <span className="section-badge">How It Works</span>
            <h2>간단한 4단계로 시작하기</h2>
            <p>누구나 쉽게 시작할 수 있는 면접 준비</p>
          </div>

          <div className="steps">
            {steps.map((step, idx) => (
              <Motion.div
                key={idx}
                initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="step"
              >
                <div className="step__number">{step.number}</div>
                <div className="step__icon">{step.icon}</div>
                <h3 className="step__title">{step.title}</h3>
                <p className="step__description">{step.description}</p>
              </Motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials">
        <div className="section-container">
          <div className="section-header">
            <span className="section-badge">Testimonials</span>
            <h2>합격자들의 생생한 후기</h2>
            <p>PrePair와 함께 꿈을 이룬 사용자들의 이야기</p>
          </div>

          <div className="testimonials__grid">
            {testimonials.map((testimonial, idx) => (
              <Motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="testimonial card"
              >
                <div className="testimonial__header">
                  <span className="testimonial__avatar">{testimonial.avatar}</span>
                  <div>
                    <strong className="testimonial__name">{testimonial.name}</strong>
                    <span className="testimonial__role">{testimonial.role}</span>
                    <span className="testimonial__company badge badge--blue">{testimonial.company}</span>
                  </div>
                </div>
                <p className="testimonial__text">"{testimonial.text}"</p>
              </Motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="section-container">
          <Motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="cta-card"
          >
            <div className="cta-card__content">
              <h2>지금 바로 시작하세요</h2>
              <p>
                매일 10분 투자로 면접 실력을 키워보세요.<br />
                첫 질문은 무료입니다.
              </p>
              <Link to="/auth?mode=signup" className="btn btn--accent btn--xl">
                무료로 시작하기
              </Link>
            </div>
            <div className="cta-card__visual">
              <img src={logo} alt="PrePair" />
            </div>
          </Motion.div>
        </div>
      </section>
    </div>
  )
}
