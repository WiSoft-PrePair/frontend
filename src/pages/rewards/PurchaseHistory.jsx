import { Link } from 'react-router-dom'
import { useAppState } from '../../context/AppStateContext'
import '../../styles/pages/Rewards.css'

export default function PurchaseHistory() {
  const { purchases } = useAppState()

  return (
    <div className="rewards">
      <div className="rewards__container">
        <header className="rewards__header">
          <div>
            <h1>교환 내역</h1>
            <p>리워드 교환 기록을 확인하세요</p>
          </div>
        </header>

        {purchases && purchases.length > 0 ? (
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
            <Link to="/reward" className="btn btn--primary">
              리워드 상점 가기
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
