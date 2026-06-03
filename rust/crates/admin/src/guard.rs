//! Inline admin-role gate used by every admin-only handler.
//!
//! The TS proxy (`rustAdminFetch` in `src/lib/rust-client/fetcher.ts`)
//! verifies the `admin_session` cookie before minting the bearer JWT, so by
//! the time a request reaches Rust the `roles` claim should already contain
//! `"admin"`. This helper enforces that contract a second time — defense in
//! depth — so a leaked or hand-crafted token without the right role can't
//! sneak through.

use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};

/// Returns `Ok(())` if the authenticated user has the `"admin"` role,
/// otherwise `Err(ApiError::Forbidden)`.
pub fn require_admin(user: &AuthUser) -> Result<()> {
    if user.roles.iter().any(|r| r == "admin") {
        Ok(())
    } else {
        Err(ApiError::Forbidden("admin role required".to_owned()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_with_roles(roles: &[&str]) -> AuthUser {
        AuthUser {
            user_id: "u".to_owned(),
            tenant_id: "t".to_owned(),
            roles: roles.iter().map(|s| (*s).to_owned()).collect(),
        }
    }

    #[test]
    fn allows_admin() {
        let u = user_with_roles(&["admin"]);
        assert!(require_admin(&u).is_ok());
    }

    #[test]
    fn allows_admin_alongside_other_roles() {
        let u = user_with_roles(&["owner", "admin", "agent"]);
        assert!(require_admin(&u).is_ok());
    }

    #[test]
    fn rejects_non_admin() {
        let u = user_with_roles(&["agent", "owner"]);
        match require_admin(&u) {
            Err(ApiError::Forbidden(_)) => {}
            other => panic!("expected Forbidden, got {other:?}"),
        }
    }

    #[test]
    fn rejects_empty_roles() {
        let u = user_with_roles(&[]);
        assert!(matches!(require_admin(&u), Err(ApiError::Forbidden(_))));
    }
}
