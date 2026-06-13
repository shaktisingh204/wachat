//! SabMail engine — entry point.
//!
//! Boots config, Mongo, the HTTP API, and a background journey ticker.
//! Mirrors the SabSMS engine but is leaner: send (lettre SMTP), journey
//! execution, and inbound binding only — no Redis, no IMAP sync (the
//! Next.js layer does on-demand IMAP reads and feeds inbound here).

use std::sync::Arc;
use std::time::Duration;

use anyhow::Context;
use axum::Router;
use tokio::signal;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use sabmail_engine::{config, db, handlers, journeys, state::AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(tracing_subscriber::fmt::layer().with_target(true))
        .init();

    let cfg = config::Config::from_env().context("loading sabmail-engine config")?;
    tracing::info!(port = cfg.port, mongo_db = %cfg.mongo_db, "starting sabmail-engine");
    if cfg.creds_key_hex.is_none() {
        tracing::warn!(
            "SABMAIL_CREDS_KEY/SABSMS_CREDS_KEY not set or wrong length — \
             SMTP send will fail until configured"
        );
    }

    let mongo = db::connect(&cfg).await.context("connecting to MongoDB")?;

    let state = Arc::new(AppState {
        cfg: cfg.clone(),
        mongo,
        http: reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("building reqwest client")?,
    });

    // Background journey ticker — advances due enrolled runs every N secs.
    let ticker_state = state.clone();
    tokio::spawn(async move {
        let interval = std::env::var("SABMAIL_JOURNEY_TICK_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(60)
            .max(5);
        let mut tick = tokio::time::interval(Duration::from_secs(interval));
        loop {
            tick.tick().await;
            match journeys::tick(&ticker_state).await {
                Ok(r) if r.processed > 0 => tracing::info!(
                    processed = r.processed,
                    sent = r.sent,
                    completed = r.completed,
                    failed = r.failed,
                    "journey tick"
                ),
                Ok(_) => {}
                Err(e) => tracing::error!(?e, "journey tick failed"),
            }
        }
    });

    let app: Router = handlers::router(state.clone())
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .layer(tower_http::limit::RequestBodyLimitLayer::new(8 * 1024 * 1024));

    let addr = format!("0.0.0.0:{}", cfg.port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .with_context(|| format!("binding {}", addr))?;
    tracing::info!(%addr, "sabmail-engine listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("axum::serve failed")?;

    tracing::info!("shutdown signal received");
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
