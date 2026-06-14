//! SabCall voice engine entrypoint.

use std::net::SocketAddr;

use sabcall_engine::config::EngineConfig;
use sabcall_engine::{db, http, stasis, state::AppState};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,sabcall_engine=debug".into()),
        )
        .init();

    let cfg = EngineConfig::from_env();
    tracing::info!(
        enabled = cfg.enabled,
        port = cfg.port,
        ari = %cfg.ari_base_url,
        "starting sabcall-engine"
    );

    let database = db::connect(&cfg).await?;
    let port = cfg.port;
    let enabled = cfg.enabled;
    let state = AppState::new(cfg, database);

    // The Stasis loop only runs when the engine is enabled AND Asterisk is
    // reachable; when disabled we still serve /health for orchestration.
    if enabled {
        let loop_state = state.clone();
        tokio::spawn(async move {
            stasis::run(loop_state).await;
        });
    } else {
        tracing::warn!("SABCALL_ENABLED=false — Stasis loop NOT started (HTTP only)");
    }

    let app = http::router(state)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(%addr, "sabcall-engine listening");
    axum::serve(listener, app).await?;
    Ok(())
}
