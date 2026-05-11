/**
 * 개발 서버에서 POST /tts, /api/tts 를 OpenAI로 처리 (별도 tts-proxy 프로세스 불필요)
 */
import { loadEnv } from 'vite'
import {
  parseAndValidateTtsBody,
  synthesizeOpenAiSpeech,
} from './lib/openaiTtsCore.js'

function sendJson(res, status, obj) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(obj))
}

export function openaiTtsDevPlugin() {
  return {
    name: 'openai-tts-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0] || ''
        if (pathname !== '/tts' && pathname !== '/api/tts') {
          return next()
        }

        const env = loadEnv(server.config.mode, process.cwd(), '')
        const apiKey = env.OPENAI_API_KEY
        const model = env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'

        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' })
          return
        }

        if (!apiKey) {
          console.error('[openai-tts-dev] Missing OPENAI_API_KEY in .env')
          sendJson(res, 500, {
            error: 'TTS 서비스가 설정되지 않았습니다. (OPENAI_API_KEY 미설정)',
          })
          return
        }

        let raw = ''
        try {
          for await (const chunk of req) {
            raw += chunk.toString()
          }
          const body = raw ? JSON.parse(raw) : {}
          const parsed = parseAndValidateTtsBody(body)

          if (!parsed.ok) {
            sendJson(res, parsed.status, { error: parsed.error })
            return
          }

          const result = await synthesizeOpenAiSpeech({
            text: parsed.text,
            voice: parsed.voice,
            apiKey,
            model,
          })

          if (!result.ok) {
            sendJson(res, result.status, { error: result.error })
            return
          }

          res.statusCode = 200
          res.setHeader('Content-Type', 'audio/wav')
          res.setHeader('Content-Length', result.buffer.byteLength)
          res.end(result.buffer)
        } catch (err) {
          if (err instanceof SyntaxError) {
            sendJson(res, 400, { error: 'Invalid JSON' })
            return
          }
          console.error('[openai-tts-dev]', err)
          sendJson(res, 500, { error: '서버 오류가 발생했습니다.' })
        }
      })
    },
  }
}
