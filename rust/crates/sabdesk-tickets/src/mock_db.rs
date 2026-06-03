use crate::models::*;
use bson::uuid::Uuid;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Default, Clone)]
pub struct AppState {
    pub db: Arc<RwLock<MockDatabase>>,
}

#[derive(Default, Clone)]
pub struct MockDatabase {
    pub tickets: HashMap<Uuid, Ticket>,
    pub messages: HashMap<Uuid, Vec<TicketMessage>>,
    pub logs: HashMap<Uuid, Vec<TicketActivityLog>>,
    pub users: HashMap<Uuid, User>,
    pub tags: HashMap<Uuid, TicketTag>,
    pub views: HashMap<Uuid, TicketView>,
}

impl MockDatabase {
    pub fn new() -> Self {
        Self {
            tickets: HashMap::new(),
            messages: HashMap::new(),
            logs: HashMap::new(),
            users: HashMap::new(),
            tags: HashMap::new(),
            views: HashMap::new(),
        }
    }
}
