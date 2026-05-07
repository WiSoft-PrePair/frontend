/**
 * 카카오 OAuth redirect_uri를 현재 origin 기준으로 생성한다.
 *
 * - 인가(/api/auth/kakao/url) 호출 시 query로 전달하면 백엔드가 화이트리스트 검증 후
 *   해당 값을 카카오 인가 URL의 redirect_uri로 박아 반환한다.
 * - 콜백 후 토큰 교환(/api/auth/kakao/callback) 호출 시 body에 같은 값을 함께 보낸다.
 *   카카오는 인가/토큰 교환 단계의 redirect_uri 일치를 강제한다.
 *
 * 백엔드 화이트리스트(KAKAO_ALLOWED_REDIRECT_URIS)에 등록되지 않은 origin이면
 * 백엔드가 fallback(prod URL)으로 떨어뜨리므로, 미등록 환경의 OAuth는 기존처럼
 * prod 도메인으로 이탈한다 (안전한 디폴트).
 */
export function getKakaoRedirectUri() {
  return `${window.location.origin}/auth/kakao/callback`
}
