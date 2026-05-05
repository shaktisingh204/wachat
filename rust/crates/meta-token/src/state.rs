//! Shared state for `meta-token` handlers.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles every token endpoint needs.
///
/// We deliberately keep our own `reqwest::Client` here rather than reusing
/// `wachat_meta_client::MetaClient`: most token endpoints
/// (`debug_token`, `oauth/access_token`, `me/permissions`, `?fields=…`)
/// authenticate via **query string** rather than `Authorization: Bearer …`,
/// which is the one shape the shared `MetaClient` does not directly support.
/// Reusing the same `reqwest::Client` connection pool would still be possible
/// in a follow-up — for now this crate owns its own client (default pooling
/// is plenty for these low-volume endpoints).
#[derive(Clone)]
pub struct MetaTokenState {
    pub mongo: MongoHandle,
    pub http: reqwest::Client,
    pub app_id: String,
    pub app_secret: String,
}

impl MetaTokenState {
    pub fn new(mongo: MongoHandle, app_id: String, app_secret: String) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("reqwest client must build with default config");
        Self {
            mongo,
            http,
            app_id,
            app_secret,
        }
    }

    /// Returns `true` when both `app_id` and `app_secret` are present.
    /// Endpoints that need the app-level token short-circuit when this is
    /// false so the surface error is "server credentials not configured"
    /// (mirrors the legacy TS code).
    pub fn app_creds_configured(&self) -> bool {
        !self.app_id.is_empty() && !self.app_secret.is_empty()
    }

    /// Build the Meta app-level token (`{app_id}|{app_secret}`).
    pub fn app_token(&self) -> String {
        format!("{}|{}", self.app_id, self.app_secret)
    }
}
