use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallSession {
    pub id: Uuid,
    pub caller_number: String,
    pub receiver_number: String,
    pub status: CallStatus,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub assigned_agent_id: Option<Uuid>,
    pub ivr_path: Vec<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum CallStatus {
    Queued,
    Ringing,
    InProgress,
    Completed,
    Failed,
    Abandoned,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IvrNode {
    pub id: Uuid,
    pub name: String,
    pub prompt_text: String,
    pub options: Vec<IvrOption>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IvrOption {
    pub dtmf_key: String,
    pub next_node_id: Option<Uuid>,
    pub action: IvrAction,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum IvrAction {
    RouteToAgent,
    RouteToQueue,
    PlayMessageAndHangup,
    ProceedToNextNode,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Recording {
    pub id: Uuid,
    pub call_session_id: Uuid,
    pub storage_url: String,
    pub duration_seconds: u32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Transcript {
    pub id: Uuid,
    pub call_session_id: Uuid,
    pub content: String,
    pub language: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VoiceAgent {
    pub id: Uuid,
    pub user_id: Uuid,
    pub status: AgentStatus,
    pub skills: Vec<String>,
    pub current_call_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum AgentStatus {
    Available,
    Busy,
    Offline,
    OnBreak,
}
