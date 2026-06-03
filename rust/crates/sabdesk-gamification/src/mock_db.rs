use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::{AgentProfile, Badge, PointsLedger, Quest};

#[derive(Clone, Default)]
pub struct MockDb {
    pub agents: Arc<RwLock<HashMap<Uuid, AgentProfile>>>,
    pub badges: Arc<RwLock<HashMap<Uuid, Badge>>>,
    pub ledger: Arc<RwLock<Vec<PointsLedger>>>,
    pub quests: Arc<RwLock<HashMap<Uuid, Quest>>>,
}

impl MockDb {
    pub fn new() -> Self {
        Self {
            agents: Arc::new(RwLock::new(HashMap::new())),
            badges: Arc::new(RwLock::new(HashMap::new())),
            ledger: Arc::new(RwLock::new(Vec::new())),
            quests: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
