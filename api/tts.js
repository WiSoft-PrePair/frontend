/**
 * Vercel Serverless Function - OpenAI TTS
 *
 * 환경변수 (Vercel Dashboard 등):
 * - OPENAI_API_KEY
 * - OPENAI_TTS_MODEL (선택, 기본: gpt-4o-mini-tts)
 *
 * POST /api/tts — 본문: { text, voice } — 응답: audio/wav
 */

import {
  parseAndValidateTtsBody,
  synthesizeOpenAiSpeech,
} from '../lib/openaiTtsCore.js'

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
    return res.status(500).json({
      error: 'TTS 서비스가 설정되지 않았습니다. (OPENAI_API_KEY 미설정)',
    })
  }

  try {
    const body = req.body || {}
    const parsed = parseAndValidateTtsBody(body)

    if (!parsed.ok) {
      return res.status(parsed.status).json({ error: parsed.error })
    }

    const result = await synthesizeOpenAiSpeech({
      text: parsed.text,
      voice: parsed.voice,
      apiKey,
      model: OPENAI_TTS_MODEL,
    })

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error })
    }

    res.setHeader('Content-Type', 'audio/wav')
    res.setHeader('Content-Length', result.buffer.byteLength)
    return res.send(result.buffer)
  } catch (error) {
    console.error('[TTS] Unexpected error:', error)
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' })
  }
}
