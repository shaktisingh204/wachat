//! Request envelope for the unified `/api/crm/lookup/{entity}` route.
//! Mirrors the TS `LookupParams` shape in
//! `src/lib/lookup-registry.ts`.

use serde::{Deserialize, Serialize};

/// Pagination + filter envelope. All fields are optional; the server
/// applies sensible defaults (page=0, limit=20, no filter).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LookupParams {
    /// Free-text query. Server fans out across each entity's
    /// `searchableFields` with `$regex` / text-index search.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub q: Option<String>,
    /// 0-based page index.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,
    /// Page size. Server clamps to `LOOKUP_MAX_LIMIT` (50).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,
    /// Hydration-by-id list. When set, the response prefers returning
    /// these exact ids (in order) so a picker mounting with a stale
    /// value can render the chip without scanning.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ids: Vec<String>,
    /// Free-form filter object. The TS shape passes this base64 in the
    /// query string; on the Rust side we accept it as JSON-decoded
    /// `Value` and let each entity's executor narrow.
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub filter: serde_json::Value,
    /// Scope override. Defaults to `Scope::Tenant`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<Scope>,
    /// Project narrowing for entities that support multi-project
    /// scoping (e.g. CRM accounts on multi-project tenants).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    /// Restricted to a single project.
    Project,
    /// All projects under the tenant. Default for most entities.
    #[default]
    Tenant,
    /// Cross-tenant (global statics like currency, country, state).
    Global,
}

/// Server-clamped maximum page size. Mirrors `LOOKUP_MAX_LIMIT` in the
/// TS lookup-registry.
pub const LOOKUP_MAX_LIMIT: u32 = 50;
/// Default page size when callers omit `limit`.
pub const LOOKUP_DEFAULT_LIMIT: u32 = 20;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_params_skip_all_optionals() {
        let p = LookupParams::default();
        let json = serde_json::to_value(&p).unwrap();
        // Default value should serialize to an empty object — no
        // pagination knobs leak onto the wire.
        assert!(json.as_object().unwrap().is_empty());
    }

    #[test]
    fn populated_params_round_trip() {
        let p = LookupParams {
            q: Some("acme".into()),
            page: Some(2),
            limit: Some(50),
            ids: vec!["123".into(), "456".into()],
            filter: serde_json::json!({"active": true}),
            scope: Some(Scope::Project),
            project_id: Some("proj-1".into()),
        };
        let json = serde_json::to_value(&p).unwrap();
        assert_eq!(json["q"], "acme");
        assert_eq!(json["projectId"], "proj-1");
        assert_eq!(json["scope"], "project");
        let back: LookupParams = serde_json::from_value(json).unwrap();
        assert_eq!(back.ids.len(), 2);
        assert_eq!(back.scope, Some(Scope::Project));
    }

    #[test]
    fn scope_default_is_tenant() {
        assert_eq!(Scope::default(), Scope::Tenant);
    }
}
