use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::{ChangeRequest, HardwareAsset, Incident, Problem, SoftwareLicense};

#[derive(Debug, Default)]
pub struct AppState {
    pub hardware_assets: HashMap<Uuid, HardwareAsset>,
    pub software_licenses: HashMap<Uuid, SoftwareLicense>,
    pub incidents: HashMap<Uuid, Incident>,
    pub problems: HashMap<Uuid, Problem>,
    pub change_requests: HashMap<Uuid, ChangeRequest>,
}

pub type SharedState = Arc<RwLock<AppState>>;

pub fn create_shared_state() -> SharedState {
    Arc::new(RwLock::new(AppState::default()))
}
