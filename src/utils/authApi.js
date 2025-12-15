const API_BASE = '/api'

// 에러 처리 헬퍼
async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(errorData.message || '요청 처리 중 오류가 발생했습니다.')
    error.statusCode = response.status
    error.isServerError = response.status >= 500
    error.isNetworkError = false
    throw error
  }
  return response.json()
}

// 네트워크 에러 래핑
function wrapNetworkError(error) {
  if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
    const networkError = new Error('네트워크 연결을 확인해주세요.')
    networkError.isNetworkError = true
    return networkError
  }
  return error
}

// 로그인
export async function loginApi({ email, password }) {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    return handleResponse(response)
  } catch (error) {
    throw wrapNetworkError(error)
  }
}

// 회원가입
export async function signupApi({ name, email, password, jobRole, cadence, notificationKakao }) {
  try {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        job_role: jobRole,
        cadence,
        notification_kakao: notificationKakao,
      }),
    })
    return handleResponse(response)
  } catch (error) {
    throw wrapNetworkError(error)
  }
}

// 비밀번호 찾기
export async function findPassword(email) {
  try {
    const response = await fetch(`${API_BASE}/auth/password/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    return handleResponse(response)
  } catch (error) {
    throw wrapNetworkError(error)
  }
}

// 사용자 요약 정보
export async function getUserSummary(userId) {
  try {
    const response = await fetch(`${API_BASE}/users/${userId}/summary`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
    })
    return handleResponse(response)
  } catch (error) {
    throw wrapNetworkError(error)
  }
}

// 프로필 업데이트
export async function updateProfileApi(userId, updates) {
  try {
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
      body: JSON.stringify(updates),
    })
    return handleResponse(response)
  } catch (error) {
    throw wrapNetworkError(error)
  }
}
