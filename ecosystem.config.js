
module.exports = {
  apps: [
    {
      name: 'sabnode-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3002',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
    },

    {
      name: 'sabnode-worker',
      script: './worker.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      restart_delay: 10000,
      max_restarts: 20,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
