
module.exports = {
  apps: [
    {
      name: 'sabnode-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      instances: 'max', // Or a specific number, e.g., 2
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
    },
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
