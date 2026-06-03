use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::{
    BrandProfile, ComplianceSetting, EmailTemplate, LegalDisclosure, SecurityConfig,
};

#[derive(Debug, Default, Clone)]
pub struct AppState {
    pub db: Arc<RwLock<MockDb>>,
}

#[derive(Debug, Default)]
pub struct MockDb {
    pub brands: HashMap<Uuid, BrandProfile>,
    pub templates: HashMap<Uuid, EmailTemplate>,
    pub disclosures: HashMap<Uuid, LegalDisclosure>,
    pub security_configs: HashMap<Uuid, SecurityConfig>,
    pub compliance_settings: HashMap<Uuid, ComplianceSetting>,
}

impl MockDb {
    pub fn new() -> Self {
        Self {
            brands: HashMap::new(),
            templates: HashMap::new(),
            disclosures: HashMap::new(),
            security_configs: HashMap::new(),
            compliance_settings: HashMap::new(),
        }
    }
}
