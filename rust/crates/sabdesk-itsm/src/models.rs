use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareAsset {
    pub id: Uuid,
    pub name: String,
    pub asset_tag: String,
    pub model: String,
    pub manufacturer: String,
    pub status: AssetStatus,
    pub assigned_to: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AssetStatus {
    InUse,
    InStock,
    Broken,
    Retired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoftwareLicense {
    pub id: Uuid,
    pub software_name: String,
    pub license_key: String,
    pub total_seats: u32,
    pub used_seats: u32,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Incident {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub urgency: Urgency,
    pub state: IncidentState,
    pub assigned_to: Option<Uuid>,
    pub related_asset: Option<Uuid>,
    pub reported_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Urgency {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum IncidentState {
    New,
    InProgress,
    Resolved,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Problem {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub root_cause: Option<String>,
    pub workaround: Option<String>,
    pub state: ProblemState,
    pub related_incidents: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ProblemState {
    Open,
    KnownError,
    Resolved,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeRequest {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub risk_level: RiskLevel,
    pub state: ChangeState,
    pub cab_approval: Option<CabApproval>,
    pub scheduled_start: Option<DateTime<Utc>>,
    pub scheduled_end: Option<DateTime<Utc>>,
    pub implemented_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ChangeState {
    Draft,
    PendingApproval,
    Approved,
    Rejected,
    Implementation,
    Review,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CabApproval {
    pub approved: bool,
    pub comments: String,
    pub approved_by: Uuid,
    pub approved_at: DateTime<Utc>,
}

// Request Models for creation/updates

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateHardwareAssetReq {
    pub name: String,
    pub asset_tag: String,
    pub model: String,
    pub manufacturer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSoftwareLicenseReq {
    pub software_name: String,
    pub license_key: String,
    pub total_seats: u32,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateIncidentReq {
    pub title: String,
    pub description: String,
    pub urgency: Urgency,
    pub reported_by: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProblemReq {
    pub title: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateChangeRequestReq {
    pub title: String,
    pub description: String,
    pub risk_level: RiskLevel,
}
