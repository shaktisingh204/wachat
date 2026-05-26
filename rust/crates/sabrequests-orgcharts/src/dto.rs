//! DTOs for the per-tenant org chart document.

use bson::oid::ObjectId;
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// One org chart per tenant (or per logical `orgId` when a tenant
/// chooses to model multiple — e.g. a holding company with two
/// subsidiaries).
///
/// `manager_of` is a `userId → managerUserId` map. Both values are the
/// 24-char ObjectId hex string (not [`ObjectId`]) because the JSON
/// document model stores object keys as strings; the TS layer joins to
/// the `users` collection by string compare.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrgChart {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// Human label for the chart ("HQ", "EU subsidiary"). Optional —
    /// most tenants have exactly one chart and leave this blank.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    /// Logical org id when the tenant maintains more than one chart.
    /// `None` means "default chart for this tenant".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub org_id: Option<ObjectId>,

    /// `userId → managerUserId` (24-char hex strings).
    #[serde(default)]
    pub manager_of: HashMap<String, String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub org_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertOrgChartInput {
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub org_id: Option<String>,
    /// Full replacement of the `managerOf` map. Use `PATCH` (see
    /// [`UpdateOrgChartInput`]) to mutate individual entries.
    pub manager_of: HashMap<String, String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOrgChartInput {
    /// Entries to add or overwrite.
    #[serde(default)]
    pub set_manager_of: Option<HashMap<String, String>>,
    /// Entries to remove (by `userId` key).
    #[serde(default)]
    pub unset_users: Option<Vec<String>>,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveManagerQuery {
    pub user_id: String,
    #[serde(default)]
    pub org_id: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn org_chart_round_trips_with_flattened_fragments() {
        let mut m = HashMap::new();
        m.insert(
            "507f1f77bcf86cd799439011".into(),
            "507f1f77bcf86cd799439012".into(),
        );
        let chart = OrgChart {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            name: Some("HQ".into()),
            org_id: None,
            manager_of: m,
        };
        let json = serde_json::to_value(&chart).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("managerOf").is_some());
        let _r: OrgChart = serde_json::from_value(json).unwrap();
    }
}
