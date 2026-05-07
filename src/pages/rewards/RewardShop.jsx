import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion as Motion } from 'framer-motion'
import { useAppState } from '../../context/AppStateContext'
import * as rewardsApi from '../../utils/rewardsApi'
import '../../styles/pages/Rewards.css'

function normalizeRewardsPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.rewards)) return payload.rewards
  return []
}

function mapRewardFromApi(raw, index) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id ?? raw.reward_id ?? `reward-${index}`
  const name = raw.name ?? raw.title ?? ''
  const description = raw.description ?? raw.desc ?? ''
  const points = Number(raw.points ?? raw.point_cost ?? raw.cost ?? 0)
  const icon = raw.icon ?? raw.emoji ?? '🎁'
  const category = raw.category ?? raw.category_id ?? 'other'
  if (!name || Number.isNaN(points)) return null
  return { id: String(id), name, description, points, icon, category }
}

export default function RewardShop() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, purchases, redeemReward } = useAppState()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedReward, setSelectedReward] = useState(null)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [rewards, setRewards] = useState([])
  const [rewardsLoading, setRewardsLoading] = useState(true)
  const [rewardsError, setRewardsError] = useState(null)

  const activeTab = searchParams.get('tab') || 'shop'

  const handleTabChange = (tab) => {
    setSearchParams({ tab })
  }

  const loadRewards = useCallback(async () => {
    setRewardsLoading(true)
    setRewardsError(null)
    try {
      const payload = await rewardsApi.getRewards()
      const list = normalizeRewardsPayload(payload)
      setRewards(list.map(mapRewardFromApi).filter(Boolean))
    } catch (e) {
      console.error('[RewardShop] getRewards:', e)
      setRewardsError(e?.message || '리워드 목록을 불러오지 못했습니다.')
      setRewards([])
    } finally {
      setRewardsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRewards()
  }, [loadRewards])

  const categories = useMemo(() => {
    const tabs = [{ id: 'all', label: '전체' }]
    const seen = new Set()
    for (const r of rewards) {
      const c = r.category || 'other'
      if (!seen.has(c)) {
        seen.add(c)
        tabs.push({ id: c, label: c })
      }
    }
    return tabs
  }, [rewards])

  const filteredRewards = selectedCategory === 'all'
    ? rewards
    : rewards.filter((r) => r.category === selectedCategory)

  const handleRedeem = async (reward) => {
    if (!user || user.points < reward.points) return

    setIsRedeeming(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      const result = redeemReward(reward)
      if (result.success) {
        navigate('/reward/complete', { state: { reward } })
      } else {
        alert(result.reason || '교환에 실패했습니다.')
      }
    } finally {
      setIsRedeeming(false)
      setSelectedReward(null)
    }
  }

  return (
    <div className="rewards">
      <div className="rewards__container">
        <header className="rewards__header">
          <div>
            <h1>리워드</h1>
            <p>포인트로 다양한 혜택을 받아보세요</p>
          </div>
          <div className="rewards__points-badge">
            <span>💰</span>
            <strong>{user?.points?.toLocaleString() || 0}</strong>
            <span>포인트</span>
          </div>
        </header>

        {/* Tabs */}
        <div className="reward__tabs">
          <button
            className={`reward__tab ${activeTab === 'shop' ? 'reward__tab--active' : ''}`}
            onClick={() => handleTabChange('shop')}
          >
            상점
          </button>
          <button
            className={`reward__tab ${activeTab === 'history' ? 'reward__tab--active' : ''}`}
            onClick={() => handleTabChange('history')}
          >
            교환 내역
          </button>
        </div>

        {activeTab === 'shop' ? (
          <>
            {rewardsLoading ? (
              <div className="rewards__empty card">
                <p>리워드 목록을 불러오는 중…</p>
              </div>
            ) : rewardsError ? (
              <div className="rewards__empty card">
                <p>{rewardsError}</p>
                <button type="button" className="btn btn--primary" onClick={() => loadRewards()}>
                  다시 시도
                </button>
              </div>
            ) : (
              <>
                <div className="shop__categories">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      className={`chip ${selectedCategory === cat.id ? 'chip--active' : ''}`}
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {filteredRewards.length === 0 ? (
                  <div className="rewards__empty card">
                    <span className="rewards__empty-icon">🛒</span>
                    <h3>등록된 리워드가 없습니다</h3>
                    <p>잠시 후 다시 확인해 주세요.</p>
                  </div>
                ) : (
                  <div className="shop__grid">
                    {filteredRewards.map((reward, idx) => {
                      const canAfford = (user?.points || 0) >= reward.points
                      return (
                        <Motion.div
                          key={reward.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`shop__item card ${!canAfford ? 'shop__item--disabled' : ''}`}
                          onClick={() => canAfford && setSelectedReward(reward)}
                        >
                          <div className="shop__item-icon">{reward.icon}</div>
                          <div className="shop__item-info">
                            <h3>{reward.name}</h3>
                            <p>{reward.description}</p>
                            <div className="shop__item-points">
                              <span>💰</span>
                              <strong>{reward.points.toLocaleString()}</strong>
                            </div>
                          </div>
                          {!canAfford && (
                            <div className="shop__item-overlay">
                              포인트 부족
                            </div>
                          )}
                        </Motion.div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          /* History Tab */
          purchases && purchases.length > 0 ? (
            <div className="history__list">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="history__item card">
                  <div className="history__icon">{purchase.reward?.icon}</div>
                  <div className="history__info">
                    <strong>{purchase.reward?.name}</strong>
                    <p>{purchase.reward?.description}</p>
                    <span className="history__date">
                      {new Date(purchase.purchasedAt).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="history__points">
                    <span>-{purchase.reward?.points?.toLocaleString()}</span>
                    <span className="history__points-label">포인트</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rewards__empty card">
              <span className="rewards__empty-icon">🛒</span>
              <h3>교환 내역이 없습니다</h3>
              <p>포인트를 모아 리워드를 교환해보세요!</p>
              <button className="btn btn--primary" onClick={() => handleTabChange('shop')}>
                리워드 상점 가기
              </button>
            </div>
          )
        )}

        {/* Confirmation Modal */}
        {selectedReward && (
          <div className="shop__modal-overlay" onClick={() => setSelectedReward(null)}>
            <Motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="shop__modal card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shop__modal-icon">{selectedReward.icon}</div>
              <h3>{selectedReward.name}</h3>
              <p>{selectedReward.description}</p>
              <div className="shop__modal-points">
                💰 {selectedReward.points.toLocaleString()} 포인트
              </div>

              <div className="shop__modal-actions">
                <button
                  className="btn btn--ghost"
                  onClick={() => setSelectedReward(null)}
                  disabled={isRedeeming}
                >
                  취소
                </button>
                <button
                  className="btn btn--primary"
                  onClick={() => handleRedeem(selectedReward)}
                  disabled={isRedeeming}
                >
                  {isRedeeming ? '교환 중...' : '교환하기'}
                </button>
              </div>
            </Motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
