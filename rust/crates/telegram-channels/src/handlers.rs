//! HTTP handlers for the Telegram Channels slice.
//!
//! Every endpoint is project-scoped (`require_project`) — the page
//! always knows which project the user is operating in. We discover
//! the bot used for an operation through the channel record itself
//! (or, for `discover`, through the request body).

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::bot_api::{BotApiError, ChatMember};
use crate::state::TelegramChannelsState;

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const CHANNELS: &str = "telegram_channels";
const POSTS: &str = "telegram_channel_posts";
const SCHEDULED: &str = "telegram_channel_scheduled_posts";

// ---------------------------------------------------------------------------
//  Wire shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "channelId")]
    pub channel_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "postId")]
    pub post_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "messageId")]
    pub message_id: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelPermissions {
    pub can_post_messages: bool,
    pub can_edit_messages: bool,
    pub can_delete_messages: bool,
    pub can_invite_users: bool,
    pub can_manage_chat: bool,
    pub can_pin_messages: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChannelRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "chatId")]
    pub chat_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    pub title: String,
    /// `"channel"` or `"supergroup"`.
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(rename = "memberCount", skip_serializing_if = "Option::is_none")]
    pub member_count: Option<i64>,
    #[serde(rename = "isVerified", skip_serializing_if = "Option::is_none")]
    pub is_verified: Option<bool>,
    #[serde(rename = "isAdmin")]
    pub is_admin: bool,
    pub permissions: ChannelPermissions,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "lastSyncedAt"
    )]
    pub last_synced_at: DateTime<Utc>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListResp {
    pub channels: Vec<ChannelRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
    #[serde(default)]
    pub skip: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectOnlyQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DiscoverBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(default, rename = "chatId")]
    pub chat_id: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PromoteBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "userId")]
    pub user_id: i64,
    #[serde(default)]
    pub can_post_messages: Option<bool>,
    #[serde(default)]
    pub can_edit_messages: Option<bool>,
    #[serde(default)]
    pub can_delete_messages: Option<bool>,
    #[serde(default)]
    pub can_invite_users: Option<bool>,
    #[serde(default)]
    pub can_manage_chat: Option<bool>,
    #[serde(default)]
    pub can_pin_messages: Option<bool>,
    #[serde(default)]
    pub can_promote_members: Option<bool>,
    #[serde(default)]
    pub can_restrict_members: Option<bool>,
    #[serde(default)]
    pub can_change_info: Option<bool>,
    #[serde(default)]
    pub can_manage_video_chats: Option<bool>,
    #[serde(default)]
    pub is_anonymous: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DemoteBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "userId")]
    pub user_id: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct PostMessage {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    /// SabFiles URL when a single image/video/document attachment is used.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media: Option<MediaItem>,
    /// Multiple attachments — sent as `sendMediaGroup`.
    #[serde(
        default,
        rename = "mediaGroup",
        skip_serializing_if = "Option::is_none"
    )]
    pub media_group: Option<Vec<MediaItem>>,
    #[serde(default, rename = "parseMode", skip_serializing_if = "Option::is_none")]
    pub parse_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entities: Option<Value>,
    #[serde(
        default,
        rename = "disableWebPagePreview",
        skip_serializing_if = "Option::is_none"
    )]
    pub disable_web_page_preview: Option<bool>,
    #[serde(
        default,
        rename = "disableNotification",
        skip_serializing_if = "Option::is_none"
    )]
    pub disable_notification: Option<bool>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        rename = "scheduleAt",
        skip_serializing_if = "Option::is_none"
    )]
    pub schedule_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct MediaItem {
    pub url: String,
    /// `"photo"` / `"video"` / `"document"` / `"audio"`.
    #[serde(default, rename = "type", skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PostBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub message: PostMessage,
    #[serde(default, rename = "inlineKeyboard")]
    pub inline_keyboard: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct EditPostBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub caption: Option<String>,
    #[serde(default, rename = "parseMode")]
    pub parse_mode: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PinBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "disableNotification")]
    pub disable_notification: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PostRow {
    pub _id: String,
    #[serde(rename = "channelId")]
    pub channel_id: String,
    #[serde(rename = "messageId")]
    pub message_id: i64,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media: Option<Value>,
    #[serde(rename = "isPinned")]
    pub is_pinned: bool,
    #[serde(rename = "views", skip_serializing_if = "Option::is_none")]
    pub views: Option<i64>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "sentAt"
    )]
    pub sent_at: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        rename = "editedAt",
        skip_serializing_if = "Option::is_none"
    )]
    pub edited_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct PostsResp {
    pub posts: Vec<PostRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "nextCursor")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScheduledRow {
    pub _id: String,
    #[serde(rename = "channelId")]
    pub channel_id: String,
    pub message: Value,
    #[serde(rename = "inlineKeyboard", skip_serializing_if = "Option::is_none")]
    pub inline_keyboard: Option<Value>,
    pub status: String,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "scheduledAt"
    )]
    pub scheduled_at: DateTime<Utc>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ScheduledResp {
    pub scheduled: Vec<ScheduledRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminRow {
    pub user_id: i64,
    pub status: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    pub can_post_messages: bool,
    pub can_edit_messages: bool,
    pub can_delete_messages: bool,
    pub can_invite_users: bool,
    pub can_manage_chat: bool,
    pub can_pin_messages: bool,
    pub can_promote_members: bool,
    pub can_change_info: bool,
    pub is_anonymous: bool,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct AdminsResp {
    pub admins: Vec<AdminRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct StatsResp {
    #[serde(rename = "postsCount")]
    pub posts_count: i64,
    #[serde(rename = "totalViews")]
    pub total_views: i64,
    #[serde(rename = "scheduledCount")]
    pub scheduled_count: i64,
    pub series: Vec<StatsPoint>,
    #[serde(rename = "topPosts")]
    pub top_posts: Vec<PostRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatsPoint {
    pub date: String,
    pub posts: i64,
}

// ---------------------------------------------------------------------------
//  Tiny helpers
// ---------------------------------------------------------------------------

fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}

fn parse_user_oid(user: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&user.user_id).ok()
}

fn dt(o: Option<bson::DateTime>) -> DateTime<Utc> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
}

fn dt_opt(o: Option<bson::DateTime>) -> Option<DateTime<Utc>> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
}

fn err(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        ..Default::default()
    })
}

fn map_bot_err(e: BotApiError) -> String {
    match e {
        BotApiError::Api(s) => s,
        BotApiError::Transport(e) => format!("network: {e}"),
    }
}

async fn require_project(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
) -> Result<ObjectId, String> {
    let project_oid = parse_oid(project_id).ok_or_else(|| "invalid project id".to_owned())?;
    let user_oid = parse_user_oid(user).ok_or_else(|| "invalid auth subject".to_owned())?;
    let project = mongo
        .collection::<Document>(PROJECTS)
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Project not found.".to_owned())?;
    if project.get_object_id("userId").ok() != Some(user_oid) {
        return Err("Project not found.".to_owned());
    }
    Ok(project_oid)
}

/// Load a bot belonging to the given project. Returns `(bot_oid, token)`.
async fn load_bot_for_project(
    mongo: &MongoHandle,
    bot_id_hex: &str,
    project_oid: ObjectId,
) -> Result<(ObjectId, String), String> {
    let bot_oid = parse_oid(bot_id_hex).ok_or_else(|| "invalid bot id".to_owned())?;
    let bot = mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid, "projectId": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found in project.".to_owned())?;
    let token = bot
        .get_str("token")
        .map_err(|_| "Bot is missing its token.".to_owned())?
        .to_owned();
    Ok((bot_oid, token))
}

/// Load a channel for the project. Returns the raw doc; caller can fish
/// out botId + chatId. Soft-deleted channels are excluded.
async fn load_channel_for_project(
    mongo: &MongoHandle,
    channel_id_hex: &str,
    project_oid: ObjectId,
) -> Result<Document, String> {
    let channel_oid = parse_oid(channel_id_hex).ok_or_else(|| "invalid channel id".to_owned())?;
    let mut filter = doc! { "_id": channel_oid, "projectId": project_oid };
    filter.insert("deletedAt", doc! { "$exists": false });
    mongo
        .collection::<Document>(CHANNELS)
        .find_one(filter)
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Channel not found.".to_owned())
}

fn permissions_from_member(m: &ChatMember) -> ChannelPermissions {
    let is_admin = m.status == "administrator" || m.status == "creator";
    let is_owner = m.status == "creator";
    ChannelPermissions {
        can_post_messages: is_owner || m.can_post_messages.unwrap_or(false),
        can_edit_messages: is_owner || m.can_edit_messages.unwrap_or(false),
        can_delete_messages: is_owner || m.can_delete_messages.unwrap_or(false),
        can_invite_users: is_owner || m.can_invite_users.unwrap_or(false),
        can_manage_chat: is_admin && (is_owner || m.can_manage_chat.unwrap_or(false)),
        can_pin_messages: is_owner || m.can_pin_messages.unwrap_or(false),
    }
}

fn doc_to_row(d: &Document) -> Option<ChannelRow> {
    let perm = d.get_document("permissions").cloned().unwrap_or_default();
    let permissions = ChannelPermissions {
        can_post_messages: perm.get_bool("can_post_messages").unwrap_or(false),
        can_edit_messages: perm.get_bool("can_edit_messages").unwrap_or(false),
        can_delete_messages: perm.get_bool("can_delete_messages").unwrap_or(false),
        can_invite_users: perm.get_bool("can_invite_users").unwrap_or(false),
        can_manage_chat: perm.get_bool("can_manage_chat").unwrap_or(false),
        can_pin_messages: perm.get_bool("can_pin_messages").unwrap_or(false),
    };
    Some(ChannelRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        chat_id: d.get_str("chatId").ok()?.to_owned(),
        username: d.get_str("username").ok().map(str::to_owned),
        title: d.get_str("title").unwrap_or("").to_owned(),
        kind: d.get_str("type").unwrap_or("channel").to_owned(),
        member_count: d
            .get_i64("memberCount")
            .or_else(|_| d.get_i32("memberCount").map(i64::from))
            .ok(),
        is_verified: d.get_bool("isVerified").ok(),
        is_admin: d.get_bool("isAdmin").unwrap_or(false),
        permissions,
        last_synced_at: dt(d.get_datetime("lastSyncedAt").ok().copied()),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
    })
}

/// Returns the Bot API `chat_id` argument we should pass when making
/// calls on behalf of this channel. Channels work either via numeric
/// id (e.g. `-1001234567890`) or `@username`.
fn outbound_chat_id<'a>(chat_id: &'a str, username: Option<&'a str>) -> String {
    if let Some(u) = username {
        if !u.is_empty() {
            return format!("@{u}");
        }
    }
    chat_id.to_owned()
}

// ---------------------------------------------------------------------------
//  GET /v1/telegram/channels
// ---------------------------------------------------------------------------

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListResp {
                channels: vec![],
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListResp {
                channels: vec![],
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let mut filter = doc! { "projectId": project_oid };
    filter.insert("deletedAt", doc! { "$exists": false });
    if let Some(b) = q.bot_id.as_deref().filter(|s| !s.is_empty()) {
        if let Some(o) = parse_oid(b) {
            filter.insert("botId", o);
        }
    }
    if let Some(k) = q.kind.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("type", k);
    }
    if let Some(s_query) = q.search.as_deref().filter(|s| !s.is_empty()) {
        // Case-insensitive title/username substring filter.
        let pat = regex::escape(s_query);
        filter.insert(
            "$or",
            bson::Bson::Array(vec![
                bson::Bson::Document(doc! { "title": { "$regex": &pat, "$options": "i" } }),
                bson::Bson::Document(doc! { "username": { "$regex": &pat, "$options": "i" } }),
            ]),
        );
    }
    let limit = q.limit.unwrap_or(100).clamp(1, 500);
    let skip = q.skip.unwrap_or(0).max(0) as u64;

    let coll = s.mongo.collection::<Document>(CHANNELS);
    let total = coll
        .count_documents(filter.clone())
        .await
        .map(|n| n as i64)
        .ok();

    let cursor = match coll
        .find(filter)
        .sort(doc! { "lastSyncedAt": -1 })
        .skip(skip)
        .limit(limit)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                channels: vec![],
                error: Some(format!("mongo: {e}")),
                total: None,
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                channels: vec![],
                error: Some(format!("mongo: {e}")),
                total: None,
            });
        }
    };
    let channels: Vec<ChannelRow> = docs.iter().filter_map(doc_to_row).collect();
    Json(ListResp {
        channels,
        error: None,
        total,
    })
}

// ---------------------------------------------------------------------------
//  POST /v1/telegram/channels/discover
// ---------------------------------------------------------------------------

pub async fn discover(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Json(body): Json<DiscoverBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let (bot_oid, token) = match load_bot_for_project(&s.mongo, &body.bot_id, project_oid).await {
        Ok(t) => t,
        Err(e) => return err(e),
    };

    // Build the Telegram chat_id from either the numeric chatId or the
    // @username. The Bot API accepts both interchangeably for getChat.
    let target_chat = match (body.chat_id.as_deref(), body.username.as_deref()) {
        (Some(id), _) if !id.is_empty() => id.to_owned(),
        (_, Some(u)) if !u.is_empty() => {
            if u.starts_with('@') {
                u.to_owned()
            } else {
                format!("@{u}")
            }
        }
        _ => return err("chatId or username is required"),
    };

    let chat = match s.bot_api.get_chat(&token, &target_chat).await {
        Ok(c) => c,
        Err(e) => return err(map_bot_err(e)),
    };
    let kind = chat.kind.clone().unwrap_or_else(|| "channel".to_owned());
    if kind != "channel" && kind != "supergroup" {
        return err("That chat is not a channel or supergroup.");
    }

    // Verify the bot is an administrator. We fetch the bot's own user
    // id via getChatAdministrators (bots cannot run getMe here without
    // their numeric id, but the project record already has it).
    let bot_doc = s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
        .ok()
        .flatten();
    let bot_uid = bot_doc
        .as_ref()
        .and_then(|d| d.get_i64("botId").ok())
        .or_else(|| {
            bot_doc
                .as_ref()
                .and_then(|d| d.get_i32("botId").ok())
                .map(i64::from)
        });

    let mut is_admin = false;
    let mut permissions = ChannelPermissions::default();
    if let Some(uid) = bot_uid {
        match s.bot_api.get_chat_member(&token, &target_chat, uid).await {
            Ok(m) => {
                is_admin = m.status == "administrator" || m.status == "creator";
                permissions = permissions_from_member(&m);
            }
            Err(_) => {
                // Fall back to scanning administrators if the direct
                // getChatMember call fails.
                if let Ok(list) = s
                    .bot_api
                    .get_chat_administrators(&token, &target_chat)
                    .await
                {
                    if let Some(m) = list
                        .iter()
                        .find(|m| m.user.get("id").and_then(|v| v.as_i64()) == Some(uid))
                    {
                        is_admin = true;
                        permissions = permissions_from_member(m);
                    }
                }
            }
        }
    }

    if !is_admin {
        return err("Add the bot as an administrator of this channel and retry.");
    }

    let member_count = s
        .bot_api
        .get_chat_member_count(&token, &target_chat)
        .await
        .ok();

    let now = bson::DateTime::now();
    let chat_id_str = chat.id.to_string();
    let title = chat
        .title
        .clone()
        .or_else(|| chat.username.clone())
        .unwrap_or_else(|| chat_id_str.clone());

    let perms_doc = doc! {
        "can_post_messages": permissions.can_post_messages,
        "can_edit_messages": permissions.can_edit_messages,
        "can_delete_messages": permissions.can_delete_messages,
        "can_invite_users": permissions.can_invite_users,
        "can_manage_chat": permissions.can_manage_chat,
        "can_pin_messages": permissions.can_pin_messages,
    };

    let mut set = doc! {
        "title": &title,
        "type": &kind,
        "permissions": perms_doc,
        "isAdmin": is_admin,
        "lastSyncedAt": now,
        "updatedAt": now,
    };
    if let Some(u) = chat.username.as_deref() {
        set.insert("username", u);
    }
    if let Some(mc) = member_count {
        set.insert("memberCount", mc);
    }
    if let Some(v) = chat.is_verified {
        set.insert("isVerified", v);
    }
    if let Some(desc) = chat.description.as_deref() {
        set.insert("description", desc);
    }

    let filter = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "chatId": &chat_id_str,
    };
    let update = doc! {
        "$set": set,
        "$setOnInsert": {
            "projectId": project_oid,
            "botId": bot_oid,
            "chatId": &chat_id_str,
            "createdAt": now,
        },
        "$unset": { "deletedAt": "" },
    };
    let opts = mongodb::options::FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(mongodb::options::ReturnDocument::After)
        .build();
    let stored = match s
        .mongo
        .collection::<Document>(CHANNELS)
        .find_one_and_update(filter, update)
        .with_options(opts)
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Failed to persist channel."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    let id = stored
        .get_object_id("_id")
        .map(|o| o.to_hex())
        .unwrap_or_default();
    Json(AckResult {
        success: true,
        message: Some(format!("Discovered {title}.")),
        channel_id: Some(id),
        ..Default::default()
    })
}

// ---------------------------------------------------------------------------
//  GET /v1/telegram/channels/{channelId}
// ---------------------------------------------------------------------------

pub async fn get_channel(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Path(channel_id): Path<String>,
    Query(q): Query<ProjectOnlyQuery>,
) -> Json<serde_json::Value> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return Json(json!({ "error": "projectId is required" })),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return Json(json!({ "error": e })),
    };
    let channel = match load_channel_for_project(&s.mongo, &channel_id, project_oid).await {
        Ok(c) => c,
        Err(e) => return Json(json!({ "error": e })),
    };
    // Best-effort refresh against Telegram. Failures are non-fatal —
    // we still return the cached record so the page never goes blank.
    let bot_oid = match channel.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return Json(json!({ "error": "channel has no botId" })),
    };
    let chat_id = channel.get_str("chatId").unwrap_or("").to_owned();
    let username = channel.get_str("username").ok().map(str::to_owned);
    let token = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
    {
        Ok(Some(d)) => d.get_str("token").ok().map(str::to_owned),
        _ => None,
    };
    let outbound = outbound_chat_id(&chat_id, username.as_deref());
    let channel_oid = match channel.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return Json(json!({ "error": "channel has no _id" })),
    };
    if let Some(t) = token {
        if let Ok(chat) = s.bot_api.get_chat(&t, &outbound).await {
            let kind = chat.kind.unwrap_or_else(|| "channel".to_owned());
            let title = chat
                .title
                .clone()
                .or_else(|| chat.username.clone())
                .unwrap_or_default();
            let member_count = s.bot_api.get_chat_member_count(&t, &outbound).await.ok();
            let bot_doc = s
                .mongo
                .collection::<Document>(BOTS)
                .find_one(doc! { "_id": bot_oid })
                .await
                .ok()
                .flatten();
            let bot_uid = bot_doc
                .as_ref()
                .and_then(|d| d.get_i64("botId").ok())
                .or_else(|| {
                    bot_doc
                        .as_ref()
                        .and_then(|d| d.get_i32("botId").ok())
                        .map(i64::from)
                });
            let mut permissions = ChannelPermissions::default();
            let mut is_admin = false;
            if let Some(uid) = bot_uid {
                if let Ok(m) = s.bot_api.get_chat_member(&t, &outbound, uid).await {
                    is_admin = m.status == "administrator" || m.status == "creator";
                    permissions = permissions_from_member(&m);
                }
            }
            let perms_doc = doc! {
                "can_post_messages": permissions.can_post_messages,
                "can_edit_messages": permissions.can_edit_messages,
                "can_delete_messages": permissions.can_delete_messages,
                "can_invite_users": permissions.can_invite_users,
                "can_manage_chat": permissions.can_manage_chat,
                "can_pin_messages": permissions.can_pin_messages,
            };
            let mut set = doc! {
                "title": title,
                "type": kind,
                "permissions": perms_doc,
                "isAdmin": is_admin,
                "lastSyncedAt": bson::DateTime::now(),
                "updatedAt": bson::DateTime::now(),
            };
            if let Some(mc) = member_count {
                set.insert("memberCount", mc);
            }
            if let Some(u) = chat.username.as_deref() {
                set.insert("username", u);
            }
            let _ = s
                .mongo
                .collection::<Document>(CHANNELS)
                .update_one(doc! { "_id": channel_oid }, doc! { "$set": set })
                .await;
        }
    }

    // Re-load + return the row.
    if let Ok(Some(d)) = s
        .mongo
        .collection::<Document>(CHANNELS)
        .find_one(doc! { "_id": channel_oid })
        .await
    {
        if let Some(row) = doc_to_row(&d) {
            return Json(serde_json::to_value(row).unwrap_or(Value::Null));
        }
    }
    Json(json!({ "error": "channel not found after refresh" }))
}

// ---------------------------------------------------------------------------
//  DELETE /v1/telegram/channels/{channelId}
// ---------------------------------------------------------------------------

pub async fn delete_channel(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Path(channel_id): Path<String>,
    Query(q): Query<ProjectOnlyQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let oid = match parse_oid(&channel_id) {
        Some(o) => o,
        None => return err("Invalid channel id."),
    };
    match s
        .mongo
        .collection::<Document>(CHANNELS)
        .update_one(
            doc! { "_id": oid, "projectId": project_oid },
            doc! { "$set": { "deletedAt": bson::DateTime::now() } },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => err("Channel not found."),
        Ok(_) => Json(AckResult {
            success: true,
            message: Some("Channel removed.".to_owned()),
            channel_id: Some(channel_id),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ---------------------------------------------------------------------------
//  GET /v1/telegram/channels/{channelId}/admins
// ---------------------------------------------------------------------------

pub async fn list_admins(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Path(channel_id): Path<String>,
    Query(q): Query<ProjectOnlyQuery>,
) -> Json<AdminsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(AdminsResp {
                admins: vec![],
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(AdminsResp {
                admins: vec![],
                error: Some(e),
            });
        }
    };
    let channel = match load_channel_for_project(&s.mongo, &channel_id, project_oid).await {
        Ok(c) => c,
        Err(e) => {
            return Json(AdminsResp {
                admins: vec![],
                error: Some(e),
            });
        }
    };
    let bot_oid = match channel.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => {
            return Json(AdminsResp {
                admins: vec![],
                error: Some("channel has no botId".to_owned()),
            });
        }
    };
    let token = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
        .ok()
        .flatten()
        .and_then(|d| d.get_str("token").ok().map(str::to_owned))
    {
        Some(t) => t,
        None => {
            return Json(AdminsResp {
                admins: vec![],
                error: Some("Bot token missing.".to_owned()),
            });
        }
    };
    let chat_id = channel.get_str("chatId").unwrap_or("").to_owned();
    let username = channel.get_str("username").ok().map(str::to_owned);
    let outbound = outbound_chat_id(&chat_id, username.as_deref());

    let members = match s.bot_api.get_chat_administrators(&token, &outbound).await {
        Ok(v) => v,
        Err(e) => {
            return Json(AdminsResp {
                admins: vec![],
                error: Some(map_bot_err(e)),
            });
        }
    };
    let admins = members
        .into_iter()
        .map(|m| {
            let user_id = m
                .user
                .get("id")
                .and_then(|v| v.as_i64())
                .unwrap_or_default();
            let first = m
                .user
                .get("first_name")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            let last = m
                .user
                .get("last_name")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            let username = m
                .user
                .get("username")
                .and_then(|v| v.as_str())
                .map(str::to_owned);
            let name = {
                let combined = format!("{first} {last}").trim().to_owned();
                if combined.is_empty() {
                    username.clone().unwrap_or_else(|| user_id.to_string())
                } else {
                    combined
                }
            };
            let is_creator = m.status == "creator";
            AdminRow {
                user_id,
                status: m.status.clone(),
                name,
                username,
                can_post_messages: is_creator || m.can_post_messages.unwrap_or(false),
                can_edit_messages: is_creator || m.can_edit_messages.unwrap_or(false),
                can_delete_messages: is_creator || m.can_delete_messages.unwrap_or(false),
                can_invite_users: is_creator || m.can_invite_users.unwrap_or(false),
                can_manage_chat: is_creator || m.can_manage_chat.unwrap_or(false),
                can_pin_messages: is_creator || m.can_pin_messages.unwrap_or(false),
                can_promote_members: is_creator || m.can_promote_members.unwrap_or(false),
                can_change_info: is_creator || m.can_change_info.unwrap_or(false),
                is_anonymous: m.is_anonymous.unwrap_or(false),
            }
        })
        .collect();
    Json(AdminsResp {
        admins,
        error: None,
    })
}

// ---------------------------------------------------------------------------
//  POST /v1/telegram/channels/{channelId}/promote
// ---------------------------------------------------------------------------

pub async fn promote(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Path(channel_id): Path<String>,
    Json(body): Json<PromoteBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let channel = match load_channel_for_project(&s.mongo, &channel_id, project_oid).await {
        Ok(c) => c,
        Err(e) => return err(e),
    };
    let bot_oid = match channel.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return err("channel has no botId"),
    };
    let token = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
        .ok()
        .flatten()
        .and_then(|d| d.get_str("token").ok().map(str::to_owned))
    {
        Some(t) => t,
        None => return err("Bot token missing."),
    };
    let chat_id = channel.get_str("chatId").unwrap_or("").to_owned();
    let username = channel.get_str("username").ok().map(str::to_owned);
    let outbound = outbound_chat_id(&chat_id, username.as_deref());
    let payload = json!({
        "chat_id": outbound,
        "user_id": body.user_id,
        "can_post_messages": body.can_post_messages.unwrap_or(false),
        "can_edit_messages": body.can_edit_messages.unwrap_or(false),
        "can_delete_messages": body.can_delete_messages.unwrap_or(false),
        "can_invite_users": body.can_invite_users.unwrap_or(false),
        "can_manage_chat": body.can_manage_chat.unwrap_or(false),
        "can_pin_messages": body.can_pin_messages.unwrap_or(false),
        "can_promote_members": body.can_promote_members.unwrap_or(false),
        "can_restrict_members": body.can_restrict_members.unwrap_or(false),
        "can_change_info": body.can_change_info.unwrap_or(false),
        "can_manage_video_chats": body.can_manage_video_chats.unwrap_or(false),
        "is_anonymous": body.is_anonymous.unwrap_or(false),
    });
    match s.bot_api.promote_chat_member(&token, &payload).await {
        Ok(_) => Json(AckResult {
            success: true,
            message: Some("Member promoted.".to_owned()),
            channel_id: Some(channel_id),
            ..Default::default()
        }),
        Err(e) => err(map_bot_err(e)),
    }
}

// ---------------------------------------------------------------------------
//  POST /v1/telegram/channels/{channelId}/demote
// ---------------------------------------------------------------------------

pub async fn demote(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Path(channel_id): Path<String>,
    Json(body): Json<DemoteBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let channel = match load_channel_for_project(&s.mongo, &channel_id, project_oid).await {
        Ok(c) => c,
        Err(e) => return err(e),
    };
    let bot_oid = match channel.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return err("channel has no botId"),
    };
    let token = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
        .ok()
        .flatten()
        .and_then(|d| d.get_str("token").ok().map(str::to_owned))
    {
        Some(t) => t,
        None => return err("Bot token missing."),
    };
    let chat_id = channel.get_str("chatId").unwrap_or("").to_owned();
    let username = channel.get_str("username").ok().map(str::to_owned);
    let outbound = outbound_chat_id(&chat_id, username.as_deref());
    let payload = json!({
        "chat_id": outbound,
        "user_id": body.user_id,
        "can_post_messages": false,
        "can_edit_messages": false,
        "can_delete_messages": false,
        "can_invite_users": false,
        "can_manage_chat": false,
        "can_pin_messages": false,
        "can_promote_members": false,
        "can_restrict_members": false,
        "can_change_info": false,
        "can_manage_video_chats": false,
    });
    match s.bot_api.promote_chat_member(&token, &payload).await {
        Ok(_) => Json(AckResult {
            success: true,
            message: Some("Member demoted.".to_owned()),
            channel_id: Some(channel_id),
            ..Default::default()
        }),
        Err(e) => err(map_bot_err(e)),
    }
}

// ---------------------------------------------------------------------------
//  POST /v1/telegram/channels/{channelId}/post
// ---------------------------------------------------------------------------

pub async fn post_message(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Path(channel_id): Path<String>,
    Json(body): Json<PostBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let channel = match load_channel_for_project(&s.mongo, &channel_id, project_oid).await {
        Ok(c) => c,
        Err(e) => return err(e),
    };
    let channel_oid = match channel.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("channel has no id"),
    };
    let bot_oid = match channel.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return err("channel has no botId"),
    };
    let user_oid = match parse_user_oid(&user) {
        Some(o) => o,
        None => return err("invalid auth subject"),
    };
    let chat_id = channel.get_str("chatId").unwrap_or("").to_owned();
    let username = channel.get_str("username").ok().map(str::to_owned);
    let outbound = outbound_chat_id(&chat_id, username.as_deref());

    // Scheduled? Persist a row and bail out — a separate worker will
    // pick it up at `scheduledAt`.
    if let Some(schedule_at) = body.message.schedule_at {
        let now = bson::DateTime::now();
        let message_bson = bson::to_bson(&body.message)
            .ok()
            .unwrap_or(bson::Bson::Null);
        let inline_bson = body
            .inline_keyboard
            .as_ref()
            .and_then(|v| bson::to_bson(v).ok())
            .unwrap_or(bson::Bson::Null);
        let doc = doc! {
            "projectId": project_oid,
            "channelId": channel_oid,
            "botId": bot_oid,
            "userId": user_oid,
            "message": message_bson,
            "inlineKeyboard": inline_bson,
            "status": "QUEUED",
            "scheduledAt": bson::DateTime::from_chrono(schedule_at),
            "createdAt": now,
            "updatedAt": now,
        };
        return match s
            .mongo
            .collection::<Document>(SCHEDULED)
            .insert_one(doc)
            .await
        {
            Ok(res) => {
                let id = res
                    .inserted_id
                    .as_object_id()
                    .map(|o| o.to_hex())
                    .unwrap_or_default();
                Json(AckResult {
                    success: true,
                    message: Some("Post scheduled.".to_owned()),
                    post_id: Some(id),
                    channel_id: Some(channel_id),
                    ..Default::default()
                })
            }
            Err(e) => err(format!("mongo: {e}")),
        };
    }

    let token = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
        .ok()
        .flatten()
        .and_then(|d| d.get_str("token").ok().map(str::to_owned))
    {
        Some(t) => t,
        None => return err("Bot token missing."),
    };

    let parse_mode = body.message.parse_mode.clone();
    let disable_web = body.message.disable_web_page_preview;
    let disable_notification = body.message.disable_notification;
    let reply_markup = body.inline_keyboard.clone();

    // Decide whether this is text / single media / media group.
    let (message_id, mirror_kind, mirror_media): (i64, &str, Option<Value>) =
        if let Some(group) = body.message.media_group.as_ref().filter(|g| !g.is_empty()) {
            let media_arr: Vec<Value> = group
                .iter()
                .enumerate()
                .map(|(i, m)| {
                    let mut item = serde_json::Map::new();
                    item.insert(
                        "type".to_owned(),
                        Value::String(m.kind.clone().unwrap_or_else(|| "photo".to_owned())),
                    );
                    item.insert("media".to_owned(), Value::String(m.url.clone()));
                    // Only attach caption + parse_mode to the first item;
                    // Telegram applies it to the whole album that way.
                    if i == 0 {
                        if let Some(c) = body.message.text.as_deref() {
                            item.insert("caption".to_owned(), Value::String(c.to_owned()));
                        } else if let Some(c) = m.caption.as_deref() {
                            item.insert("caption".to_owned(), Value::String(c.to_owned()));
                        }
                        if let Some(pm) = parse_mode.as_deref() {
                            item.insert("parse_mode".to_owned(), Value::String(pm.to_owned()));
                        }
                    }
                    Value::Object(item)
                })
                .collect();
            let payload = json!({
                "chat_id": outbound,
                "media": media_arr,
                "disable_notification": disable_notification.unwrap_or(false),
            });
            match s.bot_api.send_media_group(&token, &payload).await {
                Ok(msgs) => {
                    let first_id = msgs.first().map(|m| m.message_id).unwrap_or_default();
                    (
                        first_id,
                        "mediaGroup",
                        Some(serde_json::to_value(group).unwrap_or(Value::Null)),
                    )
                }
                Err(e) => return err(map_bot_err(e)),
            }
        } else if let Some(media) = body.message.media.as_ref() {
            let method = media.kind.as_deref().unwrap_or("photo");
            let media_field = match method {
                "photo" => "photo",
                "video" => "video",
                "document" => "document",
                "audio" => "audio",
                _ => "photo",
            };
            let mut payload = json!({
                "chat_id": outbound,
                media_field: media.url,
            });
            if let Some(c) = body.message.text.as_deref().or(media.caption.as_deref()) {
                payload["caption"] = Value::String(c.to_owned());
            }
            if let Some(pm) = parse_mode.as_deref() {
                payload["parse_mode"] = Value::String(pm.to_owned());
            }
            if let Some(d) = disable_notification {
                payload["disable_notification"] = Value::Bool(d);
            }
            if let Some(rm) = reply_markup.as_ref() {
                payload["reply_markup"] = rm.clone();
            }
            let res = match media_field {
                "photo" => s.bot_api.send_photo(&token, &payload).await,
                "video" => s.bot_api.send_video(&token, &payload).await,
                "document" => s.bot_api.send_document(&token, &payload).await,
                "audio" => s.bot_api.send_audio(&token, &payload).await,
                _ => s.bot_api.send_photo(&token, &payload).await,
            };
            match res {
                Ok(m) => (
                    m.message_id,
                    "media",
                    Some(serde_json::to_value(media).unwrap_or(Value::Null)),
                ),
                Err(e) => return err(map_bot_err(e)),
            }
        } else {
            let text = body.message.text.clone().unwrap_or_default();
            if text.trim().is_empty() {
                return err("Either text or media is required.");
            }
            let mut payload = json!({
                "chat_id": outbound,
                "text": text,
            });
            if let Some(pm) = parse_mode.as_deref() {
                payload["parse_mode"] = Value::String(pm.to_owned());
            }
            if let Some(d) = disable_web {
                payload["disable_web_page_preview"] = Value::Bool(d);
            }
            if let Some(d) = disable_notification {
                payload["disable_notification"] = Value::Bool(d);
            }
            if let Some(ent) = body.message.entities.clone() {
                payload["entities"] = ent;
            }
            if let Some(rm) = reply_markup.as_ref() {
                payload["reply_markup"] = rm.clone();
            }
            match s.bot_api.send_message(&token, &payload).await {
                Ok(m) => (m.message_id, "text", None),
                Err(e) => return err(map_bot_err(e)),
            }
        };

    // Mirror the post into Mongo so the page can list it without
    // hitting Telegram every time.
    let now = bson::DateTime::now();
    let mut mirror = doc! {
        "projectId": project_oid,
        "channelId": channel_oid,
        "botId": bot_oid,
        "userId": user_oid,
        "messageId": message_id,
        "kind": mirror_kind,
        "isPinned": false,
        "views": 0i64,
        "sentAt": now,
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(t) = body.message.text.as_deref() {
        mirror.insert("text", t);
    }
    if let Some(m) = mirror_media.as_ref().and_then(|v| bson::to_bson(v).ok()) {
        mirror.insert("media", m);
    }
    if let Some(rm) = body
        .inline_keyboard
        .as_ref()
        .and_then(|v| bson::to_bson(v).ok())
    {
        mirror.insert("inlineKeyboard", rm);
    }
    let inserted = s
        .mongo
        .collection::<Document>(POSTS)
        .insert_one(mirror)
        .await
        .ok()
        .and_then(|r| r.inserted_id.as_object_id().map(|o| o.to_hex()))
        .unwrap_or_default();
    Json(AckResult {
        success: true,
        message: Some("Post published.".to_owned()),
        post_id: Some(inserted),
        channel_id: Some(channel_id),
        message_id: Some(message_id),
        ..Default::default()
    })
}

// ---------------------------------------------------------------------------
//  GET /v1/telegram/channels/{channelId}/posts
// ---------------------------------------------------------------------------

pub async fn list_posts(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Path(channel_id): Path<String>,
    Query(q): Query<ProjectOnlyQuery>,
) -> Json<PostsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(PostsResp {
                posts: vec![],
                error: Some("projectId is required".to_owned()),
                next_cursor: None,
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(PostsResp {
                posts: vec![],
                error: Some(e),
                next_cursor: None,
            });
        }
    };
    let channel = match load_channel_for_project(&s.mongo, &channel_id, project_oid).await {
        Ok(c) => c,
        Err(e) => {
            return Json(PostsResp {
                posts: vec![],
                error: Some(e),
                next_cursor: None,
            });
        }
    };
    let channel_oid = match channel.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(PostsResp {
                posts: vec![],
                error: Some("channel has no id".to_owned()),
                next_cursor: None,
            });
        }
    };
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let mut filter = doc! { "channelId": channel_oid };
    if let Some(cur) = q.cursor.as_deref().filter(|s| !s.is_empty()) {
        if let Some(o) = parse_oid(cur) {
            filter.insert("_id", doc! { "$lt": o });
        }
    }
    let cursor = match s
        .mongo
        .collection::<Document>(POSTS)
        .find(filter)
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(PostsResp {
                posts: vec![],
                error: Some(format!("mongo: {e}")),
                next_cursor: None,
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(PostsResp {
                posts: vec![],
                error: Some(format!("mongo: {e}")),
                next_cursor: None,
            });
        }
    };
    let posts: Vec<PostRow> = docs.iter().filter_map(post_row).collect();
    let next_cursor = posts.last().map(|p| p._id.clone());
    Json(PostsResp {
        posts,
        error: None,
        next_cursor,
    })
}

fn post_row(d: &Document) -> Option<PostRow> {
    let media_value = d.get("media").and_then(|b| {
        let v = b.clone().into_relaxed_extjson();
        serde_json::from_value::<Value>(v).ok()
    });
    Some(PostRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        channel_id: d.get_object_id("channelId").ok()?.to_hex(),
        message_id: d
            .get_i64("messageId")
            .or_else(|_| d.get_i32("messageId").map(i64::from))
            .ok()?,
        kind: d.get_str("kind").unwrap_or("text").to_owned(),
        text: d.get_str("text").ok().map(str::to_owned),
        media: media_value,
        is_pinned: d.get_bool("isPinned").unwrap_or(false),
        views: d
            .get_i64("views")
            .or_else(|_| d.get_i32("views").map(i64::from))
            .ok(),
        sent_at: dt(d.get_datetime("sentAt").ok().copied()),
        edited_at: dt_opt(d.get_datetime("editedAt").ok().copied()),
    })
}

// ---------------------------------------------------------------------------
//  POST /v1/telegram/channels/{channelId}/posts/{postId}/edit
// ---------------------------------------------------------------------------

pub async fn edit_post(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Path((channel_id, post_id)): Path<(String, String)>,
    Json(body): Json<EditPostBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let channel = match load_channel_for_project(&s.mongo, &channel_id, project_oid).await {
        Ok(c) => c,
        Err(e) => return err(e),
    };
    let bot_oid = match channel.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return err("channel has no botId"),
    };
    let post_oid = match parse_oid(&post_id) {
        Some(o) => o,
        None => return err("Invalid post id."),
    };
    let post = match s
        .mongo
        .collection::<Document>(POSTS)
        .find_one(doc! { "_id": post_oid })
        .await
    {
        Ok(Some(d)) => d,
        _ => return err("Post not found."),
    };
    let message_id = match post
        .get_i64("messageId")
        .or_else(|_| post.get_i32("messageId").map(i64::from))
    {
        Ok(m) => m,
        Err(_) => return err("Post is missing messageId."),
    };
    let kind = post.get_str("kind").unwrap_or("text").to_owned();

    let token = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
        .ok()
        .flatten()
        .and_then(|d| d.get_str("token").ok().map(str::to_owned))
    {
        Some(t) => t,
        None => return err("Bot token missing."),
    };
    let chat_id = channel.get_str("chatId").unwrap_or("").to_owned();
    let username = channel.get_str("username").ok().map(str::to_owned);
    let outbound = outbound_chat_id(&chat_id, username.as_deref());

    // Text post → editMessageText; media → editMessageCaption.
    let api_result = if kind == "text" {
        let mut payload = json!({
            "chat_id": outbound,
            "message_id": message_id,
            "text": body.text.clone().unwrap_or_default(),
        });
        if let Some(pm) = body.parse_mode.as_deref() {
            payload["parse_mode"] = Value::String(pm.to_owned());
        }
        s.bot_api.edit_message_text(&token, &payload).await
    } else {
        let mut payload = json!({
            "chat_id": outbound,
            "message_id": message_id,
            "caption": body.caption.clone().or(body.text.clone()).unwrap_or_default(),
        });
        if let Some(pm) = body.parse_mode.as_deref() {
            payload["parse_mode"] = Value::String(pm.to_owned());
        }
        s.bot_api.edit_message_caption(&token, &payload).await
    };
    if let Err(e) = api_result {
        return err(map_bot_err(e));
    }

    // Mirror locally.
    let mut set = doc! { "editedAt": bson::DateTime::now(), "updatedAt": bson::DateTime::now() };
    if let Some(t) = body.text.as_deref() {
        set.insert("text", t);
    }
    if let Some(c) = body.caption.as_deref() {
        set.insert("caption", c);
    }
    let _ = s
        .mongo
        .collection::<Document>(POSTS)
        .update_one(doc! { "_id": post_oid }, doc! { "$set": set })
        .await;

    Json(AckResult {
        success: true,
        message: Some("Post updated.".to_owned()),
        post_id: Some(post_id),
        channel_id: Some(channel_id),
        message_id: Some(message_id),
        ..Default::default()
    })
}

// ---------------------------------------------------------------------------
//  DELETE /v1/telegram/channels/{channelId}/posts/{postId}
// ---------------------------------------------------------------------------

pub async fn delete_post(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Path((channel_id, post_id)): Path<(String, String)>,
    Query(q): Query<ProjectOnlyQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let channel = match load_channel_for_project(&s.mongo, &channel_id, project_oid).await {
        Ok(c) => c,
        Err(e) => return err(e),
    };
    let bot_oid = match channel.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return err("channel has no botId"),
    };
    let post_oid = match parse_oid(&post_id) {
        Some(o) => o,
        None => return err("Invalid post id."),
    };
    let post = match s
        .mongo
        .collection::<Document>(POSTS)
        .find_one(doc! { "_id": post_oid })
        .await
    {
        Ok(Some(d)) => d,
        _ => return err("Post not found."),
    };
    let message_id = match post
        .get_i64("messageId")
        .or_else(|_| post.get_i32("messageId").map(i64::from))
    {
        Ok(m) => m,
        Err(_) => return err("Post is missing messageId."),
    };
    let token = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
        .ok()
        .flatten()
        .and_then(|d| d.get_str("token").ok().map(str::to_owned))
    {
        Some(t) => t,
        None => return err("Bot token missing."),
    };
    let chat_id = channel.get_str("chatId").unwrap_or("").to_owned();
    let username = channel.get_str("username").ok().map(str::to_owned);
    let outbound = outbound_chat_id(&chat_id, username.as_deref());

    if let Err(e) = s
        .bot_api
        .delete_message(&token, &outbound, message_id)
        .await
    {
        return err(map_bot_err(e));
    }
    let _ = s
        .mongo
        .collection::<Document>(POSTS)
        .delete_one(doc! { "_id": post_oid })
        .await;

    Json(AckResult {
        success: true,
        message: Some("Post deleted.".to_owned()),
        post_id: Some(post_id),
        channel_id: Some(channel_id),
        ..Default::default()
    })
}

// ---------------------------------------------------------------------------
//  POST /v1/telegram/channels/{channelId}/posts/{postId}/pin
// ---------------------------------------------------------------------------

pub async fn pin_post(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Path((channel_id, post_id)): Path<(String, String)>,
    Json(body): Json<PinBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let channel = match load_channel_for_project(&s.mongo, &channel_id, project_oid).await {
        Ok(c) => c,
        Err(e) => return err(e),
    };
    let bot_oid = match channel.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return err("channel has no botId"),
    };
    let post_oid = match parse_oid(&post_id) {
        Some(o) => o,
        None => return err("Invalid post id."),
    };
    let post = match s
        .mongo
        .collection::<Document>(POSTS)
        .find_one(doc! { "_id": post_oid })
        .await
    {
        Ok(Some(d)) => d,
        _ => return err("Post not found."),
    };
    let message_id = match post
        .get_i64("messageId")
        .or_else(|_| post.get_i32("messageId").map(i64::from))
    {
        Ok(m) => m,
        Err(_) => return err("Post is missing messageId."),
    };
    let token = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
        .ok()
        .flatten()
        .and_then(|d| d.get_str("token").ok().map(str::to_owned))
    {
        Some(t) => t,
        None => return err("Bot token missing."),
    };
    let chat_id = channel.get_str("chatId").unwrap_or("").to_owned();
    let username = channel.get_str("username").ok().map(str::to_owned);
    let outbound = outbound_chat_id(&chat_id, username.as_deref());

    if let Err(e) = s
        .bot_api
        .pin_chat_message(
            &token,
            &outbound,
            message_id,
            body.disable_notification.unwrap_or(false),
        )
        .await
    {
        return err(map_bot_err(e));
    }
    let _ = s
        .mongo
        .collection::<Document>(POSTS)
        .update_one(
            doc! { "_id": post_oid },
            doc! { "$set": { "isPinned": true, "updatedAt": bson::DateTime::now() } },
        )
        .await;
    Json(AckResult {
        success: true,
        message: Some("Post pinned.".to_owned()),
        post_id: Some(post_id),
        channel_id: Some(channel_id),
        ..Default::default()
    })
}

// ---------------------------------------------------------------------------
//  DELETE /v1/telegram/channels/{channelId}/posts/{postId}/pin
// ---------------------------------------------------------------------------

pub async fn unpin_post(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Path((channel_id, post_id)): Path<(String, String)>,
    Query(q): Query<ProjectOnlyQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let channel = match load_channel_for_project(&s.mongo, &channel_id, project_oid).await {
        Ok(c) => c,
        Err(e) => return err(e),
    };
    let bot_oid = match channel.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => return err("channel has no botId"),
    };
    let post_oid = match parse_oid(&post_id) {
        Some(o) => o,
        None => return err("Invalid post id."),
    };
    let post = match s
        .mongo
        .collection::<Document>(POSTS)
        .find_one(doc! { "_id": post_oid })
        .await
    {
        Ok(Some(d)) => d,
        _ => return err("Post not found."),
    };
    let message_id = match post
        .get_i64("messageId")
        .or_else(|_| post.get_i32("messageId").map(i64::from))
    {
        Ok(m) => m,
        Err(_) => return err("Post is missing messageId."),
    };
    let token = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
        .ok()
        .flatten()
        .and_then(|d| d.get_str("token").ok().map(str::to_owned))
    {
        Some(t) => t,
        None => return err("Bot token missing."),
    };
    let chat_id = channel.get_str("chatId").unwrap_or("").to_owned();
    let username = channel.get_str("username").ok().map(str::to_owned);
    let outbound = outbound_chat_id(&chat_id, username.as_deref());

    if let Err(e) = s
        .bot_api
        .unpin_chat_message(&token, &outbound, message_id)
        .await
    {
        return err(map_bot_err(e));
    }
    let _ = s
        .mongo
        .collection::<Document>(POSTS)
        .update_one(
            doc! { "_id": post_oid },
            doc! { "$set": { "isPinned": false, "updatedAt": bson::DateTime::now() } },
        )
        .await;
    Json(AckResult {
        success: true,
        message: Some("Post unpinned.".to_owned()),
        post_id: Some(post_id),
        channel_id: Some(channel_id),
        ..Default::default()
    })
}

// ---------------------------------------------------------------------------
//  GET /v1/telegram/channels/{channelId}/scheduled
// ---------------------------------------------------------------------------

pub async fn list_scheduled(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Path(channel_id): Path<String>,
    Query(q): Query<ProjectOnlyQuery>,
) -> Json<ScheduledResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ScheduledResp {
                scheduled: vec![],
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ScheduledResp {
                scheduled: vec![],
                error: Some(e),
            });
        }
    };
    let channel = match load_channel_for_project(&s.mongo, &channel_id, project_oid).await {
        Ok(c) => c,
        Err(e) => {
            return Json(ScheduledResp {
                scheduled: vec![],
                error: Some(e),
            });
        }
    };
    let channel_oid = match channel.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(ScheduledResp {
                scheduled: vec![],
                error: Some("channel has no id".to_owned()),
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(SCHEDULED)
        .find(doc! {
            "channelId": channel_oid,
            "status": { "$in": ["QUEUED", "FAILED"] },
        })
        .sort(doc! { "scheduledAt": 1 })
        .limit(200)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ScheduledResp {
                scheduled: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ScheduledResp {
                scheduled: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let scheduled: Vec<ScheduledRow> = docs
        .iter()
        .filter_map(|d| {
            let raw = bson::Bson::Document(d.clone()).into_relaxed_extjson();
            let v: Value = serde_json::from_value(raw).ok()?;
            Some(ScheduledRow {
                _id: d.get_object_id("_id").ok()?.to_hex(),
                channel_id: d.get_object_id("channelId").ok()?.to_hex(),
                message: v.get("message").cloned().unwrap_or(Value::Null),
                inline_keyboard: v.get("inlineKeyboard").cloned(),
                status: d.get_str("status").unwrap_or("QUEUED").to_owned(),
                scheduled_at: dt(d.get_datetime("scheduledAt").ok().copied()),
                created_at: dt(d.get_datetime("createdAt").ok().copied()),
            })
        })
        .collect();
    Json(ScheduledResp {
        scheduled,
        error: None,
    })
}

// ---------------------------------------------------------------------------
//  DELETE /v1/telegram/channels/{channelId}/scheduled/{postId}
// ---------------------------------------------------------------------------

pub async fn cancel_scheduled(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Path((channel_id, post_id)): Path<(String, String)>,
    Query(q): Query<ProjectOnlyQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let channel = match load_channel_for_project(&s.mongo, &channel_id, project_oid).await {
        Ok(c) => c,
        Err(e) => return err(e),
    };
    let channel_oid = match channel.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("channel has no id"),
    };
    let oid = match parse_oid(&post_id) {
        Some(o) => o,
        None => return err("Invalid post id."),
    };
    match s
        .mongo
        .collection::<Document>(SCHEDULED)
        .update_one(
            doc! { "_id": oid, "channelId": channel_oid },
            doc! { "$set": { "status": "CANCELLED", "updatedAt": bson::DateTime::now() } },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => err("Scheduled post not found."),
        Ok(_) => Json(AckResult {
            success: true,
            message: Some("Scheduled post cancelled.".to_owned()),
            post_id: Some(post_id),
            channel_id: Some(channel_id),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ---------------------------------------------------------------------------
//  GET /v1/telegram/channels/{channelId}/stats
// ---------------------------------------------------------------------------

pub async fn stats(
    user: AuthUser,
    State(s): State<TelegramChannelsState>,
    Path(channel_id): Path<String>,
    Query(q): Query<ProjectOnlyQuery>,
) -> Json<StatsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(StatsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(StatsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let channel = match load_channel_for_project(&s.mongo, &channel_id, project_oid).await {
        Ok(c) => c,
        Err(e) => {
            return Json(StatsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let channel_oid = match channel.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(StatsResp {
                error: Some("channel has no id".to_owned()),
                ..Default::default()
            });
        }
    };
    let from = q
        .from
        .as_deref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(|| Utc::now() - chrono::Duration::days(30));
    let to =
        q.to.as_deref()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(Utc::now);

    let posts_coll = s.mongo.collection::<Document>(POSTS);
    let posts_count = posts_coll
        .count_documents(doc! {
            "channelId": channel_oid,
            "sentAt": {
                "$gte": bson::DateTime::from_chrono(from),
                "$lte": bson::DateTime::from_chrono(to),
            },
        })
        .await
        .map(|n| n as i64)
        .unwrap_or(0);
    let scheduled_count = s
        .mongo
        .collection::<Document>(SCHEDULED)
        .count_documents(doc! {
            "channelId": channel_oid,
            "status": "QUEUED",
        })
        .await
        .map(|n| n as i64)
        .unwrap_or(0);

    // Daily series. Cap at the number of days requested so the page
    // can render a sensibly-sized chart.
    use futures::TryStreamExt;
    let mut series: std::collections::BTreeMap<String, i64> = std::collections::BTreeMap::new();
    if let Ok(cur) = posts_coll
        .find(doc! {
            "channelId": channel_oid,
            "sentAt": {
                "$gte": bson::DateTime::from_chrono(from),
                "$lte": bson::DateTime::from_chrono(to),
            },
        })
        .sort(doc! { "sentAt": 1 })
        .await
    {
        let rows: Vec<Document> = cur.try_collect().await.unwrap_or_default();
        let mut total_views = 0i64;
        for d in &rows {
            let s_at = dt(d.get_datetime("sentAt").ok().copied());
            let key = s_at.format("%Y-%m-%d").to_string();
            *series.entry(key).or_insert(0) += 1;
            if let Ok(v) = d.get_i64("views") {
                total_views += v;
            } else if let Ok(v) = d.get_i32("views") {
                total_views += v as i64;
            }
        }
        let series_points: Vec<StatsPoint> = series
            .into_iter()
            .map(|(date, posts)| StatsPoint { date, posts })
            .collect();

        // Top posts by views (descending), limit 5.
        let mut sorted = rows.clone();
        sorted.sort_by(|a, b| {
            let av = a
                .get_i64("views")
                .or_else(|_| a.get_i32("views").map(i64::from))
                .unwrap_or(0);
            let bv = b
                .get_i64("views")
                .or_else(|_| b.get_i32("views").map(i64::from))
                .unwrap_or(0);
            bv.cmp(&av)
        });
        let top_posts: Vec<PostRow> = sorted.iter().take(5).filter_map(post_row).collect();
        return Json(StatsResp {
            posts_count,
            total_views,
            scheduled_count,
            series: series_points,
            top_posts,
            error: None,
        });
    }
    Json(StatsResp {
        posts_count,
        total_views: 0,
        scheduled_count,
        series: vec![],
        top_posts: vec![],
        error: None,
    })
}
