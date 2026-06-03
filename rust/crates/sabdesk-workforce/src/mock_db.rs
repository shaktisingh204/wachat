use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use std::collections::HashMap;

use crate::models::{
    AgentShift, TimeOffRequest, ForecastingModel, AttendanceLog, ShiftSwapRequest
};

#[derive(Debug, Default, Clone)]
pub struct MockDatabase {
    pub shifts: HashMap<Uuid, AgentShift>,
    pub time_off_requests: HashMap<Uuid, TimeOffRequest>,
    pub forecasts: HashMap<Uuid, ForecastingModel>,
    pub attendance_logs: HashMap<Uuid, AttendanceLog>,
    pub shift_swaps: HashMap<Uuid, ShiftSwapRequest>,
}

pub type DbState = Arc<RwLock<MockDatabase>>;

impl MockDatabase {
    pub fn new() -> Self {
        Self {
            shifts: HashMap::new(),
            time_off_requests: HashMap::new(),
            forecasts: HashMap::new(),
            attendance_logs: HashMap::new(),
            shift_swaps: HashMap::new(),
        }
    }
}
