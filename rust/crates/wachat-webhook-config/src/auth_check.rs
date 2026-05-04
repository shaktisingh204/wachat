//! Lightweight authorisation helper for the webhook-admin endpoints.
//!
//! The full RBAC matrix lives in `src/lib/rbac-server.ts` on the TS side and
//! has not yet been ported (Phase 2 follow-up). For now we enforce the
//! coarsest meaningful check — the caller must hold `admin` or `owner` on
//! their JWT — which is identical to how `getAdminSession()` is used in
//! `handleClearProcessedLogs` today.
//!
//! `project_id` is accepted (and ignored) so the call sites read
//! self-documenting and we don't need to refactor every caller when the
//! per-project membership lookup lands.

use sabnode_auth::AuthUser;
use sabnode_common::ApiError;

/// Verify that `user` is allowed to operate on the webhook-admin surface.
///
/// Returns `Ok(())` when the user has `admin` or `owner` in their JWT
/// roles, `Err(ApiError::Forbidden)` otherwise. `project_id` is accepted
/// for forward-compatibility with a future per-project membership check
/// but is currently unused — see the module-level comment.
pub fn ensure_admin(user: &AuthUser, project_id: Option<&str>) -> Result<(), ApiError> {
    // `project_id` is intentionally ignored for now; explicitly bind it so
    // future refactors don't have to re-touch every call site.
    let _ = project_id;

    let is_admin = user
        .roles
        .iter()
        .any(|r| r == "admin" || r == "owner");

    if is_admin {
        Ok(())
    } else {
        // TODO(phase-2-followup): switch to the full RBAC table from
        // `src/lib/rbac-server.ts` once that module is ported.
        Err(ApiError::Forbidden(
            "webhook admin requires the admin or owner role".to_owned(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_with_roles(roles: &[&str]) -> AuthUser {
        AuthUser {
            user_id: "507f1f77bcf86cd799439011".to_owned(),
            tenant_id: "tenant-1".to_owned(),
            roles: roles.iter().map(|s| s.to_string()).collect(),
        }
    }

    #[test]
    fn admin_role_passes() {
        assert!(ensure_admin(&user_with_roles(&["admin"]), None).is_ok());
    }

    #[test]
    fn owner_role_passes() {
        assert!(ensure_admin(&user_with_roles(&["owner"]), Some("p1")).is_ok());
    }

    #[test]
    fn member_only_is_forbidden() {
        let err = ensure_admin(&user_with_roles(&["member"]), None)
            .expect_err("member must be rejected");
        assert!(matches!(err, ApiError::Forbidden(_)));
    }

    #[test]
    fn empty_roles_is_forbidden() {
        let err = ensure_admin(&user_with_roles(&[]), None).expect_err("no roles must be rejected");
        assert!(matches!(err, ApiError::Forbidden(_)));
    }
}
