//! On-disk shape of an embedded `users.crmPipelines[]` element.
//!
//! Mirrors the TS `CrmPipeline` / `CrmPipelineStage` interfaces in
//! `src/lib/definitions.ts`. Keep the two in lock-step: field additions or
//! removals MUST land in both places in the same change.
//!
//! ## Addressability
//!
//! Both pipelines and stages carry their own `_id: ObjectId` so they're
//! routable (`/v1/crm/pipelines/:pipelineId/stages/:stageId`). When the
//! legacy TS code stamped `id: uuidv4()` instead, we preserve that string
//! via `legacy_id` for round-trip compatibility.

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Pipeline {
    #[serde(rename = "_id")]
    pub id: ObjectId,

    /// Legacy uuid string id stamped by the older TS path. Preserved on
    /// round-trip; new docs created by this crate leave it `None`.
    #[serde(rename = "id", default, skip_serializing_if = "Option::is_none")]
    pub legacy_id: Option<String>,

    pub name: String,

    #[serde(default)]
    pub stages: Vec<Stage>,

    #[serde(rename = "isDefault", default, skip_serializing_if = "Option::is_none")]
    pub is_default: Option<bool>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Stage {
    #[serde(rename = "_id")]
    pub id: ObjectId,

    /// Legacy uuid string id stamped by the older TS path.
    #[serde(rename = "id", default, skip_serializing_if = "Option::is_none")]
    pub legacy_id: Option<String>,

    pub name: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub order: Option<i32>,

    /// Legacy "% chance of winning" — kept so existing pipelines round-trip.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chance: Option<i32>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::doc;

    #[test]
    fn pipeline_serializes_id_as_underscore_id() {
        let p = Pipeline {
            id: ObjectId::new(),
            legacy_id: None,
            name: "Sales".to_owned(),
            stages: vec![],
            is_default: Some(true),
            color: None,
        };
        let d = bson::to_document(&p).expect("serialize");
        assert!(d.contains_key("_id"));
        assert_eq!(d.get_bool("isDefault").unwrap(), true);
        assert!(!d.contains_key("color"));
    }

    #[test]
    fn pipeline_round_trips_legacy_uuid_id() {
        let raw = doc! {
            "_id": ObjectId::new(),
            "id": "legacy-uuid-here",
            "name": "Sales",
            "stages": [],
        };
        let p: Pipeline = bson::from_document(raw).expect("deserialize");
        assert_eq!(p.legacy_id.as_deref(), Some("legacy-uuid-here"));
        assert_eq!(p.name, "Sales");
    }

    #[test]
    fn stage_round_trips_chance() {
        let raw = doc! {
            "_id": ObjectId::new(),
            "name": "New",
            "chance": 10_i32,
        };
        let s: Stage = bson::from_document(raw).expect("deserialize");
        assert_eq!(s.chance, Some(10));
        assert_eq!(s.name, "New");
    }
}
