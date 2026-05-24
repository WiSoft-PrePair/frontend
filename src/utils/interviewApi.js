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

/** 화상 면접 질문 생성. 응답의 질문 문자열은 `speechFromInterviewQuestion`(→ `textToSpeech`)로 음성화한다. */
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

function parseMaybeJson(value) {
  if (value == null) return null
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

function buildSseMessage(event, dataLines) {
  const rawData = dataLines.join('\n')
  if (!rawData) return null

  let parsedData = rawData
  try {
    parsedData = JSON.parse(rawData)
  } catch {
    // 문자열 그대로 유지
  }

  return { event, data: parsedData, rawData }
}

function emitSseEvent(state, onMessage) {
  if (!state.dataLines.length) return
  const message = buildSseMessage(state.event, state.dataLines)
  if (message) onMessage?.(message)
  state.event = 'message'
  state.dataLines = []
}

/** 빈 줄 없이 연속되는 `event:`/`data:` 도 처리하는 SSE 라인 파서 */
function feedSseLines(state, text, onMessage) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line) {
      emitSseEvent(state, onMessage)
      continue
    }
    if (line.startsWith(':')) continue

    if (line.startsWith('event:')) {
      emitSseEvent(state, onMessage)
      state.event = line.slice(6).trim().replace(/^\uFEFF/, '') || 'message'
      continue
    }

    if (line.startsWith('data:')) {
      state.dataLines.push(line.slice(5).trimStart().replace(/^\uFEFF/, ''))
      continue
    }

    if (!line.startsWith('id:') && !line.startsWith('retry:')) {
      state.dataLines.push(line)
    }
  }
}

function parseSseEventBlock(block) {
  const state = { event: 'message', dataLines: [] }
  feedSseLines(state, block, () => {})
  emitSseEvent(state, () => {})
  return buildSseMessage(state.event, state.dataLines)
}

export function unwrapVideoResultPayload(raw) {
  const parsed = parseMaybeJson(raw) ?? (typeof raw === 'object' && raw ? raw : null)
  if (!parsed || typeof parsed !== 'object') return null

  const candidates = [parsed, parsed.data, parsed.result, parsed.payload, parsed.body]

  for (const candidate of candidates) {
    const node = parseMaybeJson(candidate) ?? candidate
    if (!node || typeof node !== 'object') continue

    const questionList =
      (Array.isArray(node.questions) && node.questions) ||
      (Array.isArray(node.questionResults) && node.questionResults) ||
      (Array.isArray(node.items) && node.items) ||
      null

    if (questionList?.length) {
      return { ...node, questions: questionList }
    }

    if (
      node.sessionId != null ||
      node.summary != null ||
      node.finalScore != null ||
      node.overallScore != null
    ) {
      return node
    }
  }

  return null
}

function isFinalCompleteSseEvent(event) {
  if (!event) return false
  const normalized = String(event).trim().toLowerCase().replace(/_/g, '-')
  return (
    normalized === 'final-complete' ||
    normalized === 'finalcomplete' ||
    normalized === 'complete' ||
    normalized === 'done' ||
    normalized === 'finished'
  )
}

/** SSE 메시지에서 화상 면접 최종 결과 추출 */
export function extractVideoInterviewResultFromMessage({ event, data, rawData }) {
  const payload =
    unwrapVideoResultPayload(data) ??
    unwrapVideoResultPayload(rawData) ??
    unwrapVideoResultPayload(parseMaybeJson(rawData))

  if (!payload) return null

  const eventType =
    payload.type ?? payload.event ?? payload.status ?? payload.phase ?? null
  const eventLooksFinal =
    isFinalCompleteSseEvent(event) ||
    isFinalCompleteSseEvent(eventType) ||
    String(eventType ?? '')
      .toLowerCase()
      .includes('final')

  const questions = payload.questions
  if (Array.isArray(questions) && questions.length > 0) return payload
  if (eventLooksFinal) return payload

  return null
}

export function isCompleteVideoInterviewResult(payload) {
  const unwrapped = unwrapVideoResultPayload(payload)
  if (!unwrapped) return false
  const questions = unwrapped.questions
  return Array.isArray(questions) && questions.length > 0
}

const VIDEO_STREAM_ENDPOINTS = (sessionId) => [
  `/interviews/questions/video-answers/${sessionId}/stream`,
  `/interviews/video-answers/${sessionId}/stream`,
  `/interviews/me/video-answers/${sessionId}/stream`,
]

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('스트림 요청이 취소되었습니다.'), { name: 'AbortError' }))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(Object.assign(new Error('스트림 요청이 취소되었습니다.'), { name: 'AbortError' }))
      },
      { once: true }
    )
  })
}

async function fetchVideoInterviewStreamResponse(sessionId, { accessToken, signal } = {}) {
  return fetchWithEndpointFallback(VIDEO_STREAM_ENDPOINTS(sessionId), {
    method: 'GET',
    headers: buildHeaders(accessToken, {
      Accept: 'text/event-stream, application/json',
    }),
    signal,
  })
}

async function consumeVideoInterviewStreamBody(response, onMessage) {
  const contentType = (response.headers.get('content-type') || '').toLowerCase()

  if (contentType.includes('application/json')) {
    const text = await response.text()
    const json = parseMaybeJson(text)
    if (json) {
      onMessage?.({ event: 'message', data: json, rawData: text })
    }
    return text
  }

  if (!response.body) {
    const text = await response.text()
    if (text.trim()) {
      const json = parseMaybeJson(text)
      if (json) {
        onMessage?.({ event: 'message', data: json, rawData: text })
      } else {
        const state = { event: 'message', dataLines: [] }
        feedSseLines(state, text, onMessage)
        emitSseEvent(state, onMessage)
      }
    }
    return text
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let fullText = ''
  const state = { event: 'message', dataLines: [] }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      fullText += chunk
      buffer += chunk
      buffer = buffer.replace(/\r\n/g, '\n')

      let newlineIndex = buffer.indexOf('\n')
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex)
        buffer = buffer.slice(newlineIndex + 1)
        feedSseLines(state, `${line}\n`, onMessage)
        newlineIndex = buffer.indexOf('\n')
      }
    }

    if (buffer.trim()) {
      feedSseLines(state, `${buffer}\n`, onMessage)
    }
    emitSseEvent(state, onMessage)

    const trimmed = fullText.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const json = parseMaybeJson(trimmed)
      if (json) onMessage?.({ event: 'message', data: json, rawData: trimmed })
    }

    return fullText
  } finally {
    reader.releaseLock()
  }
}

async function streamVideoInterviewResultOnce(
  sessionId,
  { accessToken, signal, onOpen, onMessage, onError } = {}
) {
  const response = await fetchVideoInterviewStreamResponse(sessionId, { accessToken, signal })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(
      pickApiErrorMessage(errorData) || 'SSE 연결 중 오류가 발생했습니다.'
    )
    error.statusCode = response.status
    throw error
  }

  onOpen?.()

  try {
    const rawTail = await consumeVideoInterviewStreamBody(response, onMessage)
    return { rawTail, contentType: response.headers.get('content-type') || '' }
  } catch (error) {
    if (error.name === 'AbortError') {
      const abortError = new Error('스트림 요청이 취소되었습니다.')
      abortError.name = 'AbortError'
      throw abortError
    }
    onError?.(error)
    throw error
  }
}

export async function streamVideoInterviewResult(
  sessionId,
  {
    accessToken,
    signal,
    onOpen,
    onMessage,
    onError,
    onDone,
    pollIntervalMs = 2500,
    maxWaitMs = 180000,
  } = {}
) {
  const deadline = Date.now() + maxWaitMs
  let attempt = 0
  let lastPayload = null

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      const abortError = new Error('스트림 요청이 취소되었습니다.')
      abortError.name = 'AbortError'
      throw abortError
    }

    attempt += 1
    let attemptPayload = null

    await streamVideoInterviewResultOnce(sessionId, {
      accessToken,
      signal,
      onOpen: attempt === 1 ? onOpen : undefined,
      onError,
      onMessage: (message) => {
        onMessage?.(message)
        const extracted = extractVideoInterviewResultFromMessage(message)
        if (extracted) {
          attemptPayload = extracted
          lastPayload = extracted
        }
      },
    })

    if (isCompleteVideoInterviewResult(attemptPayload ?? lastPayload)) {
      onDone?.(lastPayload)
      return lastPayload
    }

    if (Date.now() + pollIntervalMs >= deadline) break
    await sleep(pollIntervalMs, signal)
  }

  if (lastPayload) {
    onDone?.(lastPayload)
    return lastPayload
  }

  return null
}
