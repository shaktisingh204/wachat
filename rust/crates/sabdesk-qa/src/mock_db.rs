use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::{
    CalibrationSession, Dispute, QaScorecard, QaSettings, TicketEvaluation,
};

#[derive(Debug, Default, Clone)]
pub struct MockDbState {
    pub scorecards: HashMap<Uuid, QaScorecard>,
    pub evaluations: HashMap<Uuid, TicketEvaluation>,
    pub disputes: HashMap<Uuid, Dispute>,
    pub calibration_sessions: HashMap<Uuid, CalibrationSession>,
    pub settings: Option<QaSettings>,
}

pub type MockDb = Arc<RwLock<MockDbState>>;

pub fn new_mock_db() -> MockDb {
    Arc::new(RwLock::new(MockDbState::default()))
}
