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
      args: ['broadcasts'],        // PASS TOPIC WITH ARRAY (correct format)
      instances: 1,                // increase later if needed
      exec_mode: 'cluster',        // cluster mode for stability
      watch: false,
      restart_delay: 10000,        // 10-sec restart backoff
      max_restarts: 20,            // more tolerance
      env: {
        NODE_ENV: 'production',
        KAFKA_TOPIC: 'broadcasts', // also available inside worker.js
      },
    },
  ],
};
