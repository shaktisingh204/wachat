require('dotenv').config();
require('dotenv').config({ path: './rust/.env', override: false });

module.exports = {
  apps: [
    {
      name: 'sabnode-api',
      cwd: './rust',
      script: 'cargo',
      args: 'run --release -p sabnode-api',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      restart_delay: 5000,
      max_restarts: 20,
      env: {
        RUST_JWT_SECRET: process.env.RUST_JWT_SECRET,
        MONGODB_URI: process.env.MONGODB_URI,
        MONGODB_DB: process.env.MONGODB_DB,
        REDIS_URL: process.env.REDIS_URL,
        FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
        SABNODE_PORT: process.env.SABNODE_PORT || '8080',
        SABNODE_ENV: process.env.SABNODE_ENV || 'production',
        RUST_LOG: process.env.RUST_LOG || 'info',
      },
    },
    {
      name: 'sabnode-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3002',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        RUST_API_URL: process.env.RUST_API_URL || 'http://127.0.0.1:8080',
        RUST_JWT_SECRET: process.env.RUST_JWT_SECRET,
      },
    },

    // New scalable broadcast pipeline. Run multiple instances for horizontal
    // throughput — they coordinate via BullMQ + Redis token buckets, so per-
    // broadcast MPS is enforced globally regardless of instance count.
    {
      name: 'sabnode-broadcast-worker',
      script: './src/workers/broadcast/index.js',
      instances: process.env.BROADCAST_WORKER_INSTANCES
        ? parseInt(process.env.BROADCAST_WORKER_INSTANCES, 10)
        : 4,
      exec_mode: 'cluster',
      watch: false,
      restart_delay: 5000,
      max_restarts: 50,
      kill_timeout: 30000, // give in-flight batches a chance to drain
      env: {
        NODE_ENV: 'production',
        BROADCAST_USE_BULLMQ: '1',
        // Effectively-unlimited concurrent campaigns. There is no per-user or
        // per-project cap in code; with 4 PM2 instances these give 200 control
        // jobs and 256 send-batch jobs in flight at once. Per-broadcast MPS
        // (Redis token bucket) still keeps Meta API usage sane regardless.
        BROADCAST_CONTROL_CONCURRENCY: process.env.BROADCAST_CONTROL_CONCURRENCY || '50',
        BROADCAST_SEND_CONCURRENCY: process.env.BROADCAST_SEND_CONCURRENCY || '64',
      },
    },

    // Legacy poller. Kept around for any in-flight broadcasts queued under the
    // old code path. Set BROADCAST_USE_BULLMQ=1 (default in the new worker) so
    // it stops claiming new ones once the BullMQ pipeline is healthy.
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
        BROADCAST_USE_BULLMQ: '1',
      },
    },
  ],
};
