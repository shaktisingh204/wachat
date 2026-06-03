use crate::models::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Default)]
pub struct AppState {
    pub db: Arc<MockDb>,
}

#[derive(Debug, Default)]
pub struct MockDb {
    pub workspaces: RwLock<HashMap<String, WorkspaceSettings>>,
    pub custom_forms: RwLock<HashMap<String, CustomFormSchema>>,
    pub channels: RwLock<HashMap<String, ChannelConfiguration>>,
    pub teams: RwLock<HashMap<String, Team>>,
    pub roles: RwLock<HashMap<String, RolePermission>>,
}

impl MockDb {
    pub fn new() -> Self {
        Self {
            workspaces: RwLock::new(HashMap::new()),
            custom_forms: RwLock::new(HashMap::new()),
            channels: RwLock::new(HashMap::new()),
            teams: RwLock::new(HashMap::new()),
            roles: RwLock::new(HashMap::new()),
        }
    }
}
