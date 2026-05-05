//! # wachat-api-keys-admin
//!
//! Admin-side CRUD for the wachat public-API keys. Ports the three
//! user-facing actions in `src/app/actions/api-keys.actions.ts`
//! (`generateApiKey`, `getApiKeysForUser`, `revokeApiKey`) onto the Rust
//! BFF and stores rows in the same `api_keys` collection that
//! [`wachat_public_api::ApiKeyVerifier`] reads on the request path. As a
//! result, a key generated through this crate becomes immediately usable
//! against `/v1/wachat/public/*` without any sync step.
//!
//! ## Routes
//!
//! Mount under `/v1/api-keys` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/api-keys", wachat_api_keys_admin::router::<AppState>())
//! ```
//!
//! | Method | Path                 | Handler            | Purpose                           |
//! | ------ | -------------------- | ------------------ | --------------------------------- |
//! | POST   | `/`                  | `generate_api_key` | Mint a new key, return plaintext. |
//! | GET    | `/`                  | `list_api_keys`    | Metadata-only list (no plaintext).|
//! | PATCH  | `/{key_id}/revoke`   | `revoke_api_key`   | Soft-delete via `revoked: true`.  |
//!
//! ## Storage shape
//!
//! Documents written here match the shape
//! [`wachat_public_api::ApiKeyVerifier`] queries:
//!
//! ```jsonc
//! {
//!   "_id":         ObjectId,
//!   "name":        "production webhook",
//!   "tenantId":    "<user hex id>",   // user-scoped — same as `userId` in TS
//!   "userId":      "<user hex id>",   // duplicate for legacy readers
//!   "key":         "<sha256 hex>",    // never the plaintext
//!   "scopes":      ["*"],
//!   "tier":        "FREE",
//!   "revoked":     false,
//!   "requestCount": 0,
//!   "createdAt":   ISODate,
//!   "lastUsedAt":  ISODate | null,
//! }
//! ```
//!
//! The plaintext is returned exactly **once** from `generate_api_key` —
//! never again. List responses scrub both `key` (the hash) and any
//! historical plaintext from the wire shape.
//!
//! ## Tenancy
//!
//! Every endpoint scopes by the JWT subject. List/revoke filter on
//! `tenantId == user_id`, so cross-user access produces 404 rather than
//! leaking existence.

pub mod dto;
pub mod handlers;
pub mod state;
pub mod store;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, patch},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

pub use state::WachatApiKeysAdminState;

/// Build the `/v1/api-keys` router.
///
/// Wire this onto any state that exposes a [`MongoHandle`] and an
/// `Arc<AuthConfig>` via `FromRef`, matching the convention used by
/// `wachat-projects` and `qr-codes`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_api_keys).post(handlers::generate_api_key),
        )
        .route("/{key_id}/revoke", patch(handlers::revoke_api_key))
}
