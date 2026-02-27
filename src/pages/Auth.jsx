import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { motion as Motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { useAppState } from '../context/AppStateContext'
import useMediaQuery from '../hooks/useMediaQuery'
import Dropdown from '../components/Dropdown'
import logo from '../assets/logo.png'
import '../styles/pages/Auth.css'
import { findIdByEmail, sendPasswordResetEmail, resetPassword } from '../utils/authApi'

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
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotEmailSent, setForgotEmailSent] = useState(false)

  // 카카오 인증 관련 상태
  const [authMethod, setAuthMethod] = useState(null) // null | 'kakao' | 'email'
  const [isKakaoAuthenticating, setIsKakaoAuthenticating] = useState(false)
  const [showKakaoNotificationModal, setShowKakaoNotificationModal] = useState(false)
  const [kakaoAuthData, setKakaoAuthData] = useState(null) // { name, email }
  const [showEmailLogin, setShowEmailLogin] = useState(false) // 이메일 로그인 폼 표시 여부

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

const [showFindId, setShowFindId] = useState(false)
const [findIdEmail, setFindIdEmail] = useState('')
const [findIdResult, setFindIdResult] = useState(null) // null, 'found', 'notFound'
const [isFindingId, setIsFindingId] = useState(false)

const [forgotPasswordStep, setForgotPasswordStep] = useState(1) // 1: 이메일, 2: 코드, 3: 새 비밀번호
const [forgotCode, setForgotCode] = useState('')
const [forgotNewPassword, setForgotNewPassword] = useState('')
const [forgotPasswordConfirm, setForgotPasswordConfirm] = useState('')

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
  // 카카오 인증 시 비밀번호는 선택사항으로 처리
  const step1Valid = authMethod === 'kakao' 
    ? signupForm.name && signupForm.email 
    : signupForm.name && signupForm.email && passwordValid && passwordSpecialValid && passwordMatch
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

  // 아이디 찾기
const handleFindId = async () => {
  if (!findIdEmail) return
  
  setIsFindingId(true)
  setError('')
  
  try {
    const result = await findIdByEmail(findIdEmail)
    setFindIdResult(result.exists ? 'found' : 'notFound')
  } catch (err) {
    setError(err.message || '아이디 찾기에 실패했습니다.')
    setFindIdResult(null)
  } finally {
    setIsFindingId(false)
  }
}

// 비밀번호 찾기 1단계: 이메일 발송
const handleSendPasswordResetEmail = async () => {
  if (!forgotEmail) return
  
  setIsLoading(true)
  setError('')
  
  try {
    await sendPasswordResetEmail(forgotEmail)
    setForgotPasswordStep(2) // 다음 단계로
    setForgotEmailSent(true)
  } catch (err) {
    setError(err.message || '이메일 발송에 실패했습니다.')
  } finally {
    setIsLoading(false)
  }
}


const handleVerifyCode = () => {
  if (!forgotCode) return
  setForgotPasswordStep(3)
}

const handleResetPassword = async () => {
  if (!forgotNewPassword || !forgotPasswordConfirm) return
  if (forgotNewPassword !== forgotPasswordConfirm) {
    setError('비밀번호가 일치하지 않습니다.')
    return
  }
  if (forgotNewPassword.length < 6) {
    setError('비밀번호는 6자 이상이어야 합니다.')
    return
  }
  
  setIsLoading(true)
  setError('')
  
  try {
    await resetPassword(forgotEmail, forgotCode, forgotNewPassword)
    setShowForgotPassword(false)
    setForgotPasswordStep(1)
    setForgotEmail('')
    setForgotCode('')
    setForgotNewPassword('')
    setForgotPasswordConfirm('')
    setForgotEmailSent(false)
    alert('비밀번호가 성공적으로 재설정되었습니다.')
  } catch (err) {
    setError(err.message || '비밀번호 재설정에 실패했습니다.')
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

  // 카카오 인증 처리
  const handleKakaoAuth = async () => {
    setIsKakaoAuthenticating(true)
    setError('')

    try {
      // 모의 카카오 인증 처리 (실제로는 Kakao SDK 사용)
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // 모의 카카오 사용자 정보
      const mockKakaoData = {
        name: '홍길동', // 실제로는 카카오 API에서 받아옴
        email: 'kakao@example.com', // 실제로는 카카오 API에서 받아옴
      }
      
      setKakaoAuthData(mockKakaoData)
      setIsKakaoAuthenticating(false)
      setShowKakaoNotificationModal(true)
    } catch (err) {
      setError('카카오 인증에 실패했습니다.')
      setIsKakaoAuthenticating(false)
    }
  }

  // 카카오 알림 설정 확인
  const handleKakaoNotificationConfirm = (enableNotification) => {
    if (!kakaoAuthData) return

    // 정보 자동 입력
    setSignupForm((prev) => ({
      ...prev,
      name: kakaoAuthData.name,
      email: kakaoAuthData.email,
      password: 'kakao-auth-' + Date.now(), // 임시 비밀번호 (실제로는 서버에서 처리)
      passwordConfirm: 'kakao-auth-' + Date.now(),
      notificationKakao: enableNotification,
    }))

    // 로그인 폼에도 정보 저장 (나중에 로그인 시 사용)
    localStorage.setItem('kakaoAuthEmail', kakaoAuthData.email)

    setAuthMethod('kakao')
    setShowKakaoNotificationModal(false)
    setActiveStep(0) // Step 1로 이동 (기본 정보는 이미 채워짐)
  }

  // 로그인용 카카오 인증
  const handleKakaoLogin = async () => {
    setIsKakaoAuthenticating(true)
    setError('')

    try {
      // 모의 카카오 인증 처리
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // 저장된 카카오 이메일이 있으면 사용, 없으면 모의 데이터
      const savedEmail = localStorage.getItem('kakaoAuthEmail')
      const mockKakaoData = {
        email: savedEmail || 'kakao@example.com',
      }
      
      // 로그인 폼에 자동 입력
      setLoginForm({
        email: mockKakaoData.email,
        password: '', // 카카오 로그인은 비밀번호 불필요 (실제로는 서버에서 처리)
      })

      // 카카오 로그인은 바로 로그인 처리 (실제로는 서버 API 호출)
      setIsKakaoAuthenticating(false)
      
      // 모의 로그인 처리
      setIsLoading(true)
      await login({ email: mockKakaoData.email, password: 'kakao-login' })
      navigate(redirectFrom || '/mypage', { replace: true })
    } catch (err) {
      setError('카카오 로그인에 실패했습니다.')
      setIsKakaoAuthenticating(false)
      setIsLoading(false)
    }
  }

  // 이메일 인증 선택
  const handleEmailAuth = () => {
    setAuthMethod('email')
    setActiveStep(0)
  }

  return (
    <div className="auth">

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
        {/* Mascot Section */}
        <div className={`auth__mascot-section auth__mascot-section--${mode}`}>
          {/* 로고 텍스트 */}
          <Motion.div
            className="auth__mascot-text"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <img src={logo} alt="PrePair" className="auth__mascot-logo" />
            <h1>PrePair</h1>
            <p className="auth__mascot-tagline">AI와 함께하는 면접 준비</p>
          </Motion.div>
        </div>

        {/* Form Section */}
        <div className="auth__form-section">
          <div className="auth__form-card">
          <header className="auth__header">
            {mode === 'login' && showEmailLogin && (
              <button
                type="button"
                className="auth__back-icon"
                onClick={() => {
                  setShowEmailLogin(false)
                  setLoginForm({ email: '', password: '' })
                }}
              >
                ←
              </button>
            )}
            <h2>{mode === 'signup' ? '회원가입' : '로그인'}</h2>
          </header>

          {error && (
            <div className="auth__error">
              <span>⚠️</span> {error}
            </div>
          )}

          {mode === 'signup' ? (
            <form onSubmit={handleSignup}>
              {/* 인증 방식 선택 화면 */}
              {authMethod === null && (
                <Motion.div
                  key="auth-method-select"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="auth__method-select"
                >
                  <div className="auth__method-select-content">
                    <h3 className="auth__method-select-title">회원가입 방법을 선택해주세요</h3>
                    <p className="auth__method-select-subtitle">간편하게 시작하거나 이메일로 가입할 수 있습니다</p>
                    
                    <button
                      type="button"
                      className="btn btn--kakao btn--block auth__method-btn"
                      onClick={handleKakaoAuth}
                      disabled={isKakaoAuthenticating}
                    >
                      {isKakaoAuthenticating ? (
                        <>
                          <div className="spinner spinner--sm" />
                          <span>인증 중...</span>
                        </>
                      ) : (
                        <>
                          <img 
                            src="https://upload.wikimedia.org/wikipedia/commons/e/e3/KakaoTalk_logo.svg" 
                            alt="카카오톡" 
                            className="auth__kakao-icon"
                          />
                          <span>카카오톡으로 시작하기</span>
                        </>
                      )}
                    </button>

                    <div className="auth__method-divider">
                      <span>또는</span>
                    </div>

                    <button
                      type="button"
                      className="btn btn--secondary btn--block auth__method-btn"
                      onClick={handleEmailAuth}
                    >
                      이메일로 가입하기
                    </button>
                  </div>
                </Motion.div>
              )}

              {/* 기존 회원가입 폼 (인증 방식 선택 후 표시) */}
              {authMethod !== null && (
                <>
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
                  {authMethod === 'kakao' && (
                    <div className="auth__kakao-badge">
                      <img 
                        src="https://upload.wikimedia.org/wikipedia/commons/e/e3/KakaoTalk_logo.svg" 
                        alt="카카오톡" 
                        className="auth__kakao-icon-small"
                      />
                      <span>카카오톡으로 가입 중</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">이름</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="홍길동"
                      value={signupForm.name}
                      onChange={(e) => setSignupForm((p) => ({ ...p, name: e.target.value }))}
                      required
                      disabled={authMethod === 'kakao'}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">이메일</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="test 또는 test@example.com"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm((p) => ({ ...p, email: e.target.value }))}
                      disabled={authMethod === 'kakao'}
                    />
                  
                  </div>

                  {authMethod === 'email' && (
                    <>
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
                    </>
                  )}

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
                    {authMethod === 'kakao' && (
                      <div className={`auth__notification-info ${signupForm.notificationKakao ? 'auth__notification-info--active' : ''}`}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/e/e3/KakaoTalk_logo.svg" alt="카카오톡" style={{ width: '20px', height: '20px' }} />
                        <span>카카오톡 알림 {signupForm.notificationKakao ? '(활성화됨)' : '(비활성화됨)'}</span>
                      </div>
                    )}
                    {authMethod === 'email' && (
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
                    )}
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
                <button type="button" className="auth__switch-link" onClick={() => {
                  setMode('login')
                  setAuthMethod(null)
                  setActiveStep(0)
                }}>
                  로그인
                </button>
              </p>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              {!showEmailLogin && (
                <>
                  <button
                    type="button"
                    className="btn btn--kakao btn--block auth__kakao-login-btn"
                    onClick={handleKakaoLogin}
                    disabled={isKakaoAuthenticating || isLoading}
                  >
                    {isKakaoAuthenticating ? (
                      <>
                        <div className="spinner spinner--sm" />
                        <span>인증 중...</span>
                      </>
                    ) : (
                      <>
                        <img 
                          src="https://upload.wikimedia.org/wikipedia/commons/e/e3/KakaoTalk_logo.svg" 
                          alt="카카오톡" 
                          className="auth__kakao-icon"
                        />
                        <span>카카오톡으로 로그인</span>
                      </>
                    )}
                  </button>

                  <div className="auth__method-divider">
                    <span>또는</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn--secondary btn--block auth__email-login-btn"
                    onClick={() => setShowEmailLogin(true)}
                  >
                    이메일로 로그인
                  </button>
                </>
              )}

              {showEmailLogin && (
                <>
                  <div className="form-group">
                    <label className="form-label">이메일</label>
                    <input
                      type="text"
                      className="form-input"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">비밀번호</label>
                    <input
                      type="password"
                      className="form-input"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn--primary btn--block auth__submit-btn"
                    disabled={isLoading || isKakaoAuthenticating}
                  >
                    {isLoading ? '로그인 중...' : '로그인'}
                  </button>

                  <p className="auth__forgot-password">
                    <button
                      type="button"
                      className="auth__forgot-link"
                      onClick={() => setShowFindId(true)}
                    >
                      아이디 찾기
                    </button>
                    {' | '}
                    <button
                      type="button"
                      className="auth__forgot-link"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      비밀번호 찾기
                    </button>
                  </p>
                </>
              )}

              <p className="auth__switch">
                계정이 없으신가요?{' '}
                <button type="button" className="auth__switch-link" onClick={() => {
                  setMode('signup')
                  setAuthMethod(null)
                  setShowEmailLogin(false)
                }}>
                  회원가입
                </button>
              </p>
            </form>
          )}
          </div>
        </div>
      </div>

      {/* 아이디 찾기 모달 */}
<AnimatePresence>
  {showFindId && (
    <Motion.div
      className="auth__modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => {
        setShowFindId(false)
        setFindIdEmail('')
        setFindIdResult(null)
      }}
    >
      <Motion.div
        className="auth__modal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>아이디 찾기</h3>
        {findIdResult === 'found' ? (
          <div className="auth__modal-success">
            <span>✓</span>
            <p>입력하신 이메일로 가입된 계정이 있습니다.</p>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => {
                setShowFindId(false)
                setFindIdEmail('')
                setFindIdResult(null)
              }}
            >
              확인
            </button>
          </div>
        ) : findIdResult === 'notFound' ? (
          <div className="auth__modal-error">
            <span>✗</span>
            <p>입력하신 이메일로 가입된 계정을 찾을 수 없습니다.</p>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => {
                setFindIdResult(null)
                setFindIdEmail('')
              }}
            >
              다시 시도
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
                value={findIdEmail}
                onChange={(e) => setFindIdEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div className="auth__modal-buttons">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setShowFindId(false)
                  setFindIdEmail('')
                }}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!findIdEmail || isFindingId}
                onClick={handleFindId}
              >
                {isFindingId ? '확인 중...' : '확인'}
              </button>
            </div>
          </>
        )}
      </Motion.div>
    </Motion.div>
  )}
</AnimatePresence>
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
        setForgotCode('')
        setForgotNewPassword('')
        setForgotPasswordConfirm('')
        setForgotEmailSent(false)
        setForgotPasswordStep(1)
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
        
        {/* 1단계: 이메일 입력 */}
        {forgotPasswordStep === 1 && (
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
            {error && (
              <div className="auth__error" style={{ marginBottom: '1rem' }}>
                <span>⚠️</span> {error}
              </div>
            )}
            <div className="auth__modal-buttons">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setShowForgotPassword(false)
                  setForgotEmail('')
                  setError('')
                }}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!forgotEmail || isLoading}
                onClick={handleSendPasswordResetEmail}
              >
                {isLoading ? '전송 중...' : '인증 메일 보내기'}
              </button>
            </div>
          </>
        )}
        
        {/* 2단계: 인증 코드 입력 */}
        {forgotPasswordStep === 2 && (
          <>
            <p>이메일로 전송된 인증 코드를 입력해주세요.</p>
            <div className="form-group">
              <input
                type="text"
                className="form-input"
                placeholder="인증 코드"
                value={forgotCode}
                onChange={(e) => setForgotCode(e.target.value)}
                autoFocus
              />
            </div>
            {error && (
              <div className="auth__error" style={{ marginBottom: '1rem' }}>
                <span>⚠️</span> {error}
              </div>
            )}
            <div className="auth__modal-buttons">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setForgotPasswordStep(1)
                  setForgotCode('')
                }}
              >
                이전
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!forgotCode}
                onClick={handleVerifyCode}
              >
                다음
              </button>
            </div>
          </>
        )}
        
        {/* 3단계: 새 비밀번호 입력 */}
        {forgotPasswordStep === 3 && (
          <>
            <p>새 비밀번호를 입력해주세요.</p>
            <div className="form-group">
              <label className="form-label">새 비밀번호</label>
              <input
                type="password"
                className="form-input"
                placeholder="6자 이상, 특수문자 포함"
                value={forgotNewPassword}
                onChange={(e) => setForgotNewPassword(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">비밀번호 확인</label>
              <input
                type="password"
                className={`form-input ${forgotPasswordConfirm && forgotNewPassword !== forgotPasswordConfirm ? 'form-input--error' : ''}`}
                placeholder="비밀번호 확인"
                value={forgotPasswordConfirm}
                onChange={(e) => setForgotPasswordConfirm(e.target.value)}
              />
              {forgotPasswordConfirm && forgotNewPassword !== forgotPasswordConfirm && (
                <p className="form-error">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>
            {error && (
              <div className="auth__error" style={{ marginBottom: '1rem' }}>
                <span>⚠️</span> {error}
              </div>
            )}
            <div className="auth__modal-buttons">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setForgotPasswordStep(2)
                  setForgotNewPassword('')
                  setForgotPasswordConfirm('')
                }}
              >
                이전
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!forgotNewPassword || !forgotPasswordConfirm || isLoading}
                onClick={handleResetPassword}
              >
                {isLoading ? '재설정 중...' : '비밀번호 재설정'}
              </button>
            </div>
          </>
        )}
      </Motion.div>
    </Motion.div>
  )}
</AnimatePresence>

      {/* 카카오 알림 설정 모달 */}
      <AnimatePresence>
        {showKakaoNotificationModal && (
          <Motion.div
            className="auth__modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              // 모달 외부 클릭 시 닫지 않음 (명시적 선택 필요)
            }}
          >
            <Motion.div
              className="auth__modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="auth__kakao-modal-header">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/e/e3/KakaoTalk_logo.svg" 
                  alt="카카오톡" 
                  className="auth__kakao-icon-large"
                />
                <h3>카카오톡 알림을 받으시겠어요?</h3>
                <p>면접 질문과 피드백을 카카오톡으로도 받아보실 수 있습니다.</p>
              </div>

              <div className="auth__kakao-modal-buttons">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => handleKakaoNotificationConfirm(false)}
                >
                  나중에 하기
                </button>
                <button
                  type="button"
                  className="btn btn--kakao"
                  onClick={() => handleKakaoNotificationConfirm(true)}
                >
                  알림 받기
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
