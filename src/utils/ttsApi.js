const API_BASE = '/api'

/**
 * ElevenLabs TTS API
 *
 * ElevenLabs를 사용한 Text-to-Speech (Voice Cloning 지원)
 * 백엔드 프록시를 통해 호출 (API Key 보안)
 *
 * @see https://elevenlabs.io/docs/api-reference/text-to-speech
 */

// 사용 가능한 음성 목록 (ElevenLabs Voices)
export const ELEVENLABS_SPEAKERS = {
  // 커스텀 클론 음성
  changu2: { name: '찬구', voiceId: 'nZOfECqWUuNiKrnh8geY', gender: 'male', lang: 'ko', description: '킹받음' },
  adult: { name: '성인', voiceId: 'ZJCNdZEjYwkOElxugmW2', gender: 'male', lang: 'ko', description: '일반 성인 남성' },
  animalKingdom: { name: '동물의 왕국', voiceId: 's07IwTCOrCDCaETjUVjx', gender: 'male', lang: 'ko', description: '동물의 왕국 나레이션' },
}

// 기본 설정
const DEFAULT_OPTIONS = {
  speaker: 'changu2',          // 기본 음성: 찬구2
  stability: 0.5,              // 안정성: 0.0 ~ 1.0 (낮을수록 다양한 표현)
  similarityBoost: 0.75,       // 원본 유사도: 0.0 ~ 1.0 (높을수록 원본과 유사)
  style: 0,                    // 스타일: 0.0 ~ 1.0 (높을수록 표현력 증가)
  useSpeakerBoost: true,       // 스피커 부스트 사용
  speed: 0.85,                 // 속도: 0.25 ~ 4.0 (1.0이 기본, 낮을수록 느림)
}

/**
 * 텍스트를 음성으로 변환
 * @param {string} text - 변환할 텍스트 (최대 5000자)
 * @param {Object} options - TTS 옵션
 * @param {AbortSignal} signal - 취소용 AbortSignal (optional)
 * @returns {Promise<Blob>} 오디오 Blob
 */
export async function textToSpeech(text, options = {}, signal = null) {
  if (!text || text.trim().length === 0) {
    throw new Error('텍스트가 비어있습니다.')
  }

  if (text.length > 5000) {
    throw new Error('텍스트는 최대 5000자까지 가능합니다.')
  }

  // speaker 키를 voice_id로 변환
  const speakerKey = options.speaker || DEFAULT_OPTIONS.speaker
  const speakerInfo = ELEVENLABS_SPEAKERS[speakerKey]
  const voiceId = speakerInfo?.voiceId || ELEVENLABS_SPEAKERS.changu2.voiceId

  const params = {
    text,
    voiceId,
    stability: options.stability ?? DEFAULT_OPTIONS.stability,
    similarityBoost: options.similarityBoost ?? DEFAULT_OPTIONS.similarityBoost,
    style: options.style ?? DEFAULT_OPTIONS.style,
    useSpeakerBoost: options.useSpeakerBoost ?? DEFAULT_OPTIONS.useSpeakerBoost,
    speed: options.speed ?? DEFAULT_OPTIONS.speed,
  }

  try {
    const response = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      signal, // AbortSignal 전달
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'TTS 변환에 실패했습니다.')
    }

    return response.blob()
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error // 취소된 경우 그대로 throw
    }
    console.error('[ttsApi] textToSpeech error:', error)
    throw error
  }
}

/**
 * 텍스트를 음성으로 변환하고 재생
 * @param {string} text - 변환할 텍스트
 * @param {Object} options - TTS 옵션
 * @returns {Promise<HTMLAudioElement>} 오디오 엘리먼트
 */
export async function speakText(text, options = {}) {
  const blob = await textToSpeech(text, options)
  const url = URL.createObjectURL(blob)

  const audio = new Audio(url)

  // 재생 완료 시 URL 해제
  audio.onended = () => {
    URL.revokeObjectURL(url)
  }

  await audio.play()
  return audio
}

/**
 * 긴 텍스트를 청크로 나누어 순차 재생
 * @param {string} text - 변환할 텍스트
 * @param {Object} options - TTS 옵션
 * @param {Function} onProgress - 진행 콜백 (currentIndex, total)
 * @returns {Promise<void>}
 */
export async function speakLongText(text, options = {}, onProgress) {
  const chunks = splitTextIntoChunks(text, 4500) // Typecast는 5000자까지 지원, 여유있게 4500자로 분할

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) {
      onProgress(i, chunks.length)
    }

    const audio = await speakText(chunks[i], options)

    // 현재 청크 재생 완료 대기
    await new Promise((resolve) => {
      audio.onended = resolve
    })
  }
}

/**
 * 텍스트를 청크로 분할 (문장 단위로 분할 시도)
 * @param {string} text - 원본 텍스트
 * @param {number} maxLength - 청크 최대 길이
 * @returns {string[]} 청크 배열
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

    // 문장 끝 찾기 (마침표, 물음표, 느낌표)
    let splitIndex = -1
    const searchEnd = Math.min(remaining.length, maxLength)

    for (let i = searchEnd - 1; i >= maxLength * 0.5; i--) {
      if (['.', '?', '!', '。'].includes(remaining[i])) {
        splitIndex = i + 1
        break
      }
    }

    // 문장 끝을 못 찾으면 공백에서 분할
    if (splitIndex === -1) {
      for (let i = searchEnd - 1; i >= maxLength * 0.5; i--) {
        if (remaining[i] === ' ' || remaining[i] === '\n') {
          splitIndex = i + 1
          break
        }
      }
    }

    // 그래도 못 찾으면 강제 분할
    if (splitIndex === -1) {
      splitIndex = maxLength
    }

    chunks.push(remaining.slice(0, splitIndex).trim())
    remaining = remaining.slice(splitIndex).trim()
  }

  return chunks
}
