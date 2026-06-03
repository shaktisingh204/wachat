use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentPerformance {
    pub agent_id: Uuid,
    pub agent_name: String,
    pub tickets_resolved: u32,
    pub average_resolution_time_minutes: f64,
    pub average_first_response_time_minutes: f64,
    pub csat_average: f64,
    pub date_calculated: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CsatScore {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub agent_id: Uuid,
    pub customer_id: Uuid,
    pub score: u8, // e.g., 1 to 5
    pub feedback: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResolutionTime {
    pub ticket_id: Uuid,
    pub time_to_resolution_minutes: u32,
    pub resolved_at: DateTime<Utc>,
    pub severity: String,
    pub category: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeflectionRate {
    pub date: String, // e.g., "YYYY-MM-DD"
    pub total_kb_views: u32,
    pub total_bot_interactions: u32,
    pub successful_deflections: u32,
    pub deflection_rate_percentage: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LiveDashboardWidgets {
    pub active_agents_count: u32,
    pub tickets_in_queue: u32,
    pub current_sla_breach_rate: f64,
    pub active_chats: u32,
    pub top_trending_topics: Vec<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TicketVolume {
    pub date: String,
    pub received: u32,
    pub resolved: u32,
    pub escalated: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SlaCompliance {
    pub period: String,
    pub target_percentage: f64,
    pub actual_percentage: f64,
    pub total_tickets_evaluated: u32,
    pub breaches_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomerRetention {
    pub segment: String,
    pub retention_rate: f64,
    pub total_customers: u32,
    pub churned_customers: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueryTrend {
    pub keyword: String,
    pub frequency: u32,
    pub change_percentage_from_last_period: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagUsage {
    pub tag_name: String,
    pub count: u32,
}
