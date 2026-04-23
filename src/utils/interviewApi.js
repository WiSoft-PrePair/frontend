const API_BASE = '/api'

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
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(
      pickApiErrorMessage(errorData) || '요청 처리 중 오류가 발생했습니다.'
    )
    error.statusCode = response.status
    error.isServerError = response.status >= 500
    throw error
  }

  if (response.status === 204) return { success: true }

  const text = await response.text()
  if (!text.trim()) return { success: true }
  return JSON.parse(text)
}

function buildHeaders(accessToken, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
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
  const primaryResponse = await fetch(`${API_BASE}/interviews/me/video`, {
    method: 'POST',
    headers: buildHeaders(accessToken),
    body: JSON.stringify(payload),
  })

  if (primaryResponse.status === 404) {
    const fallbackResponse = await fetch(`${API_BASE}/interviews/questions/video`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify(payload),
    })
    return handleResponse(fallbackResponse)
  }

  return handleResponse(primaryResponse)
}

export async function getInterviewQuestions({ type, userId } = {}, accessToken) {
  const params = new URLSearchParams()
  if (type) params.set('type', type)
  const query = params.toString()

  const primaryResponse = await fetch(
    `${API_BASE}/interviews/me/questions${query ? `?${query}` : ''}`,
    {
      method: 'GET',
      headers: buildHeaders(accessToken, userId ? { 'X-User-Id': userId } : {}),
    }
  )

  if (primaryResponse.status === 404) {
    const fallbackResponse = await fetch(
      `${API_BASE}/interviews/questions${query ? `?${query}` : ''}`,
      {
        method: 'GET',
        headers: buildHeaders(accessToken, userId ? { 'X-User-Id': userId } : {}),
      }
    )
    return handleResponse(fallbackResponse)
  }

  return handleResponse(primaryResponse)
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

  const headers = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

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
  const response = await fetch(
    `${API_BASE}/interviews/questions/video-answers/${sessionId}/stream`,
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
