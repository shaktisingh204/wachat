use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Envelope {
    pub id: Uuid,
    pub title: String,
    pub status: EnvelopeStatus,
    pub sender_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub sent_at: Option<DateTime<Utc>>,
    pub voided_at: Option<DateTime<Utc>>,
    pub void_reason: Option<String>,
    pub documents: Vec<Document>,
    pub recipients: Vec<Recipient>,
    pub routing_order: Option<RoutingOrder>,
    pub reminder_settings: Option<ReminderSettings>,
    pub expire_settings: Option<ExpireSettings>,
    pub custom_fields: Vec<CustomField>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EnvelopeStatus {
    Draft,
    Sent,
    Delivered,
    Completed,
    Declined,
    Voided,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: Uuid,
    pub envelope_id: Uuid,
    pub name: String,
    pub file_extension: String,
    pub size_bytes: u64,
    pub pages: u32,
    pub document_base64: Option<String>,
    pub order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recipient {
    pub id: Uuid,
    pub envelope_id: Uuid,
    pub name: String,
    pub email: String,
    pub recipient_type: RecipientType,
    pub role_name: String,
    pub routing_order: i32,
    pub status: RecipientStatus,
    pub signature_placements: Vec<SignaturePlacement>,
    pub access_code: Option<String>,
    pub client_user_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RecipientType {
    Signer,
    CarbonCopy,
    CertifiedDelivery,
    InPersonSigner,
    Agent,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RecipientStatus {
    Created,
    Sent,
    Delivered,
    Signed,
    Declined,
    Completed,
    AutoResponded,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignaturePlacement {
    pub id: Uuid,
    pub document_id: Uuid,
    pub page_number: u32,
    pub x_position: f64,
    pub y_position: f64,
    pub width: f64,
    pub height: f64,
    pub signature_type: SignatureType,
    pub is_required: bool,
    pub value: Option<String>,
    pub signed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SignatureType {
    Signature,
    Initial,
    DateSigned,
    Name,
    Email,
    Company,
    Title,
    Text,
    Checkbox,
    RadioGroup,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingOrder {
    pub current_order: i32,
    pub current_recipient_id: Option<Uuid>,
    pub is_sequential: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReminderSettings {
    pub reminder_enabled: bool,
    pub reminder_delay: u32,
    pub reminder_frequency: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpireSettings {
    pub expire_enabled: bool,
    pub expire_after: u32,
    pub expire_warn: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomField {
    pub name: String,
    pub value: String,
    pub show: bool,
    pub required: bool,
}
