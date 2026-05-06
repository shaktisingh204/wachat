//! Wire DTOs for the Ad Accounts & Business router.
//!
//! Most endpoints return free-form Graph API JSON (because the TS
//! callers already understand the Meta Graph shapes), so we lean
//! on `serde_json::Value` rather than re-typing every Graph object.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
//  Generic envelopes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AckResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub success: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Free-form `{ data?, error? }` envelope that mirrors the TS `ActionResult`.
#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct DataResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// `{ data?: any[], error? }` — the common ad-manager list shape.
#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ListResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub data: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  getAdAccounts
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AdAccountsResp {
    #[schema(value_type = Vec<Object>)]
    pub accounts: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  deleteAdAccount
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct DeleteAdAccountResp {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  getAdAccountSpend
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize)]
pub struct SpendQuery {
    #[serde(default)]
    pub since: Option<String>,
    #[serde(default)]
    pub until: Option<String>,
}

// ---------------------------------------------------------------------------
//  getAdAccountActivities
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ActivitiesQuery {
    #[serde(default)]
    pub since: Option<String>,
    #[serde(default)]
    pub until: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
}

// ---------------------------------------------------------------------------
//  getFacebookPagesForAdCreation
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct PagesResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub pages: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
