use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrandProfile {
    pub id: Uuid,
    pub name: String,
    pub logo_url: Option<String>,
    pub primary_color: String,
    pub secondary_color: String,
    pub custom_css: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailTemplate {
    pub id: Uuid,
    pub template_type: String, // e.g., "SIGNATURE_REQUEST", "REMINDER", "COMPLETED"
    pub subject: String,
    pub body_html: String,
    pub brand_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegalDisclosure {
    pub id: Uuid,
    pub title: String,
    pub content: String, // e.g., text for ESIGN consent
    pub requires_explicit_consent: bool,
    pub locale: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub id: Uuid,
    pub require_mfa: bool,
    pub session_timeout_minutes: u32,
    pub allowed_ips: Vec<String>,
    pub sso_enabled: bool,
    pub password_policy: PasswordPolicy,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasswordPolicy {
    pub min_length: u8,
    pub require_uppercase: bool,
    pub require_lowercase: bool,
    pub require_numbers: bool,
    pub require_special_chars: bool,
    pub expiration_days: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceSetting {
    pub id: Uuid,
    pub hipaa_compliant: bool,
    pub gdpr_compliant: bool,
    pub data_retention_days: u32,
    pub audit_log_retention_days: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsAnalytics {
    pub total_brands: usize,
    pub total_templates: usize,
    pub mfa_enabled_accounts: usize,
    pub active_sso_configs: usize,
}
