//! `_id`, `projectId`, `userId`, `tenantId` — required ownership keys
//! every CRM document carries. Server-action queries are always scoped
//! by `userId`; multi-project tenants additionally narrow on `projectId`.

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

/// Required identity tuple every CRM/HRM document persists.
///
/// `tenantId` is optional today — it currently mirrors `userId` in
/// single-tenant setups. Future SaaS hierarchies (e.g. an agency that
/// owns multiple sub-tenants) will populate it independently.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    #[serde(rename = "_id")]
    pub id: ObjectId,

    /// Project / workspace scope.
    pub project_id: ObjectId,

    /// Owning user (the CRM "tenant root"). Every server-action query
    /// filters by this.
    pub user_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<ObjectId>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_camel_case() {
        let id = Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        };
        let json = serde_json::to_value(&id).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("tenantId").is_none(), "None should skip-serialize");
    }
}
