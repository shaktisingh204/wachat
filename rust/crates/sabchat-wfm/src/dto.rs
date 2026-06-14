//! Wire-format DTOs for the SabChat **WFM** forecast endpoint.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ForecastQuery {
    /// Look-back window in weeks (default 4, clamped 1..=26).
    #[serde(default)]
    pub weeks: Option<i64>,
    /// Inbox filter (optional).
    #[serde(default)]
    pub inbox_id: Option<String>,
    /// Conversations one agent can handle per hour (default 6).
    #[serde(default)]
    pub target_per_agent_per_hour: Option<f64>,
}

/// One hour-of-week slot in the forecast grid.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ForecastSlot {
    /// 0 = Sunday … 6 = Saturday.
    pub day_of_week: u8,
    /// 0..=23 local-to-UTC hour.
    pub hour: u8,
    /// Average inbound conversations in this slot across the window.
    pub avg_volume: f64,
    /// Recommended agents = ceil(avgVolume / targetPerAgentPerHour).
    pub recommended_agents: u32,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ForecastResponse {
    pub weeks: i64,
    pub target_per_agent_per_hour: f64,
    pub total_conversations: i64,
    /// Busiest slots first (for a quick "peak hours" read).
    pub slots: Vec<ForecastSlot>,
    /// Peak recommended agents across all slots (the staffing ceiling).
    pub peak_agents: u32,
}
