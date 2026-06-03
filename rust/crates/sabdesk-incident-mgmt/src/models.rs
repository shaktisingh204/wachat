use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum IncidentSeverity {
    Sev1,
    Sev2,
    Sev3,
    Sev4,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum IncidentStatus {
    Identified,
    Investigating,
    Mitigated,
    Resolved,
    Closed,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MajorIncident {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub severity: IncidentSeverity,
    pub status: IncidentStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub reporter_id: Uuid,
    pub commander_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WarRoom {
    pub id: Uuid,
    pub incident_id: Uuid,
    pub meeting_link: String,
    pub slack_channel: String,
    pub active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PublicStatusPage {
    pub id: Uuid,
    pub incident_id: Uuid,
    pub headline: String,
    pub public_message: String,
    pub is_published: bool,
    pub last_updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PostMortem {
    pub id: Uuid,
    pub incident_id: Uuid,
    pub root_cause: Option<String>,
    pub resolution: Option<String>,
    pub action_items: Vec<String>,
    pub is_draft: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommunicationLog {
    pub id: Uuid,
    pub incident_id: Uuid,
    pub sender_id: Uuid,
    pub message: String,
    pub channels: Vec<String>,
    pub sent_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateIncidentRequest {
    pub title: String,
    pub description: String,
    pub severity: IncidentSeverity,
    pub reporter_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct UpdateIncidentStatusRequest {
    pub status: IncidentStatus,
}

#[derive(Debug, Deserialize)]
pub struct AssignCommanderRequest {
    pub commander_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct CreateWarRoomRequest {
    pub meeting_link: String,
    pub slack_channel: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStatusPageRequest {
    pub headline: String,
    pub public_message: String,
    pub is_published: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreatePostMortemRequest {
    pub root_cause: Option<String>,
    pub resolution: Option<String>,
    pub action_items: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePostMortemRequest {
    pub root_cause: Option<String>,
    pub resolution: Option<String>,
    pub action_items: Option<Vec<String>>,
    pub is_draft: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct BlastCommunicationRequest {
    pub sender_id: Uuid,
    pub message: String,
    pub channels: Vec<String>,
}
