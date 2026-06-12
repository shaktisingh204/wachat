//! Tenant-scope resolution shared by legacy `/v1/crm/*` mounts and the
//! SabCRM suite re-mounts (`/v1/sabcrm/*`).
//!
//! The legacy CRM handlers scope every Mongo query by
//! `userId == AuthUser.user_id` (the CRM "tenant root"). SabCRM scopes by
//! `projectId` — the workspace the gated Next.js server action resolved
//! and validated membership for. Both keys already exist on every CRM
//! document via [`crate::Identity`], so the same handler code can serve
//! either mount as long as the *filter key* is resolved per-request.
//!
//! [`ScopeMode`] is attached by the mounting router (axum
//! `Extension`), and [`TenantScope`] is the resolved `{key: oid}` pair a
//! handler filters by. [`sabcrm_project_oid`] is the 4xx-on-absent
//! resolver for the SabCRM (project) side; legacy `userId` behaviour is
//! untouched by design.

use bson::{Document, oid::ObjectId};
use sabnode_common::ApiError;

/// Which ownership key a mounted router scopes by. Attached as an axum
/// `Extension` by the router constructor, so the same handlers serve
/// both the legacy (`User`) and the SabCRM suite (`Project`) mounts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ScopeMode {
    /// Legacy `/v1/crm/*` behaviour — filter by `userId` from the JWT.
    #[default]
    User,
    /// SabCRM suite `/v1/sabcrm/*` behaviour — filter by the
    /// caller-supplied (action-gate-validated) `projectId`.
    Project,
}

/// A resolved per-request tenant scope: the ownership key plus the
/// `ObjectId` it must equal on every document touched by the request.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TenantScope {
    /// `{ userId: <oid> }`
    User(ObjectId),
    /// `{ projectId: <oid> }`
    Project(ObjectId),
}

impl TenantScope {
    /// The Mongo field this scope filters on.
    pub fn key(&self) -> &'static str {
        match self {
            TenantScope::User(_) => "userId",
            TenantScope::Project(_) => "projectId",
        }
    }

    /// The `ObjectId` the scope key must equal.
    pub fn oid(&self) -> ObjectId {
        match self {
            TenantScope::User(o) | TenantScope::Project(o) => *o,
        }
    }

    /// `{ <key>: <oid> }` — the base ownership filter every query under
    /// this scope must include.
    pub fn filter(&self) -> Document {
        let mut d = Document::new();
        d.insert(self.key(), self.oid());
        d
    }
}

/// Resolve the SabCRM tenant scope (= `projectId`) from a request value.
///
/// Returns a 4xx [`ApiError::Validation`] when the value is absent /
/// blank / not a 24-char hex `ObjectId` — SabCRM mounts must never fall
/// back to a broader scope. Legacy (`userId`) callers never go through
/// this function, so their behaviour is unchanged.
pub fn sabcrm_project_oid(project_id_hex: Option<&str>) -> Result<ObjectId, ApiError> {
    let raw = project_id_hex
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| ApiError::Validation("projectId is required.".to_owned()))?;
    ObjectId::parse_str(raw).map_err(|_| {
        ApiError::Validation("projectId must be a 24-character hex ObjectId.".to_owned())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_scope_filters_user_id() {
        let oid = ObjectId::new();
        let f = TenantScope::User(oid).filter();
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        assert!(!f.contains_key("projectId"));
    }

    #[test]
    fn project_scope_filters_project_id() {
        let oid = ObjectId::new();
        let f = TenantScope::Project(oid).filter();
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
    }

    #[test]
    fn sabcrm_project_oid_rejects_absent_and_blank() {
        assert!(matches!(
            sabcrm_project_oid(None),
            Err(ApiError::Validation(_))
        ));
        assert!(matches!(
            sabcrm_project_oid(Some("   ")),
            Err(ApiError::Validation(_))
        ));
    }

    #[test]
    fn sabcrm_project_oid_rejects_garbage() {
        assert!(matches!(
            sabcrm_project_oid(Some("not-an-oid")),
            Err(ApiError::Validation(_))
        ));
    }

    #[test]
    fn sabcrm_project_oid_parses_hex() {
        let oid = ObjectId::new();
        let parsed = sabcrm_project_oid(Some(&oid.to_hex())).unwrap();
        assert_eq!(parsed, oid);
    }

    #[test]
    fn scope_mode_defaults_to_user() {
        assert_eq!(ScopeMode::default(), ScopeMode::User);
    }
}
