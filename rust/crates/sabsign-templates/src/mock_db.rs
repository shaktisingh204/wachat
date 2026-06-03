use crate::models::{Envelope, Template, TemplateVersion};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Default, Clone)]
pub struct MockDb {
    pub templates: Arc<RwLock<HashMap<Uuid, Template>>>,
    pub template_versions: Arc<RwLock<HashMap<Uuid, Vec<TemplateVersion>>>>,
    pub envelopes: Arc<RwLock<HashMap<Uuid, Envelope>>>,
}

impl MockDb {
    pub fn new() -> Self {
        Self {
            templates: Arc::new(RwLock::new(HashMap::new())),
            template_versions: Arc::new(RwLock::new(HashMap::new())),
            envelopes: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
