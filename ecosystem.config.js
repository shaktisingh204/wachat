
module.exports = {
  apps: [
    {
      name: 'sabnode-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'sabnode-worker-low',
      script: 'worker.js',
      instances: 1, // A single worker for smaller jobs
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        KAFKA_TOPIC: 'low-priority-broadcasts',
      },
    },
    {
      name: 'sabnode-worker-high',
      script: 'worker.js',
      instances: 2, // Two workers for larger jobs
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        KAFKA_TOPIC: 'high-priority-broadcasts',
      },
    },
  ],
};
