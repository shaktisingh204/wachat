use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use uuid::Uuid;

use crate::models::{
    InstalledApp, WebhookSubscription, ApiLog, AppSecret, SyncJob
};

#[derive(Debug, Clone, Default)]
pub struct MockDb {
    pub apps: HashMap<Uuid, InstalledApp>,
    pub webhooks: HashMap<Uuid, WebhookSubscription>,
    pub api_logs: HashMap<Uuid, ApiLog>,
    pub app_secrets: HashMap<Uuid, AppSecret>,
    pub sync_jobs: HashMap<Uuid, SyncJob>,
}

pub type Db = Arc<RwLock<MockDb>>;

pub fn create_db() -> Db {
    Arc::new(RwLock::new(MockDb::default()))
}
