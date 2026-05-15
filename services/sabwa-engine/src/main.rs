//! sabwa-engine binary entrypoint.
//!
//! Boot order:
//!   1. Load `.env` (if present) via `dotenvy`.
//!   2. Initialise `tracing` with `RUST_LOG` / env-filter.
//!   3. Parse [`sabwa_engine::config::Config`] from the environment.
//!   4. Connect to MongoDB and verify with a `ping`.
//!   5. Build a Redis client (lazy — connections opened on demand).
//!   6. Build the Axum router via [`sabwa_engine::build_app`].
//!   7. Bind `0.0.0.0:{port}` and serve until SIGINT / SIGTERM.

use std::net::SocketAddr;

use anyhow::{Context, Result};
use mongodb::{bson::doc, options::ClientOptions, Client as MongoClient};
use tokio::signal;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

use sabwa_engine::{build_app, config::Config, crypto::AuthStateCrypto, state::AppState};

#[tokio::main]
async fn main() -> Result<()> {
    // 1. Load `.env` — silently ignored if the file is absent (production).
    let _ = dotenvy::dotenv();

    // 2. Tracing. `RUST_LOG=sabwa_engine=debug,tower_http=info` etc.
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,sabwa_engine=info,tower_http=info"));
    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().with_target(true))
        .init();

    // 3. Config.
    let config = Config::from_env().context("failed to load config from env")?;
    tracing::info!(
        port = config.port,
        mongodb_db = %config.mongodb_db,
        "sabwa-engine starting up"
    );

    // 4. Mongo client + ping.
    let mut mongo_opts = ClientOptions::parse(&config.mongodb_uri)
        .await
        .context("invalid MONGODB_URI")?;
    mongo_opts.app_name = Some("sabwa-engine".to_string());
    let mongo = MongoClient::with_options(mongo_opts).context("failed to build mongo client")?;
    mongo
        .database(&config.mongodb_db)
        .run_command(doc! { "ping": 1 })
        .await
        .context("mongo ping failed — check MONGODB_URI")?;
    let db = mongo.database(&config.mongodb_db);
    tracing::info!("mongo connected");

    // 5. Redis client. `redis::Client` is lazy; we open a single connection
    //    here purely to fail-fast on bad URLs / unreachable servers.
    let redis = redis::Client::open(config.redis_url.as_str()).context("invalid REDIS_URL")?;
    {
        let mut conn = redis
            .get_multiplexed_async_connection()
            .await
            .context("redis connection failed — check REDIS_URL")?;
        let _: String = redis::cmd("PING")
            .query_async(&mut conn)
            .await
            .context("redis ping failed")?;
    }
    tracing::info!("redis connected");

    // 6. App state + router.
    let port = config.port;
    let crypto = AuthStateCrypto::from_key_string(&config.auth_encryption_key)
        .context("failed to initialise auth-state crypto from SABWA_AUTH_ENCRYPTION_KEY")?;
    let state = AppState::new(config.clone(), mongo, db, redis, crypto);

    // 6a. Install the global WhatsApp session pool. Defaults to the real
    //     Baileys-sidecar-backed factory; set `SABWA_USE_STUB=1` to fall
    //     back to the in-process stub (used by integration tests and
    //     anyone running without Node installed).
    let use_stub = std::env::var("SABWA_USE_STUB")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    if use_stub {
        tracing::warn!("SABWA_USE_STUB=1 — wiring in-process stub WA factory");
        let factory = std::sync::Arc::new(sabwa_engine::wa::stub::StubFactory::new(
            state.redis.clone(),
        ));
        sabwa_engine::wa::pool::install(sabwa_engine::wa::pool::SessionPool::new(factory));
    } else {
        let supervisor =
            sabwa_engine::wa::baileys::BaileysSupervisor::spawn(&config, state.clone())
                .context("failed to spawn baileys sidecar supervisor")?;
        let factory =
            std::sync::Arc::new(sabwa_engine::wa::baileys::BaileysFactory::new(supervisor));
        sabwa_engine::wa::pool::install(sabwa_engine::wa::pool::SessionPool::new(factory));
        tracing::info!("baileys sidecar factory installed");
    }

    let app = build_app(state.clone());

    // 6b. Background workers (outbound queue drainer, inbound event
    //     persister, webhook dispatcher). Each runs on its own detached
    //     task; the supervisor in `workers::mod` logs failures.
    sabwa_engine::workers::spawn_all(state).await;

    // 7. Serve.
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("failed to bind {addr}"))?;
    tracing::info!(%addr, "sabwa-engine listening");

    axum::serve(listener, app.into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("server error")?;

    tracing::info!("sabwa-engine shutdown complete");
    Ok(())
}

/// Wait for Ctrl+C or SIGTERM and return so Axum can drain in-flight requests.
async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(err) = signal::ctrl_c().await {
            tracing::error!(error = %err, "failed to install Ctrl+C handler");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match signal::unix::signal(signal::unix::SignalKind::terminate()) {
            Ok(mut sig) => {
                sig.recv().await;
            }
            Err(err) => {
                tracing::error!(error = %err, "failed to install SIGTERM handler");
                std::future::pending::<()>().await;
            }
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => tracing::info!("received Ctrl+C, shutting down"),
        _ = terminate => tracing::info!("received SIGTERM, shutting down"),
    }
}
