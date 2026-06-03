use std::sync::Arc;
use tokio::sync::RwLock;

use crate::models::{ApiKey, EventDelivery, OauthApp, Webhook};

#[derive(Debug, Clone)]
pub struct MockDb {
    pub webhooks: Arc<RwLock<Vec<Webhook>>>,
    pub event_deliveries: Arc<RwLock<Vec<EventDelivery>>>,
    pub api_keys: Arc<RwLock<Vec<ApiKey>>>,
    pub oauth_apps: Arc<RwLock<Vec<OauthApp>>>,
}

impl MockDb {
    pub fn new() -> Self {
        Self {
            webhooks: Arc::new(RwLock::new(Vec::new())),
            event_deliveries: Arc::new(RwLock::new(Vec::new())),
            api_keys: Arc::new(RwLock::new(Vec::new())),
            oauth_apps: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

impl Default for MockDb {
    fn default() -> Self {
        Self::new()
    }
}
