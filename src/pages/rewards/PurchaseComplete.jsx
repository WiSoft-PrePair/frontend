import { useLocation, Link } from 'react-router-dom'
import { motion as Motion } from 'framer-motion'
import '../../styles/pages/Rewards.css'

export default function PurchaseComplete() {
  const location = useLocation()
  const reward = location.state?.reward

  if (!reward) {
    return (
      <div className="rewards">
        <div className="rewards__container">
          <div className="purchase-complete card">
            <p>잘못된 접근입니다.</p>
            <Link to="/reward" className="btn btn--primary">
              상점으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rewards">
      <div className="rewards__container">
        <Motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="purchase-complete card"
        >
          <div className="purchase-complete__icon">🎉</div>
          <h1>교환 완료!</h1>
          <p className="purchase-complete__message">
            {reward.name}을(를) 성공적으로 교환했습니다.
          </p>

          <div className="purchase-complete__reward">
            <span className="purchase-complete__reward-icon">{reward.icon}</span>
            <div>
              <strong>{reward.name}</strong>
              <p>{reward.description}</p>
            </div>
          </div>

          <div className="purchase-complete__info">
            <p>📧 이메일로 쿠폰 코드가 발송됩니다.</p>
            <p>⏰ 발송까지 최대 24시간이 소요될 수 있습니다.</p>
          </div>

          <div className="purchase-complete__actions">
            <Link to="/reward" className="btn btn--ghost">
              더 둘러보기
            </Link>
            <Link to="/mypage" className="btn btn--primary">
              홈으로
            </Link>
          </div>
        </Motion.div>
      </div>
    </div>
  )
}
