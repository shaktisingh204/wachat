use crate::models::{Envelope, EnvelopeStatus};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub envelopes: Arc<RwLock<HashMap<Uuid, Envelope>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            envelopes: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn insert_envelope(&self, envelope: Envelope) {
        let mut map = self.envelopes.write().await;
        map.insert(envelope.id, envelope);
    }

    pub async fn get_envelope(&self, id: &Uuid) -> Option<Envelope> {
        let map = self.envelopes.read().await;
        map.get(id).cloned()
    }

    pub async fn update_envelope(&self, id: &Uuid, envelope: Envelope) -> bool {
        let mut map = self.envelopes.write().await;
        if map.contains_key(id) {
            map.insert(*id, envelope);
            true
        } else {
            false
        }
    }

    pub async fn delete_envelope(&self, id: &Uuid) -> bool {
        let mut map = self.envelopes.write().await;
        map.remove(id).is_some()
    }

    pub async fn list_envelopes(&self) -> Vec<Envelope> {
        let map = self.envelopes.read().await;
        map.values().cloned().collect()
    }

    pub async fn filter_envelopes_by_status(&self, status: EnvelopeStatus) -> Vec<Envelope> {
        let map = self.envelopes.read().await;
        map.values()
            .filter(|e| e.status == status)
            .cloned()
            .collect()
    }
}
