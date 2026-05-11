/**
 * OpenAI TTS 공용 로직 (Vercel serverless / Vite dev 미들웨어에서 공유)
 */

export const OPENAI_TTS_MAX_TEXT_LENGTH = 600

export const OPENAI_TTS_DEFAULTS = {
  voice: 'alloy',
}

const OPENAI_TTS_MODEL_FALLBACK = 'gpt-4o-mini-tts'

/**
 * @param {unknown} body - 파싱된 JSON 본문
 * @returns {{ ok: true, text: string, voice: string } | { ok: false, status: number, error: string }}
 */
export function parseAndValidateTtsBody(body) {
  const { text, voice = OPENAI_TTS_DEFAULTS.voice } = body || {}

  if (!text || typeof text !== 'string') {
    return { ok: false, status: 400, error: '텍스트가 필요합니다.' }
  }

  const trimmedText = text.trim()
  if (trimmedText.length === 0) {
    return { ok: false, status: 400, error: '텍스트가 비어있습니다.' }
  }

  if (trimmedText.length > OPENAI_TTS_MAX_TEXT_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `텍스트는 최대 ${OPENAI_TTS_MAX_TEXT_LENGTH}자까지 가능합니다.`,
    }
  }

  return { ok: true, text: trimmedText, voice }
}

/**
 * @param {{ text: string, voice: string, apiKey: string, model?: string }} params
 * @returns {Promise<{ ok: true, buffer: Buffer } | { ok: false, status: number, error: string }>}
 */
export async function synthesizeOpenAiSpeech({ text, voice, apiKey, model }) {
  const resolvedModel = model || OPENAI_TTS_MODEL_FALLBACK

  const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: resolvedModel,
      voice,
      input: text,
      format: 'wav',
    }),
  })

  if (!openaiResponse.ok) {
    let errMsg = 'TTS 변환에 실패했습니다.'
    try {
      const textBody = await openaiResponse.text()
      const parsed = JSON.parse(textBody)
      errMsg =
        parsed.error?.message ||
        parsed.error?.code ||
        textBody.substring(0, 200) ||
        errMsg
    } catch {
      // ignore
    }

    if (openaiResponse.status === 401) {
      return { ok: false, status: 500, error: 'API 인증에 실패했습니다.' }
    }
    if (openaiResponse.status === 429) {
      return { ok: false, status: 429, error: '요청 한도를 초과했습니다.' }
    }

    return { ok: false, status: 500, error: errMsg }
  }

  const audioArrayBuffer = await openaiResponse.arrayBuffer()
  const buffer = Buffer.from(audioArrayBuffer)

  return { ok: true, buffer }
}
