//! Tenant scoping for CRM Mongo queries.
//!
//! Every CRM mutation/list filter must start with `userId == AuthUser.user_id`
//! — the tenant root. Lifted from `crm-leads::handlers::user_oid` so all per-
//! entity crates can share.

use bson::{Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};

/// Parse the calling user's tenant-root [`ObjectId`] from the verified JWT
/// claim. Returns `Unauthorized` if the subject is not a hex `ObjectId`.
pub fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Parse the calling principal's **tenant** [`ObjectId`] from the JWT `tid`
/// claim (the active project/workspace), rather than the acting user (`sub`).
///
/// Project-scoped modules (SabBI, SabChat, …) bind every Rust call to the
/// selected project via `runWithRustTenant` on the TS side, which sets `tid`
/// to the project id; these crates scope their Mongo collections by this value
/// so data isolates per workspace rather than per user. Returns `Unauthorized`
/// if `tid` is not a hex `ObjectId`.
pub fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant is not a valid ObjectId".to_owned()))
}

/// `{ userId, archived: { $ne: true } }` — the canonical tenant filter that
/// excludes soft-deleted rows. Most list/get/update/delete handlers want
/// this; raw archival listings should use [`tenant_filter_with_archived`].
pub fn tenant_filter(user_oid: ObjectId) -> Document {
    doc! {
        "userId": user_oid,
        "archived": { "$ne": true },
    }
}

/// `{ userId }` — bare tenant scope without archive masking. Useful for
/// admin / restore / archive views.
pub fn tenant_filter_with_archived(user_oid: ObjectId) -> Document {
    doc! { "userId": user_oid }
}
