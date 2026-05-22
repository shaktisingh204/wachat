use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Campaign {
    pub id: Uuid,
    pub name: String,
    pub cron_expression: String,
    pub segment_id: Uuid,
    pub message_body: String,
    pub from_sender: String,
    pub is_active: bool,
    pub last_run_at: Option<DateTime<Utc>>,
    pub throttle_rate_per_sec: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contact {
    pub id: Uuid,
    pub phone_number: String,
}
