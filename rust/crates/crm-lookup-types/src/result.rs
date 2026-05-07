//! Response envelope for the unified lookup endpoint.
//! Mirrors the TS `LookupResult` and `LookupItem` shapes.

use crate::chip::LookupChip;
use serde::{Deserialize, Serialize};

/// One returned row. `id` is whatever stable identifier the entity
/// exposes — typically a Mongo ObjectId hex, but composite (e.g.
/// `pipelineId:stageId` for `Stage`) for embedded shapes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LookupItem {
    pub id: String,
    pub chip: LookupChip,
    /// Optional full document payload. Returned only when the picker
    /// asked to hydrate (`hydrate: 'always' | 'on-demand'`); otherwise
    /// callers re-fetch the full doc via the entity-specific route.
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub raw: serde_json::Value,
}

/// Paginated response. `recent` is populated only when the caller
/// requested the "empty-state" view (no `q` and `page = 0`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LookupResult {
    pub items: Vec<LookupItem>,
    pub page: u32,
    pub limit: u32,
    /// Approximate total. `None` when the executor doesn't compute
    /// counts (large collections where `count_documents` is too
    /// expensive — caller should rely on `has_more` to paginate).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total: Option<u64>,
    pub has_more: bool,
    /// Tenant + entity recents — populated only when the empty-state
    /// view was requested.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub recent: Vec<LookupItem>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str, primary: &str) -> LookupItem {
        LookupItem {
            id: id.into(),
            chip: LookupChip {
                primary: primary.into(),
                ..Default::default()
            },
            raw: serde_json::Value::Null,
        }
    }

    #[test]
    fn empty_result_round_trips() {
        let r = LookupResult {
            items: vec![],
            page: 0,
            limit: 20,
            total: Some(0),
            has_more: false,
            recent: vec![],
        };
        let json = serde_json::to_value(&r).unwrap();
        assert_eq!(json["page"], 0);
        assert_eq!(json["limit"], 20);
        assert_eq!(json["hasMore"], false);
        assert!(json.get("recent").is_none(), "empty Vec must skip");
    }

    #[test]
    fn populated_result_with_recents_round_trips() {
        let r = LookupResult {
            items: vec![item("1", "Acme"), item("2", "Wayne Industries")],
            page: 0,
            limit: 20,
            total: None,
            has_more: true,
            recent: vec![item("3", "Stark Industries")],
        };
        let json = serde_json::to_value(&r).unwrap();
        assert_eq!(json["items"].as_array().unwrap().len(), 2);
        assert_eq!(json["recent"].as_array().unwrap().len(), 1);
        assert_eq!(json["hasMore"], true);
        assert!(json.get("total").is_none(), "None total must skip");
        let back: LookupResult = serde_json::from_value(json).unwrap();
        assert_eq!(back.items.len(), 2);
        assert!(back.has_more);
        assert_eq!(back.recent[0].id, "3");
    }
}
