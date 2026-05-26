//! Wire-format DTOs for the SabChat SSO + SCIM endpoints.
//!
//! Two distinct surfaces share this module:
//!
//! 1. **Admin SSO configuration + SCIM token management**
//!    (`/v1/sabchat/sso/*`). These ride the standard tenant JWT and the
//!    bodies follow the rest of the SabChat router conventions —
//!    `rename_all = "camelCase"` so the Next.js side round-trips cleanly.
//!
//! 2. **SCIM 2.0 provisioning** (`/v1/sabchat/scim/v2/*`). SCIM is a
//!    spec-defined wire format (RFC 7643/7644), so the request /
//!    response shapes here intentionally mirror the schema URNs and
//!    `userName` / `givenName` / `familyName` casing prescribed by the
//!    spec rather than the snake_case we use elsewhere.
//!
//! Stored documents are rendered back to JSON via
//! [`sabnode_db::document_to_clean_json`] where convenient — handlers
//! that need to reshape (e.g. SCIM `userName` ← `email`) build the
//! envelope explicitly.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ===========================================================================
// SSO configuration (admin)
// ===========================================================================

/// Stored shape of an SSO configuration row
/// (`sabchat_sso_configs.<id>`).
///
/// `kind` is the discriminant — `"saml"` or `"oidc"`. The remaining
/// fields are populated per-kind: SAML uses `ssoUrl` +
/// `certificatePem`; OIDC uses `clientId` + `clientSecret` + `domain`.
/// `issuer` is shared by both and identifies the IdP.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SsoConfig {
    /// Hex `ObjectId` of the row.
    #[serde(rename = "_id")]
    pub id: String,
    /// Owning tenant (hex `ObjectId`).
    pub tenant_id: String,
    /// IdP integration flavor — `"saml"` or `"oidc"`.
    pub kind: String,
    /// Issuer / entityID. Shared by both flavors.
    pub issuer: String,
    /// SAML SSO redirect URL (HTTP-Redirect or HTTP-POST endpoint).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sso_url: Option<String>,
    /// SAML signing certificate (PEM).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub certificate_pem: Option<String>,
    /// OIDC client id.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    /// OIDC client secret.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_secret: Option<String>,
    /// OIDC issuer base (e.g. `https://example.auth0.com`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub domain: Option<String>,
    /// Whether SSO is currently enabled for the tenant.
    pub active: bool,
    /// ISO-8601 created-at stamp.
    pub created_at: String,
    /// ISO-8601 updated-at stamp.
    pub updated_at: String,
}

/// `POST /v1/sabchat/sso/configs` — request body.
///
/// All per-kind fields are optional at the type level; the handler
/// validates the (`kind`, fields) combination.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateSsoConfigBody {
    pub kind: String,
    pub issuer: String,
    #[serde(default)]
    pub sso_url: Option<String>,
    #[serde(default)]
    pub certificate_pem: Option<String>,
    #[serde(default)]
    pub client_id: Option<String>,
    #[serde(default)]
    pub client_secret: Option<String>,
    #[serde(default)]
    pub domain: Option<String>,
    /// Defaults to `true` when omitted.
    #[serde(default)]
    pub active: Option<bool>,
}

/// `PATCH /v1/sabchat/sso/configs/{id}` — partial update body. Every
/// field is optional; only the keys present in the JSON payload get
/// `$set` onto the document.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSsoConfigBody {
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub issuer: Option<String>,
    #[serde(default)]
    pub sso_url: Option<String>,
    #[serde(default)]
    pub certificate_pem: Option<String>,
    #[serde(default)]
    pub client_id: Option<String>,
    #[serde(default)]
    pub client_secret: Option<String>,
    #[serde(default)]
    pub domain: Option<String>,
    #[serde(default)]
    pub active: Option<bool>,
}

// ===========================================================================
// SCIM tokens (admin)
// ===========================================================================

/// Stored shape of a SCIM provisioning token row
/// (`sabchat_scim_tokens.<id>`).
///
/// The plain-text `token` is **only** returned at creation time
/// ([`CreateScimTokenResponse`]); list / get endpoints return a
/// truncated preview instead.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScimToken {
    #[serde(rename = "_id")]
    pub id: String,
    pub tenant_id: String,
    /// Plain-text token. Listed responses redact this to a preview.
    pub token: String,
    pub name: String,
    pub scopes: Vec<String>,
    pub created_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
}

/// `POST /v1/sabchat/sso/scim-tokens` — request body.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateScimTokenBody {
    pub name: String,
    pub scopes: Vec<String>,
}

/// `POST /v1/sabchat/sso/scim-tokens` — response body. The plain
/// `token` is returned **once** here; subsequent `GET` calls show only
/// the preview.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateScimTokenResponse {
    pub id: String,
    pub name: String,
    pub scopes: Vec<String>,
    pub token: String,
}

// ===========================================================================
// SAML test (admin)
// ===========================================================================

/// `POST /v1/sabchat/sso/test-saml-response` — request body. Stub today
/// — the handler echoes a happy-path response without verifying the
/// signature.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TestSamlResponseBody {
    pub config_id: String,
    pub saml_response: String,
}

/// Response from the SAML stub.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TestSamlResponseResult {
    pub ok: bool,
    pub claims: Value,
}

// ===========================================================================
// SCIM 2.0 — User
// ===========================================================================

/// `name` sub-object inside a SCIM User payload.
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct ScimName {
    #[serde(rename = "givenName", default, skip_serializing_if = "Option::is_none")]
    pub given_name: Option<String>,
    #[serde(rename = "familyName", default, skip_serializing_if = "Option::is_none")]
    pub family_name: Option<String>,
    #[serde(rename = "formatted", default, skip_serializing_if = "Option::is_none")]
    pub formatted: Option<String>,
}

/// Single `emails` array entry inside a SCIM User payload.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ScimEmail {
    pub value: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub primary: Option<bool>,
    #[serde(rename = "type", default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
}

/// `POST /Users` body — SCIM 2.0 User create.
///
/// Casing matches the SCIM RFC (`userName`, `givenName`, …) on purpose
/// — IdPs send exactly this shape.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ScimUserCreate {
    #[serde(rename = "userName")]
    pub user_name: String,
    #[serde(default)]
    pub name: Option<ScimName>,
    #[serde(default)]
    pub emails: Option<Vec<ScimEmail>>,
    #[serde(default)]
    pub active: Option<bool>,
    #[serde(rename = "displayName", default)]
    pub display_name: Option<String>,
    #[serde(rename = "externalId", default)]
    pub external_id: Option<String>,
}

/// One operation inside a SCIM 2.0 PATCH request body.
///
/// SCIM patches are `{ schemas, Operations: [{ op, path, value }] }`.
/// We implement a naïve subset — `replace` with a literal `path` is
/// translated into a `$set` on the matched field.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ScimPatchOp {
    /// Operation name — `replace` / `add` / `remove`.
    pub op: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub value: Option<Value>,
}

/// `PATCH /Users/{id}` body. We ignore `schemas` on input.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ScimPatchBody {
    #[serde(default, rename = "Operations")]
    pub operations: Vec<ScimPatchOp>,
}

// ===========================================================================
// SCIM 2.0 — Group
// ===========================================================================

/// One `members` entry on a SCIM Group payload.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ScimGroupMember {
    pub value: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display: Option<String>,
}

/// `POST /Groups` body — minimal SCIM Group create.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ScimGroupCreate {
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(default)]
    pub members: Option<Vec<ScimGroupMember>>,
    #[serde(rename = "externalId", default)]
    pub external_id: Option<String>,
}

// ===========================================================================
// SCIM 2.0 — List response envelope
// ===========================================================================

/// SCIM 2.0 list response envelope. `Resources` is the list of rendered
/// resources (User or Group). `total_results` matches `Resources.len()`
/// for our naïve implementation (no server-side pagination yet).
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ScimListResponse {
    pub schemas: Vec<String>,
    #[serde(rename = "totalResults")]
    pub total_results: usize,
    #[serde(rename = "startIndex")]
    pub start_index: usize,
    #[serde(rename = "itemsPerPage")]
    pub items_per_page: usize,
    #[serde(rename = "Resources")]
    pub resources: Vec<Value>,
}
