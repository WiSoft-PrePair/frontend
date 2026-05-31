import { useAppState } from '../../context/AppStateContext'
import RewardsServicePreparing from '../../components/RewardsServicePreparing'
import '../../styles/pages/Rewards.css'

export default function RewardShop() {
  const { user } = useAppState()

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

        <RewardsServicePreparing />
      </div>
    </div>
  )
}
