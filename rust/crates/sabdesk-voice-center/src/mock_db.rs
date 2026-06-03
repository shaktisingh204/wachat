use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::*;

#[derive(Clone, Default)]
pub struct MockDb {
    pub calls: Arc<RwLock<HashMap<Uuid, CallSession>>>,
    pub ivr_nodes: Arc<RwLock<HashMap<Uuid, IvrNode>>>,
    pub recordings: Arc<RwLock<HashMap<Uuid, Recording>>>,
    pub transcripts: Arc<RwLock<HashMap<Uuid, Transcript>>>,
    pub agents: Arc<RwLock<HashMap<Uuid, VoiceAgent>>>,
}

impl MockDb {
    pub fn new() -> Self {
        Self {
            calls: Arc::new(RwLock::new(HashMap::new())),
            ivr_nodes: Arc::new(RwLock::new(HashMap::new())),
            recordings: Arc::new(RwLock::new(HashMap::new())),
            transcripts: Arc::new(RwLock::new(HashMap::new())),
            agents: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
