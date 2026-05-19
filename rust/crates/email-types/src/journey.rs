use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::segment::EmailFilterTree;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailJourneyNodeType {
    Trigger, Email, Wait, Condition, Action, Split, Exit,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailJourneyTriggerKind {
    ListJoin,
    TagAdded,
    TagRemoved,
    SegmentEnter,
    CampaignOpen,
    CampaignClick,
    FieldChanged,
    DateAnniversary,
    Webhook,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailJourneyStatus {
    Draft, Active, Paused, Archived,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailReentryPolicy {
    Never, AfterExit, Always,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailJourneyPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailJourneyTrigger {
    pub kind: EmailJourneyTriggerKind,
    #[serde(default)]
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailJourneyNodeData {
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub trigger: Option<EmailJourneyTrigger>,
    #[serde(default)]
    pub email_template_id: Option<String>,
    #[serde(default)]
    pub email_subject: Option<String>,
    #[serde(default)]
    pub wait_for: Option<EmailJourneyWait>,
    #[serde(default)]
    pub condition: Option<EmailFilterTree>,
    #[serde(default)]
    pub action: Option<EmailJourneyAction>,
    #[serde(default)]
    pub split_weights: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailJourneyWait {
    pub value: u64,
    pub unit: WaitUnit,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WaitUnit { Minutes, Hours, Days }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailJourneyAction {
    pub kind: EmailJourneyActionKind,
    #[serde(default)]
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailJourneyActionKind {
    TagAdd, TagRemove, ListMove, Webhook, UpdateField, Unsubscribe,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailJourneyNode {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: EmailJourneyNodeType,
    pub position: EmailJourneyPosition,
    pub data: EmailJourneyNodeData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailJourneyEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(default)]
    pub source_handle: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailJourney {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub status: EmailJourneyStatus,
    pub nodes: Vec<EmailJourneyNode>,
    pub edges: Vec<EmailJourneyEdge>,
    pub trigger: EmailJourneyTrigger,
    pub reentry_policy: EmailReentryPolicy,
    #[serde(default)]
    pub stats: Option<EmailJourneyStats>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EmailJourneyStats {
    #[serde(default)]
    pub entered: u64,
    #[serde(default)]
    pub completed: u64,
    #[serde(default)]
    pub active: u64,
    #[serde(default)]
    pub goal_reached: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailJourneyRunStatus {
    Active, Waiting, Completed, Exited, Errored,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailJourneyRun {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub journey_id: ObjectId,
    pub subscriber_id: ObjectId,
    pub current_node_id: String,
    pub status: EmailJourneyRunStatus,
    #[serde(default)]
    pub next_step_at: Option<DateTime<Utc>>,
    pub entered_at: DateTime<Utc>,
    #[serde(default)]
    pub completed_at: Option<DateTime<Utc>>,
}
