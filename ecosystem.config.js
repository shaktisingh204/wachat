
module.exports = {
  apps: [
    {
      name: 'sabnode-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'sabnode-worker',
      script: './worker.js',
      instances: 1,
      exec_mode: 'cluster',
      restart_delay: 10000, // 10s delay to reduce rapid restarts
      max_restarts: 10,     // allow more retries
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
