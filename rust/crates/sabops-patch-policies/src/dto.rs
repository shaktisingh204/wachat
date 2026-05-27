use serde::{Deserialize, Serialize};

use crate::types::{PolicySchedule, PolicyTargetSelector, SabopsPatchPolicy};

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
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePolicyInput {
    pub name: String,
    pub target_selector: PolicyTargetSelector,
    pub schedule: PolicySchedule,
    pub action: String,
    #[serde(default)]
    pub severity_filter: Option<String>,
    #[serde(default)]
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePolicyInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub target_selector: Option<PolicyTargetSelector>,
    #[serde(default)]
    pub schedule: Option<PolicySchedule>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub severity_filter: Option<String>,
    #[serde(default)]
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePolicyResponse {
    pub id: String,
    pub entity: SabopsPatchPolicy,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePolicyResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPolicyResponse {
    /// Number of endpoints the policy is currently targeting (best-effort
    /// post-evaluation snapshot). Actual deployment is dispatched by the
    /// Next.js Server Action / cron worker that consumes this response.
    pub matched_endpoints: u64,
    pub policy_id: String,
}
