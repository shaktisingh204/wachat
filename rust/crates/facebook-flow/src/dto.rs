//! Wire DTOs for the `facebook-flow` crate.
//!
//! All shapes are intentionally permissive — `FacebookFlowNode.data` is a
//! free-form object on the TS side (`any`) so we round-trip it as
//! `serde_json::Value`. Field names match the TS / Mongo storage shape so
//! the existing flow-builder UI works without translation.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Single node in a flow. `data` is opaque on the wire.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacebookFlowNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub data: Value,
    pub position: Position,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacebookFlowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(rename = "sourceHandle", skip_serializing_if = "Option::is_none")]
    pub source_handle: Option<String>,
}

/// Mongo document persisted in the `facebook_flows` collection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacebookFlowDoc {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    #[serde(rename = "projectId")]
    pub project_id: ObjectId,
    pub nodes: Vec<FacebookFlowNode>,
    pub edges: Vec<FacebookFlowEdge>,
    #[serde(rename = "triggerKeywords", default)]
    pub trigger_keywords: Vec<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<BsonDateTime>,
    #[serde(rename = "updatedAt")]
    pub updated_at: BsonDateTime,
}

/// Browser-facing list summary. Wire shape preserves the TS `_id` /
/// `projectId` as hex strings and dates as ISO-8601.
#[derive(Debug, Clone, Serialize)]
pub struct FacebookFlowSummary {
    pub _id: String,
    pub name: String,
    #[serde(rename = "triggerKeywords")]
    pub trigger_keywords: Vec<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

/// Browser-facing full record returned by `getFacebookFlowById`.
#[derive(Debug, Clone, Serialize)]
pub struct FacebookFlowRecord {
    pub _id: String,
    pub name: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub nodes: Vec<FacebookFlowNode>,
    pub edges: Vec<FacebookFlowEdge>,
    #[serde(rename = "triggerKeywords")]
    pub trigger_keywords: Vec<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

/// Request body for upserting a flow.
#[derive(Debug, Clone, Deserialize)]
pub struct SaveFlowReq {
    #[serde(default, rename = "flowId")]
    pub flow_id: Option<String>,
    pub name: String,
    pub nodes: Vec<FacebookFlowNode>,
    pub edges: Vec<FacebookFlowEdge>,
    #[serde(default, rename = "triggerKeywords")]
    pub trigger_keywords: Vec<String>,
}

/// `{ message?, error?, flowId? }` envelope returned by the upsert endpoint.
#[derive(Debug, Clone, Default, Serialize)]
pub struct SaveFlowResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(rename = "flowId", skip_serializing_if = "Option::is_none")]
    pub flow_id: Option<String>,
}

/// `{ message?, error? }` envelope returned by the delete endpoint.
#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
