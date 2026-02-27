/**
 * Vercel Serverless Function - 공용 TTS Proxy (OpenAI TTS)
 *
 * 환경변수 설정 필요 (Vercel Dashboard > Settings > Environment Variables):
 * - OPENAI_API_KEY: OpenAI API Key
 * - OPENAI_TTS_MODEL: 사용할 TTS 모델 (선택, 기본값: gpt-4o-mini-tts)
 *
 * 엔드포인트: POST /api/tts
 * 요청 본문: { text, voice }
 * 응답: audio/wav 바이너리
 */

const DEFAULTS = {
  voice: 'alloy',
}

const MAX_TEXT_LENGTH = 600

const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.error('[TTS] Missing OPENAI_API_KEY')
    return res.status(500).json({ error: 'TTS 서비스가 설정되지 않았습니다. (OPENAI_API_KEY 미설정)' })
  }

  try {
    const body = req.body || {}
    const { text, voice = DEFAULTS.voice } = body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '텍스트가 필요합니다.' })
    }

    const trimmedText = text.trim()
    if (trimmedText.length === 0) {
      return res.status(400).json({ error: '텍스트가 비어있습니다.' })
    }

    if (trimmedText.length > MAX_TEXT_LENGTH) {
      return res
        .status(400)
        .json({ error: `텍스트는 최대 ${MAX_TEXT_LENGTH}자까지 가능합니다.` })
    }

    // OpenAI TTS API 호출
    const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        voice,
        input: trimmedText,
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
      } catch (_) {
        // ignore JSON parse error, keep 기본 메시지
      }

      console.error('[TTS] OpenAI API error:', openaiResponse.status, errMsg)

      if (openaiResponse.status === 401) {
        return res.status(500).json({ error: 'API 인증에 실패했습니다.' })
      }
      if (openaiResponse.status === 429) {
        return res.status(429).json({ error: '요청 한도를 초과했습니다.' })
      }

      return res.status(500).json({ error: errMsg })
    }

    const audioArrayBuffer = await openaiResponse.arrayBuffer()
    const audioBuffer = Buffer.from(audioArrayBuffer)

    res.setHeader('Content-Type', 'audio/wav')
    res.setHeader('Content-Length', audioBuffer.byteLength)
    return res.send(audioBuffer)
  } catch (error) {
    console.error('[TTS] Unexpected error:', error)
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' })
  }
}
