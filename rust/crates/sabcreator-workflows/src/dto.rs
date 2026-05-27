//! Request DTOs for sabcreator workflows.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::types::{SabcreatorWorkflow, WorkflowTrigger};

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
    #[serde(default)]
    pub app_id: Option<String>,
    #[serde(default)]
    pub trigger_kind: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkflowInput {
    pub app_id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub trigger: WorkflowTrigger,
    #[serde(default)]
    pub sabflow_ref_id: Option<String>,
    #[serde(default)]
    pub inline_steps_json: Option<Value>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWorkflowInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub trigger: Option<WorkflowTrigger>,
    #[serde(default)]
    pub sabflow_ref_id: Option<String>,
    #[serde(default)]
    pub inline_steps_json: Option<Value>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkflowResponse {
    pub id: String,
    pub entity: SabcreatorWorkflow,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteWorkflowResponse {
    pub deleted: bool,
}

/// Body for `POST /v1/sabcreator/workflows/{id}/run` — fire-and-forget
/// execution. Real fan-out happens in the Next.js server action which
/// either forwards to SabFlow or evaluates `inlineStepsJson`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunWorkflowInput {
    #[serde(default)]
    pub trigger_data: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunWorkflowResponse {
    pub accepted: bool,
    pub workflow_id: String,
}
