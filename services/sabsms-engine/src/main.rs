//! SabSMS engine — entry point.
//!
//! Boots config, Mongo, Redis, the HTTP API, and the background send
//! worker. Graceful shutdown drains in-flight jobs before exit.

use std::sync::Arc;

use anyhow::Context;
use axum::Router;
use tokio::signal;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

mod auth;
mod compliance;
mod config;
mod creds;
mod credits;
mod db;
mod delayed;
mod errors;
mod handlers;
mod providers;
mod queue;
mod state;
mod types;
mod worker;

use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(tracing_subscriber::fmt::layer().with_target(true))
        .init();

    let cfg = config::Config::from_env().context("loading sabsms-engine config")?;
    tracing::info!(port = cfg.port, mongo_db = %cfg.mongo_db, "starting sabsms-engine");

    let mongo = db::connect(&cfg).await.context("connecting to MongoDB")?;
    db::ensure_indexes(&mongo).await.context("ensuring indexes")?;

    let redis = queue::connect(&cfg).await.context("connecting to Redis")?;

    let state = Arc::new(AppState {
        cfg: cfg.clone(),
        mongo,
        redis,
        http: reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .context("building reqwest client")?,
        creds_cache: creds::CredsCache::default(),
    });

    // Background send worker — single instance per process; pool size
    // controlled by SABSMS_WORKER_CONCURRENCY env (default 8).
    let worker_state = state.clone();
    let worker_handle = tokio::spawn(async move {
        if let Err(e) = worker::run(worker_state).await {
            tracing::error!(?e, "send worker exited with error");
        }
    });

    // Delayed-queue ticker — promotes due retries from the ZSET to the
    // main send list every second.
    let ticker_state = state.clone();
    tokio::spawn(async move {
        delayed::run_ticker(ticker_state).await;
    });

    let app: Router = handlers::router(state.clone())
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .layer(tower_http::limit::RequestBodyLimitLayer::new(2 * 1024 * 1024));

    let addr = format!("0.0.0.0:{}", cfg.port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .with_context(|| format!("binding {}", addr))?;
    tracing::info!(%addr, "sabsms-engine listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("axum::serve failed")?;

    tracing::info!("shutdown signal received — draining worker");
    worker_handle.abort();
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c().await.expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
