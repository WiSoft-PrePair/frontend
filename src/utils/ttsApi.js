const API_BASE = '/api'

/**
 * Qwen3 TTS API
 *
 * Alibaba Cloud Qwen3-TTS를 사용한 Text-to-Speech
 * 백엔드 프록시를 통해 호출 (API Key 보안)
 *
 * @see https://www.alibabacloud.com/help/en/model-studio/qwen-tts-api
 */

// Qwen3 TTS 지원 음성 (한국어 면접관 추천)
export const QWEN3_SPEAKERS = {
  sohee: {
    name: '소희',
    voice: 'Sohee',
    gender: 'female',
    lang: 'ko',
    description: '부드럽고 밝은 한국어 언니',
  },
  ethan: {
    name: '이든',
    voice: 'Ethan',
    gender: 'male',
    lang: 'ko',
    description: '밝고 따뜻한 남성',
  },
  cherry: {
    name: '체리',
    voice: 'Cherry',
    gender: 'female',
    lang: 'ko',
    description: '친근하고 긍정적인 여성',
  },
  serena: {
    name: '세레나',
    voice: 'Serena',
    gender: 'female',
    lang: 'ko',
    description: '부드러운 여성',
  },
  ryan: {
    name: '라이언',
    voice: 'Ryan',
    gender: 'male',
    lang: 'ko',
    description: '리듬감 있고 진지한 남성',
  },
}

const DEFAULT_OPTIONS = {
  speaker: 'sohee',
  language_type: 'Korean',
}

const MAX_TEXT_LENGTH = 600

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
  const speakerInfo = QWEN3_SPEAKERS[speakerKey]
  const voice = speakerInfo?.voice || QWEN3_SPEAKERS.sohee.voice

  const params = {
    text: text.trim(),
    voice,
    language_type: options.language_type ?? DEFAULT_OPTIONS.language_type,
  }

  try {
    const response = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      signal,
    })

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
      throw new Error('TTS 서버에 연결할 수 없습니다. (로컬: pnpm tts-proxy 실행, 배포: DASHSCOPE_API_KEY 확인)')
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
 * Qwen3는 최대 600자이므로 500자로 청크 분할
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
