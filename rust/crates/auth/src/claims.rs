//! JWT claims contract shared with the Next.js issuer (`src/lib/jwt-for-rust.ts`).
//!
//! Field meanings:
//! - `sub` — User ID (Mongo ObjectId hex string).
//! - `tid` — Tenant / project ID the request is scoped to.
//! - `roles` — Permission roles for the user within `tid`. Values mirror the
//!   role taxonomy in `src/lib/rbac-server.ts` (e.g. `"owner"`, `"admin"`,
//!   `"agent"`, `"member"`).
//! - `iat` / `exp` — Standard JWT timestamps in seconds since epoch.
//! - `iss` — Always `"sabnode-bff"`. Verified strictly.

use serde::{Deserialize, Serialize};

/// Decoded payload of a Rust-bound BFF JWT.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Claims {
    /// Subject — the authenticated user's ID.
    pub sub: String,
    /// Tenant / project scope for this token.
    pub tid: String,
    /// Permission roles granted to the user within `tid`.
    pub roles: Vec<String>,
    /// Issued-at (unix seconds).
    pub iat: i64,
    /// Expiry (unix seconds).
    pub exp: i64,
    /// Issuer — must equal `"sabnode-bff"`.
    pub iss: String,
}
