import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { motion as Motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { useAppState } from '../context/AppStateContext'
import useMediaQuery from '../hooks/useMediaQuery'
import Dropdown from '../components/Dropdown'
import logo from '../assets/logo.png'
import '../styles/pages/Auth.css'
import {
  getMemberByEmail,
  requestSignupEmailVerification,
  verifySignupEmail,
  registerMember,
  requestPasswordResetEmail,
  resetPassword as resetPasswordApi,
  kakaoPromptLogin,
  kakaoCallback,
  kakaoRegister,
} from '../utils/memberApi'

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
  const [kakaoAuthData, setKakaoAuthData] = useState(null) // { name, email } (prefilledData)
  const [registrationToken, setRegistrationToken] = useState(null) // 카카오 신규 회원 시 회원가입 완료용
  const [showEmailLogin, setShowEmailLogin] = useState(false) // 이메일 로그인 폼 표시 여부
  const [signupSuccessMessage, setSignupSuccessMessage] = useState('') // 회원가입 완료 후 안내

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    jobRole: '',
    cadence: defaultCadence,
    notificationKakao: false,
    // AppStateContext.signup 에서 알림 채널 계산에 사용
    authMethod: null, // 'kakao' | 'email'
  })

  // 이메일 회원가입: 인증 단계 (요청 → 코드 입력 → 확인)
  const [emailVerificationSent, setEmailVerificationSent] = useState(false)
  const [emailVerificationCode, setEmailVerificationCode] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

const [showFindEmail, setShowFindEmail] = useState(false)
  const [findEmailInput, setFindEmailInput] = useState('')
  const [findEmailResult, setFindEmailResult] = useState(null) // null | 'found' | 'notFound'
  const [isFindingEmail, setIsFindingEmail] = useState(false)

const [forgotPasswordStep, setForgotPasswordStep] = useState(1) // 1: 이메일, 2: 코드, 3: 임시 비밀번호 확인
const [forgotCode, setForgotCode] = useState('')
const [temporaryPassword, setTemporaryPassword] = useState('')
  useEffect(() => {
    const paramMode = searchParams.get('mode')
    if (paramMode && (paramMode === 'login' || paramMode === 'signup')) {
      setMode(paramMode)
    } else {
      setMode('signup')
    }
  }, [searchParams])

  // OAuth 에러가 쿼리로 넘어오면 안내
  useEffect(() => {
    const oauthError = searchParams.get('oauthError')
    if (!oauthError) return
    const desc = searchParams.get('oauthErrorDescription')
    setMode('login')
    setShowEmailLogin(true)
    setError(desc ? `카카오 인증에 실패했습니다. (${desc})` : '카카오 인증에 실패했습니다.')
    navigate('/auth?mode=login', { replace: true })
  }, [searchParams, navigate])

  // 카카오 OAuth 콜백: URL에 code가 있으면 callback API 호출 후 신규/기존 회원 분기
  useEffect(() => {
    const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
    const code = searchParams.get('code') || hashParams.get('code')
    if (!code || !code.trim()) return

    setIsKakaoAuthenticating(true)
    setError('')

    kakaoCallback({ code })
      .then((response) => {
        const data = response?.data ?? response

        if (data?.isNewMember === true) {
          // 신규 가입자 → 카카오 정보(prefilledData)를 들고 회원가입 화면으로 이동
          const token = data.registrationToken
          const prefilled = data.prefilledData ?? {}
          setRegistrationToken(token)
          setKakaoAuthData({
            name: prefilled.nickname ?? '',
            email: prefilled.email ?? '',
          })
          setMode('signup')
          setAuthMethod('kakao')
          setShowKakaoNotificationModal(true)
          // URL에서 code 제거 (보안상 콜백 코드를 URL에 남기지 않음)
          navigate('/auth?mode=signup', { replace: true })
          return
        }

        // 기존 회원: 카카오로 인증만 하고, 실제 서비스 이용 전에는 반드시 한번 더 로그인하도록 유도
        setMode('login')
        setShowEmailLogin(true)
        setSignupSuccessMessage('카카오 인증이 완료되었습니다. 이메일/비밀번호로 다시 로그인해주세요.')
        // URL에서 code 제거 + 로그인 모드로 강제
        navigate('/auth?mode=login', { replace: true })
      })
      .catch((err) => {
        setMode('login')
        setShowEmailLogin(true)
        setSignupSuccessMessage('')
        setError(err.message || '카카오 로그인에 실패했습니다.')
      })
      .finally(() => {
        setIsKakaoAuthenticating(false)
      })
  }, [searchParams, navigate])

  // Validation
  const loginValid = loginForm.email && loginForm.password
  const passwordValid = signupForm.password.length >= 6
  const passwordSpecialValid = /[^A-Za-z0-9]/.test(signupForm.password)
  const passwordMatch = signupForm.password === signupForm.passwordConfirm
  // 카카오 인증 시 비밀번호는 선택사항, 이메일 가입 시 인증 완료 필요
  const step1Valid = authMethod === 'kakao'
    ? signupForm.name && signupForm.email
    : signupForm.name && signupForm.email && passwordValid && passwordSpecialValid && passwordMatch && emailVerified
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
      const base = err.message || '로그인에 실패했습니다.'
      const kakaoHint =
        err.statusCode === 401
          ? ' 카카오로 가입한 계정은 서비스에 비밀번호가 없을 수 있습니다. 아래에서 "카카오톡으로 로그인"을 이용해 주세요.'
          : ''
      setError(`${base}${kakaoHint}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 이메일 찾기: 가입 여부 확인 (GET /api/members/?email=...)
  const handleFindEmail = async () => {
    if (!findEmailInput?.trim()) return
    setIsFindingEmail(true)
    setError('')
    try {
      await getMemberByEmail(findEmailInput.trim())
      setFindEmailResult('found')
    } catch (err) {
      if (err.statusCode === 404 || err.message?.toLowerCase().includes('not found')) {
        setFindEmailResult('notFound')
      } else {
        setError(err.message || '이메일 찾기에 실패했습니다.')
        setFindEmailResult(null)
      }
    } finally {
      setIsFindingEmail(false)
    }
  }

  // 비밀번호 찾기 1단계: 이메일 발송 (memberApi)
  const handleSendPasswordResetEmail = async () => {
    if (!forgotEmail) return
    setIsLoading(true)
    setError('')
    try {
      await requestPasswordResetEmail({ email: forgotEmail })
      setForgotPasswordStep(2)
      setForgotEmailSent(true)
    } catch (err) {
      setError(err.message || '이메일 발송에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 비밀번호 재설정: 인증 코드 확인 + 임시 비밀번호 발급
  const handleIssueTemporaryPassword = async () => {
    if (!forgotCode) return
    setIsLoading(true)
    setError('')
    try {
      const response = await resetPasswordApi({
        email: forgotEmail,
        code: forgotCode,
      })

      // BE에서 내려주는 임시 비밀번호 필드 추론
      const data = response?.data ?? response
      const tempPw =
        data?.temporaryPassword ||
        data?.tempPassword ||
        data?.password ||
        data?.temp_pw ||
        ''

      if (!tempPw) {
        throw new Error('임시 비밀번호를 가져오지 못했습니다. 다시 시도해주세요.')
      }

      setTemporaryPassword(tempPw)
      setForgotPasswordStep(3)
    } catch (err) {
      setError(err.message || '임시 비밀번호 발급에 실패했습니다.')
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
      // 카카오 신규 회원: registrationToken으로 회원가입 API 호출
      if (authMethod === 'kakao' && registrationToken) {
        const frequency = signupForm.cadence?.id === 'weekly' ? 'weekly' : 'every'
        await kakaoRegister({
          registrationToken,
          job: signupForm.jobRole?.trim() || 'OAuthJob',
          notification: 'kakao',
          frequency,
        })
        setRegistrationToken(null)
        // 카카오 회원도 가입 후에는 반드시 다시 로그인
        setMode('login')
        setShowEmailLogin(true)
        setLoginForm((prev) => ({
          ...prev,
          email: signupForm.email?.trim() || prev.email,
        }))
        setError('')
        setSignupSuccessMessage('카카오 회원가입이 완료되었습니다. 다시 로그인해주세요.')
        // URL 모드도 login으로 맞춰 줌
        navigate('/auth?mode=login', { replace: true })
        return
      }

      await signup(signupForm)
      // 이메일 회원가입도 자동 로그인 없이 로그인 화면으로 전환
      setMode('login')
      setShowEmailLogin(true)
      setLoginForm((prev) => ({ ...prev, email: signupForm.email?.trim() || prev.email }))
      setError('')
      setSignupSuccessMessage('회원가입이 완료되었습니다. 로그인해주세요.')
      // URL 모드도 login으로 맞춰 줌
      navigate('/auth?mode=login', { replace: true })
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

  // 카카오 OAuth 시작: 백엔드 /api/auth/kakao/url?prompt=login → 전달받은 url 로만 리다이렉트
  const handleKakaoAuth = async () => {
    setError('')
    setIsKakaoAuthenticating(true)
    try {
      const res = await kakaoPromptLogin('login')
      const url = res?.data?.url ?? res?.url
      if (!url) throw new Error('카카오 로그인 URL을 받지 못했습니다.')
      window.location.href = url
    } catch (err) {
      setError(err.message || '카카오 로그인 준비 중 오류가 발생했습니다.')
    } finally {
      setIsKakaoAuthenticating(false)
    }
  }

  // 카카오 알림 설정 확인
  const handleKakaoNotificationConfirm = (enableNotification) => {
    if (!kakaoAuthData) return

    // prefilledData 기반으로 회원가입 폼 자동 입력 (registrationToken은 이미 state에 있음)
    setSignupForm((prev) => ({
      ...prev,
      name: kakaoAuthData.name,
      email: kakaoAuthData.email,
      password: '',
      passwordConfirm: '',
      notificationKakao: enableNotification,
      authMethod: 'kakao',
    }))

    if (kakaoAuthData.email) {
      localStorage.setItem('kakaoAuthEmail', kakaoAuthData.email)
    }

    setAuthMethod('kakao')
    setShowKakaoNotificationModal(false)
    setActiveStep(0) // Step 1로 이동 (기본 정보는 이미 채워짐)
  }

  // 로그인용 카카오 OAuth
  const handleKakaoLogin = () => {
    setError('')
    setIsKakaoAuthenticating(true)
    kakaoPromptLogin('login')
      .then((res) => {
        const url = res?.data?.url ?? res?.url
        if (!url) throw new Error('카카오 로그인 URL을 받지 못했습니다.')
        window.location.href = url
      })
      .catch((err) => {
        setError(err.message || '카카오 로그인 준비 중 오류가 발생했습니다.')
      })
      .finally(() => {
        setIsKakaoAuthenticating(false)
      })
  }

  // 이메일 인증 선택
  const handleEmailAuth = () => {
    setRegistrationToken(null)
    setKakaoAuthData(null)
    setAuthMethod('email')
    setSignupForm((prev) => ({
      ...prev,
      authMethod: 'email',
    }))
    setActiveStep(0)
    setEmailVerificationSent(false)
    setEmailVerificationCode('')
    setEmailVerified(false)
  }

  // 회원가입 이메일 인증 요청
  const handleRequestEmailVerification = async () => {
    if (!signupForm.email?.trim()) {
      setError('이메일을 입력해주세요.')
      return
    }
    setIsVerifying(true)
    setError('')
    try {
      // 회원가입 이메일 인증 요청 시 BE 스펙에 맞춰 purpose 포함
      await requestSignupEmailVerification({
        email: signupForm.email.trim(),
        purpose: 'REGISTER',
      })
      setEmailVerificationSent(true)
    } catch (err) {
      setError(err.message || '인증 메일 발송에 실패했습니다.')
    } finally {
      setIsVerifying(false)
    }
  }

  // 회원가입 이메일 인증 확인
  const handleVerifyEmailCode = async () => {
    if (!emailVerificationCode?.trim()) {
      setError('인증 코드를 입력해주세요.')
      return
    }
    setIsVerifying(true)
    setError('')
    try {
      await verifySignupEmail({
        email: signupForm.email.trim(),
        code: emailVerificationCode.trim(),
      })
      setEmailVerified(true)
    } catch (err) {
      setError(err.message || '인증에 실패했습니다. 코드를 확인해주세요.')
    } finally {
      setIsVerifying(false)
    }
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
                    {authMethod === 'kakao' && (
                      <p className="form-helper auth__name-hint">
                        서비스(헤더, 면접 안내 등)에 표시됩니다. 카카오 프로필과 다르게 입력할 수 있어요.
                      </p>
                    )}
                    <input
                      type="text"
                      className="form-input"
                      placeholder="홍길동"
                      value={signupForm.name}
                      onChange={(e) => setSignupForm((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group auth__email-group">
                    <label className="form-label">이메일</label>
                    <div className="auth__email-row">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="test 또는 test@example.com"
                        value={signupForm.email}
                        onChange={(e) => setSignupForm((p) => ({ ...p, email: e.target.value }))}
                      />
                      {authMethod === 'email' && (
                        <button
                          type="button"
                          className="btn btn--secondary auth__email-verify-btn"
                          onClick={handleRequestEmailVerification}
                          disabled={isVerifying || !signupForm.email?.trim()}
                        >
                          {isVerifying
                            ? '발송 중...'
                            : emailVerificationSent
                            ? '재전송'
                            : '인증 메일 받기'}
                        </button>
                      )}
                    </div>
                    {authMethod === 'email' && emailVerificationSent && !emailVerified && (
                      <div className="auth__email-verify-inline">
                        <p className="form-helper">이메일로 전송된 인증 코드를 입력해주세요.</p>
                        <div className="auth__email-code-row">
                          <input
                            type="text"
                            className="form-input"
                            placeholder="인증 코드 6자리"
                            value={emailVerificationCode}
                            onChange={(e) =>
                              setEmailVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                            }
                            maxLength={6}
                            autoComplete="one-time-code"
                          />
                          <button
                            type="button"
                            className="btn btn--primary auth__email-code-btn"
                            onClick={handleVerifyEmailCode}
                            disabled={isVerifying || emailVerificationCode.length < 4}
                          >
                            {isVerifying ? '확인 중...' : '인증 확인'}
                          </button>
                        </div>
                      </div>
                    )}
                    {authMethod === 'email' && emailVerified && (
                      <p className="auth__email-verified">✓ 이메일 인증이 완료되었습니다.</p>
                    )}
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
                  setRegistrationToken(null)
                  setKakaoAuthData(null)
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
              {signupSuccessMessage && (
                <div className="auth__success">
                  {signupSuccessMessage}
                </div>
              )}
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
                  <p className="auth__login-email-hint" role="note">
                    카카오로 가입하셨다면 이메일·비밀번호 대신{' '}
                    <button
                      type="button"
                      className="auth__login-email-hint-link"
                      onClick={() => {
                        setShowEmailLogin(false)
                        setError('')
                      }}
                    >
                      카카오톡으로 로그인
                    </button>
                    을 눌러 주세요.
                  </p>
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

                  <div className="auth__find-links">
                    <button
                      type="button"
                      className="auth__forgot-link"
                      onClick={() => { setError(''); setShowFindEmail(true); }}
                    >
                      이메일 찾기
                    </button>
                    <span className="auth__find-links-divider">|</span>
                    <button
                      type="button"
                      className="auth__forgot-link"
                      onClick={() => { setError(''); setShowForgotPassword(true); }}
                    >
                      비밀번호 찾기
                    </button>
                  </div>
                </>
              )}

              <p className="auth__switch">
                계정이 없으신가요?{' '}
                <button type="button" className="auth__switch-link" onClick={() => {
                  setMode('signup')
                  setAuthMethod(null)
                  setRegistrationToken(null)
                  setKakaoAuthData(null)
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

      {/* 이메일 찾기 모달 */}
      <AnimatePresence>
        {showFindEmail && (
          <Motion.div
            className="auth__modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowFindEmail(false)
              setFindEmailInput('')
              setFindEmailResult(null)
            }}
          >
            <Motion.div
              className="auth__modal auth__modal--find-email"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="auth__modal-header">
                <h3>이메일 찾기</h3>
                <button
                  type="button"
                  className="auth__modal-close"
                  aria-label="닫기"
                  onClick={() => {
                    setShowFindEmail(false)
                    setFindEmailInput('')
                    setFindEmailResult(null)
                  }}
                >
                  ×
                </button>
              </div>
              {findEmailResult === 'found' ? (
                <div className="auth__modal-success">
                  <span className="auth__modal-icon auth__modal-icon--success">✓</span>
                  <p>입력하신 이메일로 가입된 계정이 있습니다.<br />해당 이메일로 로그인해 주세요.</p>
                  <button
                    type="button"
                    className="btn btn--primary btn--block"
                    onClick={() => {
                      setShowFindEmail(false)
                      setFindEmailInput('')
                      setFindEmailResult(null)
                    }}
                  >
                    확인
                  </button>
                </div>
              ) : findEmailResult === 'notFound' ? (
                <div className="auth__modal-error">
                  <span className="auth__modal-icon auth__modal-icon--error">✗</span>
                  <p>입력하신 이메일로 가입된 계정을 찾을 수 없습니다.</p>
                  <button
                    type="button"
                    className="btn btn--primary btn--block"
                    onClick={() => {
                      setFindEmailResult(null)
                      setFindEmailInput('')
                    }}
                  >
                    다시 시도
                  </button>
                </div>
              ) : (
                <>
                  <p className="auth__modal-desc">가입 시 사용한 이메일을 입력하시면, 해당 이메일로 가입된 계정이 있는지 확인해 드립니다.</p>
                  <div className="form-group">
                    <label className="form-label" htmlFor="find-email-input">이메일</label>
                    <input
                      id="find-email-input"
                      type="email"
                      className="form-input"
                      placeholder="example@email.com"
                      value={findEmailInput}
                      onChange={(e) => setFindEmailInput(e.target.value)}
                      autoFocus
                      autoComplete="email"
                    />
                  </div>
                  <div className="auth__modal-buttons">
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => {
                        setShowFindEmail(false)
                        setFindEmailInput('')
                      }}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={!findEmailInput?.trim() || isFindingEmail}
                      onClick={handleFindEmail}
                    >
                      {isFindingEmail ? '확인 중...' : '확인'}
                    </button>
                  </div>
                </>
              )}
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
      {/* 비밀번호 찾기 모달 */}
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
              setTemporaryPassword('')
              setForgotEmailSent(false)
              setForgotPasswordStep(1)
              setError('')
            }}
          >
            <Motion.div
              className="auth__modal auth__modal--password"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="auth__modal-header">
                <h3>비밀번호 찾기</h3>
                <button
                  type="button"
                  className="auth__modal-close"
                  aria-label="닫기"
                  onClick={() => {
                    setShowForgotPassword(false)
                    setForgotPasswordStep(1)
                    setForgotEmail('')
                    setForgotCode('')
                    setForgotNewPassword('')
                    setForgotPasswordConfirm('')
                    setForgotEmailSent(false)
                    setError('')
                  }}
                >
                  ×
                </button>
              </div>

              <div className="auth__modal-steps">
                <span className={forgotPasswordStep >= 1 ? 'auth__modal-step--active' : ''}>1. 이메일 입력</span>
                <span className="auth__modal-step-line" />
                <span className={forgotPasswordStep >= 2 ? 'auth__modal-step--active' : ''}>2. 인증 코드</span>
                <span className="auth__modal-step-line" />
                <span className={forgotPasswordStep >= 3 ? 'auth__modal-step--active' : ''}>3. 임시 비밀번호 확인</span>
              </div>

              {/* 1단계: 이메일 입력 */}
                    {forgotPasswordStep === 1 && (
                <>
                  <p className="auth__modal-desc">가입한 이메일 주소를 입력하시면 인증 코드를 보내드립니다.</p>
                  <div className="form-group">
                    <label className="form-label" htmlFor="forgot-email-input">이메일</label>
                    <input
                      id="forgot-email-input"
                      type="email"
                      className="form-input"
                      placeholder="example@email.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      autoFocus
                      autoComplete="email"
                    />
                  </div>
                  {error && (
                    <div className="auth__modal-error-inline">
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
                      disabled={!forgotEmail?.trim() || isLoading}
                      onClick={handleSendPasswordResetEmail}
                    >
                      {isLoading ? '전송 중...' : '인증 메일 보내기'}
                    </button>
                  </div>
                </>
              )}

              {/* 2단계: 인증 코드 입력 + 임시 비밀번호 발급 */}
              {forgotPasswordStep === 2 && (
                <>
                  <p className="auth__modal-desc">{forgotEmail}로 전송된 인증 코드를 입력해주세요.</p>
                  <div className="form-group">
                    <label className="form-label" htmlFor="forgot-code-input">인증 코드</label>
                    <input
                      id="forgot-code-input"
                      type="text"
                      className="form-input"
                      placeholder="6자리 코드"
                      value={forgotCode}
                      onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      autoFocus
                      autoComplete="one-time-code"
                    />
                  </div>
                  {error && (
                    <div className="auth__modal-error-inline">
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
                        setError('')
                      }}
                    >
                      이전
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={!forgotCode || forgotCode.length < 4 || isLoading}
                      onClick={handleIssueTemporaryPassword}
                    >
                      {isLoading ? '발급 중...' : '임시 비밀번호 받기'}
                    </button>
                  </div>
                </>
              )}

              {/* 3단계: 임시 비밀번호 안내 */}
              {forgotPasswordStep === 3 && (
                <>
                  <p className="auth__modal-desc">
                    아래 임시 비밀번호로 먼저 로그인한 뒤,<br />
                    <strong>설정 &gt; 보안 설정 &gt; 비밀번호 변경</strong>에서 새 비밀번호를 설정해주세요.
                  </p>
                  <div className="auth__temp-password-box">
                    <p className="auth__temp-password-label">임시 비밀번호</p>
                    <p className="auth__temp-password-value">
                      {temporaryPassword || '발급된 임시 비밀번호를 불러오지 못했습니다.'}
                    </p>
                  </div>
                  {error && (
                    <div className="auth__modal-error-inline">
                      <span>⚠️</span> {error}
                    </div>
                  )}
                  <div className="auth__modal-buttons">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => {
                        setShowForgotPassword(false)
                        setForgotPasswordStep(1)
                        setForgotEmail('')
                        setForgotCode('')
                        setTemporaryPassword('')
                        setForgotEmailSent(false)
                        setError('')
                      }}
                    >
                      닫기
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
