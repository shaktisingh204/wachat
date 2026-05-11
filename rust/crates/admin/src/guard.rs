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
        Err(ApiError::Forbidden(
            "admin role required".to_owned(),
        ))
    }
}
