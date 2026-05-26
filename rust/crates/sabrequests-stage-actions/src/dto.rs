//! DTOs for the append-only stage action log.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

pub const DEFAULT_LIMIT: i64 = 50;
pub const MAX_LIMIT: i64 = 200;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StageAction {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub request_id: ObjectId,
    pub stage_idx: u32,
    pub actor_id: ObjectId,
    /// `approve | reject | reassign | comment`. Stored as a free-form
    /// string so future actions ("withdraw", "escalate", "delegate") can
    /// be added without an enum schema migration.
    pub action: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub note: String,
    /// Action timestamp. Equal to `audit.createdAt` for in-band writes
    /// from `decide_request`, but kept as a separate field so external
    /// backfills (legacy imports) can use an authoritative wall-clock.
    pub ts: DateTime<Utc>,
    /// For `reassign` actions, who the stage was reassigned to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reassigned_to: Option<ObjectId>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// **Required in practice.** Filter to the actions for a single
    /// request instance. The handler returns 400 if absent — the
    /// timeline UI is the only consumer and it always passes one.
    #[serde(default)]
    pub request_id: Option<String>,
    /// Optional actor filter (analytics: "everything I have ever
    /// approved").
    #[serde(default)]
    pub actor_id: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_action() -> StageAction {
        StageAction {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            request_id: ObjectId::new(),
            stage_idx: 2,
            actor_id: ObjectId::new(),
            action: "approve".into(),
            note: "lgtm".into(),
            ts: Utc::now(),
            reassigned_to: None,
        }
    }

    #[test]
    fn stage_action_round_trips_with_flattened_fragments() {
        let a = make_action();
        let json = serde_json::to_value(&a).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert_eq!(json["action"], "approve");
        assert_eq!(json["stageIdx"], 2);
        let _r: StageAction = serde_json::from_value(json).unwrap();
    }

    #[test]
    fn list_query_camel_case() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({
            "requestId": "507f1f77bcf86cd799439011",
            "actorId": "507f1f77bcf86cd799439012",
        }))
        .unwrap();
        assert!(q.request_id.is_some());
        assert!(q.actor_id.is_some());
    }
}
