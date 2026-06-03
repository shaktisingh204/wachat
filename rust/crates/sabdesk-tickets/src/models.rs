use bson::uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub role: UserRole,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UserRole {
    Admin,
    Agent,
    Customer,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlaPolicy {
    pub id: Uuid,
    pub name: String,
    pub response_time_mins: u32,
    pub resolution_time_mins: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TicketTag {
    pub id: Uuid,
    pub name: String,
    pub color_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicketMessage {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub sender_id: Uuid,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub is_internal_note: bool,
    pub attachments: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum TicketStatus {
    Open,
    InProgress,
    Pending,
    Resolved,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TicketPriority {
    Low,
    Medium,
    High,
    Urgent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicketActivityLog {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub actor_id: Uuid,
    pub action: String,
    pub details: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicketView {
    pub id: Uuid,
    pub name: String,
    pub conditions: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ticket {
    pub id: Uuid,
    pub subject: String,
    pub description: String,
    pub status: TicketStatus,
    pub priority: TicketPriority,
    pub requester_id: Uuid,
    pub assignee_id: Option<Uuid>,
    pub cc_emails: Vec<String>,
    pub tags: Vec<TicketTag>,
    pub sla_policy_id: Option<Uuid>,
    pub custom_fields: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub due_date: Option<DateTime<Utc>>,
}

// Request Models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTicketRequest {
    pub subject: String,
    pub description: String,
    pub priority: TicketPriority,
    pub requester_id: Uuid,
    pub custom_fields: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTicketRequest {
    pub subject: Option<String>,
    pub description: Option<String>,
    pub status: Option<TicketStatus>,
    pub priority: Option<TicketPriority>,
    pub assignee_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkUpdateTicketRequest {
    pub ticket_ids: Vec<Uuid>,
    pub status: Option<TicketStatus>,
    pub priority: Option<TicketPriority>,
    pub assignee_id: Option<Uuid>,
    pub add_tags: Option<Vec<TicketTag>>,
    pub remove_tags: Option<Vec<Uuid>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddMessageRequest {
    pub sender_id: Uuid,
    pub content: String,
    pub is_internal_note: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterTicketsRequest {
    pub status: Option<Vec<TicketStatus>>,
    pub priority: Option<Vec<TicketPriority>>,
    pub assignee_id: Option<Uuid>,
    pub requester_id: Option<Uuid>,
    pub has_tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignTicketRequest {
    pub assignee_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddTagRequest {
    pub tag: TicketTag,
}
