
module.exports = {
  apps: [
    {
      name: 'sabnode-worker',
      script: 'worker.js',
      instances: 'max', // Use all available CPUs for workers
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
