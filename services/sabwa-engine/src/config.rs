//! Process configuration loaded from environment variables.
//!
//! All env reads happen here so the rest of the crate can rely on a single
//! validated [`Config`] value carried inside [`crate::state::AppState`].

use anyhow::{Context, Result};

/// Runtime configuration for the sabwa-engine service.
#[derive(Debug, Clone)]
pub struct Config {
    /// TCP port the HTTP server binds to. Defaults to `4001`.
    pub port: u16,
    /// MongoDB connection string (e.g. `mongodb://localhost:27017`).
    pub mongodb_uri: String,
    /// Name of the Mongo database to operate on. Defaults to `sabnode`.
    pub mongodb_db: String,
    /// Redis connection string used for pub/sub and queues.
    pub redis_url: String,
    /// Shared secret that callers (Next.js server actions / route handlers)
    /// must present in the `X-Sabwa-Service-Token` header.
    pub service_token: String,
    /// HMAC secret used to sign outbound webhook payloads.
    pub webhook_signing_secret: String,
}

impl Config {
    /// Build a [`Config`] from process environment variables.
    ///
    /// Required vars: `MONGODB_URI`, `REDIS_URL`, `SABWA_ENGINE_TOKEN`.
    /// Optional vars: `SABWA_ENGINE_PORT` (default 4001),
    /// `MONGODB_DB` (default `sabnode`),
    /// `SABWA_WEBHOOK_SIGNING_SECRET` (defaults to the service token).
    pub fn from_env() -> Result<Self> {
        let port = std::env::var("SABWA_ENGINE_PORT")
            .ok()
            .map(|v| v.parse::<u16>())
            .transpose()
            .context("SABWA_ENGINE_PORT must be a valid u16")?
            .unwrap_or(4001);

        let mongodb_uri =
            std::env::var("MONGODB_URI").context("MONGODB_URI env var is required")?;
        let mongodb_db = std::env::var("MONGODB_DB").unwrap_or_else(|_| "sabnode".to_string());
        let redis_url = std::env::var("REDIS_URL").context("REDIS_URL env var is required")?;
        let service_token = std::env::var("SABWA_ENGINE_TOKEN")
            .context("SABWA_ENGINE_TOKEN env var is required")?;

        if service_token.trim().is_empty() {
            anyhow::bail!("SABWA_ENGINE_TOKEN must not be empty");
        }

        let webhook_signing_secret = std::env::var("SABWA_WEBHOOK_SIGNING_SECRET")
            .unwrap_or_else(|_| service_token.clone());

        Ok(Self {
            port,
            mongodb_uri,
            mongodb_db,
            redis_url,
            service_token,
            webhook_signing_secret,
        })
    }
}
