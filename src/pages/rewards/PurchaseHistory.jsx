import RewardsServicePreparing from '../../components/RewardsServicePreparing'
import '../../styles/pages/Rewards.css'

export default function PurchaseHistory() {
  return (
    <div className="rewards">
      <div className="rewards__container">
        <header className="rewards__header">
          <div>
            <h1>교환 내역</h1>
            <p>리워드 교환 기록을 확인하세요</p>
          </div>
        </header>

        <RewardsServicePreparing />
      </div>
    </div>
  )
}
