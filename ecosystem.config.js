
module.exports = {
  apps: [
    {
      name: 'sabnode-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'sabnode-worker-low',
      script: './worker.js',
      args: 'low-priority-broadcasts',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        KAFKA_TOPIC: 'low-priority-broadcasts',
      },
    },
    {
      name: 'sabnode-worker-high',
      script: './worker.js',
      args: 'high-priority-broadcasts',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        KAFKA_TOPIC: 'high-priority-broadcasts',
      },
    },
  ],
};
