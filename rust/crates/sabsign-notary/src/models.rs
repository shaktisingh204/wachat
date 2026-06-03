use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotarySession {
    pub id: Uuid,
    pub notary_id: Uuid,
    pub signers: Vec<Signer>,
    pub document_ids: Vec<Uuid>,
    pub status: SessionStatus,
    pub created_at: DateTime<Utc>,
    pub scheduled_for: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub recording_id: Option<Uuid>,
    pub identity_check_ids: Vec<Uuid>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SessionStatus {
    Pending,
    Scheduled,
    InProgress,
    Completed,
    Failed,
    Canceled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signer {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub has_passed_kba: bool,
    pub has_passed_id_verification: bool,
    pub joined_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoRecording {
    pub id: Uuid,
    pub session_id: Uuid,
    pub storage_url: String,
    pub duration_seconds: u32,
    pub file_size_bytes: u64,
    pub format: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: DateTime<Utc>,
    pub retention_policy_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityCheck {
    pub id: Uuid,
    pub session_id: Uuid,
    pub signer_id: Uuid,
    pub check_type: IdentityCheckType,
    pub provider: String,
    pub status: IdentityCheckStatus,
    pub score: Option<u8>,
    pub timestamp: DateTime<Utc>,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum IdentityCheckType {
    KnowledgeBasedAuthentication,
    CredentialAnalysis,
    BiometricMatch,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum IdentityCheckStatus {
    Pending,
    Passed,
    Failed,
    Inconclusive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotaryJournal {
    pub id: Uuid,
    pub notary_id: Uuid,
    pub session_id: Uuid,
    pub entries: Vec<JournalEntry>,
    pub fee_charged: Option<f64>,
    pub sealed_at: Option<DateTime<Utc>>,
    pub is_audited: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEntry {
    pub entry_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub action_type: JournalActionType,
    pub description: String,
    pub signer_id: Option<Uuid>,
    pub ip_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum JournalActionType {
    SessionStarted,
    SignerJoined,
    IdentityVerified,
    DocumentSigned,
    NotarySealApplied,
    SessionCompleted,
}

// Request and Response Models for handlers

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    pub notary_id: Uuid,
    pub signers: Vec<CreateSignerRequest>,
    pub document_ids: Vec<Uuid>,
    pub scheduled_for: Option<DateTime<Utc>>,
    pub metadata: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSignerRequest {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSessionStatusRequest {
    pub status: SessionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddIdentityCheckRequest {
    pub signer_id: Uuid,
    pub check_type: IdentityCheckType,
    pub provider: String,
    pub status: IdentityCheckStatus,
    pub score: Option<u8>,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateJournalEntryRequest {
    pub action_type: JournalActionType,
    pub description: String,
    pub signer_id: Option<Uuid>,
    pub ip_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddVideoRecordingRequest {
    pub session_id: Uuid,
    pub storage_url: String,
    pub duration_seconds: u32,
    pub file_size_bytes: u64,
    pub format: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SealJournalRequest {
    pub fee_charged: Option<f64>,
}
