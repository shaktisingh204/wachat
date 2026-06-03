use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::{Trigger, Macro, SlaPolicy, RoutingRule, Ticket};

#[derive(Debug, Clone, Default)]
pub struct MockDb {
    pub triggers: Arc<RwLock<HashMap<Uuid, Trigger>>>,
    pub macros: Arc<RwLock<HashMap<Uuid, Macro>>>,
    pub sla_policies: Arc<RwLock<HashMap<Uuid, SlaPolicy>>>,
    pub routing_rules: Arc<RwLock<HashMap<Uuid, RoutingRule>>>,
    pub tickets: Arc<RwLock<HashMap<Uuid, Ticket>>>,
}

impl MockDb {
    pub fn new() -> Self {
        Self {
            triggers: Arc::new(RwLock::new(HashMap::new())),
            macros: Arc::new(RwLock::new(HashMap::new())),
            sla_policies: Arc::new(RwLock::new(HashMap::new())),
            routing_rules: Arc::new(RwLock::new(HashMap::new())),
            tickets: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
