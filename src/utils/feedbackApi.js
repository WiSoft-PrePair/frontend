const API_BASE = '/api'

// 에러 처리 헬퍼
async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(errorData.message || '요청 처리 중 오류가 발생했습니다.')
    error.statusCode = response.status
    error.isServerError = response.status >= 500
    throw error
  }
  return response.json()
}

// 오늘의 질문 가져오기
export async function getTodayQuestion(userId) {
  try {
    const response = await fetch(`${API_BASE}/interview/today`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[feedbackApi] getTodayQuestion error:', error)
    throw error
  }
}

// 피드백 생성
export async function generateFeedback(historyId, payload) {
  try {
    const response = await fetch(`${API_BASE}/interview/${historyId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[feedbackApi] generateFeedback error:', error)
    throw error
  }
}

// 면접 히스토리 목록
export async function getInterviewHistories(userId) {
  try {
    const response = await fetch(`${API_BASE}/interview/histories`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[feedbackApi] getInterviewHistories error:', error)
    throw error
  }
}

// 면접 히스토리 상세
export async function getInterviewHistoryDetail(userId, historyId) {
  try {
    const response = await fetch(`${API_BASE}/interview/histories/${historyId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[feedbackApi] getInterviewHistoryDetail error:', error)
    throw error
  }
}

// 요약 피드백
export async function getSummaryFeedback(userId) {
  try {
    const response = await fetch(`${API_BASE}/interview/summary`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[feedbackApi] getSummaryFeedback error:', error)
    throw error
  }
}

// AI 추천 답변
export async function getSuggestedAnswer(payload) {
  try {
    const response = await fetch(`${API_BASE}/interview/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[feedbackApi] getSuggestedAnswer error:', error)
    throw error
  }
}
