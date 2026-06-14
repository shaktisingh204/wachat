//! Shared state for ad-manager handlers — Mongo plus a process-wide
//! `reqwest` client for talking to graph.facebook.com.

use std::sync::Arc;

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct AdManagerState {
    pub mongo: MongoHandle,
    pub http: Arc<reqwest::Client>,
    /// Pinned Graph API version. v23.0 matches the legacy TS code.
    pub graph_version: String,
}

impl AdManagerState {
    pub fn new(mongo: MongoHandle) -> Self {
        let http = Arc::new(
            reqwest::Client::builder()
                // The legacy axios calls used the default 0-timeout (i.e. no
                // timeout). Async insights jobs can take >60s for large
                // accounts, so we lean generous here. The axum router-level
                // 30s timeout doesn't apply to outbound calls.
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .expect("reqwest client"),
        );
        Self {
            mongo,
            http,
            graph_version: "v25.0".to_owned(),
        }
    }
}
