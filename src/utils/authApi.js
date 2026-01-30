const API_BASE = '/api'

const TEST_EMAILS = ['test/test', 'admin/admin', 'demo/demo']

// 테스트용 이메일 확인 함수
function isTestEmail(email) {
  if (!email) return false
  const normalized = email.toLowerCase().trim()
  return TEST_EMAILS.some(testEmail => testEmail.toLowerCase() === normalized)
}

// 모의 지연 (실제 API 호출처럼 느끼게)
function mockDelay(ms = 500) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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

// 아이디 찾기 (이메일로 회원 확인)
export async function findIdByEmail(email) {
  // 테스트용 이메일인 경우 모의 응답 반환
  if (isTestEmail(email)) {
    await mockDelay(800)
    return { exists: true, email }
  }

  try {
    const response = await fetch(`${API_BASE}/members/?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return handleResponse(response)
  } catch (error) {
    // 네트워크 에러인 경우 테스트용 이메일이면 모의 응답 반환
    if (error.isNetworkError && isTestEmail(email)) {
      return { exists: true, email }
    }
    throw wrapNetworkError(error)
  }
}

// 비밀번호 재설정 이메일 발송
export async function sendPasswordResetEmail(email) {
  // 테스트용 이메일인 경우 모의 응답 반환
  if (isTestEmail(email)) {
    await mockDelay(1000)
    return { 
      success: true, 
      message: '인증 코드가 이메일로 전송되었습니다. (테스트 모드)',
      // 테스트용: 인증 코드를 콘솔에 출력
      testCode: '123456'
    }
  }

  try {
    const response = await fetch(`${API_BASE}/members/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    return handleResponse(response)
  } catch (error) {
    // 네트워크 에러인 경우 테스트용 이메일이면 모의 응답 반환
    if (error.isNetworkError && isTestEmail(email)) {
      const testCode = '123456'
      console.log(`[테스트 모드] 인증 코드: ${testCode}`)
      return { 
        success: true, 
        message: '인증 코드가 이메일로 전송되었습니다. (테스트 모드)',
        testCode
      }
    }
    throw wrapNetworkError(error)
  }
}

// 비밀번호 재설정 (인증 코드 + 새 비밀번호)
export async function resetPassword(email, code, newPassword) {
  // 테스트용 이메일인 경우 모의 응답 반환
  if (isTestEmail(email)) {
    await mockDelay(1000)
    // 테스트용 인증 코드는 '123456' 또는 '000000'
    if (code === '123456' || code === '000000') {
      return { 
        success: true, 
        message: '비밀번호가 성공적으로 재설정되었습니다. (테스트 모드)'
      }
    } else {
      throw new Error('인증 코드가 올바르지 않습니다. (테스트 모드: 123456 또는 000000 사용)')
    }
  }

  try {
    const response = await fetch(`${API_BASE}/members/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, new_password: newPassword }),
    })
    return handleResponse(response)
  } catch (error) {
    // 네트워크 에러인 경우 테스트용 이메일이면 모의 응답 반환
    if (error.isNetworkError && isTestEmail(email)) {
      if (code === '123456' || code === '000000') {
        return { 
          success: true, 
          message: '비밀번호가 성공적으로 재설정되었습니다. (테스트 모드)'
        }
      } else {
        throw new Error('인증 코드가 올바르지 않습니다. (테스트 모드: 123456 또는 000000 사용)')
      }
    }
    throw wrapNetworkError(error)
  }
}