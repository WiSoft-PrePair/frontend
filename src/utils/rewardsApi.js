const API_BASE = '/api'

// 에러 처리 헬퍼
async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(errorData.message || '요청 처리 중 오류가 발생했습니다.')
    error.statusCode = response.status
    throw error
  }
  return response.json()
}

// 리워드 목록
export async function getRewards() {
  try {
    const response = await fetch(`${API_BASE}/rewards`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[rewardsApi] getRewards error:', error)
    throw error
  }
}

// 리워드 교환
export async function redeemReward(userId, rewardId) {
  try {
    const response = await fetch(`${API_BASE}/rewards/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
      body: JSON.stringify({ reward_id: rewardId }),
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[rewardsApi] redeemReward error:', error)
    throw error
  }
}

// 구매 내역
export async function getPurchaseHistory(userId) {
  try {
    const response = await fetch(`${API_BASE}/rewards/history`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
    })
    return handleResponse(response)
  } catch (error) {
    console.error('[rewardsApi] getPurchaseHistory error:', error)
    throw error
  }
}
