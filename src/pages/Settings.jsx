import { useState } from 'react'
import { motion as Motion } from 'framer-motion'
import { useAppState } from '../context/AppStateContext'
import Dropdown from '../components/Dropdown'
import ProUpgradeModal from '../components/ProUpgradeModal'
import '../styles/pages/Settings.css'
import '../styles/components/pro-upgrade.css'

export default function SettingsPage() {
  const { user, updateProfile, cadencePresets, deleteAccount, isPro, PRO_PLANS, proUsage, canUseMockInterview, canUseJobPost, upgradeToPro } = useAppState()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showProModal, setShowProModal] = useState(false)

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

  const handleSave = async () => {
    setIsSaving(true)
    setSaved(false)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))
      updateProfile({
        name: form.name,
        email: form.email,
        jobRole: form.jobRole,
        cadence: form.cadence,
        notificationKakao: form.notificationKakao,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="settings">
      <div className="settings__container">
        <header className="settings__header">
          <h1>설정</h1>
          <p>계정 정보와 알림 설정을 관리하세요</p>
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
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="example@email.com"
                />
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
