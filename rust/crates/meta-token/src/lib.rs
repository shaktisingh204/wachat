//! Meta access-token management — port of
//! `src/app/actions/meta-token.actions.ts` (Phase 6).
//!
//! Endpoints under `/v1/meta/token` cover:
//! - Token introspection (`debug_token`)
//! - Project-scoped token introspection / scope check / validity
//! - Short-lived → long-lived token exchange
//! - Project token refresh (writes back to `projects.accessToken`)
//! - Page token lookup from a user token
//! - App access token (`client_credentials`)
//! - Permission listing & granted-status checks
//! - Lightweight rate-limit usage probe (`/me?fields=id` headers)
//! - Batch Graph API (`POST /` with `batch=[...]`)
//! - User identity / accounts / businesses
//!
//! Security: raw access tokens are **never** logged. Use [`mask`] from
//! `wachat-meta-auth` when an introspection trace is needed.

pub mod graph;
pub mod router;
pub mod state;

pub use router::router;
pub use state::MetaTokenState;
