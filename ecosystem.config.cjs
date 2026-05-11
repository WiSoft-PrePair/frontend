/**
 * PM2: 프론트(pnpm prod) + TTS 전용 Node(scripts/tts-proxy.js)
 *
 * 서버에서 최초 반영 또는 ecosystem 변경 후:
 *   pm2 start ecosystem.config.cjs
 * 이미 떠 있으면:
 *   pm2 delete fe tts 2>/dev/null; pm2 start ecosystem.config.cjs
 *
 * 확인: pm2 ls 에 fe 와 tts 둘 다 online 이어야 함.
 * TTS만 없으면: pm2 start ecosystem.config.cjs --only tts
 *
 * nginx: 브라우저가 같은 도메인으로 POST /tts, /api/tts 할 수 있게
 *   127.0.0.1:TTS_PORT(기본 3001) 로 proxy_pass 필요. (vite preview는 /tts 안 줌)
 *
 * .env 에 OPENAI_API_KEY 필수 (tts 프로세스가 읽음)
 */
const path = require('path')

/** 이 파일이 있는 디렉터리 = 프론트 프로젝트 루트 (서버 경로 수동 맞출 필요 없음) */
const FE_CWD = path.resolve(__dirname)

module.exports = {
  apps: [
    {
      name: 'fe',
      script: 'pnpm',
      args: 'run prod',
      cwd: FE_CWD,
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4173,
      },
    },
    {
      name: 'tts',
      script: 'scripts/tts-proxy.js',
      cwd: FE_CWD,
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        TTS_PORT: 3001,
      },
    },
  ],
}
