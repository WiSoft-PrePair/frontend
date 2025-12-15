/**
 * 개발용 TTS 프록시 서버
 * ElevenLabs API를 로컬에서 테스트하기 위한 프록시
 *
 * 실행: npm run tts-proxy 또는 node scripts/tts-proxy.js
 */

import http from 'http'
import https from 'https'
import {config} from 'dotenv'
import {fileURLToPath} from 'url'
import {dirname, join} from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// .env 파일 로드
config({path: join(__dirname, '..', '.env')})

const PORT = 3001
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

// 기본값
const DEFAULTS = {
  voiceId: 'nZOfECqWUuNiKrnh8geY', // 찬구 (클론)
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
  speed: 1,
}

if (!ELEVENLABS_API_KEY) {
  console.error('Error: 환경 변수가 설정되지 않았습니다.')
  console.error('   .env 파일에 ELEVENLABS_API_KEY를 설정하세요.')
  process.exit(1)
}

const server = http.createServer((req, res) => {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Preflight 요청 처리
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // POST /api/tts만 처리
  if (req.method !== 'POST' || req.url !== '/api/tts') {
    res.writeHead(404, {'Content-Type': 'application/json'})
    res.end(JSON.stringify({error: 'Not Found'}))
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    try {
      const {
        text,
        voiceId = DEFAULTS.voiceId,
        stability = DEFAULTS.stability,
        similarityBoost = DEFAULTS.similarityBoost,
        style = DEFAULTS.style,
        useSpeakerBoost = DEFAULTS.useSpeakerBoost,
        speed = DEFAULTS.speed,
      } = JSON.parse(body)

      if (!text) {
        res.writeHead(400, {'Content-Type': 'application/json'})
        res.end(JSON.stringify({error: 'text is required'}))
        return
      }

      // ElevenLabs API 요청 데이터
      const requestBody = JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: Number(stability) || 0.5,
          similarity_boost: Number(similarityBoost) || 0.75,
          style: Number(style) || 0,
          use_speaker_boost: useSpeakerBoost,
          speed: Number(speed) || 0.85,
        },
      })

      const options = {
        hostname: 'api.elevenlabs.io',
        port: 443,
        path: `/v1/text-to-speech/${voiceId}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Length': Buffer.byteLength(requestBody),
        },
      }

      const elevenLabsReq = https.request(options, (elevenLabsRes) => {
        if (elevenLabsRes.statusCode !== 200) {
          let errorBody = ''
          elevenLabsRes.on('data', (chunk) => {
            errorBody += chunk.toString()
          })
          elevenLabsRes.on('end', () => {
            console.error('ElevenLabs API Error:', elevenLabsRes.statusCode, errorBody)
            res.writeHead(elevenLabsRes.statusCode, {'Content-Type': 'application/json'})
            res.end(JSON.stringify({error: 'ElevenLabs API Error', details: errorBody}))
          })
          return
        }

        // 오디오 데이터 스트리밍
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Transfer-Encoding': 'chunked',
        })

        elevenLabsRes.pipe(res)
      })

      elevenLabsReq.on('error', (error) => {
        console.error('Request Error:', error)
        res.writeHead(500, {'Content-Type': 'application/json'})
        res.end(JSON.stringify({error: error.message}))
      })

      elevenLabsReq.write(requestBody)
      elevenLabsReq.end()

      console.log(`TTS 요청: "${text.substring(0, 30)}..." (voice: ${voiceId})`)
    } catch (error) {
      console.error('Parse Error:', error)
      res.writeHead(400, {'Content-Type': 'application/json'})
      res.end(JSON.stringify({error: 'Invalid JSON'}))
    }
  })
})

server.listen(PORT, () => {
  console.log('')
  console.log('TTS 프록시 서버가 시작되었습니다 (ElevenLabs)')
  console.log(`   http://localhost:${PORT}/api/tts`)
  console.log('')
  console.log('Vite 개발 서버와 함께 사용하세요:')
  console.log('   npm run dev (다른 터미널에서)')
  console.log('')
})
