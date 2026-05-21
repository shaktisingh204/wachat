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
    // SabWa Node (personal WhatsApp — Node.js HTTP server + Baileys)
    // ---------------------------------------------------------------------
    {
      name: 'sabwa-node',
      cwd: './services/sabwa-node',
      // Run the built artefact directly — no shell/pnpm needed on the
      // server PATH. Build first with `npm run build` in this dir.
      script: 'dist/index.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: '4001',
        // Accept either MONGO_URL or MONGODB_URI — the service reads
        // both. Fall through to the repo-wide MONGODB_URI used by
        // sabnode-api / broadcast-worker so a single .env line works.
        MONGO_URL: process.env.MONGO_URL || process.env.MONGODB_URI,
        MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL,
        MONGODB_DB: process.env.MONGODB_DB || 'sabnode',
        REDIS_URL: process.env.REDIS_URL,
        REDIS_HOST: process.env.REDIS_HOST,
        REDIS_PORT: process.env.REDIS_PORT,
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,
        SABWA_ENGINE_TOKEN: process.env.SABWA_ENGINE_TOKEN,
        SABWA_JWT_SECRET: process.env.SABWA_JWT_SECRET,
        AUTH_STATE_KEY: process.env.AUTH_STATE_KEY,
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      kill_timeout: 10000,
    },

    // ---------------------------------------------------------------------
    // SabSMS Engine (Rust — multi-provider SMS/MMS/RCS pipeline)
    // ---------------------------------------------------------------------
    {
      name: 'sabsms-engine',
      cwd: './services/sabsms-engine',
      script: './target/release/sabsms-engine',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      kill_timeout: 10000,
      env: {
        SABSMS_PORT: process.env.SABSMS_PORT || '4002',
        SABSMS_ENGINE_TOKEN: process.env.SABSMS_ENGINE_TOKEN,
        SABSMS_APP_CALLBACK_URL:
          process.env.SABSMS_APP_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL,
        SABSMS_WORKER_CONCURRENCY: process.env.SABSMS_WORKER_CONCURRENCY || '8',
        SABSMS_TWILIO_ACCOUNT_SID: process.env.SABSMS_TWILIO_ACCOUNT_SID,
        SABSMS_TWILIO_AUTH_TOKEN: process.env.SABSMS_TWILIO_AUTH_TOKEN,
        SABSMS_TWILIO_DEFAULT_FROM: process.env.SABSMS_TWILIO_DEFAULT_FROM,
        SABSMS_DEFAULT_WORKSPACE: process.env.SABSMS_DEFAULT_WORKSPACE,
        SABSMS_ALLOW_UNSIGNED_WEBHOOKS:
          process.env.SABSMS_ALLOW_UNSIGNED_WEBHOOKS || 'false',
        MONGO_URL: process.env.MONGO_URL || process.env.MONGODB_URI,
        MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL,
        MONGODB_DB: process.env.MONGODB_DB || 'sabnode',
        REDIS_URL: process.env.REDIS_URL,
        RUST_LOG: process.env.RUST_LOG || 'info,sabsms_engine=debug',
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

        // SabSMS engine (Rust)
        SABSMS_ENABLED: process.env.SABSMS_ENABLED || 'false',
        SABSMS_ENGINE_URL:
          process.env.SABSMS_ENGINE_URL || 'http://127.0.0.1:4002',
        SABSMS_ENGINE_TOKEN: process.env.SABSMS_ENGINE_TOKEN,
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

    // ---------------------------------------------------------------------
    // SabNode Cron Worker
    // Single-instance node-cron tick that pings /api/cron/[job] on the
    // Next.js app. See scripts/cron-worker.mjs and scripts/CRON_README.md.
    // ---------------------------------------------------------------------
    {
      name: 'sabnode-cron',
      script: 'scripts/cron-worker.mjs',
      cwd: __dirname,
      instances: 1,           // single instance, never cluster
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3000',
        CRON_SECRET: process.env.CRON_SECRET,
        TZ: 'UTC',
      },
      error_file: './logs/cron-error.log',
      out_file: './logs/cron-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ].filter(Boolean),
};