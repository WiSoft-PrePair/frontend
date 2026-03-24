/**
 * Member(회원) 도메인 API 클라이언트
 *
 * 백엔드 Member 관련 엔드포인트를 한 곳에서 관리합니다.
 * - /api/members/* : 회원가입, 이메일 인증, 회원정보, 비밀번호, 탈퇴 등
 * - /api/auth/*    : 로그인, 로그아웃, JWT, OAuth(카카오) 등
 */

const API_BASE = '/api'

function pickApiErrorMessage(errorData) {
  if (!errorData || typeof errorData !== 'object') return null
  if (typeof errorData.message === 'string' && errorData.message) return errorData.message
  const nested = errorData.error
  if (nested && typeof nested === 'object' && typeof nested.message === 'string' && nested.message) {
    return nested.message
  }
  if (typeof nested === 'string' && nested) return nested
  return null
}

// 에러 처리 헬퍼
async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const msg = pickApiErrorMessage(errorData) || '요청 처리 중 오류가 발생했습니다.'
    const error = new Error(msg)
    error.statusCode = response.status
    error.isServerError = response.status >= 500
    throw error
  }
  return response.json()
}

function wrapNetworkError(error) {
  if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
    const networkError = new Error('네트워크 연결을 확인해주세요.')
    networkError.isNetworkError = true
    return networkError
  }
  return error
}

// ─── 이메일 인증 (회원가입 / 이메일 변경 / 비밀번호 찾기 공용) ───

/** 회원가입 이메일 인증 요청 | POST /api/members/email */
export async function requestSignupEmailVerification(payload) {
  try {
    const response = await fetch(`${API_BASE}/members/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] requestSignupEmailVerification error:', error)
    throw wrapNetworkError(error)
  }
}

/** 회원가입 이메일 인증 확인 | POST /api/members/email-verify */
export async function verifySignupEmail(payload) {
  try {
    const response = await fetch(`${API_BASE}/members/email-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] verifySignupEmail error:', error)
    throw wrapNetworkError(error)
  }
}

/** 회원가입 | POST /api/members/register */
export async function registerMember(payload) {
  try {
    const response = await fetch(`${API_BASE}/members/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] registerMember error:', error)
    throw wrapNetworkError(error)
  }
}

// ─── 인증 (Auth) ───

/** 로그인 | POST /api/auth/login */
export async function login(payload) {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] login error:', error)
    throw wrapNetworkError(error)
  }
}

/** 로그아웃 | POST /api/auth/logout */
export async function logout(options = {}) {
  try {
    const headers = { 'Content-Type': 'application/json' }

    const { accessToken, refreshToken, credentials } = options

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const fetchOptions = {
      method: 'POST',
      headers,
      // refreshToken 을 요구하는 BE 스펙을 지원
      ...(refreshToken && { body: JSON.stringify({ refreshToken }) }),
      ...(credentials !== undefined && { credentials }),
    }

    const response = await fetch(`${API_BASE}/auth/logout`, fetchOptions)

    // 일부 서버는 204 No Content 를 반환하므로 별도 처리
    if (response.status === 204) {
      return { success: true }
    }

    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] logout error:', error)
    throw wrapNetworkError(error)
  }
}

/** JWT로 회원 찾기 (현재 로그인 사용자) | GET /api/auth/me */
export async function getMe(accessToken) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers,
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] getMe error:', error)
    throw wrapNetworkError(error)
  }
}

/** JWT refresh 토큰 발급 | POST /api/auth/refresh */
export async function refreshToken(payload) {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] refreshToken error:', error)
    throw wrapNetworkError(error)
  }
}

/**
 * OAuth 카카오 로그인/회원가입 시작 (prompt-login)
 * 백엔드가 카카오 인증 URL을 생성해주면, 프론트는 해당 URL로만 리다이렉트합니다.
 * 명세: GET /api/auth/kakao/url?prompt=login
 */
export async function kakaoPromptLogin(prompt = 'login') {
  try {
    const params = new URLSearchParams()
    if (prompt) params.set('prompt', prompt)
    const url = `${API_BASE}/auth/kakao/url?${params.toString()}`
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] kakaoPromptLogin error:', error)
    throw wrapNetworkError(error)
  }
}

/**
 * OAuth 로그인 및 회원가입 (카카오 콜백) | POST /api/auth/kakao/callback
 * @param {{ code: string }} payload
 */
export async function kakaoCallback(payload) {
  try {
    const response = await fetch(`${API_BASE}/auth/kakao/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] kakaoCallback error:', error)
    throw wrapNetworkError(error)
  }
}

/**
 * OAuth 회원가입 (카카오) | POST /api/auth/kakao/register
 * Body: { registrationToken, job, notification, frequency } — 예: notification "kakao", frequency "every"|"weekly"
 */
export async function kakaoRegister(payload) {
  try {
    const response = await fetch(`${API_BASE}/auth/kakao/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] kakaoRegister error:', error)
    throw wrapNetworkError(error)
  }
}

/** 로그인한 상태에서 OAuth 회원가입 (카카오 링크) | POST /api/auth/kakao/link */
export async function kakaoLink(accessToken, payload) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const response = await fetch(`${API_BASE}/auth/kakao/link`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] kakaoLink error:', error)
    throw wrapNetworkError(error)
  }
}

// ─── 회원 정보 수정 ───

/** 회원정보수정 | PATCH /api/members */
export async function updateMember(accessToken, payload) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const response = await fetch(`${API_BASE}/members`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] updateMember error:', error)
    throw wrapNetworkError(error)
  }
}

/** 비밀번호수정 | PATCH /api/members/password */
export async function updatePassword(accessToken, payload) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const response = await fetch(`${API_BASE}/members/password`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] updatePassword error:', error)
    throw wrapNetworkError(error)
  }
}

// ─── 이메일 변경 플로우 ───

/** 이메일 변경시 이메일 인증 요청 | POST /api/members/email */
export async function requestEmailChangeVerification(accessToken, payload) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const response = await fetch(`${API_BASE}/members/email`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] requestEmailChangeVerification error:', error)
    throw wrapNetworkError(error)
  }
}

/** 이메일 변경시 검증 요청 | POST /api/members/email-verify */
export async function verifyEmailChange(accessToken, payload) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const response = await fetch(`${API_BASE}/members/email-verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] verifyEmailChange error:', error)
    throw wrapNetworkError(error)
  }
}

/** 이메일 변경 | PATCH /api/members/email */
export async function updateEmail(accessToken, payload) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const response = await fetch(`${API_BASE}/members/email`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] updateEmail error:', error)
    throw wrapNetworkError(error)
  }
}

// ─── 회원 탈퇴 ───

/** 회원탈퇴 | DELETE /api/members */
export async function deleteMember(accessToken) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const response = await fetch(`${API_BASE}/members`, {
      method: 'DELETE',
      headers,
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] deleteMember error:', error)
    throw wrapNetworkError(error)
  }
}

// ─── 회원 조회 ───

/** 이메일로 회원 찾기 | GET /api/members/?email=... */
export async function getMemberByEmail(email) {
  try {
    const url = `${API_BASE}/members/?email=${encodeURIComponent(email)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] getMemberByEmail error:', error)
    throw wrapNetworkError(error)
  }
}

/** 전체 회원 찾기 | GET /api/members/all?limit=...&offset=... */
export async function getAllMembers({ limit, offset } = {}) {
  try {
    const params = new URLSearchParams()
    if (limit != null) params.set('limit', String(limit))
    if (offset != null) params.set('offset', String(offset))
    const query = params.toString()
    const url = `${API_BASE}/members/all${query ? `?${query}` : ''}`
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] getAllMembers error:', error)
    throw wrapNetworkError(error)
  }
}

// ─── 비밀번호 찾기 플로우 ───

/**
 * 비밀번호 찾기 시 이메일 인증 코드 전송 | POST /api/members/email
 * @param {{ email: string }} payload - 가입 이메일
 * @returns {Promise<object>} - 발송 결과 (BE 스펙에 따라 purpose 등 추가 가능)
 */
export async function requestPasswordResetEmail(payload) {
  try {
    const body = { ...payload, purpose: 'PASSWORD_RESET' }
    const response = await fetch(`${API_BASE}/members/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] requestPasswordResetEmail error:', error)
    throw wrapNetworkError(error)
  }
}

/**
 * 비밀번호 재설정 | POST /api/members/password-reset
 * BE 스펙: email, verificationCode(4자 이상)
 * - 서버에서 임시 비밀번호를 생성해 응답으로 내려줍니다.
 * @param {{ email: string, code: string }} payload
 */
export async function resetPassword(payload) {
  try {
    const body = {
      email: payload.email,
      verificationCode: String(payload.code ?? ''),
    }
    const response = await fetch(`${API_BASE}/members/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] resetPassword error:', error)
    throw wrapNetworkError(error)
  }
}

// ─── 참고: BE 전용 (필요 시 FE에서 사용 가능) ───

/** 아이디로 회원 찾기 (BE에서만 사용) | GET /api/members/:id */
export async function getMemberById(accessToken, memberId) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const response = await fetch(`${API_BASE}/members/${memberId}`, {
      method: 'GET',
      headers,
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] getMemberById error:', error)
    throw wrapNetworkError(error)
  }
}

/** Score 변경 (BE에서만 사용) | PATCH /api/members/reward */
export async function updateMemberReward(accessToken, payload) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const response = await fetch(`${API_BASE}/members/reward`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[memberApi] updateMemberReward error:', error)
    throw wrapNetworkError(error)
  }
}
