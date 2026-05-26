//! Wire-format DTOs for the SabChat contacts endpoints.
//!
//! Stored documents round-trip through [`SabChatContact`](sabchat_types::SabChatContact)
//! from `sabchat-types`. Request bodies and the lightweight query / list
//! envelopes live here.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` to
//! match the JSON the Next.js side sends.

use sabchat_types::{SabChatContact, SocialIdentity};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/// Default page size for `GET /v1/sabchat/contacts`.
pub const DEFAULT_LIMIT: u32 = 50;

/// Hard ceiling so callers cannot DOS the server with `limit=1_000_000`.
pub const MAX_LIMIT: u32 = 200;

fn default_limit() -> u32 {
    DEFAULT_LIMIT
}

// ---------------------------------------------------------------------------
// `POST /v1/sabchat/contacts` — create_contact
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/contacts`. Every field is optional but
/// **at least one identifier** (email / phone / social id) must be
/// present; identifier-less contacts are rejected with `BadRequest`.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateContactReq {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub emails: Vec<String>,
    #[serde(default)]
    pub phones: Vec<String>,
    #[serde(default)]
    pub social_ids: Vec<SocialIdentity>,
    /// Free-form custom attributes (plan, MRR, account id, …). Stored
    /// as opaque JSON on the contact document.
    #[serde(default)]
    pub attrs: Option<Value>,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// Response envelope wrapping a single SabChat contact. The full
/// `SabChatContact` is returned so callers can render the document
/// without a follow-up GET.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ContactResp {
    pub contact: SabChatContact,
}

// ---------------------------------------------------------------------------
// `GET /v1/sabchat/contacts` — list_contacts
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/contacts`.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListContactsQuery {
    /// Case-insensitive substring match against `name`, `emails`,
    /// `phones`. Missing / empty disables search.
    #[serde(default)]
    pub q: Option<String>,
    /// Exact tag name filter. Missing / empty disables the filter.
    #[serde(default)]
    pub tag: Option<String>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`] and is clamped to
    /// [`MAX_LIMIT`].
    #[serde(default = "default_limit")]
    pub limit: u32,
    /// Opaque cursor — hex of the last `_id` seen on the previous
    /// page. Empty / missing means "first page".
    #[serde(default)]
    pub cursor: Option<String>,
}

/// Response body for `GET /v1/sabchat/contacts`. Pagination is
/// `_id`-descending; the next cursor is the hex of the last document's
/// `_id`, or `None` when fewer than `limit` rows came back.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListContactsResp {
    pub items: Vec<SabChatContact>,
    #[serde(default)]
    pub next_cursor: Option<String>,
}

// ---------------------------------------------------------------------------
// `PATCH /v1/sabchat/contacts/{id}` — update_contact
// ---------------------------------------------------------------------------

/// Body for `PATCH /v1/sabchat/contacts/{id}`. Same shape as
/// [`CreateContactReq`] but every field is optional and any field left
/// out is preserved (no clobber).
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateContactReq {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub emails: Option<Vec<String>>,
    #[serde(default)]
    pub phones: Option<Vec<String>>,
    #[serde(default)]
    pub social_ids: Option<Vec<SocialIdentity>>,
    #[serde(default)]
    pub attrs: Option<Value>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

// ---------------------------------------------------------------------------
// `POST /v1/sabchat/contacts/{id}/merge` — merge_contact
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/contacts/{id}/merge`. Unions every
/// identifier and tag from `sourceId` into the path-id contact, then
/// deletes `sourceId`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MergeContactReq {
    /// Hex `ObjectId` of the contact whose identifiers should be folded
    /// into the path-id contact. Must belong to the same tenant.
    pub source_id: String,
}

// ---------------------------------------------------------------------------
// `POST /v1/sabchat/contacts/resolve` — resolve_contact
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/contacts/resolve`. At least one of
/// `email`, `phone`, or `socialId` must be present. The handler looks
/// up an existing contact by any matching identifier and creates a new
/// one if none exists.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ResolveContactReq {
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub social_id: Option<SocialIdentity>,
    /// Optional display name used only when creating a brand new
    /// contact; ignored on a hit.
    #[serde(default)]
    pub name: Option<String>,
}

/// Response body for `POST /v1/sabchat/contacts/resolve`. `created`
/// distinguishes a fresh insert from a lookup hit so callers can branch
/// on first-touch UX.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ResolveContactResp {
    pub contact: SabChatContact,
    pub created: bool,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by the DELETE endpoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResp {
    pub success: bool,
}

impl SuccessResp {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
