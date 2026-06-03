use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Condition {
    pub field: String,
    pub operator: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionGroup {
    pub any: Vec<Condition>,
    pub all: Vec<Condition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    pub field: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trigger {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub conditions: ConditionGroup,
    pub actions: Vec<Action>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Macro {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub actions: Vec<Action>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlaPolicy {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub conditions: ConditionGroup,
    pub first_response_time_minutes: u32,
    pub resolution_time_minutes: u32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingRule {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub conditions: ConditionGroup,
    pub target_group_id: Option<Uuid>,
    pub target_agent_id: Option<Uuid>,
    pub weight: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ticket {
    pub id: Uuid,
    pub subject: String,
    pub status: String,
    pub priority: String,
    pub group_id: Option<Uuid>,
    pub assignee_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub custom_fields: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluationResult {
    pub ticket_id: Uuid,
    pub matched_triggers: Vec<Uuid>,
    pub matched_routing_rules: Vec<Uuid>,
    pub matched_sla_policies: Vec<Uuid>,
    pub applied_actions: Vec<Action>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlaBreachResult {
    pub ticket_id: Uuid,
    pub policy_id: Uuid,
    pub first_response_breached: bool,
    pub resolution_breached: bool,
    pub remaining_time_minutes: i32,
}
