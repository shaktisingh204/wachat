//! Wire DTOs for the flow-events metrics endpoints.
//!
//! Field names are `camelCase` to match the shape the flow-builder pages
//! consume (`getFlowMetrics` → `{ triggersToday, totalTriggers, lastTriggeredAt }`).

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Query for the batch endpoint `GET /?projectId=…`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BatchQuery {
    /// Project to aggregate flow metrics for. Scoped to the caller.
    pub project_id: String,
}

/// Trigger metrics for a single flow.
///
/// `lastTriggeredAt` is an ISO-8601 string (or `null` when the flow has no
/// recorded events yet); the counts are zero when there are no events.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FlowMetrics {
    /// Events whose `ts` falls on the current UTC day.
    pub triggers_today: u64,
    /// Total events ever recorded for the flow.
    pub total_triggers: u64,
    /// ISO-8601 timestamp of the most recent event, or `null` when none.
    pub last_triggered_at: Option<String>,
}

impl FlowMetrics {
    /// The all-zero / never-triggered baseline returned when a flow has no events.
    pub fn empty() -> Self {
        Self {
            triggers_today: 0,
            total_triggers: 0,
            last_triggered_at: None,
        }
    }
}

/// Response for the batch endpoint: a `flowId` (hex string) → metrics map.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(transparent)]
pub struct BatchMetricsResponse {
    pub metrics: HashMap<String, FlowMetrics>,
}
