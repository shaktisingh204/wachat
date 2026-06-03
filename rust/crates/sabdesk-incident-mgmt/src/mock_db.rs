use crate::models::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone)]
pub struct MockDb {
    pub incidents: Arc<RwLock<HashMap<Uuid, MajorIncident>>>,
    pub war_rooms: Arc<RwLock<HashMap<Uuid, WarRoom>>>,
    pub status_pages: Arc<RwLock<HashMap<Uuid, PublicStatusPage>>>,
    pub post_mortems: Arc<RwLock<HashMap<Uuid, PostMortem>>>,
    pub communications: Arc<RwLock<HashMap<Uuid, CommunicationLog>>>,
}

impl MockDb {
    pub fn new() -> Self {
        Self {
            incidents: Arc::new(RwLock::new(HashMap::new())),
            war_rooms: Arc::new(RwLock::new(HashMap::new())),
            status_pages: Arc::new(RwLock::new(HashMap::new())),
            post_mortems: Arc::new(RwLock::new(HashMap::new())),
            communications: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
