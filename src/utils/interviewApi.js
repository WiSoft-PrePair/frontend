const API_BASE = '/api'
const interviewQuestionsInFlight = new Map()

async function fetchWithEndpointFallback(
  endpointCandidates,
  { method = 'GET', headers, body, signal } = {}
) {
  let lastResponse = null
  let lastError = null

  for (const endpoint of endpointCandidates) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers,
        body,
        signal,
      })

      if (response.ok) return response

      lastResponse = response
      if (![404, 405, 500, 502, 503].includes(response.status)) {
        return response
      }
    } catch (error) {
      lastError = error
    }
  }

  if (lastResponse) return lastResponse
  if (lastError) throw lastError
  throw new Error('요청을 처리할 수 없습니다.')
}

function requireAccessToken(accessToken) {
  if (!accessToken) {
    const error = new Error('인증 토큰이 필요합니다. 다시 로그인해주세요.')
    error.statusCode = 401
    throw error
  }
  return accessToken
}

function pickApiErrorMessage(errorData) {
  if (!errorData || typeof errorData !== 'object') return null
  if (typeof errorData.message === 'string' && errorData.message) return errorData.message
  if (typeof errorData.error === 'string' && errorData.error) return errorData.error
  if (
    errorData.error &&
    typeof errorData.error === 'object' &&
    typeof errorData.error.message === 'string' &&
    errorData.error.message
  ) {
    return errorData.error.message
  }
  return null
}

async function handleResponse(response) {
  if (!response.ok) {
    const rawText = await response.text()
    let errorData = {}
    try {
      errorData = rawText ? JSON.parse(rawText) : {}
    } catch {
      errorData = {}
    }
    const fallbackMessage = typeof rawText === 'string' && rawText.trim()
      ? rawText.trim().slice(0, 300)
      : '요청 처리 중 오류가 발생했습니다.'
    const error = new Error(
      pickApiErrorMessage(errorData) || fallbackMessage
    )
    error.statusCode = response.status
    error.isServerError = response.status >= 500
    error.details = errorData
    throw error
  }

  if (response.status === 204) return { success: true }

  const text = await response.text()
  if (!text.trim()) return { success: true }
  return JSON.parse(text)
}

function buildHeaders(accessToken, extraHeaders = {}) {
  const resolvedAccessToken = requireAccessToken(accessToken)
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  }
  headers.Authorization = `Bearer ${resolvedAccessToken}`
  return headers
}

export async function createCompanyInterviewQuestion(payload, accessToken) {
  const response = await fetch(`${API_BASE}/interviews/questions/company`, {
    method: 'POST',
    headers: buildHeaders(accessToken),
    body: JSON.stringify(payload),
  })
  return handleResponse(response)
}

export async function createVideoInterviewQuestion(payload, accessToken) {
  const response = await fetchWithEndpointFallback(
    [
      '/interviews/questions/video',
      '/interviews/me/video',
      '/interviews/video',
      '/interviews/me/questions/video',
    ],
    {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify(payload),
    }
  )
  return handleResponse(response)
}

export async function getInterviewQuestions({ type, userId } = {}, accessToken) {
  const requestKey = JSON.stringify({
    type: type ?? null,
    userId: userId ?? null,
    hasToken: Boolean(accessToken),
  })

  const existingRequest = interviewQuestionsInFlight.get(requestKey)
  if (existingRequest) return existingRequest

  const requestPromise = (async () => {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    const query = params.toString()
    const headers = buildHeaders(accessToken, userId ? { 'X-User-Id': userId } : {})

    const typedQuestionsUrl = `${API_BASE}/interviews/questions${query ? `?${query}` : ''}`
    const meTypedQuestionsUrl = `${API_BASE}/interviews/me/questions${query ? `?${query}` : ''}`
    const rawQuestionsUrl = `${API_BASE}/interviews/questions`

    let lastError = null

    // 현재 백엔드에서 가장 안정적인 경로를 우선 사용한다.
    const primaryResponse = await fetch(typedQuestionsUrl, {
      method: 'GET',
      headers,
    })

    if (primaryResponse.ok) {
      return handleResponse(primaryResponse)
    }
    lastError = await primaryResponse.json().catch(() => ({}))

    // 타입 값 미지원(400)일 때만 타입 없는 경로로 한번 재시도한다.
    if (primaryResponse.status === 400 && type) {
      const rawResponse = await fetch(rawQuestionsUrl, {
        method: 'GET',
        headers,
      })
      if (rawResponse.ok) {
        return handleResponse(rawResponse)
      }
      lastError = await rawResponse.json().catch(() => ({}))
    }

    // 엔드포인트 차이(404) 상황에서만 /me 변형으로 폴백한다.
    if (primaryResponse.status === 404) {
      const meResponse = await fetch(meTypedQuestionsUrl, {
        method: 'GET',
        headers,
      })
      if (meResponse.ok) {
        return handleResponse(meResponse)
      }
      lastError = await meResponse.json().catch(() => ({}))
    }

    if (lastError instanceof Error) throw lastError
    const error = new Error(pickApiErrorMessage(lastError) || '면접 질문 조회에 실패했습니다.')
    error.statusCode = 500
    throw error
  })()

  interviewQuestionsInFlight.set(requestKey, requestPromise)
  try {
    return await requestPromise
  } finally {
    interviewQuestionsInFlight.delete(requestKey)
  }
}

export async function getInterviewQuestionDetail(questionId, accessToken) {
  const response = await fetch(`${API_BASE}/interviews/questions/${questionId}`, {
    method: 'GET',
    headers: buildHeaders(accessToken),
  })
  return handleResponse(response)
}

export async function submitTextInterviewAnswer(questionId, payload, accessToken) {
  const response = await fetch(`${API_BASE}/interviews/questions/${questionId}/answers`, {
    method: 'POST',
    headers: buildHeaders(accessToken),
    body: JSON.stringify(payload),
  })
  return handleResponse(response)
}

export async function submitVideoInterviewAnswer(questionId, payload, accessToken) {
  const formData = new FormData()
  if (payload?.video) {
    formData.append('video', payload.video)
  }

  const headers = {
    Authorization: `Bearer ${requireAccessToken(accessToken)}`,
  }

  const response = await fetch(
    `${API_BASE}/interviews/questions/${questionId}/video-answers`,
    {
      method: 'POST',
      headers,
      body: formData,
    }
  )
  return handleResponse(response)
}

function parseSseEventBlock(block) {
  const lines = block.split('\n')
  let event = 'message'
  const dataLines = []

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      event = line.slice(6).trim() || 'message'
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
      continue
    }
    if (!line.startsWith('id:') && !line.startsWith('retry:')) {
      dataLines.push(line)
    }
  }

  const rawData = dataLines.join('\n')
  if (!rawData) return null

  let parsedData = rawData
  try {
    parsedData = JSON.parse(rawData)
  } catch {
    // JSON이 아닐 수 있으므로 문자열 유지
  }

  return { event, data: parsedData, rawData }
}

export async function streamVideoInterviewResult(
  sessionId,
  { accessToken, signal, onOpen, onMessage, onError, onDone } = {}
) {
  const response = await fetchWithEndpointFallback(
    [
      `/interviews/questions/video-answers/${sessionId}/stream`,
      `/interviews/video-answers/${sessionId}/stream`,
      `/interviews/me/video-answers/${sessionId}/stream`,
    ],
    {
      method: 'GET',
      headers: buildHeaders(accessToken, { Accept: 'text/event-stream' }),
      signal,
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(
      pickApiErrorMessage(errorData) || 'SSE 연결 중 오류가 발생했습니다.'
    )
    error.statusCode = response.status
    throw error
  }

  if (!response.body) {
    throw new Error('SSE 응답 스트림을 사용할 수 없습니다.')
  }

  onOpen?.()

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''

      for (const block of blocks) {
        const parsed = parseSseEventBlock(block)
        if (!parsed) continue
        onMessage?.(parsed)
      }
    }

    if (buffer.trim()) {
      const parsed = parseSseEventBlock(buffer)
      if (parsed) onMessage?.(parsed)
    }
    onDone?.()
  } catch (error) {
    if (error.name === 'AbortError') return
    onError?.(error)
    throw error
  } finally {
    reader.releaseLock()
  }
}
