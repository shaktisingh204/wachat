use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionToken {
    pub id: Uuid,
    pub token: String,
    pub document_id: Uuid,
    pub signer_id: Uuid,
    pub expires_at: DateTime<Utc>,
    pub is_valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdoptedSignature {
    pub id: Uuid,
    pub signer_id: Uuid,
    pub signature_text: Option<String>,
    pub signature_image_url: Option<String>,
    pub signature_type: String, // e.g., "draw", "type", "upload"
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityVerification {
    pub id: Uuid,
    pub signer_id: Uuid,
    pub method: String, // e.g., "email", "sms", "knowledge_based", "id_verification"
    pub status: String, // e.g., "pending", "verified", "failed"
    pub verified_at: Option<DateTime<Utc>>,
    pub attempt_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: Uuid,
    pub title: String,
    pub file_url: String,
    pub created_at: DateTime<Utc>,
    pub total_pages: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agreement {
    pub id: Uuid,
    pub document_id: Uuid,
    pub status: String, // e.g., "draft", "out_for_signature", "completed", "declined"
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signer {
    pub id: Uuid,
    pub agreement_id: Uuid,
    pub email: String,
    pub name: String,
    pub routing_order: u32,
    pub status: String, // e.g., "pending", "viewed", "signed", "declined"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureField {
    pub id: Uuid,
    pub document_id: Uuid,
    pub signer_id: Uuid,
    pub page_number: u32,
    pub x_position: f32,
    pub y_position: f32,
    pub width: f32,
    pub height: f32,
    pub is_signed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: Uuid,
    pub agreement_id: Uuid,
    pub action: String,
    pub ip_address: Option<String>,
    pub timestamp: DateTime<Utc>,
    pub description: String,
}

// Payload structs for endpoints
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionTokenRequest {
    pub document_id: Uuid,
    pub signer_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdoptSignatureRequest {
    pub signature_text: Option<String>,
    pub signature_image_url: Option<String>,
    pub signature_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartVerificationRequest {
    pub method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteVerificationRequest {
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplySignatureRequest {
    pub field_id: Uuid,
    pub adopted_signature_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeclineAgreementRequest {
    pub reason: String,
}
