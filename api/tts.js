/**
 * Vercel Serverless Function - Qwen3 TTS Proxy
 *
 * 환경변수 설정 필요 (Vercel Dashboard > Settings > Environment Variables):
 * - DASHSCOPE_API_KEY: Alibaba Cloud Model Studio API Key (Qwen3 TTS)
 *
 * @see https://www.alibabacloud.com/help/en/model-studio/qwen-tts-api
 *
 * 엔드포인트: POST /api/tts
 * 요청 본문: { text, voice, language_type }
 * 응답: audio/wav 바이너리
 */

const DEFAULTS = {
  voice: 'Sohee',
  language_type: 'Korean',
}

const MAX_TEXT_LENGTH = 600

const DASHSCOPE_HOST =
  process.env.DASHSCOPE_REGION === 'cn'
    ? 'dashscope.aliyuncs.com'
    : 'dashscope-intl.aliyuncs.com'

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

  const apiKey = process.env.DASHSCOPE_API_KEY

  if (!apiKey) {
    console.error('[TTS] Missing DASHSCOPE_API_KEY')
    return res.status(500).json({ error: 'TTS 서비스가 설정되지 않았습니다.' })
  }

  try {
    const body = req.body || {}
    const { text, voice = DEFAULTS.voice, language_type = DEFAULTS.language_type } = body

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

    // Qwen3 TTS API 호출 (DashScope)
    const dashScopeResponse = await fetch(
      `https://${DASHSCOPE_HOST}/api/v1/services/aigc/multimodal-generation/generation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'qwen3-tts-flash',
          input: {
            text: trimmedText,
            voice,
            language_type,
          },
        }),
      }
    )

    const json = await dashScopeResponse.json()

    if (!dashScopeResponse.ok) {
      const errMsg =
        json.message || json.code || JSON.stringify(json).substring(0, 200) || 'Unknown error'
      console.error('[TTS] DashScope API error:', dashScopeResponse.status, errMsg)

      if (dashScopeResponse.status === 401) {
        return res.status(500).json({ error: 'API 인증에 실패했습니다.' })
      }
      if (dashScopeResponse.status === 429) {
        return res.status(429).json({ error: '요청 한도를 초과했습니다.' })
      }

      return res.status(500).json({ error: errMsg || 'TTS 변환에 실패했습니다.' })
    }

    const audioUrl = json.output?.audio?.url
    if (!audioUrl) {
      console.error('[TTS] No audio URL in response:', json)
      return res.status(500).json({ error: 'TTS 응답에 오디오 URL이 없습니다.' })
    }

    // URL에서 오디오 바이너리 가져오기
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
      console.error('[TTS] Failed to fetch audio from URL:', audioResponse.status)
      return res.status(500).json({ error: '오디오 파일을 불러오는데 실패했습니다.' })
    }

    const audioBuffer = await audioResponse.arrayBuffer()

    res.setHeader('Content-Type', 'audio/wav')
    res.setHeader('Content-Length', audioBuffer.byteLength)
    return res.send(Buffer.from(audioBuffer))
  } catch (error) {
    console.error('[TTS] Unexpected error:', error)
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' })
  }
}
