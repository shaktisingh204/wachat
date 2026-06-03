use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: Uuid,
    pub document_id: Uuid,
    pub user_id: Option<Uuid>,
    pub event_type: EventType,
    pub timestamp: DateTime<Utc>,
    pub ip_log: IpLog,
    pub description: String,
    pub device_info: String,
    pub location: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum EventType {
    DocumentCreated,
    DocumentViewed,
    SignatureAdded,
    DocumentCompleted,
    DocumentDeclined,
    DocumentDeleted,
    HashVerified,
    CertificateGenerated,
    SystemEvent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpLog {
    pub ip_address: String,
    pub user_agent: String,
    pub proxy_info: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CryptoHash {
    pub id: Uuid,
    pub document_id: Uuid,
    pub hash_value: String, // e.g., SHA-256
    pub algorithm: String,
    pub timestamp: DateTime<Utc>,
    pub verified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertificateOfCompletion {
    pub id: Uuid,
    pub document_id: Uuid,
    pub generated_at: DateTime<Utc>,
    pub reference_number: String,
    pub total_pages: u32,
    pub total_signatures: u32,
    pub summary_hash: String,
    pub status: CertStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CertStatus {
    Draft,
    Active,
    Revoked,
}

// Request and Response Models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAuditEventReq {
    pub document_id: Uuid,
    pub user_id: Option<Uuid>,
    pub event_type: EventType,
    pub ip_log: IpLog,
    pub description: String,
    pub device_info: String,
    pub location: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordCryptoHashReq {
    pub document_id: Uuid,
    pub hash_value: String,
    pub algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyHashReq {
    pub document_id: Uuid,
    pub hash_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateCertReq {
    pub document_id: Uuid,
    pub total_pages: u32,
    pub total_signatures: u32,
    pub summary_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterAuditReq {
    pub document_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub event_type: Option<EventType>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditStatsRes {
    pub total_events: usize,
    pub events_by_type: std::collections::HashMap<String, usize>,
    pub unique_documents: usize,
    pub unique_users: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCertMetadataReq {
    pub status: CertStatus,
    pub reference_number: Option<String>,
}
