/** 서버 경로(cwd)는 배포 환경에 맞게 수정하세요. */
const FE_CWD = '/home/prepair/prepair/prepair-fe'

module.exports = {
  apps: [
    {
      name: 'fe',
      script: '/home/prepair/.asdf/installs/pnpm/9.15.1/bin/pnpm',
      args: 'run prod',
      cwd: FE_CWD,
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
