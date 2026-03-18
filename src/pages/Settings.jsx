import { useState, useEffect } from 'react'
import { motion as Motion } from 'framer-motion'
import { useAppState } from '../context/AppStateContext'
import Dropdown from '../components/Dropdown'
import ProUpgradeModal from '../components/ProUpgradeModal'
import '../styles/pages/Settings.css'
import '../styles/components/pro-upgrade.css'
import {
  getMe,
  updateMember,
  updatePassword,
  requestEmailChangeVerification,
  verifyEmailChange,
  updateEmail,
  kakaoLink,
} from '../utils/memberApi'

export default function SettingsPage() {
  const {
    user,
    updateProfile,
    cadencePresets,
    deleteAccount,
    isPro,
    PRO_PLANS,
    canUseMockInterview,
    canUseJobPost,
    upgradeToPro,
    getAccessToken,
    setUserFromAuthResponse,
  } = useAppState()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showProModal, setShowProModal] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)

  const handleDeleteAccount = () => {
    if (showDeleteConfirm) {
      deleteAccount()
    } else {
      setShowDeleteConfirm(true)
    }
  }

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    jobRole: user?.jobRole || '',
    cadence: user?.cadence || 'daily',
    notificationEmail: true,
    notificationKakao: user?.notificationKakao || false,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // 이메일 변경 상태
  const [emailChange, setEmailChange] = useState({
    email: '',
    code: '',
    sent: false,
    isSending: false,
    isVerifying: false,
    successMessage: '',
    errorMessage: '',
  })

  // 비밀번호 변경 상태
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    newPasswordConfirm: '',
  })
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' })

  // Settings 진입 시 서버의 최신 회원 정보를 한 번 동기화
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoadingProfile(true)
        const accessToken = getAccessToken?.()
        const me = await getMe(accessToken)
        // BE 래퍼: { statusCode, data, message } 형태를 가정
        // AppStateContext의 정규화 로직을 그대로 사용해 user 상태를 갱신
        setUserFromAuthResponse(me)
      } catch (error) {
        console.error('[Settings] getMe error:', error)
      } finally {
        setIsLoadingProfile(false)
      }
    }

    // 로그인 후라면 user가 이미 있을 수 있지만,
    // 새로고침 등으로 초기화된 경우를 대비해 한 번 호출
    if (!user) {
      fetchProfile()
    }
  }, [user, getAccessToken, setUserFromAuthResponse])

  // user 상태가 바뀌면 폼에 회원 정보 반영
  useEffect(() => {
    if (!user) return
    setForm((prev) => ({
      ...prev,
      name: user.name || '',
      email: user.email || '',
      jobRole: user.jobRole || '',
      cadence: user.cadence || 'daily',
      notificationKakao: user.notificationKakao || false,
    }))

    // 프로필 동기화 시 기본 이메일도 갱신
    setEmailChange((prev) => ({
      ...prev,
      email: '',
      code: '',
      sent: false,
      successMessage: '',
      errorMessage: '',
    }))
  }, [user])

  const handleSave = async () => {
    setIsSaving(true)
    setSaved(false)

    try {
      const accessToken = getAccessToken?.()

      if (!accessToken) {
        console.warn('[Settings] accessToken is missing. 회원정보 수정 API를 호출할 수 없습니다.')
      } else {
        const shouldLinkKakao =
          form.notificationKakao && !user?.notificationKakao

        // cadence(id: 'daily' | 'weekly') → frequency('every' | 'weekly') 매핑
        const cadenceId = form.cadence?.id ?? form.cadence
        const frequency = cadenceId === 'weekly' ? 'weekly' : 'every'

        // 알림 채널(email | kakao | BOTH)
        let notification = 'email'
        const emailOn = form.notificationEmail
        const kakaoOn = form.notificationKakao
        if (emailOn && kakaoOn) notification = 'BOTH'
        else if (!emailOn && kakaoOn) notification = 'kakao'
        else if (emailOn && !kakaoOn) notification = 'email'

        const payload = {
          nickname: form.name,
          job: form.jobRole,
          notification,
          frequency,
        }

        const updated = await updateMember(accessToken, payload)

        // 백엔드 응답을 AppStateContext 정규화 로직을 통해 반영
        setUserFromAuthResponse({ user: updated })

        // 로컬 폼 상태도 동기화
        updateProfile({
          name: updated.nickname ?? form.name,
          email: updated.email ?? form.email,
          jobRole: updated.job ?? form.jobRole,
          cadence: form.cadence,
          notificationKakao: updated.notificationKakao ?? form.notificationKakao,
        })

        // 카카오톡 알림을 새로 활성화한 경우, 카카오 링크 인증 플로우 시작
        if (shouldLinkKakao) {
          try {
            const response = await kakaoLink(accessToken, {})
            const url = response?.data?.url ?? response?.url
            if (url) {
              window.location.href = url
              return
            }
          } catch (error) {
            console.error('[Settings] kakaoLink error:', error)
          }
        }
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendEmailChangeCode = async () => {
    const trimmedEmail = emailChange.email.trim()
    if (!trimmedEmail) {
      setEmailChange((prev) => ({
        ...prev,
        errorMessage: '변경할 이메일을 입력해주세요.',
        successMessage: '',
      }))
      return
    }

    const accessToken = getAccessToken?.()
    if (!accessToken) {
      setEmailChange((prev) => ({
        ...prev,
        errorMessage: '로그인 정보가 없습니다. 다시 로그인 후 시도해주세요.',
        successMessage: '',
      }))
      return
    }

    setEmailChange((prev) => ({
      ...prev,
      isSending: true,
      errorMessage: '',
      successMessage: '',
    }))

    try {
      await requestEmailChangeVerification(accessToken, {
        email: trimmedEmail,
        purpose: 'CHANGE_EMAIL',
      })
      setEmailChange((prev) => ({
        ...prev,
        sent: true,
        successMessage: '인증 메일을 전송했습니다. 받은 편지함을 확인해주세요.',
      }))
    } catch (error) {
      setEmailChange((prev) => ({
        ...prev,
        errorMessage: error.message || '인증 메일 전송에 실패했습니다.',
        successMessage: '',
      }))
    } finally {
      setEmailChange((prev) => ({
        ...prev,
        isSending: false,
      }))
    }
  }

  const handleConfirmEmailChange = async () => {
    const trimmedEmail = emailChange.email.trim()
    const trimmedCode = emailChange.code.trim()

    if (!trimmedEmail || !trimmedCode) {
      setEmailChange((prev) => ({
        ...prev,
        errorMessage: '이메일과 인증 코드를 모두 입력해주세요.',
        successMessage: '',
      }))
      return
    }

    const accessToken = getAccessToken?.()
    if (!accessToken) {
      setEmailChange((prev) => ({
        ...prev,
        errorMessage: '로그인 정보가 없습니다. 다시 로그인 후 시도해주세요.',
        successMessage: '',
      }))
      return
    }

    setEmailChange((prev) => ({
      ...prev,
      isVerifying: true,
      errorMessage: '',
      successMessage: '',
    }))

    try {
      // 1) 코드 검증
      await verifyEmailChange(accessToken, {
        email: trimmedEmail,
        code: trimmedCode,
        purpose: 'CHANGE_EMAIL',
      })

      // 2) 이메일 실제 변경
      await updateEmail(accessToken, {
        newEmail: trimmedEmail,
      })

      setForm((prev) => ({
        ...prev,
        email: trimmedEmail,
      }))

      updateProfile({
        email: trimmedEmail,
      })

      setEmailChange({
        email: '',
        code: '',
        sent: false,
        isSending: false,
        isVerifying: false,
        successMessage: '이메일이 성공적으로 변경되었습니다.',
        errorMessage: '',
      })
    } catch (error) {
      setEmailChange((prev) => ({
        ...prev,
        errorMessage: error.message || '이메일 변경에 실패했습니다.',
        successMessage: '',
      }))
    } finally {
      setEmailChange((prev) => ({
        ...prev,
        isVerifying: false,
      }))
    }
  }

  const handleChangePassword = async () => {
    const { newPassword, newPasswordConfirm } = passwordForm

    if (!newPassword || !newPasswordConfirm) {
      setPasswordMessage({ type: 'error', text: '새 비밀번호와 확인 비밀번호를 입력해주세요.' })
      return
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: '새 비밀번호는 6자 이상이어야 합니다.' })
      return
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      setPasswordMessage({ type: 'error', text: '새 비밀번호에 특수문자를 포함해주세요.' })
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordMessage({ type: 'error', text: '새 비밀번호가 서로 일치하지 않습니다.' })
      return
    }

    setIsUpdatingPassword(true)
    setPasswordMessage({ type: '', text: '' })

    try {
      const accessToken = getAccessToken?.()
      if (!accessToken) {
        throw new Error('로그인 정보가 없습니다. 다시 로그인 후 시도해주세요.')
      }

      await updatePassword(accessToken, { newPassword })

      setPasswordForm({
        newPassword: '',
        newPasswordConfirm: '',
      })
      setPasswordMessage({
        type: 'success',
        text: '비밀번호가 성공적으로 변경되었습니다.',
      })
    } catch (error) {
      setPasswordMessage({
        type: 'error',
        text: error.message || '비밀번호 변경에 실패했습니다.',
      })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <div className="settings">
      <div className="settings__container">
        <header className="settings__header">
          <h1>설정</h1>
          <p>계정 정보와 알림 설정을 관리하세요</p>
          {isLoadingProfile && (
            <p className="settings__header-subtext">회원 정보를 불러오는 중입니다...</p>
          )}
        </header>

        <div className="settings__grid">
          {/* Profile Section */}
          <section className="settings__section card">
            <h2 className="settings__section-title">프로필 정보</h2>

            <div className="settings__form">
              <div className="form-group">
                <label className="form-label">이름</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">이메일</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.email}
                  disabled
                  placeholder="example@email.com"
                />
                <p className="form-helper">
                  이메일 변경은 아래 <strong>이메일 변경</strong> 섹션에서 진행할 수 있습니다.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">목표 직무</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.jobRole}
                  onChange={(e) => setForm((p) => ({ ...p, jobRole: e.target.value }))}
                  placeholder="예: 프론트엔드 개발자"
                />
              </div>
            </div>
          </section>

          {/* Notification Section */}
          <section className="settings__section card">
            <h2 className="settings__section-title">질문 & 알림 설정</h2>

            <div className="settings__form">
              <div className="form-group">
                <label className="form-label">질문 주기</label>
                <Dropdown
                  options={cadencePresets?.map((preset) => ({
                    value: preset.id,
                    label: preset.label,
                  })) || []}
                  value={form.cadence}
                  onChange={(value) => setForm((p) => ({ ...p, cadence: value }))}
                  placeholder="질문 주기 선택"
                />
              </div>

              <div className="form-group">
                <label className="form-label">알림 채널</label>

                <div className="settings__notification-options">
                  <label className="settings__notification-option">
                    <input
                      type="checkbox"
                      checked={form.notificationEmail}
                      onChange={(e) => setForm((p) => ({ ...p, notificationEmail: e.target.checked }))}
                    />
                    <div className="settings__notification-info">
                      <span className="settings__notification-icon">📧</span>
                      <div>
                        <strong>이메일</strong>
                        <p>기본 알림 (선택)</p>
                      </div>
                    </div>
                  </label>

                  <label className="settings__notification-option">
                    <input
                      type="checkbox"
                      checked={form.notificationKakao}
                      onChange={(e) => setForm((p) => ({ ...p, notificationKakao: e.target.checked }))}
                    />
                    <div className="settings__notification-info">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/e/e3/KakaoTalk_logo.svg" alt="카카오톡" className="settings__notification-icon" style={{ width: '28px', height: '28px' }} />
                      <div>
                        <strong>카카오톡</strong>
                        <p>추가 알림 (선택)</p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Security Section */}
          <section className="settings__section card">
            <h2 className="settings__section-title">보안 설정</h2>

            <div className="settings__form settings__form--security">
              {/* Email Change */}
              <div className="settings__security-block">
                <h3 className="settings__security-title">이메일 변경</h3>
                <p className="settings__security-description">
                  현재 이메일: <strong>{user?.email || '등록된 이메일 없음'}</strong>
                </p>

                <div className="form-group">
                  <label className="form-label">새 이메일</label>
                  <div className="settings__field-row">
                    <input
                      type="email"
                      className="form-input"
                      placeholder="새로운 이메일 주소를 입력하세요"
                      value={emailChange.email}
                      onChange={(e) =>
                        setEmailChange((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="btn btn--secondary settings__inline-btn"
                      onClick={handleSendEmailChangeCode}
                      disabled={emailChange.isSending || !emailChange.email.trim()}
                    >
                      {emailChange.isSending
                        ? '전송 중...'
                        : emailChange.sent
                        ? '재전송'
                        : '인증 메일 보내기'}
                    </button>
                  </div>
                  <p className="form-helper">
                    회원가입 때와 동일하게 이메일로 인증 코드를 보내드려요.
                  </p>
                </div>

                {emailChange.sent && (
                  <div className="form-group">
                    <label className="form-label">인증 코드</label>
                    <div className="settings__field-row">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="이메일로 받은 인증 코드 입력"
                        value={emailChange.code}
                        onChange={(e) =>
                          setEmailChange((prev) => ({
                            ...prev,
                            code: e.target.value.replace(/\s/g, ''),
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="btn btn--primary settings__inline-btn"
                        onClick={handleConfirmEmailChange}
                        disabled={emailChange.isVerifying || emailChange.code.trim().length === 0}
                      >
                        {emailChange.isVerifying ? '변경 중...' : '인증 후 변경'}
                      </button>
                    </div>
                  </div>
                )}

                {(emailChange.errorMessage || emailChange.successMessage) && (
                  <p
                    className={`settings__status ${
                      emailChange.errorMessage ? 'settings__status--error' : 'settings__status--success'
                    }`}
                  >
                    {emailChange.errorMessage || emailChange.successMessage}
                  </p>
                )}
              </div>

              {/* Password Change */}
              <div className="settings__security-block">
                <h3 className="settings__security-title">비밀번호 변경</h3>
                <p className="settings__security-description">
                  임시 비밀번호로 로그인하신 뒤, 여기에서 새 비밀번호를 설정해주세요.
                </p>

                <div className="settings__security-grid">
                  <div className="form-group">
                    <label className="form-label">새 비밀번호</label>
                    <input
                      type="password"
                      className="form-input"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          newPassword: e.target.value,
                        }))
                      }
                      placeholder="6자 이상, 특수문자 포함"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">새 비밀번호 확인</label>
                    <input
                      type="password"
                      className="form-input"
                      value={passwordForm.newPasswordConfirm}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          newPasswordConfirm: e.target.value,
                        }))
                      }
                      placeholder="새 비밀번호 다시 입력"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn--secondary settings__password-btn"
                  onClick={handleChangePassword}
                  disabled={isUpdatingPassword}
                >
                  {isUpdatingPassword ? '변경 중...' : '비밀번호 변경'}
                </button>

                {passwordMessage.text && (
                  <p
                    className={`settings__status ${
                      passwordMessage.type === 'error'
                        ? 'settings__status--error'
                        : 'settings__status--success'
                    }`}
                  >
                    {passwordMessage.text}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Stats Section */}
          <section className="settings__section settings__section--stats card">
            <h2 className="settings__section-title">내 현황</h2>

            <div className="settings__stats-grid">
              <div className="settings__stat-card settings__stat-card--points">
                <div className="settings__stat-header">
                  <div className="settings__stat-icon-wrapper settings__stat-icon-wrapper--points">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 6v12M6 12h12"/>
                    </svg>
                  </div>
                  <span className="settings__stat-label">보유 포인트</span>
                </div>
                <div className="settings__stat-value">
                  <strong>{user?.points?.toLocaleString() || 0}</strong>
                  <span className="settings__stat-unit">P</span>
                </div>
              </div>

              <div className="settings__stat-card settings__stat-card--streak">
                <div className="settings__stat-header">
                  <div className="settings__stat-icon-wrapper settings__stat-icon-wrapper--streak">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                    </svg>
                  </div>
                  <span className="settings__stat-label">연속 연습</span>
                </div>
                <div className="settings__stat-value">
                  <strong>{user?.streak || 0}</strong>
                  <span className="settings__stat-unit">일</span>
                </div>
              </div>
            </div>
          </section>

          {/* Subscription Section */}
          <section className="settings__section settings__section--subscription card">
            <h2 className="settings__section-title">구독 관리</h2>

            <div className="settings__subscription">
              <div className="settings__subscription-header">
                <div className="settings__subscription-plan">
                  <span className="settings__subscription-plan-name">
                    {isPro ? 'Pro' : 'Free'}
                  </span>
                  <span className={`settings__subscription-badge ${isPro ? 'settings__subscription-badge--pro' : ''}`}>
                    {isPro ? 'PRO' : '무료'}
                  </span>
                </div>
                {isPro && (
                  <span className="settings__subscription-price">
                    월 {PRO_PLANS.pro.price.toLocaleString()}원
                  </span>
                )}
              </div>

              {!isPro && (
                <div className="settings__subscription-usage">
                  <div className="settings__subscription-usage-item">
                    <div className="settings__subscription-usage-header">
                      <span className="settings__subscription-usage-label">모의 면접</span>
                      <span className="settings__subscription-usage-value">
                        {canUseMockInterview().remaining} / {PRO_PLANS.free.mockInterviewLimit}회
                      </span>
                    </div>
                    <div className="settings__subscription-usage-bar">
                      <div
                        className="settings__subscription-usage-bar-fill"
                        style={{
                          width: `${((PRO_PLANS.free.mockInterviewLimit - canUseMockInterview().remaining) / PRO_PLANS.free.mockInterviewLimit) * 100}%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="settings__subscription-usage-item">
                    <div className="settings__subscription-usage-header">
                      <span className="settings__subscription-usage-label">채용 공고 분석</span>
                      <span className="settings__subscription-usage-value">
                        {canUseJobPost().remaining} / {PRO_PLANS.free.jobPostLimit}회
                      </span>
                    </div>
                    <div className="settings__subscription-usage-bar">
                      <div
                        className="settings__subscription-usage-bar-fill"
                        style={{
                          width: `${((PRO_PLANS.free.jobPostLimit - canUseJobPost().remaining) / PRO_PLANS.free.jobPostLimit) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {isPro && (
                <div className="settings__subscription-features">
                  <span className="settings__subscription-feature">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    모의 면접 무제한
                  </span>
                  <span className="settings__subscription-feature">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    채용 공고 분석 무제한
                  </span>
                  <span className="settings__subscription-feature">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    상세 분석 리포트
                  </span>
                </div>
              )}

              <div className="settings__subscription-actions">
                {!isPro ? (
                  <button
                    className="btn btn--primary settings__subscription-btn"
                    onClick={() => setShowProModal(true)}
                  >
                    Pro로 업그레이드
                  </button>
                ) : (
                  <button className="btn btn--secondary settings__subscription-btn">
                    구독 관리
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="settings__actions">
            <button
              className="btn btn--primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? '저장 중...' : saved ? '저장 완료 ✓' : '변경사항 저장'}
            </button>
          </div>

          {/* Danger Zone */}
          <section className="settings__section settings__danger card">
            <h2 className="settings__section-title">계정 관리</h2>
            <div className="settings__danger-content">
              <div className="settings__danger-info">
                <p className="settings__danger-text">
                  {showDeleteConfirm
                    ? '정말 탈퇴하시겠습니까? 모든 데이터가 삭제되며 복구할 수 없습니다.'
                    : '회원 탈퇴 시 모든 데이터가 영구적으로 삭제됩니다.'}
                </p>
              </div>
              <div className="settings__danger-actions">
                {showDeleteConfirm && (
                  <button
                    className="btn btn--ghost"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    취소
                  </button>
                )}
                <button
                  className={`btn ${showDeleteConfirm ? 'btn--danger' : 'settings__btn-danger'}`}
                  onClick={handleDeleteAccount}
                >
                  {showDeleteConfirm ? '탈퇴 확인' : '회원 탈퇴'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Pro Upgrade Modal */}
      <ProUpgradeModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        feature="all"
      />
    </div>
  )
}
