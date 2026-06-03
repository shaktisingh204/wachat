use crate::models::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Default, Clone)]
pub struct MockDb {
    pub sessions: HashMap<Uuid, NotarySession>,
    pub video_recordings: HashMap<Uuid, VideoRecording>,
    pub identity_checks: HashMap<Uuid, IdentityCheck>,
    pub journals: HashMap<Uuid, NotaryJournal>,
}

pub type Db = Arc<RwLock<MockDb>>;

pub fn new_db() -> Db {
    Arc::new(RwLock::new(MockDb::default()))
}
