/**
 * Vercel Serverless Function - ElevenLabs TTS Proxy
 *
 * 환경변수 설정 필요 (Vercel Dashboard > Settings > Environment Variables):
 * - ELEVENLABS_API_KEY: ElevenLabs API Key
 *
 * @see https://elevenlabs.io/docs/api-reference/text-to-speech
 *
 * [백엔드 마이그레이션 시 참고]
 * 이 파일의 로직을 NestJS 컨트롤러로 옮기면 됩니다.
 * 엔드포인트: POST /api/tts
 * 요청 본문: { text, voiceId, stability, similarityBoost, style, useSpeakerBoost }
 * 응답: audio/mpeg 바이너리
 */

// 기본값
const DEFAULTS = {
  voiceId: 'ctdr2dNInXnThzWJXouh', // 찬구 (클론)
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
  speed: 0.85,
}

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // POST만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed'})
  }

  // 환경변수 확인
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) {
    console.error('[TTS] Missing ELEVENLABS_API_KEY')
    return res.status(500).json({error: 'TTS 서비스가 설정되지 않았습니다.'})
  }

  try {
    const body = req.body || {}
    const {
      text,
      voiceId = DEFAULTS.voiceId,
      stability = DEFAULTS.stability,
      similarityBoost = DEFAULTS.similarityBoost,
      style = DEFAULTS.style,
      useSpeakerBoost = DEFAULTS.useSpeakerBoost,
      speed = DEFAULTS.speed,
    } = body

    // 입력 검증
    if (!text || typeof text !== 'string') {
      return res.status(400).json({error: '텍스트가 필요합니다.'})
    }

    if (text.length > 5000) {
      return res.status(400).json({error: '텍스트는 최대 5000자까지 가능합니다.'})
    }

    // 숫자 범위 검증
    const numStability = Math.max(0, Math.min(1, Number(stability) || 0.5))
    const numSimilarityBoost = Math.max(0, Math.min(1, Number(similarityBoost) || 0.75))
    const numStyle = Math.max(0, Math.min(1, Number(style) || 0))
    const numSpeed = Math.max(0.25, Math.min(4.0, Number(speed) || 0.85))

    // ElevenLabs API 요청 본문
    const requestBody = {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: numStability,
        similarity_boost: numSimilarityBoost,
        style: numStyle,
        use_speaker_boost: useSpeakerBoost,
        speed: numSpeed,
      },
    }

    // ElevenLabs API 호출
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text()
      console.error('[TTS] ElevenLabs API error:', elevenLabsResponse.status, errorText)

      if (elevenLabsResponse.status === 401) {
        return res.status(500).json({error: 'API 인증에 실패했습니다.'})
      }
      if (elevenLabsResponse.status === 402 || elevenLabsResponse.status === 403) {
        return res.status(402).json({error: '크레딧이 부족하거나 권한이 없습니다.'})
      }
      if (elevenLabsResponse.status === 404) {
        return res.status(404).json({error: '음성을 찾을 수 없습니다.'})
      }
      if (elevenLabsResponse.status === 429) {
        return res.status(429).json({error: '요청 한도를 초과했습니다.'})
      }

      return res.status(500).json({error: 'TTS 변환에 실패했습니다.'})
    }

    // 오디오 바이너리 응답
    const audioBuffer = await elevenLabsResponse.arrayBuffer()

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Length', audioBuffer.byteLength)

    return res.send(Buffer.from(audioBuffer))
  } catch (error) {
    console.error('[TTS] Unexpected error:', error)
    return res.status(500).json({error: '서버 오류가 발생했습니다.'})
  }
}
