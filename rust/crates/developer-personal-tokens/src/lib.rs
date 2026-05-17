//! # developer-personal-tokens
//!
//! Personal Access Token (PAT) CRUD for the SabNode developer API.
//! Sibling of [`wachat_api_keys_admin`] — same shape, different collection.
//!
//! ## Why a separate crate?
//!
//! PATs differ from API keys in two ways that matter at the storage level:
//!
//!   - **Tenancy.** API keys are tenant-scoped — a key has a `tenantId` and
//!     calls made with it carry no user identity. PATs are user-scoped —
//!     every PAT has both `tenantId` and `userId`, and the Next.js
//!     `verifyApiKey` path threads the `userId` into the auth context so
//!     RBAC kicks in for the request.
//!
//!   - **Plaintext prefix.** PATs are minted with the `sab_pat_` prefix so
//!     the Next.js verifier knows which collection to query. The hash
//!     stored at rest is computed over the prefix-stripped suffix, matching
//!     `auth.ts`'s `parseToken().suffix` path.
//!
//! Keeping a separate crate avoids tangling two different ownership models
//! inside one store module and keeps the migration path clean (later
//! phases can rotate either side independently).
//!
//! ## Routes
//!
//! Mount under `/v1/personal-access-tokens` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/personal-access-tokens", developer_personal_tokens::router::<AppState>())
//! ```
//!
//! | Method | Path                  | Handler          | Purpose                              |
//! | ------ | --------------------- | ---------------- | ------------------------------------ |
//! | POST   | `/`                   | `generate_pat`   | Mint a new PAT, return plaintext.    |
//! | GET    | `/`                   | `list_pats`      | Metadata-only list (no plaintext).   |
//! | PATCH  | `/{token_id}/revoke`  | `revoke_pat`     | Soft-delete via `revoked: true`.     |
//!
//! ## Storage shape
//!
//! ```jsonc
//! {
//!   "_id":         ObjectId,
//!   "name":        "ci-deploy",
//!   "tenantId":    "<tenant hex id>",
//!   "userId":      "<user hex id>",     // owner — drives RBAC at request time
//!   "key":         "<sha256 hex>",      // hash of the suffix; never the plaintext
//!   "scopes":      ["*"],
//!   "tier":        "FREE",
//!   "expiresAt":   ISODate | null,
//!   "revoked":     false,
//!   "requestCount": 0,
//!   "createdAt":   ISODate,
//!   "lastUsedAt":  ISODate | null,
//! }
//! ```

pub mod dto;
pub mod handlers;
pub mod state;
pub mod store;

pub use state::DeveloperPersonalTokensState;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, patch},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

/// Build the `/v1/personal-access-tokens` router.
///
/// Wire onto any state exposing a [`MongoHandle`] + `Arc<AuthConfig>` via
/// `FromRef`, matching the convention used by `wachat-api-keys-admin`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_pats).post(handlers::generate_pat),
        )
        .route("/{token_id}/revoke", patch(handlers::revoke_pat))
}
