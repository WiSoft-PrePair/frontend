import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppState } from '../context/AppStateContext'
import { kakaoCallback } from '../utils/memberApi'

const KAKAO_PENDING_SIGNUP_KEY = 'kakao_pending_signup'

/**
 * 카카오 OAuth redirect_uri 로 들어오는 콜백 전용 라우트입니다.
 * code를 /auth 쿼리로 옮기지 않고, 여기서 즉시 callback API를 호출합니다.
 */
export default function KakaoCallbackRedirect() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setUserFromAuthResponse } = useAppState()

  useEffect(() => {
    const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
    const code = searchParams.get('code') || hashParams.get('code')
    const error = searchParams.get('error') || hashParams.get('error')
    const errorDescription =
      searchParams.get('error_description') || hashParams.get('error_description')

    if (error) {
      const params = new URLSearchParams()
      params.set('mode', 'login')
      params.set('oauthError', error)
      if (errorDescription) params.set('oauthErrorDescription', errorDescription)
      navigate(`/auth?${params.toString()}`, { replace: true })
      return
    }

    if (!code || !code.trim()) {
      navigate('/auth?mode=login', { replace: true })
      return
    }

    let cancelled = false
    kakaoCallback({ code: code.trim() })
      .then((response) => {
        if (cancelled) return
        const data = response?.data ?? response
        if (data?.isNewMember) {
          const pendingSignup = {
            registrationToken: data.registrationToken ?? null,
            prefilledData: data.prefilledData ?? {},
          }
          sessionStorage.setItem(KAKAO_PENDING_SIGNUP_KEY, JSON.stringify(pendingSignup))
          navigate('/auth?mode=signup', { replace: true })
          return
        }

        setUserFromAuthResponse(response)
        navigate('/mypage', { replace: true })
      })
      .catch((callbackError) => {
        if (cancelled) return
        const params = new URLSearchParams()
        params.set('mode', 'login')
        params.set('oauthError', 'kakao_callback_failed')
        if (callbackError?.message) {
          params.set('oauthErrorDescription', callbackError.message)
        }
        navigate(`/auth?${params.toString()}`, { replace: true })
      })

    return () => { cancelled = true }
  }, [navigate, searchParams, setUserFromAuthResponse])

  return null
}
