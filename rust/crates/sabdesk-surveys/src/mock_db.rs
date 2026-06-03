use crate::models::{Response, SurveyTemplate};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone, Default)]
pub struct AppState {
    pub surveys: Arc<RwLock<HashMap<Uuid, SurveyTemplate>>>,
    pub responses: Arc<RwLock<HashMap<Uuid, Response>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            surveys: Arc::new(RwLock::new(HashMap::new())),
            responses: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
