use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentProfile {
    pub id: Uuid,
    pub user_id: Uuid,
    pub total_points: i64,
    pub current_level: i32,
    pub badges: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Badge {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub icon_url: String,
    pub points_required: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PointsLedger {
    pub id: Uuid,
    pub agent_id: Uuid,
    pub points: i64,
    pub reason: String,
    pub source_id: Option<Uuid>, // e.g., ticket id, quest id
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Quest {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub points_reward: i64,
    pub requirements: serde_json::Value,
    pub active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LeaderboardEntry {
    pub rank: usize,
    pub agent_id: Uuid,
    pub total_points: i64,
    pub current_level: i32,
}
