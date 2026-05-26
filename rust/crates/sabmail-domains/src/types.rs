//! On-disk shape of a `sabmail_domains` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabmailDomain {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// `owner` userId — typically the same as `user_id`. Tracked separately
    /// so future shared-ownership flows can flip it without breaking tenancy.
    #[serde(rename = "ownerUserId")]
    pub owner_user_id: ObjectId,

    /// FQDN (e.g. `acme.com`). Stored lower-case, trimmed.
    pub domain: String,

    /* ── DNS verification status. `pending` | `verified` | `failed` ───── */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mx_status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spf_status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dmarc_status: Option<String>,

    /* ── DKIM ──────────────────────────────────────────────────────────── */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dkim_selector: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dkim_public_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dkim_status: Option<String>,

    /* ── Capacity / billing hints ──────────────────────────────────────── */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mailbox_quota: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mailbox_count: Option<u32>,

    /* ── Audit ─────────────────────────────────────────────────────────── */
    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
    /// `active` | `archived`
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}
