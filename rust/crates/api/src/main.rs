//! `sabnode-api` binary entrypoint.
//!
//! Boots the tokio runtime, loads configuration, initializes tracing and DB
//! handles, builds the router, serves HTTP with graceful shutdown on
//! SIGINT/SIGTERM.

mod router;
mod routes;
mod state;

use std::{net::SocketAddr, sync::Arc};

use anyhow::Context;
use common::Settings;
use sabnode_auth::AuthConfig;
use sabnode_db::{mongo::MongoHandle, redis::RedisHandle};
use tokio::{net::TcpListener, signal};
use tracing::{error, info};

use crate::state::AppState;

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();

    if let Err(e) = run().await {
        // Tracing may or may not be initialized at the failure point, so log
        // to stderr too for unattended boots.
        eprintln!("FATAL: {e:#}");
        error!(error = ?e, "fatal startup error");
        std::process::exit(1);
    }
}

async fn run() -> anyhow::Result<()> {
    let settings: Settings = common::load_settings().context("loading Settings")?;
    common::tracing_init::init(&settings.env);

    info!(env = %settings.env, port = settings.port, "starting sabnode-api");

    let mongo_uri = std::env::var("MONGODB_URI").context("MONGODB_URI is required")?;
    let mongo_db = std::env::var("MONGODB_DB").context("MONGODB_DB is required")?;
    let redis_url = std::env::var("REDIS_URL").context("REDIS_URL is required")?;
    let jwt_secret = std::env::var("RUST_JWT_SECRET").context("RUST_JWT_SECRET is required")?;

    let mongo = MongoHandle::connect(&mongo_uri, &mongo_db)
        .await
        .context("connecting to MongoDB")?;
    mongo.ping().await.context("MongoDB initial ping")?;
    info!(db = %mongo_db, "mongodb connected");

    let redis = RedisHandle::connect(&redis_url)
        .await
        .context("connecting to Redis")?;
    redis.ping().await.context("Redis initial ping")?;
    info!("redis connected");

    let auth = Arc::new(AuthConfig {
        secret: jwt_secret.into_bytes(),
    });

    let state = AppState::new(mongo, redis, auth);
    let app = router::build(state.clone());

    let addr = SocketAddr::from(([0, 0, 0, 0], settings.port));
    let listener = TcpListener::bind(addr)
        .await
        .with_context(|| format!("binding {addr}"))?;
    info!(%addr, "listening");

    state.mark_ready();

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("axum::serve")?;

    info!("shutdown complete");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(e) = signal::ctrl_c().await {
            error!(error = %e, "failed to install Ctrl+C handler");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match signal::unix::signal(signal::unix::SignalKind::terminate()) {
            Ok(mut sig) => {
                sig.recv().await;
            }
            Err(e) => error!(error = %e, "failed to install SIGTERM handler"),
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => info!("received SIGINT, shutting down"),
        _ = terminate => info!("received SIGTERM, shutting down"),
    }
}
