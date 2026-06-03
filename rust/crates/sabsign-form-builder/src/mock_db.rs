use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::{CanvasField, FormAnalytics, FormTemplate};

pub type DbMap<T> = HashMap<Uuid, T>;

#[derive(Debug, Clone)]
pub struct AppState {
    pub fields: Arc<RwLock<DbMap<CanvasField>>>,
    pub forms: Arc<RwLock<DbMap<FormTemplate>>>,
    pub analytics: Arc<RwLock<DbMap<FormAnalytics>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            fields: Arc::new(RwLock::new(HashMap::new())),
            forms: Arc::new(RwLock::new(HashMap::new())),
            analytics: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
