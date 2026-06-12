//! Request DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
}

/// Scope-only query for `GET`/`PATCH`/`DELETE` by id. `projectId` is
/// required on SabCRM (project) mounts and ignored on legacy mounts.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCouponInput {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    pub code: String,
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
    pub value: f64,
    #[serde(default)]
    pub min_cart: Option<f64>,
    #[serde(default)]
    pub max_uses: Option<i32>,
    #[serde(default)]
    pub per_customer_limit: Option<i32>,
    #[serde(default)]
    pub valid_from: Option<String>,
    #[serde(default)]
    pub valid_to: Option<String>,
    #[serde(default)]
    pub applicable_products: Vec<String>,
    #[serde(default)]
    pub stackable: Option<bool>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCouponInput {
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
    #[serde(default)]
    pub value: Option<f64>,
    #[serde(default)]
    pub min_cart: Option<f64>,
    #[serde(default)]
    pub max_uses: Option<i32>,
    #[serde(default)]
    pub per_customer_limit: Option<i32>,
    #[serde(default)]
    pub valid_from: Option<String>,
    #[serde(default)]
    pub valid_to: Option<String>,
    #[serde(default)]
    pub applicable_products: Option<Vec<String>>,
    #[serde(default)]
    pub stackable: Option<bool>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCouponResponse {
    pub id: String,
    pub entity: crate::types::CrmCoupon,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCouponResponse {
    pub deleted: bool,
}
