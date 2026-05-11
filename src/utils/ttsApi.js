const PRIMARY_TTS_ENDPOINT = '/tts'
const LEGACY_TTS_ENDPOINT = '/api/tts'
const BACKEND_TTS_ENDPOINT = '/api/interviews/tts'

/**
 * 공용 TTS API 클라이언트
 *
 * - `accessToken`이 있으면 백엔드 `POST /api/interviews/tts`(JWT 필요)를 우선 시도합니다.
 * - 로컬·Vercel 등에서 동일 출처 `/tts`, `/api/tts`(서버리스/미들웨어)가 있으면 그쪽으로 폴백합니다.
 */

// 지원 음성 프리셋 (OpenAI TTS 기반, 한국어 사용에 적합한 톤 설명)
export const TTS_SPEAKERS = {
  alloy_calm: {
    name: '차분한 기본 음성',
    voice: 'alloy',
    gender: 'neutral',
    lang: 'ko',
    description: '차분하고 또렷한 기본 한국어 음성',
  },
  alloy_bright: {
    name: '밝은 기본 음성',
    voice: 'alloy',
    gender: 'neutral',
    lang: 'ko',
    description: '조금 더 경쾌하고 에너지가 느껴지는 톤',
  },
  verse_soft: {
    name: '부드러운 면접관',
    voice: 'verse',
    gender: 'neutral',
    lang: 'ko',
    description: '편안하고 부드러운 설명형 톤',
  },
  verse_serious: {
    name: '진지한 면접관',
    voice: 'verse',
    gender: 'neutral',
    lang: 'ko',
    description: '조금 더 진중하고 또렷한 피드백 톤',
  },
}

const DEFAULT_OPTIONS = {
  speaker: 'alloy_calm',
  language_type: 'Korean',
}

const MAX_TEXT_LENGTH = 600
const VALID_OPENAI_VOICES = new Set([
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'onyx',
  'nova',
  'sage',
  'shimmer',
])

const MAX_ERROR_MESSAGE_LEN = 480

function clampErrorText(value, max = MAX_ERROR_MESSAGE_LEN) {
  if (!value || typeof value !== 'string') return value
  const t = value.trim()
  if (!t.length) return ''
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/** API 오류 JSON의 message/error 필드가 객체일 때도 문자열로 펼친다. */
function fragmentToErrorMessage(fragment, depth = 0) {
  if (fragment == null || depth > 6) return ''
  if (typeof fragment === 'string') {
    const t = fragment.trim()
    return t.length ? t : ''
  }
  if (typeof fragment === 'number' || typeof fragment === 'boolean') {
    return String(fragment)
  }
  if (Array.isArray(fragment)) {
    const parts = fragment
      .map((item) => fragmentToErrorMessage(item, depth + 1))
      .filter(Boolean)
    return parts.join('; ')
  }
  if (typeof fragment === 'object') {
    const nested =
      fragmentToErrorMessage(fragment.message, depth + 1) ||
      fragmentToErrorMessage(fragment.error, depth + 1) ||
      fragmentToErrorMessage(fragment.detail, depth + 1) ||
      fragmentToErrorMessage(fragment.description, depth + 1)
    if (nested) return nested
    try {
      return JSON.stringify(fragment)
    } catch {
      return ''
    }
  }
  return String(fragment)
}

function extractHttpErrorMessage(payload, fallback) {
  if (payload == null) return fallback
  if (typeof payload === 'string') {
    const t = clampErrorText(payload)
    return t || fallback
  }
  if (typeof payload !== 'object') return fallback

  const text =
    fragmentToErrorMessage(payload.message) ||
    fragmentToErrorMessage(payload.error) ||
    fragmentToErrorMessage(payload.detail) ||
    fragmentToErrorMessage(payload.title) ||
    fragmentToErrorMessage(payload.errors)

  const normalized = clampErrorText(text)
  return normalized || fallback
}

/**
 * 텍스트를 음성으로 변환
 * @param {string} text - 변환할 텍스트 (최대 600자)
 * @param {Object} options - TTS 옵션 (`accessToken`: 백엔드 TTS용 Bearer JWT)
 * @param {AbortSignal} signal - 취소용 AbortSignal (optional)
 * @returns {Promise<Blob>} 오디오 Blob (audio/wav)
 */
export async function textToSpeech(text, options = {}, signal = null) {
  if (!text || text.trim().length === 0) {
    throw new Error('텍스트가 비어있습니다.')
  }

  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`텍스트는 최대 ${MAX_TEXT_LENGTH}자까지 가능합니다.`)
  }

  const speakerKey = options.speaker || DEFAULT_OPTIONS.speaker
  const speakerInfo = TTS_SPEAKERS[speakerKey]
  const fallbackVoice = TTS_SPEAKERS[DEFAULT_OPTIONS.speaker]?.voice || 'alloy'
  const rawVoice = speakerInfo?.voice || fallbackVoice
  const voice = VALID_OPENAI_VOICES.has(rawVoice) ? rawVoice : fallbackVoice
  if (!VALID_OPENAI_VOICES.has(rawVoice)) {
    console.warn(`[ttsApi] unsupported voice "${rawVoice}", fallback to "${fallbackVoice}"`)
  }

  const params = {
    text: text.trim(),
    voice,
    language_type: options.language_type ?? DEFAULT_OPTIONS.language_type,
  }

  const accessToken =
    typeof options.accessToken === 'string' && options.accessToken.trim()
      ? options.accessToken.trim()
      : null

  try {
    // 토큰이 있으면 백엔드 TTS를 먼저 시도(단일 도메인 배포에서 서버리스 /tts 가 없을 때)
    const endpoints = accessToken
      ? [BACKEND_TTS_ENDPOINT, PRIMARY_TTS_ENDPOINT, LEGACY_TTS_ENDPOINT]
      : [PRIMARY_TTS_ENDPOINT, LEGACY_TTS_ENDPOINT, BACKEND_TTS_ENDPOINT]
    let response = null
    let lastResponse = null

    for (const endpoint of endpoints) {
      const headers = {
        'Content-Type': 'application/json',
      }
      if (accessToken && endpoint === BACKEND_TTS_ENDPOINT) {
        headers.Authorization = `Bearer ${accessToken}`
      }

      const candidate = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
        signal,
      })

      if (candidate.ok) {
        response = candidate
        break
      }

      lastResponse = candidate

      // 404: 다음 엔드포인트(로컬 /tts, Vercel /api/tts 등) 시도
      // 5xx·429: 백엔드/한도 문제일 수 있으므로 동일 출처 TTS로 폴백
      const tryNext =
        candidate.status === 404 ||
        candidate.status === 429 ||
        (candidate.status >= 500 && candidate.status <= 599)

      if (tryNext) {
        console.warn(
          `[ttsApi] ${endpoint} → HTTP ${candidate.status}, 다음 TTS 경로를 시도합니다.`
        )
        await candidate.text().catch(() => '')
        continue
      }

      response = candidate
      break
    }

    response = response || lastResponse

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('TTS 인증에 실패했습니다. 다시 로그인 후 시도해주세요.')
      }

      const rawText = await response.text()
      let msg = 'TTS 변환에 실패했습니다.'

      console.error(
        `[ttsApi] HTTP ${response.status}`,
        rawText ? rawText.substring(0, 1200) : '(empty body)'
      )

      try {
        const errorData = JSON.parse(rawText)
        msg = extractHttpErrorMessage(errorData, msg)
        if (errorData.details) {
          console.error('[ttsApi] 서버 상세:', errorData.details)
        }
      } catch {
        if (rawText.length > 0) {
          msg = clampErrorText(rawText.substring(0, 300), 300) || msg
        }
      }

      throw new Error(typeof msg === 'string' ? msg : 'TTS 변환에 실패했습니다.')
    }

    const contentType = response.headers.get('Content-Type') || ''
    if (!contentType.includes('audio/')) {
      const text = await response.text()
      console.error('[ttsApi] Non-audio response:', text.substring(0, 200))
      throw new Error('TTS 서버가 오디오 대신 오류를 반환했습니다.')
    }

    return response.blob()
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error
    }
    const isNetworkError =
      error.name === 'TypeError' ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('NetworkError')
    if (isNetworkError) {
      throw new Error('TTS 서버에 연결할 수 없습니다. 서버 설정을 확인해주세요.')
    }
    console.error('[ttsApi] textToSpeech error:', error)
    throw error
  }
}

/**
 * 텍스트를 음성으로 변환하고 재생
 */
export async function speakText(text, options = {}) {
  const blob = await textToSpeech(text, options)
  const url = URL.createObjectURL(blob)

  const audio = new Audio(url)

  audio.onended = () => {
    URL.revokeObjectURL(url)
  }

  await audio.play()
  return audio
}

/**
 * 긴 텍스트를 청크로 나누어 순차 재생
 * 현재는 최대 600자 제한을 가정하고 500자로 청크 분할
 */
export async function speakLongText(text, options = {}, onProgress) {
  const chunks = splitTextIntoChunks(text, 500)

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) {
      onProgress(i, chunks.length)
    }

    const audio = await speakText(chunks[i], options)

    await new Promise((resolve) => {
      audio.onended = resolve
    })
  }
}

/**
 * 텍스트를 청크로 분할
 */
function splitTextIntoChunks(text, maxLength) {
  if (text.length <= maxLength) {
    return [text]
  }

  const chunks = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)
      break
    }

    let splitIndex = -1
    const searchEnd = Math.min(remaining.length, maxLength)

    for (let i = searchEnd - 1; i >= maxLength * 0.5; i--) {
      if (['.', '?', '!', '。'].includes(remaining[i])) {
        splitIndex = i + 1
        break
      }
    }

    if (splitIndex === -1) {
      for (let i = searchEnd - 1; i >= maxLength * 0.5; i--) {
        if (remaining[i] === ' ' || remaining[i] === '\n') {
          splitIndex = i + 1
          break
        }
      }
    }

    if (splitIndex === -1) {
      splitIndex = maxLength
    }

    chunks.push(remaining.slice(0, splitIndex).trim())
    remaining = remaining.slice(splitIndex).trim()
  }

  return chunks
}
