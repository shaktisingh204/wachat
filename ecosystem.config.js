
module.exports = {
  apps: [
    {
      name: 'sabnode-web',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // Ensure we don't try to run workers inside the web server instances
      env_production: {
        IS_WORKER: 'false',
      },
    },
    {
      name: 'sabnode-worker',
      script: 'worker.js',
      instances: 'max', // Use all available CPUs minus one for the web server
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        // This flag tells the script it's a worker
        IS_WORKER: 'true',
      },
    },
  ],
};
