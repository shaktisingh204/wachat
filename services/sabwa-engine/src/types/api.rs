//! Request / response DTOs for every endpoint exposed under `/v1/*`.
//!
//! Covers the REST surface in `SABWA_PLAN.md` §12 plus the server-action
//! companions in §13. Every struct is `Debug + Clone + Serialize +
//! Deserialize` with `camelCase` field naming; every enum uses
//! `snake_case` variants, and discriminated sum types carry a `kind` tag.
//!
//! These types deliberately use `String` for IDs and `chrono::DateTime<Utc>`
//! for timestamps so the JSON shape matches what the Next.js layer expects.
//! The persistence agent (`crate::db::*`) is free to use `ObjectId` /
//! `bson::DateTime` internally and convert at the route boundary.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::common::{Jid, MessagePayloadDto};

// ─────────────────────────────────────────────────────────────────────────
//   Health
// ─────────────────────────────────────────────────────────────────────────

/// `GET /v1/health` — diagnostic probe with build/uptime info.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthRes {
    pub ok: bool,
    pub version: &'static str,
    pub uptime_seconds: u64,
}

// ─────────────────────────────────────────────────────────────────────────
//   Sessions — pairing, listing, logout
// ─────────────────────────────────────────────────────────────────────────

/// Pairing method requested by the client (see `SABWA_PLAN.md` §4).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PairMethodDto {
    /// Worker emits a QR string the user scans with their phone.
    Qr,
    /// Worker requests an 8-digit pair code tied to a phone number.
    Code,
}

/// `POST /v1/sessions/pair` — kick off the Baileys pair flow.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairSessionReq {
    pub project_id: String,
    pub user_id: String,
    pub pair_method: PairMethodDto,
    /// Required when `pair_method == Code`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone_e164: Option<String>,
}

/// Response for [`PairSessionReq`].
///
/// Only one of `qr` / `pair_code` is populated, matching the requested
/// method. The first artifact may still be in-flight when this returns —
/// subsequent updates arrive over SSE as `qr` / `pair_code` events.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairSessionRes {
    pub session_id: String,
    /// `pending` | `connected` | `logged_out` | `banned` | `error`.
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub qr: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pair_code: Option<String>,
}

/// `POST /v1/sessions/:id/logout` — request body.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogoutSessionReq {
    pub session_id: String,
    /// When true, drop cached chats/messages/contacts in addition to creds.
    #[serde(default)]
    pub purge_data: bool,
}

/// Generic ack for fire-and-forget session mutations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionAckRes {
    pub session_id: String,
    pub status: String,
}

/// `GET /v1/sessions?projectId=...` — listing query.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSessionsQuery {
    pub project_id: String,
}

/// One row in [`ListSessionsRes`].
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummaryDto {
    pub session_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone_e164: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub push_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile_pic_url: Option<String>,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_connected_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rate_limit_profile: Option<String>,
}

/// Response for [`ListSessionsQuery`].
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSessionsRes {
    pub sessions: Vec<SessionSummaryDto>,
}

/// `POST /v1/sessions/:id/rename` — request body.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameSessionReq {
    pub session_id: String,
    pub label: String,
}

// ─────────────────────────────────────────────────────────────────────────
//   Messages — send, history
// ─────────────────────────────────────────────────────────────────────────

/// `POST /v1/sessions/:id/messages` — send a message to a chat.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageReq {
    pub session_id: String,
    pub chat_jid: Jid,
    pub payload: MessagePayloadDto,
}

/// Response for [`SendMessageReq`].
///
/// `queued = true` means the message has been written to the outbound
/// Redis queue but not yet sent by the worker; the client should watch
/// the SSE stream for the matching `message_status` event.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageRes {
    pub message_id: String,
    /// Unix-ms timestamp the engine accepted the send.
    pub server_ts: i64,
    pub queued: bool,
}

/// `GET /v1/sessions/:id/chats/:jid/messages` — history query.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetChatMessagesQuery {
    pub session_id: String,
    pub chat_jid: Jid,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
    /// Max page size; server clamps to a hard ceiling.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,
}

/// `POST /v1/sessions/:id/chats/:jid/read` — mark chat read.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkReadReq {
    pub session_id: String,
    pub chat_jid: Jid,
}

// ─────────────────────────────────────────────────────────────────────────
//   Chats — listing, per-chat mutations
// ─────────────────────────────────────────────────────────────────────────

/// Server-side filter applied to a chat list query.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChatFilterDto {
    /// No filter — return every chat.
    All,
    /// Only individual peer chats (`@s.whatsapp.net`).
    Individual,
    /// Only group chats (`@g.us`).
    Group,
    /// Only broadcast lists.
    Broadcast,
}

/// `GET /v1/sessions/:id/chats` — listing query.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListChatsQuery {
    pub session_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filter: Option<ChatFilterDto>,
    /// When `Some(true)`, restrict to chats with `unreadCount > 0`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unread: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
}

/// One row in the chat list.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSummaryDto {
    pub jid: Jid,
    /// `individual` | `group` | `broadcast` | `status`.
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile_pic_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_message_preview: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_message_ts: Option<i64>,
    #[serde(default)]
    pub unread_count: u32,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub archived: bool,
    #[serde(default)]
    pub muted: bool,
    /// IDs of labels attached to this chat.
    #[serde(default)]
    pub labels: Vec<String>,
}

/// `POST /v1/sessions/:id/chats/:jid/state` — pin / mute / archive toggle.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChatStateReq {
    pub session_id: String,
    pub chat_jid: Jid,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pinned: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub muted: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub archived: Option<bool>,
    /// When `muted == Some(true)`, optional auto-unmute timestamp.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mute_end_at: Option<DateTime<Utc>>,
}

// ─────────────────────────────────────────────────────────────────────────
//   Groups
// ─────────────────────────────────────────────────────────────────────────

/// `POST /v1/sessions/:id/groups` — create a new group chat.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupReq {
    pub session_id: String,
    pub subject: String,
    pub participants: Vec<Jid>,
}

/// Response for [`CreateGroupReq`].
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupRes {
    pub group_jid: Jid,
    pub subject: String,
    pub invite_code: Option<String>,
}

/// `POST /v1/sessions/:id/groups/:jid/members` — modify membership.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGroupMembersReq {
    pub session_id: String,
    pub group_jid: Jid,
    pub action: GroupMemberActionDto,
    pub members: Vec<Jid>,
}

/// Action discriminator for [`UpdateGroupMembersReq`].
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GroupMemberActionDto {
    Add,
    Remove,
    Promote,
    Demote,
}

/// `POST /v1/sessions/:id/groups/:jid/metadata` — subject / desc / icon.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGroupMetadataReq {
    pub session_id: String,
    pub group_jid: Jid,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// SabFiles-hosted URL for the new group icon (never an arbitrary URL).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

// ─────────────────────────────────────────────────────────────────────────
//   Scheduler
// ─────────────────────────────────────────────────────────────────────────

/// `POST /v1/sessions/:id/scheduled` — schedule a one-off or recurring send.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleMessageReq {
    pub session_id: String,
    pub kind: ScheduledKindDto,
    /// First fire time (UTC). For recurring jobs this is the anchor that
    /// the `cron` expression is evaluated relative to.
    pub scheduled_for: DateTime<Utc>,
    /// Required when `kind == Recurring`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cron: Option<String>,
    /// IANA tz name (e.g. `"Asia/Kolkata"`) used to interpret `cron`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,
    pub targets: Vec<ScheduledTargetDto>,
    pub payload: MessagePayloadDto,
}

/// One delivery target for a scheduled send.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTargetDto {
    pub jid: Jid,
    /// Disambiguates how the JID should be addressed (individual peer,
    /// group chat, or broadcast list — reuses [`ChatFilterDto`]'s set).
    pub kind: ChatFilterDto,
}

/// Whether a scheduled job fires once or on a recurring cron.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ScheduledKindDto {
    OneOff,
    Recurring,
}

/// Response for [`ScheduleMessageReq`].
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleMessageRes {
    pub scheduled_id: String,
    pub status: String,
}

/// `GET /v1/sessions/:id/scheduled` — list query.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListScheduledQuery {
    pub session_id: String,
    /// Filter by `pending` | `sent` | `failed` | `cancelled`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
}

// ─────────────────────────────────────────────────────────────────────────
//   Broadcasts & bulk
// ─────────────────────────────────────────────────────────────────────────

/// Discriminated audience for a bulk campaign.
///
/// `Numbers`     — raw E.164 list, validated server-side.
/// `Label`       — chats tagged with this label ID.
/// `GroupMembers`— every participant of this group JID.
/// `ContactTag`  — every contact carrying this tag.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", content = "value")]
pub enum BulkAudienceDto {
    Numbers(Vec<String>),
    Label(String),
    GroupMembers(String),
    ContactTag(String),
}

/// `POST /v1/sessions/:id/bulk` — start a bulk send campaign.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartBulkReq {
    pub session_id: String,
    pub audience: BulkAudienceDto,
    pub payload: MessagePayloadDto,
    /// Cap on the number of sends per minute the worker may perform —
    /// enforced by the anti-ban layer (§9).
    pub send_rate_per_min: u32,
    /// Maximum random jitter, in seconds, added between sends.
    pub jitter_sec: u32,
}

/// Response for [`StartBulkReq`].
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartBulkRes {
    pub campaign_id: String,
    pub status: String,
    pub estimated_recipients: u32,
}

/// `POST /v1/sessions/:id/bulk/:campaignId/control` — pause/resume/abort.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlBulkReq {
    pub session_id: String,
    pub campaign_id: String,
    pub action: BulkActionDto,
}

/// Action discriminator for [`ControlBulkReq`].
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BulkActionDto {
    Pause,
    Resume,
    Abort,
}

// ─────────────────────────────────────────────────────────────────────────
//   Contacts
// ─────────────────────────────────────────────────────────────────────────

/// `GET /v1/sessions/:id/contacts` — listing query.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListContactsQuery {
    pub session_id: String,
    /// Free-text query matched against `name` / `pushName` / `phoneE164`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub q: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
}

/// One row in the contact list.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactDto {
    pub jid: Jid,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone_e164: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub push_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile_pic_url: Option<String>,
    #[serde(default)]
    pub is_business: bool,
    #[serde(default)]
    pub is_blocked: bool,
    #[serde(default)]
    pub is_my_contact: bool,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// `POST /v1/sessions/:id/contacts/:jid/tags` — mutate contact tags.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertContactTagsReq {
    pub session_id: String,
    pub jid: Jid,
    pub tags: Vec<String>,
}

// ─────────────────────────────────────────────────────────────────────────
//   RBAC & plan gating  (SABWA_PLAN.md §10–§11)
// ─────────────────────────────────────────────────────────────────────────

/// `GET /v1/permissions/check` — single permission probe.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionCheckReq {
    pub project_id: String,
    pub user_id: String,
    /// Permission key, e.g. `"sabwa:bulk:start"` or `"sabwa:groups:create"`.
    pub permission: String,
}

/// Response for [`PermissionCheckReq`].
///
/// `reason` carries a stable code (`"plan_required"`, `"role_required"`,
/// `"quota_exceeded"`, …) when `allowed == false`, suitable for surfacing
/// an upgrade CTA in the UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionCheckRes {
    pub allowed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    /// Minimum plan tier required to unlock this permission, if gated.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required_plan: Option<String>,
}

/// `GET /v1/plan/quota` — return remaining quota counters for the project.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanQuotaRes {
    pub project_id: String,
    pub plan: String,
    pub messages_sent_today: u32,
    pub messages_daily_cap: u32,
    pub bulk_campaigns_today: u32,
    pub bulk_daily_cap: u32,
    pub active_sessions: u32,
    pub session_cap: u32,
    /// Credits remaining at the moment of the call. Mirrors §11.
    pub credits_remaining: i64,
}
