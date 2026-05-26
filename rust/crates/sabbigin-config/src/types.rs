//! On-disk shape of a `sabbigin_configs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// Per-tenant SabBigin (lite CRM SKU) configuration.
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

    /// The single pipeline SabBigin is allowed to surface. When absent, the
    /// SabBigin UI picks the first pipeline owned by the tenant (graceful
    /// fallback for tenants that just toggled the SKU on).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pipeline_id: Option<ObjectId>,

    /// Hard cap on pipeline count exposed through the SabBigin UI.
    /// Defaults to `1` for the standard SabBigin tier.
    pub pipeline_limit: u32,

    /// Opt-in feature flags. Recognized values:
    ///   `contacts`, `products`, `calls`, `emails`, `dashboard`.
    /// The SabBigin home page surfaces only the tiles whose feature flag is
    /// present here.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub allowed_features: Vec<String>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

impl SabbiginConfig {
    /// Default feature flags for a brand-new SabBigin tenant.
    pub fn default_features() -> Vec<String> {
        vec![
            "contacts".to_owned(),
            "products".to_owned(),
            "calls".to_owned(),
            "emails".to_owned(),
            "dashboard".to_owned(),
        ]
    }
}
