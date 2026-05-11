/**
 * TTS 전용 서버 (OpenAI Speech API 프록시)
 *
 * 로컬: `pnpm tts-proxy`
 * 운영: PM2로 함께 띄움 (`ecosystem.config.cjs`의 `tts` 앱)
 *
 * `.env`에 OPENAI_API_KEY 필요. 포트는 TTS_PORT 또는 PORT (기본 3001).
 */

import http from 'http'
import https from 'https'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '.env') })

const PORT = Number(process.env.TTS_PORT || process.env.PORT || 3001) || 3001
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'

const DEFAULTS = {
  voice: 'alloy',
}

const MAX_TEXT_LENGTH = 600

if (!OPENAI_API_KEY) {
  console.error('Error: 환경 변수가 설정되지 않았습니다.')
  console.error('   .env 파일에 OPENAI_API_KEY를 설정하세요.')
  process.exit(1)
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const pathname = (req.url || '').split('?')[0]
  const isTtsPath = pathname === '/api/tts' || pathname === '/tts'

  if (req.method !== 'POST' || !isTtsPath) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not Found' }))
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', async () => {
    try {
      const parsed = JSON.parse(body)
      const { text, voice = DEFAULTS.voice } = parsed

      if (!text || typeof text !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'text is required' }))
        return
      }

      const trimmedText = text.trim()
      if (trimmedText.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'text cannot be empty' }))
        return
      }

      if (trimmedText.length > MAX_TEXT_LENGTH) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            error: `text must be at most ${MAX_TEXT_LENGTH} characters`,
          })
        )
        return
      }

      const openaiBody = JSON.stringify({
        model: OPENAI_TTS_MODEL,
        voice,
        input: trimmedText,
        format: 'wav',
      })

      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/audio/speech',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Length': Buffer.byteLength(openaiBody),
        },
      }

      const openaiReq = https.request(options, (openaiRes) => {
        if (openaiRes.statusCode !== 200) {
          let errorBody = ''
          openaiRes.on('data', (chunk) => {
            errorBody += chunk.toString()
          })
          openaiRes.on('end', () => {
            let errorMsg = 'OpenAI API 오류'
            try {
              const errJson = JSON.parse(errorBody)
              errorMsg =
                errJson.error?.message ||
                errJson.error?.code ||
                errorBody.substring(0, 200) ||
                errorMsg
            } catch (_) {
              errorMsg = errorBody.substring(0, 200) || errorMsg
            }
            console.error('OpenAI API Error:', openaiRes.statusCode, errorBody)
            res.writeHead(openaiRes.statusCode, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: errorMsg }))
          })
          return
        }

        res.writeHead(200, {
          'Content-Type': openaiRes.headers['content-type'] || 'audio/wav',
        })
        openaiRes.pipe(res)
      })

      openaiReq.on('error', (error) => {
        console.error('Request Error:', error)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error.message }))
      })

      openaiReq.write(openaiBody)
      openaiReq.end()

      console.log(`TTS 요청: "${trimmedText.substring(0, 30)}..." (voice: ${voice})`)
    } catch (error) {
      console.error('Parse Error:', error)
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON' }))
    }
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log('')
  console.log(`TTS 서버 (OpenAI)  http://0.0.0.0:${PORT}`)
  console.log(`   POST /tts   POST /api/tts`)
  console.log('')
})
