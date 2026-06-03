use crate::models::{AuditEvent, CertificateOfCompletion, CryptoHash};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Default, Clone)]
pub struct AppState {
    pub db: Arc<RwLock<MockDb>>,
}

#[derive(Default)]
pub struct MockDb {
    pub audit_events: HashMap<Uuid, AuditEvent>,
    pub crypto_hashes: HashMap<Uuid, CryptoHash>,
    pub certificates: HashMap<Uuid, CertificateOfCompletion>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            db: Arc::new(RwLock::new(MockDb::default())),
        }
    }
}
