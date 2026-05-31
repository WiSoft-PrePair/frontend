import { Link } from 'react-router-dom'
import '../styles/pages/Rewards.css'

export default function RewardsServicePreparing({ showBackLink = true }) {
  return (
    <div className="rewards__empty card rewards__service-preparing">
      <span className="rewards__empty-icon">🎁</span>
      <h3>서비스 준비중</h3>
      <p>리워드 서비스를 준비하고 있습니다. 조금만 기다려 주세요.</p>
      {showBackLink && (
        <Link to="/mypage" className="btn btn--primary">
          마이페이지로 돌아가기
        </Link>
      )}
    </div>
  )
}
