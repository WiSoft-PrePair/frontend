import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { useAppState } from '../context/AppStateContext'
import useMediaQuery from '../hooks/useMediaQuery'
import Dropdown from '../components/Dropdown'
import logo from '../assets/logo.png'
import '../styles/pages/Auth.css'

const steps = [
  { id: 'account', label: '기본 정보' },
  { id: 'job', label: '목표 직무' },
  { id: 'cadence', label: '질문 설정' },
]

export default function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const { user, login, signup, jobTracks, cadencePresets } = useAppState()
  const isMobile = useMediaQuery('(max-width: 768px)')

  useEffect(() => {
    if (user) {
      const redirectFrom = location.state?.from
      navigate(redirectFrom || '/mypage', { replace: true })
    }
  }, [user, navigate, location.state])

  const redirectFrom = location.state?.from
  const defaultCadence = cadencePresets?.[0] || null

  const [mode, setMode] = useState('signup')
  const [activeStep, setActiveStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isLightOn, setIsLightOn] = useState(() => window.matchMedia('(max-width: 768px)').matches) // 모바일은 처음부터 켜짐
  const [isPulling, setIsPulling] = useState(false) // 줄 당기는 중
  const [isReleased, setIsReleased] = useState(false) // 끈 놓은 후 찰랑거림
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotEmailSent, setForgotEmailSent] = useState(false)

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    jobRole: '',
    cadence: defaultCadence,
    notificationKakao: false,
  })

  useEffect(() => {
    const paramMode = searchParams.get('mode')
    if (paramMode && (paramMode === 'login' || paramMode === 'signup')) {
      setMode(paramMode)
    } else {
      setMode('signup')
    }
  }, [searchParams])

  // Validation
  const loginValid = loginForm.email && loginForm.password
  const passwordValid = signupForm.password.length >= 6
  const passwordSpecialValid = /[^A-Za-z0-9]/.test(signupForm.password)
  const passwordMatch = signupForm.password === signupForm.passwordConfirm
  const step1Valid = signupForm.name && signupForm.email && passwordValid && passwordSpecialValid && passwordMatch
  const step2Valid = signupForm.jobRole.trim().length > 0
  const step3Valid = signupForm.cadence !== null

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!loginValid) return

    setIsLoading(true)
    setError('')

    try {
      await login({ email: loginForm.email, password: loginForm.password })
      navigate(redirectFrom || '/mypage', { replace: true })
    } catch (err) {
      setError(err.message || '로그인에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    if (!step3Valid) return

    setIsLoading(true)
    setError('')

    try {
      await signup(signupForm)
      navigate('/mypage', { replace: true })
    } catch (err) {
      setError(err.message || '회원가입에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const goNext = () => {
    if (activeStep === 0 && !step1Valid) return
    if (activeStep === 1 && !step2Valid) return
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1))
  }

  const goPrev = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0))
  }


  const handlePullStart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (isPulling) return
    setIsPulling(true)
    setIsReleased(false)
  }

  const handlePullEnd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isPulling) return
    setIsPulling(false)
    setIsReleased(true)
    setIsLightOn((prev) => !prev)
    // 찰랑거림이 끝난 후 상태 초기화
    setTimeout(() => {
      setIsReleased(false)
    }, 800)
  }

  return (
    <div className={`auth ${!isLightOn ? 'auth--dark' : ''}`}>
      {/* 어두운 오버레이 */}
      <AnimatePresence>
        {!isLightOn && (
          <Motion.div
            className="auth__dark-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="auth__loading"
          >
            <img src={logo} alt="PrePair" className="auth__loading-logo" />
            <div className="spinner spinner--lg" />
            <p>잠시만 기다려주세요...</p>
          </Motion.div>
        )}
      </AnimatePresence>

      <div className="auth__container">
        {/* Mascot Section with Mood Lamp */}
        <div className={`auth__mascot-section auth__mascot-section--${mode}`}>
          {/* 스탠드 조명 */}
          <div className={`auth__lamp ${isLightOn ? 'auth__lamp--on' : ''}`}>
            {/* 갓 */}
            <div className="auth__lamp-shade">
              <div className="auth__lamp-shade-inner" />
            </div>
            {/* 기둥 */}
            <div className="auth__lamp-pole" />
            {/* 받침대 */}
            <div className="auth__lamp-base" />
            {/* 빛 효과 */}
            {isLightOn && <div className="auth__lamp-light" />}
            {/* 당기는 줄 */}
            <Motion.div
              className={`auth__lamp-pull ${isPulling ? 'auth__lamp-pull--pulling' : ''}`}
              onMouseDown={handlePullStart}
              onMouseUp={handlePullEnd}
              onMouseLeave={isPulling ? handlePullEnd : undefined}
              onTouchStart={handlePullStart}
              onTouchEnd={handlePullEnd}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handlePullStart(e)
                  setTimeout(() => handlePullEnd(e), 200)
                }
              }}
              style={{ cursor: 'grab' }}
              whileTap={{ cursor: 'grabbing' }}
            >
              <Motion.div
                className="auth__lamp-string"
                animate={{
                  height: isPulling ? 95 : 65,
                  rotate: isReleased ? [0, 8, -6, 4, -3, 2, -1, 0] : (isPulling ? 0 : undefined),
                }}
                transition={
                  isReleased
                    ? { rotate: { duration: 0.8, ease: 'easeOut' } }
                    : { height: { type: 'spring', stiffness: 400, damping: 25 } }
                }
              />
            </Motion.div>
          </div>

          {/* 힌트 텍스트 */}
          <AnimatePresence>
            {!isLightOn && (
              <Motion.p
                className="auth__lamp-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.5 }}
              >
                줄을 당겨 불을 켜세요
              </Motion.p>
            )}
          </AnimatePresence>

          {/* 로고 텍스트 (불 켜진 후) */}
          <AnimatePresence>
            {isLightOn && (
              <Motion.div
                className="auth__mascot-text"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h1>PrePair</h1>
                <p>AI와 함께하는 면접 준비</p>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Form Section */}
        <div className="auth__form-section">
          <div className="auth__form-card">
          <header className="auth__header">
            <h2>{mode === 'signup' ? '회원가입' : '로그인'}</h2>
          </header>

          {error && (
            <div className="auth__error">
              <span>⚠️</span> {error}
            </div>
          )}

          {mode === 'signup' ? (
            <form onSubmit={handleSignup}>
              {/* Stepper */}
              <div className="auth__stepper">
                {steps.map((step, idx) => {
                  const canGoTo = idx < activeStep ||
                    (idx === 1 && activeStep === 0 && step1Valid) ||
                    (idx === 2 && activeStep === 1 && step2Valid)
                  return (
                    <div
                      key={step.id}
                      className={`auth__step ${idx === activeStep ? 'auth__step--active' : ''} ${idx < activeStep ? 'auth__step--done' : ''} ${canGoTo && idx !== activeStep ? 'auth__step--clickable' : ''}`}
                      onClick={() => canGoTo && idx !== activeStep && setActiveStep(idx)}
                    >
                      <span className="auth__step-dot">{idx < activeStep ? '✓' : idx + 1}</span>
                      <span className="auth__step-label">{step.label}</span>
                    </div>
                  )
                })}
              </div>

              {/* Step 1: Account Info */}
              {activeStep === 0 && (
                <Motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="auth__step-content"
                >
                  <div className="form-group">
                    <label className="form-label">이름</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="홍길동"
                      value={signupForm.name}
                      onChange={(e) => setSignupForm((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">이메일 (또는 아이디)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="test 또는 test@example.com"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm((p) => ({ ...p, email: e.target.value }))}
                    />
                    <p className="form-helper">테스트용: 아무 값이나 입력 가능</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">비밀번호</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="6자 이상, 특수문자 포함"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm((p) => ({ ...p, password: e.target.value }))}
                      required
                    />
                    <div className="auth__password-hints">
                      <span className={passwordValid ? 'valid' : ''}>• 6자 이상</span>
                      <span className={passwordSpecialValid ? 'valid' : ''}>• 특수문자 포함</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">비밀번호 확인</label>
                    <input
                      type="password"
                      className={`form-input ${signupForm.passwordConfirm && !passwordMatch ? 'form-input--error' : ''}`}
                      placeholder="비밀번호 확인"
                      value={signupForm.passwordConfirm}
                      onChange={(e) => setSignupForm((p) => ({ ...p, passwordConfirm: e.target.value }))}
                      required
                    />
                    {signupForm.passwordConfirm && !passwordMatch && (
                      <p className="form-error">비밀번호가 일치하지 않습니다.</p>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn btn--primary btn--block"
                    onClick={goNext}
                    disabled={!step1Valid}
                  >
                    다음
                  </button>
                </Motion.div>
              )}

              {/* Step 2: Job Role */}
              {activeStep === 1 && (
                <Motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="auth__step-content"
                >
                  <div className="form-group">
                    <label className="form-label">목표 직무</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="예: 프론트엔드 개발자, PM, 마케터 등"
                      value={signupForm.jobRole}
                      onChange={(e) => setSignupForm((p) => ({ ...p, jobRole: e.target.value }))}
                      required
                    />
                    <p className="form-helper">AI가 직무에 맞는 면접 질문을 생성합니다.</p>
                  </div>

                  <div className="auth__job-suggestions">
                    {jobTracks?.slice(0, 6).map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        className={`chip ${signupForm.jobRole === job.label ? 'chip--active' : ''}`}
                        onClick={() => setSignupForm((p) => ({ ...p, jobRole: job.label }))}
                      >
                        {job.label}
                      </button>
                    ))}
                  </div>

                  <div className="auth__buttons">
                    <button type="button" className="btn btn--secondary" onClick={goPrev}>
                      이전
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={goNext}
                      disabled={!step2Valid}
                    >
                      다음
                    </button>
                  </div>
                </Motion.div>
              )}

              {/* Step 3: Cadence */}
              {activeStep === 2 && (
                <Motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="auth__step-content"
                >
                  <div className="form-group">
                    <label className="form-label">질문 주기</label>
                    <Dropdown
                      options={cadencePresets?.map((preset) => ({
                        value: preset.id,
                        label: preset.label,
                      })) || []}
                      value={signupForm.cadence?.id || ''}
                      onChange={(value) =>
                        setSignupForm((p) => ({
                          ...p,
                          cadence: cadencePresets.find((c) => c.id === value),
                        }))
                      }
                      placeholder="질문 주기 선택"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">알림 설정</label>
                    <div className="auth__notification-info">
                      <span>📧</span> 이메일 알림은 기본 제공됩니다.
                    </div>
                    <div className="auth__notification-info">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/e/e3/KakaoTalk_logo.svg" alt="카카오톡" style={{ width: '20px', height: '20px' }} />
                      <span>카카오톡 알림 (선택)</span>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={signupForm.notificationKakao}
                        onChange={(e) =>
                          setSignupForm((p) => ({ ...p, notificationKakao: e.target.checked }))
                        }
                        style={{ marginLeft: 'auto' }}
                      />
                    </div>
                  </div>

                  <div className="auth__summary card card--gradient card--sm">
                    <p>
                      <strong>{signupForm.cadence?.label}</strong>로{' '}
                      <strong>{signupForm.jobRole}</strong> 직무에 대한<br />
                      AI 면접 질문을 받게 됩니다.
                    </p>
                  </div>

                  <div className="auth__buttons">
                    <button type="button" className="btn btn--secondary" onClick={goPrev}>
                      이전
                    </button>
                    <button type="submit" className="btn btn--primary" disabled={!step3Valid || isLoading}>
                      {isLoading ? '가입 중...' : '회원가입 완료'}
                    </button>
                  </div>
                </Motion.div>
              )}

              <p className="auth__switch">
                이미 계정이 있으신가요?{' '}
                <button type="button" className="auth__switch-link" onClick={() => setMode('login')}>
                  로그인
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">이메일 (또는 아이디)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="test, admin, demo 또는 아무 값"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                />
                <p className="form-helper">테스트 계정: test/test, admin/admin, demo/demo</p>
              </div>

              <div className="form-group">
                <label className="form-label">비밀번호</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="비밀번호 (아무 값이나 가능)"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                />
              </div>

              <p className="auth__forgot-password">
                <button type="button" className="auth__forgot-link" onClick={() => setShowForgotPassword(true)}>
                  비밀번호를 잊으셨나요?
                </button>
              </p>

              <button
                type="submit"
                className="btn btn--primary btn--block auth__submit-btn"
                disabled={isLoading}
              >
                {isLoading ? '로그인 중...' : '로그인'}
              </button>

              <p className="auth__switch">
                계정이 없으신가요?{' '}
                <button type="button" className="auth__switch-link" onClick={() => setMode('signup')}>
                  회원가입
                </button>
              </p>
            </form>
          )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotPassword && (
          <Motion.div
            className="auth__modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowForgotPassword(false)
              setForgotEmail('')
              setForgotEmailSent(false)
            }}
          >
            <Motion.div
              className="auth__modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>비밀번호 찾기</h3>
              {forgotEmailSent ? (
                <div className="auth__modal-success">
                  <span>✉️</span>
                  <p>입력하신 이메일로 비밀번호 재설정 링크를 보냈습니다.</p>
                  <button
                    type="button"
                    className="btn btn--primary btn--block"
                    onClick={() => {
                      setShowForgotPassword(false)
                      setForgotEmail('')
                      setForgotEmailSent(false)
                    }}
                  >
                    확인
                  </button>
                </div>
              ) : (
                <>
                  <p>가입한 이메일을 입력해주세요.</p>
                  <div className="form-group">
                    <input
                      type="email"
                      className="form-input"
                      placeholder="이메일 주소"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="auth__modal-buttons">
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => {
                        setShowForgotPassword(false)
                        setForgotEmail('')
                      }}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={!forgotEmail}
                      onClick={() => setForgotEmailSent(true)}
                    >
                      전송
                    </button>
                  </div>
                </>
              )}
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
