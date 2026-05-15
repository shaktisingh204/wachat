require('dotenv').config();
require('dotenv').config({ path: './rust/.env', override: false });

// ---------------------------------------------------------------------------
// BROADCAST_WORKER feature flag
// ---------------------------------------------------------------------------

const BROADCAST_WORKER = (
  process.env.BROADCAST_WORKER || 'rust'
).toLowerCase();

if (
  BROADCAST_WORKER !== 'node' &&
  BROADCAST_WORKER !== 'rust'
) {
  throw new Error(
    `BROADCAST_WORKER must be 'node' or 'rust', got '${process.env.BROADCAST_WORKER}'.`
  );
}

module.exports = {
  apps: [
    // ---------------------------------------------------------------------
    // Rust API
    // ---------------------------------------------------------------------
    {
      name: 'sabnode-api',
      cwd: './rust',

      // Better production approach
      script: './target/release/sabnode-api',

      // If you want cargo instead:
      // script: 'cargo',
      // args: 'run --release -p sabnode-api',

      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      kill_timeout: 10000,

      env: {
        RUST_JWT_SECRET: process.env.RUST_JWT_SECRET,
        MONGODB_URI: process.env.MONGODB_URI,
        MONGODB_DB: process.env.MONGODB_DB,
        REDIS_URL: process.env.REDIS_URL,
        FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,

        SABNODE_PORT: process.env.SABNODE_PORT || '8080',
        SABNODE_ENV: process.env.SABNODE_ENV || 'production',

        RUST_LOG: process.env.RUST_LOG || 'info',

        R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
        R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
        R2_BUCKET: process.env.R2_BUCKET || 'sabnode',
      },
    },

    // ---------------------------------------------------------------------
    // SabWa Engine (personal WhatsApp — Rust HTTP server + Baileys sidecar)
    // ---------------------------------------------------------------------
    {
      name: 'sabwa-engine',
      cwd: './services/sabwa-engine',

      script: './target/release/sabwa-engine',
      interpreter: 'none',

      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      kill_timeout: 15000,
      max_memory_restart: '2G',

      env: {
        SABWA_ENGINE_PORT: process.env.SABWA_ENGINE_PORT || '4001',

        SABWA_ENGINE_TOKEN: process.env.SABWA_ENGINE_TOKEN,
        SABWA_AUTH_ENCRYPTION_KEY: process.env.SABWA_AUTH_ENCRYPTION_KEY,
        SABWA_STREAM_JWT_SECRET: process.env.SABWA_STREAM_JWT_SECRET,
        SABWA_WEBHOOK_SIGNING_SECRET: process.env.SABWA_WEBHOOK_SIGNING_SECRET,

        MONGODB_URI: process.env.MONGODB_URI,
        MONGODB_DB: process.env.MONGODB_DB,
        REDIS_URL: process.env.REDIS_URL,

        SABWA_SIDECAR_PATH:
          process.env.SABWA_SIDECAR_PATH ||
          '/var/www/sabnode/services/sabwa-engine/sidecar-node/src/index.js',
        SABWA_NODE_BIN: process.env.SABWA_NODE_BIN || 'node',

        RUST_LOG: process.env.RUST_LOG || 'info,sabwa_engine=info',
      },
    },

    // ---------------------------------------------------------------------
    // Next.js Frontend
    // ---------------------------------------------------------------------
    {
      name: 'sabnode-web',

      script: 'node_modules/.bin/next',
      args: 'start -p 3002',

      cwd: './',

      instances: 1,
      exec_mode: 'fork',

      watch: false,
      autorestart: true,

      env: {
        NODE_ENV: 'production',

        RUST_API_URL:
          process.env.RUST_API_URL || 'http://127.0.0.1:8080',

        RUST_JWT_SECRET: process.env.RUST_JWT_SECRET,

        // SabWa engine
        SABWA_ENGINE_URL:
          process.env.SABWA_ENGINE_URL || 'http://127.0.0.1:4001',
        SABWA_ENGINE_TOKEN: process.env.SABWA_ENGINE_TOKEN,
      },
    },

    // ---------------------------------------------------------------------
    // Node Broadcast Worker
    // ---------------------------------------------------------------------
    BROADCAST_WORKER === 'node' && {
      name: 'sabnode-broadcast-worker',

      script: './src/workers/broadcast/index.js',

      instances: process.env.BROADCAST_WORKER_INSTANCES
        ? parseInt(process.env.BROADCAST_WORKER_INSTANCES, 10)
        : 4,

      exec_mode: 'cluster',

      watch: false,
      autorestart: true,

      restart_delay: 5000,
      max_restarts: 50,
      kill_timeout: 30000,

      env: {
        NODE_ENV: 'production',

        BROADCAST_USE_BULLMQ: '1',
        BROADCAST_WORKER: 'node',

        BROADCAST_CONTROL_CONCURRENCY:
          process.env.BROADCAST_CONTROL_CONCURRENCY || '50',

        BROADCAST_SEND_CONCURRENCY:
          process.env.BROADCAST_SEND_CONCURRENCY || '64',
      },
    },

    // ---------------------------------------------------------------------
    // Rust Broadcast Worker
    // ---------------------------------------------------------------------
    BROADCAST_WORKER === 'rust' && {
      name: 'sabnode-broadcast-worker',

      cwd: './rust',

      // Better production approach
      script: './target/release/broadcast-worker',

      // If you want cargo instead:
      // script: 'cargo',
      // args: 'run --release -p wachat-broadcast-worker',

      instances: process.env.BROADCAST_WORKER_INSTANCES
        ? parseInt(process.env.BROADCAST_WORKER_INSTANCES, 10)
        : 1,

      exec_mode: 'fork',

      watch: false,
      autorestart: true,

      restart_delay: 5000,
      max_restarts: 50,
      kill_timeout: 30000,

      env: {
        RUST_LOG: process.env.RUST_LOG || 'info',

        RUST_JWT_SECRET: process.env.RUST_JWT_SECRET,

        MONGODB_URI: process.env.MONGODB_URI,
        MONGODB_DB: process.env.MONGODB_DB,

        REDIS_URL: process.env.REDIS_URL,

        FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,

        SABNODE_ENV:
          process.env.SABNODE_ENV || 'production',

        BROADCAST_WORKER: 'rust',
      },
    },

    // ---------------------------------------------------------------------
    // SabFlow Execution Worker
    // ---------------------------------------------------------------------
    {
      name: 'sabflow-worker',

      script: './node_modules/.bin/tsx',
      args: 'src/workers/sabflow-worker.ts',

      instances: process.env.SABFLOW_WORKER_INSTANCES
        ? parseInt(process.env.SABFLOW_WORKER_INSTANCES, 10)
        : 1,

      exec_mode: 'fork',

      watch: false,
      autorestart: true,

      restart_delay: 5000,
      max_restarts: 50,
      kill_timeout: 30000,

      env: {
        NODE_ENV: 'production',

        MONGODB_URI: process.env.MONGODB_URI,
        MONGODB_DB: process.env.MONGODB_DB,

        REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
        REDIS_PORT: process.env.REDIS_PORT || '6379',
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,

        SABFLOW_WORKER_CONCURRENCY: process.env.SABFLOW_WORKER_CONCURRENCY || '10',
      },
    },

    // ---------------------------------------------------------------------
    // Legacy Worker
    // ---------------------------------------------------------------------
    {
      name: 'sabnode-worker',

      script: './worker.js',

      instances: 1,
      exec_mode: 'fork',

      watch: false,
      autorestart: true,

      restart_delay: 10000,
      max_restarts: 20,

      env: {
        NODE_ENV: 'production',
        BROADCAST_USE_BULLMQ: '1',
      },
    },
  ].filter(Boolean),
};