/**
 * 개발용 TTS 프록시 서버
 * Qwen3 TTS (Alibaba DashScope) API를 로컬에서 테스트하기 위한 프록시
 *
 * 실행: pnpm tts-proxy (또는 npm run tts-proxy)
 *
 * .env 파일에 DASHSCOPE_API_KEY를 설정하세요.
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
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY
const DASHSCOPE_REGION = process.env.DASHSCOPE_REGION || 'intl' // 'intl' | 'cn'

const DASHSCOPE_HOST =
  DASHSCOPE_REGION === 'cn'
    ? 'dashscope.aliyuncs.com'
    : 'dashscope-intl.aliyuncs.com'

const DEFAULTS = {
  voice: 'Sohee',
  language_type: 'Korean',
}

const MAX_TEXT_LENGTH = 600

if (!DASHSCOPE_API_KEY) {
  console.error('Error: 환경 변수가 설정되지 않았습니다.')
  console.error('   .env 파일에 DASHSCOPE_API_KEY를 설정하세요.')
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
      const {
        text,
        voice = DEFAULTS.voice,
        language_type = DEFAULTS.language_type,
      } = parsed

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

      const dashScopeBody = JSON.stringify({
        model: 'qwen3-tts-flash',
        input: {
          text: trimmedText,
          voice,
          language_type,
        },
      })

      const options = {
        hostname: DASHSCOPE_HOST,
        port: 443,
        path: '/api/v1/services/aigc/multimodal-generation/generation',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Length': Buffer.byteLength(dashScopeBody),
        },
      }

      const dashScopeReq = https.request(options, async (dashScopeRes) => {
        let responseBody = ''
        dashScopeRes.on('data', (chunk) => {
          responseBody += chunk.toString()
        })

        dashScopeRes.on('end', async () => {
          if (dashScopeRes.statusCode !== 200) {
            let errorMsg = 'DashScope API 오류'
            try {
              const errJson = JSON.parse(responseBody)
              errorMsg = errJson.message || errJson.code || errorMsg
              if (errJson.message && errJson.code) {
                errorMsg = `${errJson.code}: ${errJson.message}`
              }
            } catch (_) {
              errorMsg = responseBody.substring(0, 200) || errorMsg
            }
            console.error('DashScope API Error:', dashScopeRes.statusCode, responseBody)
            res.writeHead(dashScopeRes.statusCode, { 'Content-Type': 'application/json' })
            res.end(
              JSON.stringify({
                error: errorMsg,
                details: responseBody,
              })
            )
            return
          }

          const json = JSON.parse(responseBody)
          const audioUrl = json.output?.audio?.url

          if (!audioUrl) {
            console.error('No audio URL in response:', json)
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'No audio URL in response' }))
            return
          }

          try {
            const audioRes = await fetch(audioUrl)
            if (!audioRes.ok) {
              throw new Error(`Failed to fetch audio: ${audioRes.status}`)
            }
            const audioBuffer = await audioRes.arrayBuffer()
            res.writeHead(200, {
              'Content-Type': 'audio/wav',
              'Content-Length': audioBuffer.byteLength,
            })
            res.end(Buffer.from(audioBuffer))
          } catch (fetchErr) {
            console.error('Error fetching audio:', fetchErr)
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Failed to fetch audio file' }))
          }
        })
      })

      dashScopeReq.on('error', (error) => {
        console.error('Request Error:', error)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error.message }))
      })

      dashScopeReq.write(dashScopeBody)
      dashScopeReq.end()

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
  console.log('TTS 프록시 서버가 시작되었습니다 (Qwen3 TTS)')
  console.log(`   http://localhost:${PORT}/api/tts`)
  console.log(`   리전: ${DASHSCOPE_REGION} (${DASHSCOPE_HOST})`)
  console.log('')
  console.log('Vite 개발 서버와 함께 사용하세요:')
  console.log('   pnpm dev (다른 터미널에서)')
  console.log('')
})
