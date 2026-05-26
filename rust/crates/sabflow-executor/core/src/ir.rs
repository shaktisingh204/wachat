use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IRNode {
    pub id: String,
    pub r#type: String,
    pub type_version: f64,
    pub parameters: serde_json::Value,
    pub credentials: Option<HashMap<String, CredentialRef>>,
    pub disabled: Option<bool>,
    pub continue_on_fail: Option<bool>,
    pub retry_on_fail: Option<bool>,
    pub max_tries: Option<u32>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialRef {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EdgeFrom {
    pub node_id: String,
    pub output_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EdgeTo {
    pub node_id: String,
    pub input_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IREdge {
    pub from: EdgeFrom,
    pub to: EdgeTo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IRTrigger {
    pub node_id: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowSettings {
    pub timeout_sec: Option<u32>,
    pub save_data: Option<String>,
    pub error_workflow_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowGraph {
    pub id: String,
    pub version: u32,
    pub nodes: Vec<IRNode>,
    pub edges: Vec<IREdge>,
    pub triggers: Vec<IRTrigger>,
    pub settings: Option<WorkflowSettings>,
}
