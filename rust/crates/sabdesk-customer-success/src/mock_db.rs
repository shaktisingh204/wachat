use crate::models::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Default, Clone)]
pub struct MockDb {
    pub health_scores: Arc<RwLock<HashMap<Uuid, HealthScore>>>,
    pub accounts: Arc<RwLock<HashMap<Uuid, Account>>>,
    pub qbr_templates: Arc<RwLock<HashMap<Uuid, QbrTemplate>>>,
    pub churn_predictions: Arc<RwLock<HashMap<Uuid, ChurnPrediction>>>,
    pub success_plans: Arc<RwLock<HashMap<Uuid, SuccessPlan>>>,
}

impl MockDb {
    pub fn new() -> Self {
        Self {
            health_scores: Arc::new(RwLock::new(HashMap::new())),
            accounts: Arc::new(RwLock::new(HashMap::new())),
            qbr_templates: Arc::new(RwLock::new(HashMap::new())),
            churn_predictions: Arc::new(RwLock::new(HashMap::new())),
            success_plans: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
