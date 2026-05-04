//! Application configuration loader.
//!
//! Settings are merged from (in order, later overrides earlier):
//!   1. Built-in defaults
//!   2. Optional `config.toml` in the working directory
//!   3. Environment variables prefixed with `SABNODE_`
//!      (e.g. `SABNODE_PORT=8080`, `SABNODE_ENV=prod`, `SABNODE_LOG_LEVEL=info`)

use figment::{
    Figment,
    providers::{Env, Format, Serialized, Toml},
};
use serde::{Deserialize, Serialize};

/// Runtime settings shared by every binary in the workspace.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    /// TCP port the HTTP server binds to. Defaults to `8080`.
    pub port: u16,
    /// Deployment environment label: `"dev"`, `"staging"`, or `"prod"`.
    pub env: String,
    /// Default log level fallback when `RUST_LOG` is unset.
    pub log_level: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            port: 8080,
            env: "dev".to_owned(),
            log_level: "info".to_owned(),
        }
    }
}

/// Load `Settings` from defaults, optional `config.toml`, then `SABNODE_*` env.
#[allow(clippy::result_large_err)] // figment::Error is large; only used at startup, not hot path
pub fn load() -> Result<Settings, figment::Error> {
    Figment::new()
        .merge(Serialized::defaults(Settings::default()))
        .merge(Toml::file("config.toml"))
        .merge(Env::prefixed("SABNODE_"))
        .extract()
}
