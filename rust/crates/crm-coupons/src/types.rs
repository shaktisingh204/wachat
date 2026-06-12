//! On-disk shape of a `crm_coupons` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmCoupon {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM suite scope — set on documents created through the
    /// project-scoped (`/v1/sabcrm/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,
    pub code: String,
    /// `"percent"` | `"fixed"`.
    #[serde(rename = "type")]
    pub kind: String,
    pub value: f64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_cart: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_uses: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub per_customer_limit: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub valid_from: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub valid_to: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub applicable_products: Vec<String>,
    #[serde(default)]
    pub stackable: bool,
    /// `"draft"` | `"active"` | `"expired"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default)]
    pub used_count: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
