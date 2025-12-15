module.exports = {
  apps: [
    {
      name: 'fe',
      script: 'pnpm',
      args: 'run preview',
      cwd: '/Users/moon/Developments/project/prepair/front',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4173,
      },
    },
    {
      name: 'tts-proxy',
      script: 'node',
      args: 'scripts/tts-proxy.js',
      cwd: '/Users/moon/Developments/project/prepair/front',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

// module.exports = {
//   apps: [
//     {
//       name: 'fe',
//       script: '/home/prepair/.asdf/installs/pnpm/9.15.1/bin/pnpm',
//       args: 'run preview',
//       cwd: '/home/prepair/prepair/prepair-fe',
//       instances: 1,
//       exec_mode: 'fork',
//       autorestart: true,
//       watch: false,
//       max_memory_restart: '1G',
//       env: {
//         NODE_ENV: 'production',
//         PORT: 4173,
//       },
//     },
//     {
//       name: 'tts-proxy',
//       script: 'scripts/tts-proxy.js',
//       cwd: '/home/prepair/prepair/prepair-fe',
//       instances: 1,
//       exec_mode: 'fork',
//       autorestart: true,
//       watch: false,
//       max_memory_restart: '512M',
//       env: {
//         NODE_ENV: 'production',
//       },
//     },
//   ],
// };
