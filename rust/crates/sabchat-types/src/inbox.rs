//! Inbox + channel registry.
//!
//! A [`SabChatInbox`] is one channel binding (one widget, one WhatsApp number,
//! one Instagram page, one shared email address, …). Tenancy and RBAC scope
//! down to the inbox level. Routing rules and business hours are configured
//! per-inbox.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Transport channels SabChat can ingest from. The string discriminants are
/// stable wire values — do not rename without a migration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ChannelType {
    Website,
    WhatsappCloud,
    WhatsappPersonal,
    Instagram,
    Facebook,
    Telegram,
    Email,
    Sms,
    Voice,
    InApp,
    AppleBusinessChat,
    GoogleBusinessMessages,
    Line,
    Viber,
    XDm,
}

/// Channel-specific configuration blob. Stored as opaque JSON to keep the
/// type stable as channel adapters evolve. Each adapter crate is responsible
/// for parsing the shape it cares about.
#[derive(Debug, Clone, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ChannelConfig {
    /// Free-form per-channel settings (webhook secrets, page id, phone number
    /// id, widget colour, etc.).
    #[serde(default)]
    pub settings: serde_json::Value,
}

/// Business-hours definition for an inbox. Quoted in the tenant's local
/// timezone. If `enabled` is false the inbox is always-on.
#[derive(Debug, Clone, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BusinessHours {
    #[serde(default)]
    pub enabled: bool,

    /// IANA timezone string, e.g. `"Asia/Kolkata"`.
    #[serde(default)]
    pub timezone: String,

    /// Weekday window slots, 0 = Sunday … 6 = Saturday.
    #[serde(default)]
    pub windows: Vec<BusinessHoursWindow>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BusinessHoursWindow {
    /// 0..=6, Sunday-indexed.
    pub day: u8,
    /// HH:MM 24h.
    pub open: String,
    /// HH:MM 24h.
    pub close: String,
}

/// One inbox. Mongo collection: `sabchat_inboxes`.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SabChatInbox {
    #[serde(rename = "_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,

    /// Owning tenant (mirrors `users._id` for now; will become an org id when
    /// org-mode lands).
    #[schema(value_type = String)]
    pub tenant_id: ObjectId,

    pub name: String,

    pub channel_type: ChannelType,

    #[serde(default)]
    pub channel_config: ChannelConfig,

    /// Agents allowed to handle conversations on this inbox.
    #[serde(default)]
    #[schema(value_type = String)]
    pub agent_ids: Vec<ObjectId>,

    /// Optional team binding.
    #[serde(default)]
    #[schema(value_type = String)]
    pub team_id: Option<ObjectId>,

    #[serde(default)]
    pub business_hours: BusinessHours,

    /// Whether the inbox is currently accepting traffic.
    #[serde(default = "default_true")]
    pub enabled: bool,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub updated_at: DateTime<Utc>,
}

fn default_true() -> bool {
    true
}
