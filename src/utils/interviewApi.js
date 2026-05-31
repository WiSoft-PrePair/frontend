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
      if (![404, 405, 500, 502, 503, 504].includes(response.status)) {
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

  const questions =
    payload.questions ?? payload.questionResults ?? payload.items
  if (Array.isArray(questions) && questions.length > 0) return payload
  if (eventLooksFinal) return { ...payload, __finalComplete: true }

  return null
}

export function isFinalCompleteVideoInterviewPayload(payload) {
  if (!payload || typeof payload !== 'object') return false
  if (payload.__finalComplete === true) return true
  const unwrapped = unwrapVideoResultPayload(payload)
  if (!unwrapped) return false
  return (
    unwrapped.__finalComplete === true ||
    (unwrapped.finalScore != null && Boolean(String(unwrapped.summary ?? '').trim()))
  )
}

export function isCompleteVideoInterviewResult(payload) {
  const unwrapped = unwrapVideoResultPayload(payload)
  if (!unwrapped) return false
  const questions =
    unwrapped.questions ?? unwrapped.questionResults ?? unwrapped.items
  if (Array.isArray(questions) && questions.length > 0) return true
  return isFinalCompleteVideoInterviewPayload(unwrapped)
}

const VIDEO_STREAM_ENDPOINTS = (sessionId) => [
  `/interviews/questions/video-answers/${sessionId}/stream`,
]

const VIDEO_RESULT_GET_ENDPOINTS = (sessionId) => [
  `/interviews/questions/video-answers/${sessionId}`,
]

/** 화상 면접 기록 목록 — 질문 업로드·스트림과 동일한 `/interviews/questions/video-answers` 네임스페이스 */
const VIDEO_HISTORY_LIST_ENDPOINTS = ['/interviews/questions/video-answers']

/** 녹화 영상 — 답변 업로드(POST …/video-answers)와 대칭되는 GET 경로 */
const VIDEO_RECORDING_ENDPOINTS = (_sessionId, questionId) => [
  `/interviews/questions/${questionId}/video-answers/video`,
  `/interviews/questions/${questionId}/video-answers/recording`,
]

const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504])

function isRetryableInterviewError(error) {
  if (!error) return false
  if (error.name === 'AbortError') return false
  if (error.isRetryable === true) return true
  return RETRYABLE_HTTP_STATUSES.has(error.statusCode)
}

function buildInterviewFetchError(response, fallbackMessage) {
  const error = new Error(fallbackMessage)
  error.statusCode = response?.status
  error.isRetryable = RETRYABLE_HTTP_STATUSES.has(response?.status)
  return error
}

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

function combineAbortSignals(...signals) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  for (const signal of signals) {
    if (!signal) continue
    if (signal.aborted) {
      abort()
      break
    }
    signal.addEventListener('abort', abort, { once: true })
  }
  return controller.signal
}

function createAttemptTimeoutSignal(timeoutMs, parentSignal) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onParentAbort = () => {
    clearTimeout(timer)
    controller.abort()
  }
  parentSignal?.addEventListener('abort', onParentAbort, { once: true })
  return {
    signal: combineAbortSignals(parentSignal, controller.signal),
    clear: () => {
      clearTimeout(timer)
      parentSignal?.removeEventListener('abort', onParentAbort)
    },
  }
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

/** SSE 없이 짧은 GET으로 최종 결과 조회 (게이트웨이 504 회피) */
async function fetchVideoInterviewResultRest(sessionId, { accessToken, signal } = {}) {
  const response = await fetchWithEndpointFallback(VIDEO_RESULT_GET_ENDPOINTS(sessionId), {
    method: 'GET',
    headers: buildHeaders(accessToken, { Accept: 'application/json' }),
    signal,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(
      pickApiErrorMessage(errorData) ||
        (response.status === 504
          ? '서버 분석이 지연되고 있습니다. 잠시 후 다시 확인합니다.'
          : '면접 결과 조회에 실패했습니다.')
    )
    error.statusCode = response.status
    error.isRetryable = RETRYABLE_HTTP_STATUSES.has(response.status)
    throw error
  }

  const text = await response.text()
  if (!text.trim()) return null
  return unwrapVideoResultPayload(parseMaybeJson(text) ?? text)
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
  { accessToken, signal, onOpen, onMessage, onError, streamAttemptTimeoutMs } = {}
) {
  const timeout =
    typeof streamAttemptTimeoutMs === 'number' && streamAttemptTimeoutMs > 0
      ? createAttemptTimeoutSignal(streamAttemptTimeoutMs, signal)
      : null
  const attemptSignal = timeout?.signal ?? signal

  try {
    const response = await fetchVideoInterviewStreamResponse(sessionId, {
      accessToken,
      signal: attemptSignal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const status = response.status
      const error = new Error(
        pickApiErrorMessage(errorData) ||
          (status === 504
            ? '서버 분석이 지연되고 있습니다. 잠시 후 다시 확인합니다.'
            : 'SSE 연결 중 오류가 발생했습니다.')
      )
      error.statusCode = status
      error.isRetryable = RETRYABLE_HTTP_STATUSES.has(status)
      throw error
    }

    onOpen?.()

    const rawTail = await consumeVideoInterviewStreamBody(response, onMessage)
    return { rawTail, contentType: response.headers.get('content-type') || '' }
  } catch (error) {
    if (error.name === 'AbortError') {
      if (signal?.aborted) {
        const abortError = new Error('스트림 요청이 취소되었습니다.')
        abortError.name = 'AbortError'
        throw abortError
      }
      const timeoutError = new Error('결과 조회 시간이 초과되어 다시 시도합니다.')
      timeoutError.statusCode = 504
      timeoutError.isRetryable = true
      throw timeoutError
    }
    onError?.(error)
    throw error
  } finally {
    timeout?.clear()
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
    onPollAttempt,
    pollIntervalMs = 2500,
    maxWaitMs = 180000,
    initialDelayMs = 0,
    streamAttemptTimeoutMs = 22000,
  } = {}
) {
  const deadline = Date.now() + maxWaitMs
  const effectiveInitialDelay = Math.max(0, initialDelayMs)
  const effectivePollInterval = Math.max(0, pollIntervalMs)
  const effectiveStreamTimeout = streamAttemptTimeoutMs

  if (effectiveInitialDelay > 0) {
    await sleep(effectiveInitialDelay, signal)
  }

  let attempt = 0
  let lastPayload = null
  let lastRetryableError = null
  let receivedFinalComplete = false
  let consecutiveStreamFailures = 0

  const applyStreamMessage = (message) => {
    onMessage?.(message)
    const extracted = extractVideoInterviewResultFromMessage(message)
    if (!extracted) return
    lastPayload = extracted
    if (isFinalCompleteSseEvent(message?.event) || extracted.__finalComplete) {
      receivedFinalComplete = true
    }
  }

  const finishIfReady = () => {
    if (receivedFinalComplete && lastPayload) {
      onDone?.(lastPayload)
      return lastPayload
    }
    if (isCompleteVideoInterviewResult(lastPayload)) {
      onDone?.(lastPayload)
      return lastPayload
    }
    return null
  }

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      const abortError = new Error('스트림 요청이 취소되었습니다.')
      abortError.name = 'AbortError'
      throw abortError
    }

    attempt += 1
    onPollAttempt?.({ attempt, phase: 'stream' })

    let streamReturnedOk = false
    try {
      await streamVideoInterviewResultOnce(sessionId, {
        accessToken,
        signal,
        streamAttemptTimeoutMs: effectiveStreamTimeout,
        onOpen: attempt === 1 ? onOpen : undefined,
        onError,
        onMessage: applyStreamMessage,
      })
      streamReturnedOk = true
      consecutiveStreamFailures = 0
    } catch (error) {
      if (!isRetryableInterviewError(error)) throw error
      lastRetryableError = error
      consecutiveStreamFailures += 1
    }

    const ready = finishIfReady()
    if (ready) return ready

    if (Date.now() + effectivePollInterval >= deadline) break

    const failureBackoff = Math.min(
      Math.max(800, effectivePollInterval || 0) * Math.max(1, consecutiveStreamFailures),
      15000
    )
    const waitMs = streamReturnedOk && !receivedFinalComplete
      ? Math.max(250, effectivePollInterval)
      : failureBackoff

    await sleep(waitMs, signal)
  }

  if (lastPayload && (receivedFinalComplete || isCompleteVideoInterviewResult(lastPayload))) {
    onDone?.(lastPayload)
    return lastPayload
  }

  if (lastRetryableError) {
    const error = new Error(
      lastRetryableError.statusCode === 504
        ? '서버 분석이 지연되어 결과를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.'
        : lastRetryableError.message || '면접 결과 조회에 실패했습니다.'
    )
    error.statusCode = lastRetryableError.statusCode
    error.isRetryable = true
    throw error
  }

  return null
}

function toNumericInterviewScore(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** API 응답 항목에서 녹화 영상 URL 추출 */
export function pickVideoRecordingUrl(item) {
  if (!item || typeof item !== 'object') return null
  const candidates = [
    item.videoUrl,
    item.video_url,
    item.recordingUrl,
    item.recording_url,
    item.answerVideoUrl,
    item.answer_video_url,
    item.mediaUrl,
    item.media_url,
    item.fileUrl,
    item.file_url,
    item.videoPath,
    item.video_path,
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function normalizeVideoHistoryQuestion(item, idx, sessionId) {
  const questionId = item?.questionId ?? item?.question_id ?? item?.id ?? null
  return {
    index: idx + 1,
    questionId,
    question: item?.question ?? item?.questionText ?? item?.text ?? '',
    score:
      toNumericInterviewScore(item?.combinedScore) ??
      toNumericInterviewScore(item?.score) ??
      toNumericInterviewScore(item?.latestScore),
    videoUrl: pickVideoRecordingUrl(item),
    sessionId: item?.sessionId ?? item?.session_id ?? sessionId ?? null,
  }
}

function normalizeVideoHistorySessionItem(item) {
  if (!item || typeof item !== 'object') return null
  const sessionId =
    item.sessionId ?? item.session_id ?? item.id ?? item.videoSessionId ?? null
  if (!sessionId) return null

  const questionItems = Array.isArray(item.questions)
    ? item.questions
    : Array.isArray(item.questionResults)
      ? item.questionResults
      : Array.isArray(item.items)
        ? item.items
        : []

  const questions = questionItems.map((q, idx) =>
    normalizeVideoHistoryQuestion(q, idx, sessionId)
  )

  const date =
    item.completedAt ??
    item.completed_at ??
    item.createdAt ??
    item.created_at ??
    item.updatedAt ??
    item.updated_at ??
    item.date ??
    null

  return {
    sessionId: String(sessionId),
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    overallScore:
      toNumericInterviewScore(item.finalScore) ??
      toNumericInterviewScore(item.overallScore) ??
      toNumericInterviewScore(item.averageScore) ??
      toNumericInterviewScore(item.score),
    summary: item.summary ?? item.overallSummary ?? item.description ?? '',
    questionCount: questions.length || item.questionCount || item.totalQuestions || 0,
    questionsPreview: questions.slice(0, 3).map((q) => q.question).filter(Boolean),
    questions,
    source: 'api',
  }
}

function extractVideoHistoryRawList(response) {
  const payload = response?.data ?? response
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.sessions)) return payload.sessions
  if (Array.isArray(payload?.content)) return payload.content
  if (Array.isArray(payload?.histories)) return payload.histories
  if (Array.isArray(payload?.videoAnswers)) return payload.videoAnswers
  if (Array.isArray(payload?.video_answers)) return payload.video_answers
  return []
}

function looksLikeFlatVideoAnswerList(list) {
  if (!Array.isArray(list) || list.length === 0) return false
  return list.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      (item.questionId != null || item.question_id != null || item.id != null) &&
      !Array.isArray(item.questions) &&
      !Array.isArray(item.questionResults)
  )
}

function groupFlatVideoAnswersBySession(flatList) {
  const sessions = new Map()

  for (const raw of flatList) {
    if (!raw || typeof raw !== 'object') continue
    const sessionId =
      raw.sessionId ?? raw.session_id ?? raw.videoSessionId ?? raw.video_session_id ?? null
    if (!sessionId) continue

    const key = String(sessionId)
    if (!sessions.has(key)) {
      sessions.set(key, {
        sessionId: key,
        session_id: key,
        questions: [],
        completedAt:
          raw.completedAt ??
          raw.completed_at ??
          raw.createdAt ??
          raw.created_at ??
          raw.updatedAt ??
          raw.updated_at ??
          null,
        finalScore: raw.finalScore ?? raw.final_score ?? raw.overallScore ?? raw.overall_score,
        overallScore: raw.overallScore ?? raw.overall_score ?? raw.finalScore ?? raw.final_score,
        summary: raw.summary ?? raw.overallSummary ?? raw.overall_summary ?? '',
      })
    }

    const session = sessions.get(key)
    session.questions.push(raw)

    const sessionDate =
      raw.completedAt ??
      raw.completed_at ??
      raw.createdAt ??
      raw.created_at ??
      raw.updatedAt ??
      raw.updated_at
    if (sessionDate && !session.completedAt) session.completedAt = sessionDate

    const sessionScore =
      raw.finalScore ?? raw.final_score ?? raw.overallScore ?? raw.overall_score ?? raw.sessionScore
    if (sessionScore != null) {
      session.finalScore = sessionScore
      session.overallScore = sessionScore
    }

    const sessionSummary = raw.summary ?? raw.overallSummary ?? raw.overall_summary
    if (sessionSummary && !session.summary) session.summary = sessionSummary
  }

  return Array.from(sessions.values())
}

/** 화상 면접 기록 목록 응답 정규화 */
export function normalizeVideoInterviewHistoryList(response) {
  let list = extractVideoHistoryRawList(response)

  if (looksLikeFlatVideoAnswerList(list)) {
    list = groupFlatVideoAnswersBySession(list)
  }

  return list
    .map(normalizeVideoHistorySessionItem)
    .filter(Boolean)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/** 화상 면접 기록 목록 조회 */
export async function getVideoInterviewHistories(accessToken, { signal } = {}) {
  const response = await fetch(`${API_BASE}${VIDEO_HISTORY_LIST_ENDPOINTS[0]}`, {
    method: 'GET',
    headers: buildHeaders(accessToken, { Accept: 'application/json' }),
    signal,
  })

  if (!response.ok) {
    // 목록 API 미구현·서버 오류 시 로컬 기록만 사용
    if ([404, 405, 500, 501, 502, 503, 504].includes(response.status)) {
      return []
    }
    return normalizeVideoInterviewHistoryList(await handleResponse(response))
  }

  const data = await response.json().catch(() => ({}))
  return normalizeVideoInterviewHistoryList(data)
}

/** 화상 면접 세션 상세(피드백·질문·영상 URL) 조회 */
export async function getVideoInterviewSessionDetail(sessionId, accessToken, { signal } = {}) {
  if (!sessionId) return null

  try {
    const payload = await fetchVideoInterviewResultRest(sessionId, { accessToken, signal })
    if (!payload) return null

    const root = unwrapVideoResultPayload(payload) ?? payload
    const sessionMeta = normalizeVideoHistorySessionItem({
      ...root,
      sessionId,
      session_id: sessionId,
      id: sessionId,
    })

    if (!sessionMeta) return null

    const questionItems = Array.isArray(root?.questions)
      ? root.questions
      : Array.isArray(root?.questionResults)
        ? root.questionResults
        : []

    if (questionItems.length) {
      sessionMeta.questions = questionItems.map((item, idx) =>
        normalizeVideoHistoryQuestion(item, idx, sessionId)
      )
      sessionMeta.questionCount = sessionMeta.questions.length
      sessionMeta.questionsPreview = sessionMeta.questions
        .slice(0, 3)
        .map((q) => q.question)
        .filter(Boolean)
    }

    return sessionMeta
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    return null
  }
}

function resolveRecordingFetchUrl(videoUrl) {
  if (!videoUrl) return null
  if (/^https?:\/\//i.test(videoUrl)) return videoUrl
  if (videoUrl.startsWith('/api/')) return videoUrl
  if (videoUrl.startsWith('/')) return `${API_BASE}${videoUrl}`
  return `${API_BASE}/${videoUrl}`
}

/** 인증이 필요한 녹화 영상 blob 조회 (video 태그 재생용) */
export async function fetchVideoInterviewRecording(
  { sessionId, questionId, videoUrl },
  accessToken,
  { signal } = {}
) {
  const token = requireAccessToken(accessToken)
  const authHeaders = { Authorization: `Bearer ${token}` }

  const directUrl = resolveRecordingFetchUrl(videoUrl)
  if (directUrl) {
    const response = await fetch(directUrl, { headers: authHeaders, signal })
    if (response.ok) {
      const blob = await response.blob()
      if (blob.size > 0) return blob
    }
  }

  if (!sessionId || !questionId) {
    throw new Error('녹화 영상을 불러올 수 없습니다.')
  }

  let lastResponse = null
  for (const endpoint of VIDEO_RECORDING_ENDPOINTS(sessionId, questionId)) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: authHeaders,
        signal,
      })
      if (response.ok) {
        const blob = await response.blob()
        if (blob.size > 0) return blob
      }
      lastResponse = response
      if (![404, 405].includes(response.status)) break
    } catch (error) {
      if (error.name === 'AbortError') throw error
    }
  }

  const error = new Error('녹화 영상을 불러올 수 없습니다.')
  error.statusCode = lastResponse?.status
  throw error
}
