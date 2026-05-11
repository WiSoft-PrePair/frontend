/**
 * TTS 전용 PM2 앱만 정의 (메인 ecosystem과 충돌·pull 막힐 때 사용)
 *
 *   cd /path/to/frontend
 *   pm2 start ecosystem.tts.cjs
 *
 * 이미 fe만 떠 있어도 위 한 줄로 tts만 추가 등록됩니다.
 */
const path = require('path')

const FE_CWD = path.resolve(__dirname)

module.exports = {
  apps: [
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
        TTS_PORT: 7400,
      },
    },
  ],
}
