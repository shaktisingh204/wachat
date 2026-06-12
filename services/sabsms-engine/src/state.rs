use mongodb::Database;
use redis::aio::ConnectionManager;

use crate::config::Config;
use crate::creds::CredsCache;
use crate::routing::policy::PolicyCache;

pub struct AppState {
    pub cfg: Config,
    pub mongo: Database,
    pub redis: ConnectionManager,
    pub http: reqwest::Client,
    /// 60s-TTL provider-credential cache (see `creds.rs`).
    pub creds_cache: CredsCache,
    /// 60s-TTL routing-policy cache (see `routing/policy.rs`).
    pub routing_cache: PolicyCache,
}
