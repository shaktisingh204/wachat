//! Wire-format DTOs for the user-domain endpoints.
//!
//! These types are the **public contract** with the Next.js TypeScript client.
//! They derive [`utoipa::ToSchema`] so they appear in the generated OpenAPI
//! spec, which feeds `openapi-typescript` codegen on the TS side.
//!
//! Keep these decoupled from the Mongo document shape (`User` in
//! `sabnode-db`) — handlers do the conversion. That gives us room to evolve
//! the storage representation without breaking the API.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Response body for `GET /v1/me`.
///
/// Mirrored on the TypeScript side as `MeResponse` in
/// `src/lib/rust-client/types.ts` until codegen replaces the manual copy.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MeResponse {
    /// Mongo `_id` of the authenticated user, serialized as a hex string.
    pub id: String,
    /// Primary email address. Always present; uniqueness is enforced upstream.
    pub email: String,
    /// Optional display name. May be missing for users who signed up via
    /// providers that don't return one.
    pub name: Option<String>,
    /// When the user record was first created, in UTC.
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Response body for `GET /v1/session`.
///
/// The user payload is intentionally an open `Value` because the Next.js
/// session shape is still evolving (custom permissions, plan overrides,
/// CRM settings, ...) and shapes get added regularly. Treat this as the
/// "passthrough" view of the user document with plan joined and
/// permissions merged, matching the legacy `getSession()` action.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionResponse {
    /// Stored user document with `_id`/`planId` rendered as hex strings,
    /// `password` stripped, `credits` initialized, and an embedded `plan`
    /// field whose `permissions` already merge `customPermissions` on
    /// top of the plan's defaults.
    #[schema(value_type = Object)]
    pub user: Value,
}
