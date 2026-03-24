import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * 카카오 OAuth redirect_uri 로 들어오는 콜백 전용 라우트입니다.
 * 배포 환경에서 /auth/kakao/callback 경로가 index.html 로 서빙되더라도
 * 라우팅/전환 라이브러리 영향으로 '*' 라우트로 튕기는 케이스를 줄이기 위해,
 * 들어오는 즉시 /auth 로 code 를 옮겨 태웁니다.
 */
export default function KakaoCallbackRedirect() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
    const code = searchParams.get('code') || hashParams.get('code')
    const error = searchParams.get('error') || hashParams.get('error')
    const errorDescription =
      searchParams.get('error_description') || hashParams.get('error_description')

    if (error) {
      // 카카오가 error를 내려주는 케이스도 /auth에서 통일 처리
      const params = new URLSearchParams()
      params.set('mode', 'login')
      params.set('oauthError', error)
      if (errorDescription) params.set('oauthErrorDescription', errorDescription)
      navigate(`/auth?${params.toString()}`, { replace: true })
      return
    }

    if (code && code.trim()) {
      const params = new URLSearchParams()
      params.set('mode', 'signup')
      params.set('code', code.trim())
      // 카카오가 내려준 state — 백엔드가 authorize 시 세션/CSRF에 쓴 경우 콜백 POST에 그대로 넘겨야 함
      const state = searchParams.get('state') || hashParams.get('state')
      if (state) params.set('state', state)
      navigate(`/auth?${params.toString()}`, { replace: true })
      return
    }

    navigate('/auth?mode=login', { replace: true })
  }, [navigate, searchParams])

  // 화면이 잠깐 보일 수 있으니 최소한의 fallback 렌더
  return null
}

