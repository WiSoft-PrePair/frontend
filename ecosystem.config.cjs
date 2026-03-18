module.exports = {
  apps: [
    {
      name: 'fe',
      script: '/home/prepair/.asdf/installs/pnpm/9.15.1/bin/pnpm',
      args: 'run prod',
      cwd: '/home/prepair/prepair/prepair-fe',
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
    
  ],
};
