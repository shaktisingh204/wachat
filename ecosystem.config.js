
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
      name: 'sabnode-worker-low',
      script: './worker.js',
      args: 'low-priority-broadcasts',
      instances: 1,
      exec_mode: 'cluster',
      restart_delay: 10000, // 10s delay to reduce rapid restarts
      max_restarts: 10,     // allow more retries
      env: {
        NODE_ENV: 'production',
        KAFKA_TOPIC: 'low-priority-broadcasts',
      },
    },
    {
      name: 'sabnode-worker-high',
      script: './worker.js',
      args: 'high-priority-broadcasts',
      instances: 1, // reduce to 1 for stability
      exec_mode: 'cluster',
      restart_delay: 10000, // 10s delay
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        KAFKA_TOPIC: 'high-priority-broadcasts',
      },
    },
  ],
};
