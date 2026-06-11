//! On-disk shape of a `sabbigin_configs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn default_pipeline_limit() -> u32 {
    0
}

/// Public-branding block for SabBigin's hosted surfaces (web forms, booking
/// pages). All fields optional.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PublicBranding {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accent_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company_name: Option<String>,
}

/// Onboarding checklist progress for the SabBigin home page.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingState {
    #[serde(default)]
    pub created_pipeline: bool,
    #[serde(default)]
    pub imported_contacts: bool,
    #[serde(default)]
    pub created_deal: bool,
    #[serde(default)]
    pub connected_email: bool,
    #[serde(default)]
    pub dismissed: bool,
}

/// Per-tenant SabBigin (pipeline CRM) configuration.
///
/// One row per tenant under normal operation. The collection allows multiple
/// historical rows so the `status: "archived"` soft-delete pattern works the
/// same way as every other CRM entity.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabbiginConfig {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Tenant scope — owning user.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Is the SabBigin SKU enabled for this tenant?
    #[serde(default)]
    pub enabled: bool,

    /// The pipeline the SabBigin deals board defaults to. When absent, the
    /// SabBigin UI picks the first pipeline owned by the tenant.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pipeline_id: Option<ObjectId>,

    /// Optional admin override on pipeline count. `0` means "no override" —
    /// the effective limit is derived from the plan tier (unlimited while the
    /// SKU is unpriced). Legacy docs that stored `1` simply stop being
    /// authoritative; nothing migrates.
    #[serde(default = "default_pipeline_limit")]
    pub pipeline_limit: u32,

    /// Opt-in feature flags. Recognized values:
    ///   `contacts`, `companies`, `deals`, `products`, `tasks`, `events`,
    ///   `calls`, `emails`, `dashboard`, `forms`, `bookings`, `workflows`,
    ///   `emailIn`, `fileCabinet`, `api`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub allowed_features: Vec<String>,

    /// ISO-4217 default currency for new deals (e.g. `"INR"`, `"USD"`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_currency: Option<String>,

    /// Allow per-deal currency selection.
    #[serde(default)]
    pub multi_currency: bool,

    /// Has the tenant enabled Email-In aliases?
    #[serde(default)]
    pub email_in_enabled: bool,

    /// Branding for hosted forms / booking pages.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub public_branding: Option<PublicBranding>,

    /// Onboarding checklist progress.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub onboarding: Option<OnboardingState>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

impl SabbiginConfig {
    /// Default feature flags for a brand-new SabBigin tenant — everything on.
    pub fn default_features() -> Vec<String> {
        vec![
            "contacts".to_owned(),
            "companies".to_owned(),
            "deals".to_owned(),
            "products".to_owned(),
            "tasks".to_owned(),
            "events".to_owned(),
            "calls".to_owned(),
            "emails".to_owned(),
            "dashboard".to_owned(),
            "forms".to_owned(),
            "bookings".to_owned(),
            "workflows".to_owned(),
            "emailIn".to_owned(),
            "fileCabinet".to_owned(),
            "api".to_owned(),
        ]
    }
}
