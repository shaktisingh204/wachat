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

        // SabPay (sabpay crate): platform PayU credentials + the public app
        // URL used for hosted-checkout links and the PayU surl/furl callback.
        PAYU_MERCHANT_KEY: process.env.PAYU_MERCHANT_KEY,
        PAYU_MERCHANT_SALT: process.env.PAYU_MERCHANT_SALT,
        PAYU_MODE: process.env.PAYU_MODE || 'test',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      },
    },

    // ---------------------------------------------------------------------
    // SabSites data layer — PostgREST over the sabsites Postgres database.
    // The builder itself runs INSIDE the Next.js app (src/app/sites);
    // PostgREST is its only extra process. Requires the `postgrest` binary
    // on PATH (or set SABSITES_POSTGREST_BIN) and Postgres 16 running with
    // the `sabsites` database migrated (see docs/sabsites/README.md).
    // ---------------------------------------------------------------------
    {
      name: 'sabsites-postgrest',
      script: process.env.SABSITES_POSTGREST_BIN || 'postgrest',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      kill_timeout: 10000,
      env: {
        PGRST_DB_URI:
          process.env.SABSITES_DATABASE_URL ||
          'postgres://sabsites:sabsites@localhost:5432/sabsites',
        PGRST_DB_SCHEMAS: 'public',
        PGRST_DB_ANON_ROLE: process.env.SABSITES_PG_ROLE || 'sabsites',
        PGRST_SERVER_PORT: process.env.SABSITES_POSTGREST_PORT || '4006',
        PGRST_JWT_SECRET: process.env.SABSITES_POSTGREST_JWT_SECRET,
      },
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
    // SabSMS Events Consumer (Node — reads the engine's `sabsms:events`
    // Redis Stream via consumer group `sabsms-next`; writes the 30-day
    // event log + inbox poke keys). Same tsx bootstrap as sabflow-worker.
    // ---------------------------------------------------------------------
    {
      name: 'sabsms-events',

      script: './node_modules/.bin/tsx',
      args: 'scripts/sabsms-events-worker.mjs',

      instances: 1,
      exec_mode: 'fork',

      watch: false,
      autorestart: true,

      restart_delay: 5000,
      max_restarts: 50,
      kill_timeout: 10000,

      env: {
        NODE_ENV: 'production',

        MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL,
        MONGODB_DB: process.env.MONGODB_DB || 'sabnode',

        REDIS_URL: process.env.REDIS_URL,
        REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
        REDIS_PORT: process.env.REDIS_PORT || '6379',
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,

        // `server-only` poison-pill → benign stub (see sabflow-worker).
        NODE_PATH: './src/workers/_stubs',
      },
    },

    // ---------------------------------------------------------------------
    // SabSMS Credits Sweeper (Node — long-lived 60s interval that calls
    // releaseExpiredHolds(200) so expired 15-min credit holds are refunded
    // on a fixed clock instead of only on incoming credits-route traffic).
    // Same tsx + NODE_PATH stub bootstrap as sabsms-events.
    // ---------------------------------------------------------------------
    {
      name: 'sabsms-credits-sweeper',

      script: './node_modules/.bin/tsx',
      args: 'scripts/sabsms-credits-sweeper.mjs',

      instances: 1,
      exec_mode: 'fork',

      watch: false,
      autorestart: true,

      restart_delay: 5000,
      max_restarts: 50,
      kill_timeout: 10000,

      env: {
        NODE_ENV: 'production',

        MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL,
        MONGODB_DB: process.env.MONGODB_DB || 'sabnode',

        SABSMS_SWEEP_INTERVAL_MS: process.env.SABSMS_SWEEP_INTERVAL_MS || '60000',
        SABSMS_SWEEP_BATCH: process.env.SABSMS_SWEEP_BATCH || '200',

        // ledger.ts imports `server-only` → benign stub (see sabsms-events).
        NODE_PATH: './src/workers/_stubs',
      },
    },

    // ---------------------------------------------------------------------
    // SabMail Sync Worker — long-lived IMAP IDLE listener per connected
    // mailbox; fans new mail into Mongo + publishes to Redis (real-time inbox).
    // Same tsx + NODE_PATH-stub bootstrap as sabsms-events. No-ops until
    // mailboxes are connected; needs SABMAIL_CREDS_KEY to decrypt creds.
    // ---------------------------------------------------------------------
    {
      name: 'sabmail-sync',

      script: './node_modules/.bin/tsx',
      args: 'src/workers/sabmail-sync.ts',

      instances: 1,
      exec_mode: 'fork',

      watch: false,
      autorestart: true,

      restart_delay: 5000,
      max_restarts: 50,
      kill_timeout: 10000,

      env: {
        NODE_ENV: 'production',

        MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL,
        MONGODB_DB: process.env.MONGODB_DB || 'sabnode',

        REDIS_URL: process.env.REDIS_URL,
        REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
        REDIS_PORT: process.env.REDIS_PORT || '6379',
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,

        SABMAIL_CREDS_KEY: process.env.SABMAIL_CREDS_KEY || process.env.SABSMS_CREDS_KEY,
        SABMAIL_ENABLED: process.env.SABMAIL_ENABLED || 'false',

        // Where the worker POSTs newly-seen mail for binding (conversation +
        // screener + rules + journey trigger) via the internal route.
        SABMAIL_APP_URL: process.env.SABMAIL_APP_URL || process.env.NEXT_PUBLIC_APP_URL,
        CRON_SECRET: process.env.CRON_SECRET,

        // credentials.ts / imapflow are tsx-safe; server-only modules → stub.
        NODE_PATH: './src/workers/_stubs',
      },
    },

    // ---------------------------------------------------------------------
    // SabMail Push-Sync Worker — drains Gmail Pub/Sub + Graph change-notif
    // markers from sabmail_events and POSTs each to the internal push-sync
    // route, which hydrates messages via the provider adapters. No-ops until
    // an OAuth-connected Gmail/Outlook account exists + SABMAIL_APP_URL is set.
    // ---------------------------------------------------------------------
    {
      name: 'sabmail-push-sync',

      script: './node_modules/.bin/tsx',
      args: 'src/workers/sabmail-push-sync.ts',

      instances: 1,
      exec_mode: 'fork',

      watch: false,
      autorestart: true,

      restart_delay: 5000,
      max_restarts: 50,
      kill_timeout: 10000,

      env: {
        NODE_ENV: 'production',

        MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL,
        MONGODB_DB: process.env.MONGODB_DB || 'sabnode',

        // POSTs markers to /api/sabmail/internal/push-sync (CRON_SECRET-auth).
        SABMAIL_APP_URL: process.env.SABMAIL_APP_URL || process.env.NEXT_PUBLIC_APP_URL,
        CRON_SECRET: process.env.CRON_SECRET,

        // Worker inlines the events collection name, but keep the stub on
        // NODE_PATH for parity with sabmail-sync (any future server-only pull).
        NODE_PATH: './src/workers/_stubs',
      },
    },

    // ---------------------------------------------------------------------
    // SabMail Engine (Rust — services/sabmail-engine). Owns SMTP send
    // (lettre), journey execution (background ticker), and inbound binding
    // (POST /v1/inbound). Shares the `sabmail_*` Mongo collections with the
    // Next layer; reached via src/lib/sabmail/engine-client.ts when
    // SABMAIL_ENABLED=true. Decrypts mailbox creds with SABMAIL_CREDS_KEY.
    // ---------------------------------------------------------------------
    {
      name: 'sabmail-engine',
      cwd: './services/sabmail-engine',
      script: './target/release/sabmail-engine',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      kill_timeout: 10000,
      env: {
        SABMAIL_PORT: process.env.SABMAIL_PORT || '4003',
        SABMAIL_ENGINE_TOKEN: process.env.SABMAIL_ENGINE_TOKEN,
        SABMAIL_CREDS_KEY: process.env.SABMAIL_CREDS_KEY || process.env.SABSMS_CREDS_KEY,
        SABMAIL_APP_CALLBACK_URL:
          process.env.SABMAIL_APP_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL,
        SABMAIL_JOURNEY_TICK_SECS: process.env.SABMAIL_JOURNEY_TICK_SECS || '60',
        MONGO_URL: process.env.MONGO_URL || process.env.MONGODB_URI,
        MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL,
        MONGODB_DB: process.env.MONGODB_DB || 'sabnode',
        RUST_LOG: process.env.RUST_LOG || 'info,sabmail_engine=debug',
      },
    },

    // ---------------------------------------------------------------------
    // SabSMS Identity Nightly (V2.10 — recompute 30-day engagement
    // counters + decay the send-time histogram on `sabsms_identities`).
    // Run-to-completion: PM2 fires it daily via cron_restart, NOT a daemon,
    // so autorestart is OFF — the process exits when the job finishes.
    // ---------------------------------------------------------------------
    {
      name: 'sabsms-identity-nightly',

      script: './node_modules/.bin/tsx',
      args: 'scripts/sabsms-identity-nightly.mjs',

      instances: 1,
      exec_mode: 'fork',

      watch: false,
      autorestart: false,
      cron_restart: '30 2 * * *', // 02:30 UTC daily

      kill_timeout: 30000,

      env: {
        NODE_ENV: 'production',
        TZ: 'UTC',

        MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL,
        MONGODB_DB: process.env.MONGODB_DB || 'sabnode',

        // graph.ts is worker-safe (no server-only), but keep the stub on
        // NODE_PATH for parity with the other SabSMS workers.
        NODE_PATH: './src/workers/_stubs',
      },
    },

    // ---------------------------------------------------------------------
    // SabSMS Insights Nightly (V2.12 — LLM map-reduce miner that writes
    // `sabsms_conversation_insights` for the inbox insights card). Same
    // run-to-completion cron pattern as sabsms-identity-nightly; no-op
    // exit-0 when no LLM gateway key is configured.
    // ---------------------------------------------------------------------
    {
      name: 'sabsms-insights-nightly',

      script: './node_modules/.bin/tsx',
      args: 'scripts/sabsms-insights-nightly.mjs',

      instances: 1,
      exec_mode: 'fork',

      watch: false,
      autorestart: false,
      cron_restart: '15 3 * * *', // 03:15 UTC daily

      kill_timeout: 30000,

      env: {
        NODE_ENV: 'production',
        TZ: 'UTC',

        MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL,
        MONGODB_DB: process.env.MONGODB_DB || 'sabnode',

        // LLM gateway ladder (mining.ts → agent/llm.ts). All optional;
        // with none set the run exits 0 having done nothing.
        AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,

        // mining.ts is worker-safe (no server-only); keep the stub on
        // NODE_PATH for parity with the other SabSMS workers.
        NODE_PATH: './src/workers/_stubs',
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

        // The TS-engine path (forge/app-preset flows) imports library code
        // that begins with `import 'server-only'`. Next strips that at build
        // time; plain tsx cannot, and the real package throws outside a
        // React Server environment. Resolve it to the benign local stub.
        NODE_PATH: './src/workers/_stubs',
      },
    },

    // ---------------------------------------------------------------------
    // SabFlow Scheduler (fires `schedule` trigger events every minute)
    // ---------------------------------------------------------------------
    {
      name: 'sabflow-scheduler',

      script: './node_modules/.bin/tsx',
      args: 'src/workers/sabflow-scheduler.ts',

      instances: 1,
      exec_mode: 'fork',

      watch: false,
      autorestart: true,

      restart_delay: 5000,
      max_restarts: 50,
      kill_timeout: 10000,

      env: {
        NODE_ENV: 'production',

        MONGODB_URI: process.env.MONGODB_URI,
        MONGODB_DB: process.env.MONGODB_DB,

        REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
        REDIS_PORT: process.env.REDIS_PORT || '6379',
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,

        CRON_SECRET: process.env.CRON_SECRET,
        SABNODE_INTERNAL_URL: process.env.SABNODE_INTERNAL_URL || 'http://127.0.0.1:3002',
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