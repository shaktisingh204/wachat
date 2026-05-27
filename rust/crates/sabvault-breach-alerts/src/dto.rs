use serde::{Deserialize, Serialize};

use crate::types::{BreachStatus, SabvaultBreachAlert};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub secret_id: Option<String>,
    #[serde(default)]
    pub status: Option<BreachStatus>,
}

/// `POST /v1/sabvault/breach-alerts` body — upsert a breach result for a
/// secret. Caller must be the secret's owner.
///
/// **Privacy note:** the provider integration (HIBP k-anonymity range API or
/// equivalent) happens client-side. The client sends us only the
/// **result** — never the raw credential.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertBreachInput {
    pub secret_id: String,
    pub status: BreachStatus,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub breach_source_url: Option<String>,
    #[serde(default)]
    pub breach_count: Option<u32>,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertBreachResponse {
    pub id: String,
    pub entity: SabvaultBreachAlert,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabvaultBreachAlert>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
