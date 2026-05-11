//! Request and response shapes for the admin HTTP surface.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// `GET /v1/admin/configured` response.
#[derive(Debug, Serialize, ToSchema)]
pub struct ConfiguredResponse {
    pub configured: bool,
}

/// `POST /v1/admin/setup` request body. Mirrors the TS form fields.
#[derive(Debug, Deserialize, ToSchema)]
pub struct SetupBody {
    pub email: String,
    pub password: String,
    #[serde(rename = "confirmPassword")]
    pub confirm_password: String,
}

/// `POST /v1/admin/login` request body.
#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginBody {
    pub email: String,
    pub password: String,
}

/// Standard `{ ok: true }` ack for setup/login/revoke success paths.
#[derive(Debug, Serialize, ToSchema)]
pub struct AdminOk {
    pub ok: bool,
}

impl AdminOk {
    pub fn new() -> Self {
        Self { ok: true }
    }
}

impl Default for AdminOk {
    fn default() -> Self {
        Self::new()
    }
}

/// `POST /v1/admin/logout/revoke` request body. The TS proxy decodes the
/// admin cookie itself to pull `jti` + `exp`, so we don't need the raw JWT
/// here — keeps `JWT_SECRET` out of the Rust process.
#[derive(Debug, Deserialize, ToSchema)]
pub struct LogoutRevokeBody {
    /// JWT id from the admin cookie.
    pub jti: String,
    /// Token expiry as unix seconds — used as the `expiresAt` for the
    /// `revoked_tokens` row so the entry can be TTL-pruned later.
    #[serde(rename = "expSeconds")]
    pub exp_seconds: i64,
}
