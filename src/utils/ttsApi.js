const PRIMARY_TTS_ENDPOINT = '/tts'
const LEGACY_TTS_ENDPOINT = '/api/tts'
const BACKEND_TTS_ENDPOINT = '/api/interviews/tts'

/**
 * 공용 TTS API 클라이언트
 *
 * 백엔드의 `/api/tts` 엔드포인트(OpenAI TTS 등)를 호출해
 * 텍스트를 음성으로 변환합니다.
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

/**
 * 텍스트를 음성으로 변환
 * @param {string} text - 변환할 텍스트 (최대 600자)
 * @param {Object} options - TTS 옵션
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

  try {
    // 프론트 배포 환경마다 라우팅이 다를 수 있어 순차 폴백한다.
    const endpoints = [PRIMARY_TTS_ENDPOINT, LEGACY_TTS_ENDPOINT, BACKEND_TTS_ENDPOINT]
    let response = null
    let lastResponse = null

    for (const endpoint of endpoints) {
      const candidate = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        signal,
      })

      if (candidate.ok) {
        response = candidate
        break
      }

      lastResponse = candidate
      if (candidate.status !== 404) {
        response = candidate
        break
      }
    }

    response = response || lastResponse

    if (!response.ok) {
      const rawText = await response.text()
      let msg = 'TTS 변환에 실패했습니다.'

      try {
        const errorData = JSON.parse(rawText)
        msg = errorData.error || errorData.message || msg
        if (errorData.details) {
          console.error('[ttsApi] 서버 상세:', errorData.details)
        }
      } catch (_) {
        console.error('[ttsApi] 500 응답 원문:', rawText.substring(0, 500))
        if (rawText.length > 0) msg = rawText.substring(0, 200)
      }

      throw new Error(msg)
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
