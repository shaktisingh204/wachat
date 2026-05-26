//! Deduped contact identity across every channel.
//!
//! One human → one [`SabChatContact`]. Phones, emails, and social IDs are
//! arrays so the same person reaching us via WhatsApp + email + Instagram
//! merges into a single record. Identity resolution lives in
//! `sabchat-contacts`; this is the storage shape only.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Per-social-network identifier. The provider string matches
/// `ChannelType` snake-case ("instagram", "facebook", "telegram", …).
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SocialIdentity {
    pub provider: String,
    /// Stable id on that provider (page-scoped id, telegram chat id, etc.).
    pub external_id: String,
    /// Display handle if known.
    #[serde(default)]
    pub handle: Option<String>,
}

/// One human across channels. Mongo collection: `sabchat_contacts`.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SabChatContact {
    #[serde(rename = "_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,

    #[schema(value_type = String)]
    pub tenant_id: ObjectId,

    #[serde(default)]
    pub name: Option<String>,

    #[serde(default)]
    pub avatar_url: Option<String>,

    /// All known emails. Lower-cased on write.
    #[serde(default)]
    pub emails: Vec<String>,

    /// All known phones in E.164 (digits only, no `+`).
    #[serde(default)]
    pub phones: Vec<String>,

    /// All known social identities (Instagram, Facebook, Telegram, …).
    #[serde(default)]
    pub social_ids: Vec<SocialIdentity>,

    /// Free-form custom attributes set by the tenant (plan, MRR, account id,
    /// etc.). Kept as opaque JSON.
    #[serde(default)]
    pub attrs: serde_json::Value,

    /// Tag names this contact is currently tagged with.
    #[serde(default)]
    pub tags: Vec<String>,

    /// Cross-channel last-seen for visitor-presence and re-engagement.
    #[serde(default, with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional")]
    pub last_seen_at: Option<DateTime<Utc>>,

    /// Optional foreign key into the CRM `contacts` collection once the
    /// merge with CRM is wired up.
    #[serde(default)]
    #[schema(value_type = String)]
    pub crm_contact_id: Option<ObjectId>,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub updated_at: DateTime<Utc>,
}
