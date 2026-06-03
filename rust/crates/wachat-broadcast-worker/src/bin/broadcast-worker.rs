//! `broadcast-worker` binary — drains the BullMQ `broadcast-control` and
//! `broadcast-send` queues using the native Rust consumer in
//! `wachat-queue::consumer`.
//!
//! Replaces the PM2-managed Node workers spawned from
//! `src/workers/broadcast/index.js`. Wires Mongo + Redis + a
//! `BullProducer` (so the send handler can re-enqueue retry batches)
//! and runs `ControlJobHandler` + `SendJobHandler` concurrently. Exits
//! cleanly on SIGTERM / SIGINT after letting in-flight jobs drain.

use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use sabnode_db::{mongo::MongoHandle, redis::RedisHandle};
use tracing::{error, info, warn};
use tracing_subscriber::{EnvFilter, fmt};
use wachat_queue::BullProducer;
use wachat_rate_limit::{BroadcastLimiter, TokenBucket};

use wachat_broadcast_worker::queue_compat::{Worker, WorkerOptions};
use wachat_broadcast_worker::{ControlConfig, ControlJobHandler, SendConfig, SendJobHandler};

#[tokio::main(flavor = "multi_thread")]
async fn main() -> Result<()> {
    init_tracing();

    let cfg = AppConfig::from_env()?;
    info!(?cfg, "broadcast-worker starting");

    // ---- Connect Mongo + Redis ------------------------------------------
    let mongo = MongoHandle::connect(&cfg.mongo_uri, &cfg.mongo_db)
        .await
        .context("connect Mongo")?;
    let redis = RedisHandle::connect(&cfg.redis_url)
        .await
        .context("connect Redis")?;

    // Health probes — fail fast if either is wedged.
    mongo.ping().await.context("Mongo ping")?;
    redis.ping().await.context("Redis ping")?;

    let bull = BullProducer::new(redis.clone());
    let limiter = BroadcastLimiter::new(TokenBucket::new(redis.clone()));

    let http = reqwest::Client::builder()
        .pool_max_idle_per_host(cfg.http_connections)
        .timeout(Duration::from_secs(60))
        .build()
        .context("build reqwest client")?;

    // ---- Build handlers --------------------------------------------------
    let worker_id = format!("rust-{}", std::process::id());

    let control_handler = Arc::new(ControlJobHandler::new(
        mongo.clone(),
        bull.clone(),
        http.clone(),
        ControlConfig {
            batch_size: cfg.batch_size,
            checkpoint_every: cfg.checkpoint_every,
            cancel_check_every: cfg.cancel_check_every,
            api_version: cfg.api_version.clone(),
        },
        worker_id.clone(),
    ));

    let send_handler = Arc::new(SendJobHandler::new(
        mongo.clone(),
        bull.clone(),
        limiter.clone(),
        http.clone(),
        SendConfig {
            parallel: cfg.batch_parallel,
            max_retries: cfg.max_retries,
            retry_delay_ms: cfg.retry_delay_ms,
            default_mps: cfg.default_mps,
            api_version: cfg.api_version.clone(),
        },
    ));

    // ---- Build Workers (Agent 1's primitive) ---------------------------
    // Lock budgets match the Node workers exactly:
    //   control: 5 min lock, 1 min renew, 1 min stalled, max-stalled=2
    //   send:    2 min lock, 30s renew, 30s stalled, max-stalled=3
    let control_worker = Worker::new(
        redis.clone(),
        "broadcast-control",
        control_handler,
        WorkerOptions {
            concurrency: cfg.control_concurrency,
            lock_duration_ms: 5 * 60 * 1_000,
            lock_renew_ms: 60 * 1_000,
            stalled_interval_ms: 60 * 1_000,
            max_stalled_count: 2,
            ..Default::default()
        },
    );

    let send_worker = Worker::new(
        redis.clone(),
        "broadcast-send",
        send_handler,
        WorkerOptions {
            concurrency: cfg.send_concurrency,
            lock_duration_ms: 2 * 60 * 1_000,
            lock_renew_ms: 30 * 1_000,
            stalled_interval_ms: 30 * 1_000,
            max_stalled_count: 3,
            ..Default::default()
        },
    );

    // ---- Run with graceful shutdown ------------------------------------
    let control_task = tokio::spawn(async move {
        if let Err(e) = control_worker.run().await {
            error!(error = ?e, "control worker exited with error");
        }
    });
    let send_task = tokio::spawn(async move {
        if let Err(e) = send_worker.run().await {
            error!(error = ?e, "send worker exited with error");
        }
    });

    info!("broadcast-worker ready");

    let shutdown = wait_for_shutdown();
    tokio::select! {
        _ = shutdown => {
            info!("shutdown signal received; draining workers");
        }
        _ = control_task => warn!("control worker task ended unexpectedly"),
        _ = send_task => warn!("send worker task ended unexpectedly"),
    }

    // The `Worker::run` future internally observes its own cancellation
    // via task drop. Give it a window to finish in-flight jobs so we
    // don't leave half-processed batches behind.
    tokio::time::sleep(Duration::from_secs(2)).await;
    info!("broadcast-worker exiting");
    Ok(())
}

/// Initialize `tracing` from `RUST_LOG` (defaults to `info`).
fn init_tracing() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let _ = fmt().with_env_filter(filter).with_target(false).try_init();
}

/// Resolve every env-driven knob this worker reads. Defaults match the
/// Node worker so a side-by-side cutover doesn't change behaviour.
#[derive(Debug, Clone)]
struct AppConfig {
    mongo_uri: String,
    mongo_db: String,
    redis_url: String,

    batch_size: usize,
    batch_parallel: usize,
    send_concurrency: usize,
    control_concurrency: usize,
    default_mps: u32,
    max_retries: u32,
    retry_delay_ms: u64,
    checkpoint_every: usize,
    cancel_check_every: usize,
    api_version: String,
    http_connections: usize,
}

impl AppConfig {
    fn from_env() -> Result<Self> {
        let mongo_uri = std::env::var("MONGODB_URI").context("MONGODB_URI not set")?;
        let mongo_db = std::env::var("MONGODB_DB").context("MONGODB_DB not set")?;
        let redis_url =
            std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_owned());

        Ok(Self {
            mongo_uri,
            mongo_db,
            redis_url,

            batch_size: env_usize("BROADCAST_BATCH_SIZE", 200),
            batch_parallel: env_usize("BROADCAST_BATCH_PARALLEL", 64),
            send_concurrency: env_usize("BROADCAST_SEND_CONCURRENCY", 64),
            control_concurrency: env_usize("BROADCAST_CONTROL_CONCURRENCY", 50),
            default_mps: env_u32("BROADCAST_DEFAULT_MPS", 80),
            max_retries: env_u32("BROADCAST_MAX_RETRIES", 3),
            retry_delay_ms: env_u64("BROADCAST_RETRY_DELAY_MS", 5_000),
            checkpoint_every: env_usize("BROADCAST_CHECKPOINT_EVERY", 10),
            cancel_check_every: env_usize("BROADCAST_CANCEL_CHECK_EVERY", 50),
            api_version: std::env::var("META_GRAPH_VERSION").unwrap_or_else(|_| "v23.0".to_owned()),
            http_connections: env_usize("BROADCAST_HTTP_CONNECTIONS", 256),
        })
    }
}

fn env_usize(key: &str, default: usize) -> usize {
    std::env::var(key)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(default)
}
fn env_u32(key: &str, default: u32) -> u32 {
    std::env::var(key)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(default)
}
fn env_u64(key: &str, default: u64) -> u64 {
    std::env::var(key)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(default)
}

/// Resolve when SIGINT or SIGTERM arrives. SIGTERM is what PM2 / systemd
/// send on graceful shutdown; SIGINT covers the dev `Ctrl+C` flow.
async fn wait_for_shutdown() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};
        let mut sigterm = signal(SignalKind::terminate()).expect("install SIGTERM handler");
        let mut sigint = signal(SignalKind::interrupt()).expect("install SIGINT handler");
        tokio::select! {
            _ = sigterm.recv() => info!("SIGTERM received"),
            _ = sigint.recv() => info!("SIGINT received"),
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
        info!("Ctrl+C received");
    }
}
