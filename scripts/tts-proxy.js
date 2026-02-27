/**
 * 개발용 TTS 프록시 서버 (OpenAI TTS)
 *
 * 실행: pnpm tts-proxy (또는 npm run tts-proxy)
 *
 * .env 파일에 OPENAI_API_KEY를 설정하세요.
 */

import http from 'http'
import https from 'https'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '.env') })

const PORT = 3001
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

  if (req.method !== 'POST' || req.url !== '/api/tts') {
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

server.listen(PORT, () => {
      console.log('')
      console.log('TTS 프록시 서버가 시작되었습니다 (OpenAI TTS)')
      console.log(`   http://localhost:${PORT}/api/tts`)
      console.log('')
      console.log('Vite 개발 서버와 함께 사용하세요:')
      console.log('   pnpm dev (다른 터미널에서)')
      console.log('')
})
