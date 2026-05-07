import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppState } from '../context/AppStateContext'
import { kakaoCallback } from '../utils/memberApi'
import {
  KAKAO_OAUTH_INTENT_KEY,
  KAKAO_PENDING_SIGNUP_KEY,
  KAKAO_PROCESSED_OAUTH_CODE_KEY,
} from '../constants/kakaoAuthSession'
import { getKakaoRedirectUri } from '../utils/kakaoRedirectUri'

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

    const normalizedCode = code?.trim()
    if (!normalizedCode) {
      navigate('/auth?mode=login', { replace: true })
      return
    }

    const intent = sessionStorage.getItem(KAKAO_OAUTH_INTENT_KEY) || 'login'
    const processedCode = sessionStorage.getItem(KAKAO_PROCESSED_OAUTH_CODE_KEY)
    if (processedCode === normalizedCode) return
    sessionStorage.setItem(KAKAO_PROCESSED_OAUTH_CODE_KEY, normalizedCode)

    kakaoCallback({ code: normalizedCode, redirectUri: getKakaoRedirectUri() })
      .then((response) => {
        const data = response?.data ?? response

        if (data?.isNewMember) {
          if (intent === 'login') {
            sessionStorage.removeItem(KAKAO_OAUTH_INTENT_KEY)
            navigate('/auth?mode=login&kakaoError=not_member', { replace: true })
            return
          }
          sessionStorage.removeItem(KAKAO_OAUTH_INTENT_KEY)
          const pendingSignup = {
            registrationToken: data.registrationToken ?? null,
            prefilledData: data.prefilledData ?? {},
          }
          sessionStorage.setItem(KAKAO_PENDING_SIGNUP_KEY, JSON.stringify(pendingSignup))
          navigate('/auth?mode=signup', { replace: true })
          return
        }

        sessionStorage.removeItem(KAKAO_OAUTH_INTENT_KEY)

        if (intent === 'signup') {
          navigate('/auth?mode=signup&kakaoError=already_member', { replace: true })
          return
        }

        const accessToken = data?.accessToken ?? response?.data?.accessToken
        if (accessToken) {
          setUserFromAuthResponse(response)
          navigate('/mypage', { replace: true })
          return
        }

        navigate('/auth?mode=login&kakaoError=no_token', { replace: true })
      })
      .catch((callbackError) => {
        sessionStorage.removeItem(KAKAO_PROCESSED_OAUTH_CODE_KEY)
        sessionStorage.removeItem(KAKAO_OAUTH_INTENT_KEY)
        const params = new URLSearchParams()
        params.set('mode', 'login')
        params.set('oauthError', 'kakao_callback_failed')
        if (callbackError?.message) {
          params.set('oauthErrorDescription', callbackError.message)
        }
        navigate(`/auth?${params.toString()}`, { replace: true })
      })

  }, [navigate, searchParams, setUserFromAuthResponse])

  return null
}
