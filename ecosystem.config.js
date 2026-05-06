require('dotenv').config();
require('dotenv').config({ path: './rust/.env', override: false });

// ---------------------------------------------------------------------------
// BROADCAST_WORKER feature flag (Phase 9 of the wachat broadcast → Rust port)
// ---------------------------------------------------------------------------
//
// Values:
//   'node' (default) — boot the existing Node BullMQ worker at
//                      `src/workers/broadcast/index.js`. The Rust
//                      `broadcast-worker` binary is NOT started.
//   'rust'           — boot the Rust `broadcast-worker` binary instead
//                      (built from `rust/crates/wachat-broadcast-worker`
//                      by Agents 1+2). The Node worker is NOT started.
//
// Why a static filter and not just `autorestart` toggling: PM2 evaluates
// this file once on `pm2 start`. A static filter gives a single, atomic
// "what processes are alive" decision per deploy — much easier to reason
// about during a cutover than relying on runtime restart loops. To flip
// the flag, set `BROADCAST_WORKER=rust pm2 start ecosystem.config.js` (or
// `pm2 reload ecosystem.config.js` for zero-downtime when both binaries
// are already healthy in Redis).
//
// See `BROADCAST_WORKER_CUTOVER.md` at the repo root for the playbook.
const BROADCAST_WORKER = (process.env.BROADCAST_WORKER || 'node').toLowerCase();
if (BROADCAST_WORKER !== 'node' && BROADCAST_WORKER !== 'rust') {
  // Fail loud — typo'd value would silently start neither worker, which is
  // worse than crashing on boot.
  throw new Error(
    `BROADCAST_WORKER must be 'node' or 'rust', got '${process.env.BROADCAST_WORKER}'.`,
  );
}

const apps = [
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

  // ---------------------------------------------------------------------
  // Broadcast worker — Node implementation.
  //
  // Boots only when BROADCAST_WORKER=='node' (the default). Run multiple
  // instances for horizontal throughput — they coordinate via BullMQ +
  // Redis token buckets, so per-broadcast MPS is enforced globally
  // regardless of instance count.
  // ---------------------------------------------------------------------
  BROADCAST_WORKER === 'node' && {
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
      BROADCAST_WORKER: 'node',
      // Effectively-unlimited concurrent campaigns. There is no per-user or
      // per-project cap in code; with 4 PM2 instances these give 200 control
      // jobs and 256 send-batch jobs in flight at once. Per-broadcast MPS
      // (Redis token bucket) still keeps Meta API usage sane regardless.
      BROADCAST_CONTROL_CONCURRENCY: process.env.BROADCAST_CONTROL_CONCURRENCY || '50',
      BROADCAST_SEND_CONCURRENCY: process.env.BROADCAST_SEND_CONCURRENCY || '64',
    },
  },

  // ---------------------------------------------------------------------
  // Broadcast worker — Rust implementation (Phase 9 cutover).
  //
  // Boots only when BROADCAST_WORKER=='rust'. The binary path matches
  // what Agent 2 produces in `rust/crates/wachat-broadcast-worker` —
  // adjust if the crate name lands differently. Instances are pinned at
  // 1 by default because the Rust worker uses native async concurrency
  // for fan-out and does not need PM2 cluster-mode replication for
  // throughput. Bump `BROADCAST_WORKER_INSTANCES` only if Redis-side
  // sharding ever becomes necessary.
  // ---------------------------------------------------------------------
  BROADCAST_WORKER === 'rust' && {
    name: 'sabnode-broadcast-worker',
    cwd: './rust',
    // Use `cargo run --release` for symmetry with `sabnode-api`. In a
    // production deploy where the binary is pre-built, swap this for
    // `script: './target/release/broadcast-worker'` to skip the cargo
    // overhead on PM2 restart.
    script: 'cargo',
    args: 'run --release -p wachat-broadcast-worker',
    instances: process.env.BROADCAST_WORKER_INSTANCES
      ? parseInt(process.env.BROADCAST_WORKER_INSTANCES, 10)
      : 1,
    exec_mode: 'fork',
    watch: false,
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
      SABNODE_ENV: process.env.SABNODE_ENV || 'production',
      BROADCAST_WORKER: 'rust',
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
].filter(Boolean);

module.exports = { apps };
