//! # Telegram Stories handlers
//!
//! Implements the multi-tenant story workflow described in the spec:
//! local drafts in `telegram_stories`, lazily expiring posted stories,
//! manual business-connection registry, and outbound calls to the Bot
//! API (`postStory` / `editStory` / `deleteStory` /
//! `getBusinessConnection` / `getBusinessAccountStarBalance`).

use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Datelike, Duration, TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::state::TelegramStoriesState;

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const STORIES: &str = "telegram_stories";
const BUSINESS_CONNECTIONS: &str = "telegram_business_connections";

const TG_BASE: &str = "https://api.telegram.org";

const ALLOWED_PERIODS: &[i64] = &[21600, 43200, 86400, 172800];
const ALLOWED_PRIVACY: &[&str] = &["public", "contacts", "close_friends", "selected"];
const ALLOWED_MEDIA_KINDS: &[&str] = &["photo", "video"];
const ALLOWED_STORY_TYPES: &[&str] = &["channel", "business"];

// ---------------------------------------------------------------------------
//  Generic envelope
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "storyId")]
    pub story_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "telegramStoryId")]
    pub telegram_story_id: Option<i64>,
}

fn ok_msg(msg: impl Into<String>) -> AckResult {
    AckResult {
        success: true,
        message: Some(msg.into()),
        ..Default::default()
    }
}
fn err_ack(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        ..Default::default()
    })
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}
fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}
fn dt(o: Option<bson::DateTime>) -> DateTime<Utc> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
}
fn dt_opt(o: Option<bson::DateTime>) -> Option<DateTime<Utc>> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
}
fn parse_iso(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| d.with_timezone(&Utc))
        .or_else(|| {
            chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
                .ok()
                .and_then(|nd| nd.and_hms_opt(0, 0, 0))
                .map(|ndt| Utc.from_utc_datetime(&ndt))
        })
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

async fn require_bot_in_project(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_id: &str,
) -> Result<Document, String> {
    let bot_oid = parse_oid(bot_id).ok_or_else(|| "invalid bot id".to_owned())?;
    let bot = mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid, "projectId": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;
    Ok(bot)
}

// ---------------------------------------------------------------------------
//  DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StoryArea {
    /// Free-form position payload — Telegram uses
    /// `{ x_percentage, y_percentage, width_percentage, height_percentage, rotation_angle, corner_radius_percentage }`.
    #[serde(default)]
    pub position: Value,
    /// `location` | `suggested_reaction` | `link` | `weather` | `unique_gift` etc.
    #[serde(default, rename = "type")]
    pub kind: String,
    /// Type-specific payload Telegram expects (e.g. `{ "latitude":..., "longitude":... }`).
    #[serde(default)]
    pub payload: Value,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StoryContent {
    #[serde(rename = "mediaKind")]
    pub media_kind: String,
    #[serde(rename = "sabFileId")]
    pub sab_file_id: String,
    #[serde(default)]
    pub caption: Option<String>,
    #[serde(default, rename = "parseMode")]
    pub parse_mode: Option<String>,
    #[serde(default, rename = "captionEntities")]
    pub caption_entities: Option<Value>,
    #[serde(default)]
    pub areas: Option<Vec<StoryArea>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StoryPrivacy {
    pub kind: String,
    #[serde(default, rename = "userIds")]
    pub user_ids: Option<Vec<i64>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StoryRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "channelId")]
    pub channel_id: Option<String>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        rename = "businessConnectionId"
    )]
    pub business_connection_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "telegramStoryId")]
    pub telegram_story_id: Option<i64>,
    #[serde(rename = "type")]
    pub kind: String,
    pub content: StoryContent,
    pub privacy: StoryPrivacy,
    #[serde(rename = "activePeriodSeconds")]
    pub active_period_seconds: i64,
    #[serde(rename = "postToChatPage")]
    pub post_to_chat_page: bool,
    #[serde(rename = "protectContent")]
    pub protect_content: bool,
    pub status: String,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "scheduledAt"
    )]
    pub scheduled_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "postedAt"
    )]
    pub posted_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "expiresAt"
    )]
    pub expires_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "errorMessage")]
    pub error_message: Option<String>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "updatedAt"
    )]
    pub updated_at: DateTime<Utc>,
}

fn doc_to_story(d: &Document) -> Option<StoryRow> {
    // Content
    let content_doc = d.get_document("content").ok()?.clone();
    let raw = bson::Bson::Document(content_doc).into_relaxed_extjson();
    let content: StoryContent = serde_json::from_value(raw).ok().unwrap_or_default();

    // Privacy
    let privacy_doc = d.get_document("privacy").ok().cloned().unwrap_or_default();
    let praw = bson::Bson::Document(privacy_doc).into_relaxed_extjson();
    let privacy: StoryPrivacy = serde_json::from_value(praw).ok().unwrap_or_default();

    let channel_id = if let Ok(o) = d.get_object_id("channelId") {
        Some(o.to_hex())
    } else {
        d.get_str("channelId").ok().map(str::to_owned)
    };

    Some(StoryRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        channel_id,
        business_connection_id: d.get_str("businessConnectionId").ok().map(str::to_owned),
        telegram_story_id: d
            .get_i64("telegramStoryId")
            .or_else(|_| d.get_i32("telegramStoryId").map(i64::from))
            .ok(),
        kind: d.get_str("type").unwrap_or("channel").to_owned(),
        content,
        privacy,
        active_period_seconds: d
            .get_i64("activePeriodSeconds")
            .or_else(|_| d.get_i32("activePeriodSeconds").map(i64::from))
            .unwrap_or(86400),
        post_to_chat_page: d.get_bool("postToChatPage").unwrap_or(false),
        protect_content: d.get_bool("protectContent").unwrap_or(false),
        status: d.get_str("status").unwrap_or("draft").to_owned(),
        scheduled_at: dt_opt(d.get_datetime("scheduledAt").ok().copied()),
        posted_at: dt_opt(d.get_datetime("postedAt").ok().copied()),
        expires_at: dt_opt(d.get_datetime("expiresAt").ok().copied()),
        error_message: d.get_str("errorMessage").ok().map(str::to_owned),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

// ---------------------------------------------------------------------------
//  Validation
// ---------------------------------------------------------------------------

fn validate_content(c: &StoryContent) -> Result<(), String> {
    if !ALLOWED_MEDIA_KINDS.contains(&c.media_kind.as_str()) {
        return Err("content.mediaKind must be 'photo' or 'video'".into());
    }
    if c.sab_file_id.trim().is_empty() {
        return Err("content.sabFileId is required".into());
    }
    Ok(())
}

fn validate_privacy(p: &StoryPrivacy) -> Result<(), String> {
    if !ALLOWED_PRIVACY.contains(&p.kind.as_str()) {
        return Err("privacy.kind must be public|contacts|close_friends|selected".into());
    }
    if p.kind == "selected" {
        let ids = p.user_ids.as_deref().unwrap_or(&[]);
        if ids.is_empty() {
            return Err("privacy.userIds is required when privacy.kind is 'selected'".into());
        }
        if ids.len() > 200 {
            return Err("privacy.userIds cannot exceed 200 entries".into());
        }
    }
    Ok(())
}

fn validate_period(p: i64) -> Result<(), String> {
    if !ALLOWED_PERIODS.contains(&p) {
        return Err("activePeriodSeconds must be one of 21600 / 43200 / 86400 / 172800".into());
    }
    Ok(())
}

fn validate_type_target(
    kind: &str,
    channel_id: Option<&str>,
    business_connection_id: Option<&str>,
) -> Result<(), String> {
    if !ALLOWED_STORY_TYPES.contains(&kind) {
        return Err("type must be 'channel' or 'business'".into());
    }
    match kind {
        "channel" => {
            if channel_id.map(str::trim).unwrap_or("").is_empty() {
                return Err("channelId is required for channel stories".into());
            }
        }
        "business" => {
            if business_connection_id
                .map(str::trim)
                .unwrap_or("")
                .is_empty()
            {
                return Err("businessConnectionId is required for business stories".into());
            }
        }
        _ => {}
    }
    Ok(())
}

// ---------------------------------------------------------------------------
//  List / pagination
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct ListQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default, rename = "pageSize")]
    pub page_size: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListResp {
    pub stories: Vec<StoryRow>,
    pub total: i64,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
    pub page: i64,
    #[serde(rename = "pageSize")]
    pub page_size: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn empty_list(err: Option<String>) -> ListResp {
    ListResp {
        stories: vec![],
        total: 0,
        has_more: false,
        page: 1,
        page_size: 20,
        error: err,
    }
}

fn build_list_filter(project_oid: ObjectId, q: &ListQuery) -> Document {
    let mut filter = doc! { "projectId": project_oid };
    if let Some(s) = q.status.as_deref() {
        if !s.is_empty() && s != "all" {
            filter.insert("status", s);
        }
    }
    if let Some(k) = q.kind.as_deref() {
        if !k.is_empty() && k != "all" {
            filter.insert("type", k);
        }
    }
    if let Some(b) = q.bot_id.as_deref() {
        if let Some(b_oid) = parse_oid(b) {
            filter.insert("botId", b_oid);
        }
    }
    if let Some(search) = q.search.as_deref() {
        let trimmed = search.trim();
        if !trimmed.is_empty() {
            let escaped = regex::escape(trimmed);
            let regex = doc! { "$regex": escaped, "$options": "i" };
            filter.insert(
                "$or",
                vec![
                    doc! { "content.caption": regex.clone() },
                    doc! { "errorMessage": regex },
                ],
            );
        }
    }
    filter
}

/// Lazily transition posted rows whose `expiresAt` is in the past to
/// `expired`. Fire-and-forget — we don't return errors from this since
/// it's best-effort housekeeping.
async fn expire_stale(mongo: &MongoHandle, project_oid: ObjectId) {
    let now = bson::DateTime::now();
    let _ = mongo
        .collection::<Document>(STORIES)
        .update_many(
            doc! {
                "projectId": project_oid,
                "status": "posted",
                "expiresAt": { "$lt": now },
            },
            doc! { "$set": { "status": "expired", "updatedAt": now } },
        )
        .await;
}

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return Json(empty_list(Some("projectId is required".into()))),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return Json(empty_list(Some(e))),
    };
    expire_stale(&s.mongo, project_oid).await;

    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.page_size.unwrap_or(20).clamp(1, 100);
    let skip = (page - 1) * page_size;
    let filter = build_list_filter(project_oid, &q);
    let coll = s.mongo.collection::<Document>(STORIES);
    let total = match coll.count_documents(filter.clone()).await {
        Ok(n) => n as i64,
        Err(e) => return Json(empty_list(Some(format!("mongo: {e}")))),
    };
    let cursor = match coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .skip(skip as u64)
        .limit(page_size)
        .await
    {
        Ok(c) => c,
        Err(e) => return Json(empty_list(Some(format!("mongo: {e}")))),
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => return Json(empty_list(Some(format!("mongo: {e}")))),
    };
    let stories: Vec<StoryRow> = docs.iter().filter_map(doc_to_story).collect();
    let has_more = skip + (stories.len() as i64) < total;
    Json(ListResp {
        stories,
        total,
        has_more,
        page,
        page_size,
        error: None,
    })
}

// ---------------------------------------------------------------------------
//  Create / Update / Detail / Delete
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct CreateBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default, rename = "channelId")]
    pub channel_id: Option<String>,
    #[serde(default, rename = "businessConnectionId")]
    pub business_connection_id: Option<String>,
    pub content: StoryContent,
    pub privacy: StoryPrivacy,
    #[serde(rename = "activePeriodSeconds")]
    pub active_period_seconds: i64,
    #[serde(default, rename = "postToChatPage")]
    pub post_to_chat_page: bool,
    #[serde(default, rename = "protectContent")]
    pub protect_content: bool,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        rename = "scheduledAt"
    )]
    pub scheduled_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct DetailResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub story: Option<StoryRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn create(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Json(body): Json<CreateBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    if let Err(e) = validate_type_target(
        &body.kind,
        body.channel_id.as_deref(),
        body.business_connection_id.as_deref(),
    ) {
        return err_ack(e);
    }
    if let Err(e) = validate_content(&body.content) {
        return err_ack(e);
    }
    if let Err(e) = validate_privacy(&body.privacy) {
        return err_ack(e);
    }
    if let Err(e) = validate_period(body.active_period_seconds) {
        return err_ack(e);
    }
    let bot_doc = match require_bot_in_project(&s.mongo, project_oid, &body.bot_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let bot_oid = match bot_doc.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err_ack("Bot is malformed"),
    };

    let now = bson::DateTime::now();
    let status = if body.scheduled_at.is_some() {
        "scheduled"
    } else {
        "draft"
    };

    let content_doc = bson::to_document(&body.content).unwrap_or_default();
    let privacy_doc = bson::to_document(&body.privacy).unwrap_or_default();

    let mut doc = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "type": &body.kind,
        "content": content_doc,
        "privacy": privacy_doc,
        "activePeriodSeconds": body.active_period_seconds,
        "postToChatPage": body.post_to_chat_page,
        "protectContent": body.protect_content,
        "status": status,
        "createdAt": now,
        "updatedAt": now,
    };
    if body.kind == "channel" {
        if let Some(c) = body.channel_id.as_deref() {
            if let Some(oid) = parse_oid(c) {
                doc.insert("channelId", oid);
            } else {
                doc.insert("channelId", c);
            }
        }
    } else if body.kind == "business" {
        if let Some(c) = body.business_connection_id.as_deref() {
            doc.insert("businessConnectionId", c);
        }
    }
    if let Some(t) = body.scheduled_at {
        doc.insert("scheduledAt", bson::DateTime::from_chrono(t));
    }

    match s
        .mongo
        .collection::<Document>(STORIES)
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
                story_id: Some(id),
                message: Some("Story created.".into()),
                ..Default::default()
            })
        }
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default)]
    pub content: Option<StoryContent>,
    #[serde(default)]
    pub privacy: Option<StoryPrivacy>,
    #[serde(default, rename = "activePeriodSeconds")]
    pub active_period_seconds: Option<i64>,
    #[serde(default, rename = "postToChatPage")]
    pub post_to_chat_page: Option<bool>,
    #[serde(default, rename = "protectContent")]
    pub protect_content: Option<bool>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        rename = "scheduledAt"
    )]
    pub scheduled_at: Option<DateTime<Utc>>,
}

pub async fn update_story(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Path(story_id): Path<String>,
    Json(body): Json<UpdateBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let oid = match parse_oid(&story_id) {
        Some(o) => o,
        None => return err_ack("Invalid story id."),
    };
    let coll = s.mongo.collection::<Document>(STORIES);
    let existing = match coll
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err_ack("Story not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let status = existing.get_str("status").unwrap_or("draft");
    if status != "draft" && status != "scheduled" && status != "failed" {
        return err_ack(
            "Only draft / scheduled / failed stories can be edited locally. Use /edit for posted stories.",
        );
    }

    let mut set = doc! { "updatedAt": bson::DateTime::now() };
    if let Some(c) = body.content.as_ref() {
        if let Err(e) = validate_content(c) {
            return err_ack(e);
        }
        set.insert("content", bson::to_document(c).unwrap_or_default());
    }
    if let Some(p) = body.privacy.as_ref() {
        if let Err(e) = validate_privacy(p) {
            return err_ack(e);
        }
        set.insert("privacy", bson::to_document(p).unwrap_or_default());
    }
    if let Some(period) = body.active_period_seconds {
        if let Err(e) = validate_period(period) {
            return err_ack(e);
        }
        set.insert("activePeriodSeconds", period);
    }
    if let Some(v) = body.post_to_chat_page {
        set.insert("postToChatPage", v);
    }
    if let Some(v) = body.protect_content {
        set.insert("protectContent", v);
    }
    if let Some(t) = body.scheduled_at {
        set.insert("scheduledAt", bson::DateTime::from_chrono(t));
        set.insert("status", "scheduled");
    }

    match coll
        .update_one(
            doc! { "_id": oid, "projectId": project_oid },
            doc! { "$set": set },
        )
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            story_id: Some(story_id),
            message: Some("Saved.".into()),
            ..Default::default()
        }),
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

pub async fn detail(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Path(story_id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<DetailResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(DetailResp {
                error: Some("projectId is required".into()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(DetailResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let oid = match parse_oid(&story_id) {
        Some(o) => o,
        None => {
            return Json(DetailResp {
                error: Some("Invalid story id.".into()),
                ..Default::default()
            });
        }
    };
    match s
        .mongo
        .collection::<Document>(STORIES)
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => Json(DetailResp {
            story: doc_to_story(&d),
            error: None,
        }),
        Ok(None) => Json(DetailResp {
            error: Some("Story not found.".into()),
            ..Default::default()
        }),
        Err(e) => Json(DetailResp {
            error: Some(format!("mongo: {e}")),
            ..Default::default()
        }),
    }
}

pub async fn delete_story(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Path(story_id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err_ack("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let oid = match parse_oid(&story_id) {
        Some(o) => o,
        None => return err_ack("Invalid story id."),
    };
    match s
        .mongo
        .collection::<Document>(STORIES)
        .delete_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(r) if r.deleted_count == 0 => err_ack("Story not found."),
        Ok(_) => Json(AckResult {
            success: true,
            story_id: Some(story_id),
            message: Some("Deleted.".into()),
            ..Default::default()
        }),
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

// ---------------------------------------------------------------------------
//  Posting / scheduling / cancelling / Telegram edit & delete
// ---------------------------------------------------------------------------

/// Resolve the SabFile id to a public URL that Telegram can fetch
/// directly. We rely on the `sabfiles` collection having a stable `url`
/// (R2 public URL or `/api/sabfiles/raw/:id` proxy) — the same shape the
/// frontend file picker hands back.
async fn resolve_sabfile_url(mongo: &MongoHandle, sab_file_id: &str) -> Result<String, String> {
    let oid = parse_oid(sab_file_id).ok_or_else(|| "invalid sabFileId".to_owned())?;
    let f = mongo
        .collection::<Document>("sabfiles")
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "SabFile not found.".to_owned())?;
    let url = f
        .get_str("url")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    if let Some(u) = url {
        return Ok(u);
    }
    // Fallback: return the id-based proxy path; only usable when the
    // running deployment exposes a public origin Telegram can reach.
    Err("SabFile has no public URL set.".to_owned())
}

fn build_privacy_payload(p: &StoryPrivacy) -> Value {
    match p.kind.as_str() {
        "public" => serde_json::json!({ "type": "everyone" }),
        "contacts" => serde_json::json!({ "type": "contacts" }),
        "close_friends" => serde_json::json!({ "type": "close_friends" }),
        "selected" => serde_json::json!({
            "type": "selected_contacts",
            "user_ids": p.user_ids.clone().unwrap_or_default(),
        }),
        _ => serde_json::json!({ "type": "everyone" }),
    }
}

fn build_content_payload(content: &StoryContent, media_url: &str) -> Value {
    let kind = match content.media_kind.as_str() {
        "photo" => "story_content_photo",
        _ => "story_content_video",
    };
    let url_key = if content.media_kind == "photo" {
        "photo"
    } else {
        "video"
    };
    serde_json::json!({ "type": kind, url_key: media_url })
}

async fn call_telegram_method(
    http: &reqwest::Client,
    token: &str,
    method: &str,
    body: &Value,
) -> Result<Value, String> {
    let url = format!("{TG_BASE}/bot{token}/{method}");
    let resp = http
        .post(url)
        .json(body)
        .send()
        .await
        .map_err(|e| format!("telegram: {e}"))?;
    let json: Value = resp
        .json()
        .await
        .map_err(|e| format!("telegram parse: {e}"))?;
    if json.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
        Ok(json.get("result").cloned().unwrap_or(Value::Null))
    } else {
        Err(json
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("Telegram error")
            .to_owned())
    }
}

async fn fetch_chat_id_from_channel(
    mongo: &MongoHandle,
    channel_doc_id: &str,
    project_oid: ObjectId,
) -> Result<String, String> {
    let oid = parse_oid(channel_doc_id).ok_or_else(|| "invalid channelId".to_owned())?;
    let c = mongo
        .collection::<Document>("telegram_channels")
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Channel not found.".to_owned())?;
    Ok(c.get_str("chatId").unwrap_or("").to_owned())
}

pub async fn post_now(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Path(story_id): Path<String>,
    Json(body): Json<ProjectQuery>,
) -> Json<AckResult> {
    let project_id = match body.project_id.as_deref() {
        Some(p) if !p.is_empty() => p.to_owned(),
        _ => return err_ack("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, &project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let oid = match parse_oid(&story_id) {
        Some(o) => o,
        None => return err_ack("Invalid story id."),
    };
    let coll = s.mongo.collection::<Document>(STORIES);
    let story_doc = match coll
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err_ack("Story not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let story = match doc_to_story(&story_doc) {
        Some(r) => r,
        None => return err_ack("Story is malformed."),
    };
    if story.status == "posted" {
        return err_ack("Story is already posted.");
    }

    let bot_doc = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": story_doc.get_object_id("botId").unwrap_or_default() })
        .await
    {
        Ok(Some(b)) => b,
        Ok(None) => return err_ack("Bot not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let token = bot_doc.get_str("token").unwrap_or("");
    if token.is_empty() {
        return err_ack("Bot has no token.");
    }

    let media_url = match resolve_sabfile_url(&s.mongo, &story.content.sab_file_id).await {
        Ok(u) => u,
        Err(e) => return err_ack(e),
    };

    let mut payload = serde_json::Map::new();
    payload.insert(
        "content".into(),
        build_content_payload(&story.content, &media_url),
    );
    payload.insert(
        "active_period".into(),
        Value::from(story.active_period_seconds),
    );
    payload.insert("privacy".into(), build_privacy_payload(&story.privacy));
    if let Some(c) = story.content.caption.clone().filter(|s| !s.is_empty()) {
        payload.insert("caption".into(), Value::from(c));
    }
    if let Some(p) = story.content.parse_mode.clone().filter(|s| !s.is_empty()) {
        payload.insert("parse_mode".into(), Value::from(p));
    }
    if let Some(e) = story.content.caption_entities.clone() {
        payload.insert("caption_entities".into(), e);
    }
    if let Some(a) = story.content.areas.clone() {
        if !a.is_empty() {
            payload.insert(
                "areas".into(),
                serde_json::to_value(a).unwrap_or(Value::Null),
            );
        }
    }
    if story.post_to_chat_page {
        payload.insert("post_to_chat_page".into(), Value::from(true));
    }
    if story.protect_content {
        payload.insert("protect_content".into(), Value::from(true));
    }

    match story.kind.as_str() {
        "channel" => {
            let channel_doc_id = match story.channel_id.as_deref() {
                Some(c) => c,
                None => return err_ack("Story has no channelId."),
            };
            let chat_id =
                match fetch_chat_id_from_channel(&s.mongo, channel_doc_id, project_oid).await {
                    Ok(s) => s,
                    Err(e) => return err_ack(e),
                };
            payload.insert("chat_id".into(), Value::from(chat_id));
        }
        "business" => {
            let cid = match story.business_connection_id.as_deref() {
                Some(c) => c,
                None => return err_ack("Story has no businessConnectionId."),
            };
            payload.insert("business_connection_id".into(), Value::from(cid.to_owned()));
        }
        _ => return err_ack("Invalid story type."),
    }

    let body_json = Value::Object(payload);
    let res = call_telegram_method(&s.http, token, "postStory", &body_json).await;
    let now = Utc::now();
    let now_b = bson::DateTime::from_chrono(now);
    let expires_at = now + Duration::seconds(story.active_period_seconds);

    match res {
        Ok(result) => {
            let tg_story_id = result.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
            let _ = coll
                .update_one(
                    doc! { "_id": oid },
                    doc! {
                        "$set": {
                            "status": "posted",
                            "telegramStoryId": tg_story_id,
                            "postedAt": now_b,
                            "expiresAt": bson::DateTime::from_chrono(expires_at),
                            "errorMessage": Option::<String>::None,
                            "updatedAt": now_b,
                        }
                    },
                )
                .await;
            Json(AckResult {
                success: true,
                story_id: Some(story_id),
                telegram_story_id: Some(tg_story_id),
                message: Some("Story posted.".into()),
                ..Default::default()
            })
        }
        Err(e) => {
            let _ = coll
                .update_one(
                    doc! { "_id": oid },
                    doc! {
                        "$set": {
                            "status": "failed",
                            "errorMessage": &e,
                            "updatedAt": now_b,
                        }
                    },
                )
                .await;
            err_ack(e)
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ScheduleBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "scheduledAt"
    )]
    pub scheduled_at: DateTime<Utc>,
}

pub async fn schedule(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Path(story_id): Path<String>,
    Json(body): Json<ScheduleBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let oid = match parse_oid(&story_id) {
        Some(o) => o,
        None => return err_ack("Invalid story id."),
    };
    let now = bson::DateTime::now();
    match s
        .mongo
        .collection::<Document>(STORIES)
        .update_one(
            doc! { "_id": oid, "projectId": project_oid, "status": { "$in": ["draft", "scheduled", "failed"] } },
            doc! {
                "$set": {
                    "status": "scheduled",
                    "scheduledAt": bson::DateTime::from_chrono(body.scheduled_at),
                    "errorMessage": Option::<String>::None,
                    "updatedAt": now,
                }
            },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => err_ack("Story not found, or not in a schedulable state."),
        Ok(_) => Json(AckResult {
            success: true,
            story_id: Some(story_id),
            message: Some("Scheduled.".into()),
            ..Default::default()
        }),
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

pub async fn cancel(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Path(story_id): Path<String>,
    Json(body): Json<ProjectQuery>,
) -> Json<AckResult> {
    let project_id = match body.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err_ack("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let oid = match parse_oid(&story_id) {
        Some(o) => o,
        None => return err_ack("Invalid story id."),
    };
    let now = bson::DateTime::now();
    match s
        .mongo
        .collection::<Document>(STORIES)
        .update_one(
            doc! { "_id": oid, "projectId": project_oid, "status": { "$in": ["scheduled", "draft", "failed"] } },
            doc! {
                "$set": {
                    "status": "draft",
                    "scheduledAt": Option::<bson::DateTime>::None,
                    "updatedAt": now,
                }
            },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => err_ack("Story not found or already posted."),
        Ok(_) => Json(AckResult {
            success: true,
            story_id: Some(story_id),
            message: Some("Back to draft.".into()),
            ..Default::default()
        }),
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct EditBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default)]
    pub content: Option<StoryContent>,
    #[serde(default)]
    pub privacy: Option<StoryPrivacy>,
}

pub async fn edit_on_telegram(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Path(story_id): Path<String>,
    Json(body): Json<EditBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let oid = match parse_oid(&story_id) {
        Some(o) => o,
        None => return err_ack("Invalid story id."),
    };
    let coll = s.mongo.collection::<Document>(STORIES);
    let story_doc = match coll
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err_ack("Story not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let story = match doc_to_story(&story_doc) {
        Some(r) => r,
        None => return err_ack("Story is malformed."),
    };
    if story.status != "posted" {
        return err_ack("Only posted stories can be edited on Telegram.");
    }
    let tg_story_id = match story.telegram_story_id {
        Some(v) if v > 0 => v,
        _ => return err_ack("Story has no telegramStoryId."),
    };
    let bot_doc = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": story_doc.get_object_id("botId").unwrap_or_default() })
        .await
    {
        Ok(Some(b)) => b,
        Ok(None) => return err_ack("Bot not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let token = bot_doc.get_str("token").unwrap_or("");
    if token.is_empty() {
        return err_ack("Bot has no token.");
    }

    let merged_content = body
        .content
        .clone()
        .unwrap_or_else(|| story.content.clone());
    let media_url = match resolve_sabfile_url(&s.mongo, &merged_content.sab_file_id).await {
        Ok(u) => u,
        Err(e) => return err_ack(e),
    };

    let mut payload = serde_json::Map::new();
    payload.insert("story_id".into(), Value::from(tg_story_id));
    payload.insert(
        "content".into(),
        build_content_payload(&merged_content, &media_url),
    );
    if let Some(c) = merged_content.caption.clone().filter(|s| !s.is_empty()) {
        payload.insert("caption".into(), Value::from(c));
    }
    if let Some(p) = merged_content.parse_mode.clone().filter(|s| !s.is_empty()) {
        payload.insert("parse_mode".into(), Value::from(p));
    }
    if let Some(e) = merged_content.caption_entities.clone() {
        payload.insert("caption_entities".into(), e);
    }
    if let Some(a) = merged_content.areas.clone() {
        if !a.is_empty() {
            payload.insert(
                "areas".into(),
                serde_json::to_value(a).unwrap_or(Value::Null),
            );
        }
    }
    let privacy_ref = body.privacy.as_ref().unwrap_or(&story.privacy);
    payload.insert("privacy".into(), build_privacy_payload(privacy_ref));
    match story.kind.as_str() {
        "channel" => {
            let cid = match story.channel_id.as_deref() {
                Some(c) => c,
                None => return err_ack("Story has no channelId."),
            };
            let chat_id = match fetch_chat_id_from_channel(&s.mongo, cid, project_oid).await {
                Ok(s) => s,
                Err(e) => return err_ack(e),
            };
            payload.insert("chat_id".into(), Value::from(chat_id));
        }
        "business" => {
            let bcid = match story.business_connection_id.as_deref() {
                Some(c) => c,
                None => return err_ack("Story has no businessConnectionId."),
            };
            payload.insert(
                "business_connection_id".into(),
                Value::from(bcid.to_owned()),
            );
        }
        _ => return err_ack("Invalid story type."),
    }

    let body_json = Value::Object(payload);
    let res = call_telegram_method(&s.http, token, "editStory", &body_json).await;
    let now_b = bson::DateTime::now();
    match res {
        Ok(_) => {
            let mut set = doc! { "updatedAt": now_b };
            if let Some(c) = body.content.as_ref() {
                set.insert("content", bson::to_document(c).unwrap_or_default());
            }
            if let Some(p) = body.privacy.as_ref() {
                set.insert("privacy", bson::to_document(p).unwrap_or_default());
            }
            let _ = coll
                .update_one(doc! { "_id": oid }, doc! { "$set": set })
                .await;
            Json(AckResult {
                success: true,
                story_id: Some(story_id),
                telegram_story_id: Some(tg_story_id),
                message: Some("Edited on Telegram.".into()),
                ..Default::default()
            })
        }
        Err(e) => {
            let _ = coll
                .update_one(
                    doc! { "_id": oid },
                    doc! { "$set": { "errorMessage": &e, "updatedAt": now_b } },
                )
                .await;
            err_ack(e)
        }
    }
}

pub async fn delete_on_telegram(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Path(story_id): Path<String>,
    Json(body): Json<ProjectQuery>,
) -> Json<AckResult> {
    let project_id = match body.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err_ack("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let oid = match parse_oid(&story_id) {
        Some(o) => o,
        None => return err_ack("Invalid story id."),
    };
    let coll = s.mongo.collection::<Document>(STORIES);
    let story_doc = match coll
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err_ack("Story not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let story = match doc_to_story(&story_doc) {
        Some(r) => r,
        None => return err_ack("Story is malformed."),
    };
    let tg_story_id = match story.telegram_story_id {
        Some(v) if v > 0 => v,
        _ => return err_ack("Story has no telegramStoryId."),
    };
    let bot_doc = match s
        .mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": story_doc.get_object_id("botId").unwrap_or_default() })
        .await
    {
        Ok(Some(b)) => b,
        Ok(None) => return err_ack("Bot not found."),
        Err(e) => return err_ack(format!("mongo: {e}")),
    };
    let token = bot_doc.get_str("token").unwrap_or("");
    if token.is_empty() {
        return err_ack("Bot has no token.");
    }

    let mut payload = serde_json::Map::new();
    payload.insert("story_id".into(), Value::from(tg_story_id));
    match story.kind.as_str() {
        "channel" => {
            let cid = match story.channel_id.as_deref() {
                Some(c) => c,
                None => return err_ack("Story has no channelId."),
            };
            let chat_id = match fetch_chat_id_from_channel(&s.mongo, cid, project_oid).await {
                Ok(s) => s,
                Err(e) => return err_ack(e),
            };
            payload.insert("chat_id".into(), Value::from(chat_id));
        }
        "business" => {
            let bcid = match story.business_connection_id.as_deref() {
                Some(c) => c,
                None => return err_ack("Story has no businessConnectionId."),
            };
            payload.insert(
                "business_connection_id".into(),
                Value::from(bcid.to_owned()),
            );
        }
        _ => return err_ack("Invalid story type."),
    }

    let res = call_telegram_method(&s.http, token, "deleteStory", &Value::Object(payload)).await;
    let now_b = bson::DateTime::now();
    match res {
        Ok(_) => {
            let _ = coll
                .update_one(
                    doc! { "_id": oid },
                    doc! {
                        "$set": {
                            "status": "deleted",
                            "errorMessage": Option::<String>::None,
                            "updatedAt": now_b,
                        }
                    },
                )
                .await;
            Json(AckResult {
                success: true,
                story_id: Some(story_id),
                message: Some("Deleted on Telegram.".into()),
                ..Default::default()
            })
        }
        Err(e) => {
            let _ = coll
                .update_one(
                    doc! { "_id": oid },
                    doc! { "$set": { "errorMessage": &e, "updatedAt": now_b } },
                )
                .await;
            err_ack(e)
        }
    }
}

// ---------------------------------------------------------------------------
//  Business connections
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct BusinessConnectionRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "connectionId")]
    pub connection_id: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "userId")]
    pub user_id: Option<i64>,
    #[serde(rename = "canReply")]
    pub can_reply: bool,
    #[serde(rename = "canEdit")]
    pub can_edit: bool,
    #[serde(rename = "isEnabled")]
    pub is_enabled: bool,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct BusinessConnectionsResp {
    pub connections: Vec<BusinessConnectionRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn doc_to_business(d: &Document) -> Option<BusinessConnectionRow> {
    Some(BusinessConnectionRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        connection_id: d.get_str("connectionId").unwrap_or("").to_owned(),
        user_id: d
            .get_i64("userId")
            .or_else(|_| d.get_i32("userId").map(i64::from))
            .ok(),
        can_reply: d.get_bool("canReply").unwrap_or(true),
        can_edit: d.get_bool("canEdit").unwrap_or(true),
        is_enabled: d.get_bool("isEnabled").unwrap_or(true),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct BcListQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
}

pub async fn list_business_connections(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Query(q): Query<BcListQuery>,
) -> Json<BusinessConnectionsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(BusinessConnectionsResp {
                connections: vec![],
                error: Some("projectId is required".into()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(BusinessConnectionsResp {
                connections: vec![],
                error: Some(e),
            });
        }
    };
    let mut filter = doc! { "projectId": project_oid };
    if let Some(b) = q.bot_id.as_deref() {
        if let Some(boid) = parse_oid(b) {
            filter.insert("botId", boid);
        }
    }
    let cursor = match s
        .mongo
        .collection::<Document>(BUSINESS_CONNECTIONS)
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(BusinessConnectionsResp {
                connections: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = cursor.try_collect().await.unwrap_or_default();
    let connections = docs.iter().filter_map(doc_to_business).collect();
    Json(BusinessConnectionsResp {
        connections,
        error: None,
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct RegisterBcBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "connectionId")]
    pub connection_id: String,
}

pub async fn register_business_connection(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Json(body): Json<RegisterBcBody>,
) -> Json<AckResult> {
    if body.connection_id.trim().is_empty() {
        return err_ack("connectionId is required");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let bot_doc = match require_bot_in_project(&s.mongo, project_oid, &body.bot_id).await {
        Ok(b) => b,
        Err(e) => return err_ack(e),
    };
    let bot_oid = match bot_doc.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err_ack("Bot is malformed."),
    };
    let token = bot_doc.get_str("token").unwrap_or("");
    let now = bson::DateTime::now();

    // Best-effort live lookup so we can populate userId / canReply.
    let live = if !token.is_empty() {
        call_telegram_method(
            &s.http,
            token,
            "getBusinessConnection",
            &serde_json::json!({ "business_connection_id": body.connection_id }),
        )
        .await
        .ok()
    } else {
        None
    };

    let user_id = live
        .as_ref()
        .and_then(|v| v.get("user"))
        .and_then(|u| u.get("id"))
        .and_then(|i| i.as_i64());
    let can_reply = live
        .as_ref()
        .and_then(|v| v.get("can_reply"))
        .and_then(|b| b.as_bool())
        .unwrap_or(true);
    let is_enabled = live
        .as_ref()
        .and_then(|v| v.get("is_enabled"))
        .and_then(|b| b.as_bool())
        .unwrap_or(true);

    let mut set = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "connectionId": &body.connection_id,
        "canReply": can_reply,
        "canEdit": true,
        "isEnabled": is_enabled,
        "updatedAt": now,
    };
    if let Some(uid) = user_id {
        set.insert("userId", uid);
    }

    let coll = s.mongo.collection::<Document>(BUSINESS_CONNECTIONS);
    let existing = coll
        .find_one(doc! { "projectId": project_oid, "botId": bot_oid, "connectionId": &body.connection_id })
        .await
        .ok()
        .flatten();
    if let Some(d) = existing {
        let id = d
            .get_object_id("_id")
            .map(|o| o.to_hex())
            .unwrap_or_default();
        let _ = coll
            .update_one(
                doc! { "_id": d.get_object_id("_id").unwrap_or_default() },
                doc! { "$set": set },
            )
            .await;
        return Json(AckResult {
            success: true,
            story_id: Some(id),
            message: Some("Updated.".into()),
            ..Default::default()
        });
    }
    set.insert("createdAt", now);
    match coll.insert_one(set).await {
        Ok(res) => {
            let id = res
                .inserted_id
                .as_object_id()
                .map(|o| o.to_hex())
                .unwrap_or_default();
            Json(AckResult {
                success: true,
                story_id: Some(id),
                message: Some("Registered.".into()),
                ..Default::default()
            })
        }
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

pub async fn delete_business_connection(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Path(id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err_ack("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return err_ack("Invalid id."),
    };
    match s
        .mongo
        .collection::<Document>(BUSINESS_CONNECTIONS)
        .delete_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(r) if r.deleted_count == 0 => err_ack("Connection not found."),
        Ok(_) => Json(ok_msg("Removed.")),
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

// ---------------------------------------------------------------------------
//  Star balance proxy
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct StarBalanceQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default, rename = "connectionId")]
    pub connection_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct StarBalanceResp {
    pub success: bool,
    #[serde(rename = "amount")]
    pub amount: i64,
    #[serde(rename = "nanostarAmount")]
    pub nanostar_amount: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn star_balance(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Query(q): Query<StarBalanceQuery>,
) -> Json<StarBalanceResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(StarBalanceResp {
                error: Some("projectId is required".into()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(StarBalanceResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_id = match q.bot_id.as_deref() {
        Some(b) if !b.is_empty() => b,
        _ => {
            return Json(StarBalanceResp {
                error: Some("botId is required".into()),
                ..Default::default()
            });
        }
    };
    let cid = match q.connection_id.as_deref() {
        Some(c) if !c.is_empty() => c,
        _ => {
            return Json(StarBalanceResp {
                error: Some("connectionId is required".into()),
                ..Default::default()
            });
        }
    };
    let bot_doc = match require_bot_in_project(&s.mongo, project_oid, bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(StarBalanceResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let token = bot_doc.get_str("token").unwrap_or("");
    if token.is_empty() {
        return Json(StarBalanceResp {
            error: Some("Bot has no token.".into()),
            ..Default::default()
        });
    }
    let res = call_telegram_method(
        &s.http,
        token,
        "getBusinessAccountStarBalance",
        &serde_json::json!({ "business_connection_id": cid }),
    )
    .await;
    match res {
        Ok(v) => Json(StarBalanceResp {
            success: true,
            amount: v.get("amount").and_then(|x| x.as_i64()).unwrap_or(0),
            nanostar_amount: v
                .get("nanostar_amount")
                .and_then(|x| x.as_i64())
                .unwrap_or(0),
            error: None,
        }),
        Err(e) => Json(StarBalanceResp {
            error: Some(e),
            ..Default::default()
        }),
    }
}

// ---------------------------------------------------------------------------
//  Analytics
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct AnalyticsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnalyticsByDayPoint {
    pub date: String,
    pub drafts: i64,
    pub scheduled: i64,
    pub posted: i64,
    pub expired: i64,
    pub failed: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct AnalyticsResp {
    pub drafts: i64,
    pub scheduled: i64,
    pub posted: i64,
    pub expired: i64,
    pub failed: i64,
    #[serde(rename = "postedToday")]
    pub posted_today: i64,
    #[serde(rename = "active")]
    pub active: i64,
    #[serde(rename = "byDay")]
    pub by_day: Vec<AnalyticsByDayPoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn analytics(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Query(q): Query<AnalyticsQuery>,
) -> Json<AnalyticsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(AnalyticsResp {
                error: Some("projectId is required".into()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    expire_stale(&s.mongo, project_oid).await;

    let now = Utc::now();
    let from = q
        .from
        .as_deref()
        .and_then(parse_iso)
        .unwrap_or_else(|| now - Duration::days(30));
    let to = q.to.as_deref().and_then(parse_iso).unwrap_or(now);

    let coll = s.mongo.collection::<Document>(STORIES);
    let filter = doc! { "projectId": project_oid };
    let cursor = match coll.find(filter).await {
        Ok(c) => c,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = cursor.try_collect().await.unwrap_or_default();

    let mut drafts = 0i64;
    let mut scheduled = 0i64;
    let mut posted = 0i64;
    let mut expired = 0i64;
    let mut failed = 0i64;
    let mut active = 0i64;
    let mut posted_today = 0i64;
    let today = now.date_naive();

    use std::collections::BTreeMap;
    let mut per_day: BTreeMap<String, (i64, i64, i64, i64, i64)> = BTreeMap::new();
    let mut day = from.date_naive();
    let end_day = to.date_naive();
    let mut guard = 0;
    while day <= end_day && guard < 400 {
        per_day.insert(day.format("%Y-%m-%d").to_string(), (0, 0, 0, 0, 0));
        match day.succ_opt() {
            Some(next) => day = next,
            None => break,
        }
        guard += 1;
    }

    for d in &docs {
        let status = d.get_str("status").unwrap_or("draft");
        match status {
            "draft" => drafts += 1,
            "scheduled" => scheduled += 1,
            "posted" => posted += 1,
            "expired" => expired += 1,
            "failed" => failed += 1,
            _ => {}
        }
        if status == "posted" {
            let exp = dt_opt(d.get_datetime("expiresAt").ok().copied());
            if exp.map_or(true, |t| t > now) {
                active += 1;
            }
            if let Some(p) = dt_opt(d.get_datetime("postedAt").ok().copied()) {
                if p.date_naive() == today {
                    posted_today += 1;
                }
                let key = format!("{:04}-{:02}-{:02}", p.year(), p.month(), p.day());
                let entry = per_day.entry(key).or_insert((0, 0, 0, 0, 0));
                entry.2 += 1;
            }
        }
        if let Some(ca) = dt_opt(d.get_datetime("createdAt").ok().copied()) {
            let key = format!("{:04}-{:02}-{:02}", ca.year(), ca.month(), ca.day());
            let entry = per_day.entry(key).or_insert((0, 0, 0, 0, 0));
            match status {
                "draft" => entry.0 += 1,
                "scheduled" => entry.1 += 1,
                "expired" => entry.3 += 1,
                "failed" => entry.4 += 1,
                _ => {}
            }
        }
    }
    let by_day: Vec<AnalyticsByDayPoint> = per_day
        .into_iter()
        .map(|(date, (d_, s_, p_, e_, f_))| AnalyticsByDayPoint {
            date,
            drafts: d_,
            scheduled: s_,
            posted: p_,
            expired: e_,
            failed: f_,
        })
        .collect();

    Json(AnalyticsResp {
        drafts,
        scheduled,
        posted,
        expired,
        failed,
        posted_today,
        active,
        by_day,
        error: None,
    })
}

// ---------------------------------------------------------------------------
//  CSV export
// ---------------------------------------------------------------------------

fn csv_escape(v: &str) -> String {
    if v.contains(',') || v.contains('"') || v.contains('\n') {
        let escaped = v.replace('"', "\"\"");
        format!("\"{escaped}\"")
    } else {
        v.to_owned()
    }
}

pub async fn export_csv(
    user: AuthUser,
    State(s): State<TelegramStoriesState>,
    Query(q): Query<ProjectQuery>,
) -> Response {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return (StatusCode::BAD_REQUEST, "projectId is required").into_response(),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };
    let cursor = match s
        .mongo
        .collection::<Document>(STORIES)
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("mongo: {e}")).into_response();
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = cursor.try_collect().await.unwrap_or_default();
    let rows: Vec<StoryRow> = docs.iter().filter_map(doc_to_story).collect();

    let mut body = String::from(
        "_id,type,status,channelId,businessConnectionId,telegramStoryId,mediaKind,caption,activePeriodSeconds,privacy,scheduledAt,postedAt,expiresAt,createdAt\n",
    );
    for r in rows {
        body.push_str(&r._id);
        body.push(',');
        body.push_str(&csv_escape(&r.kind));
        body.push(',');
        body.push_str(&csv_escape(&r.status));
        body.push(',');
        body.push_str(&csv_escape(r.channel_id.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&csv_escape(
            r.business_connection_id.as_deref().unwrap_or(""),
        ));
        body.push(',');
        body.push_str(
            &r.telegram_story_id
                .map(|v| v.to_string())
                .unwrap_or_default(),
        );
        body.push(',');
        body.push_str(&csv_escape(&r.content.media_kind));
        body.push(',');
        body.push_str(&csv_escape(r.content.caption.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&r.active_period_seconds.to_string());
        body.push(',');
        body.push_str(&csv_escape(&r.privacy.kind));
        body.push(',');
        body.push_str(&r.scheduled_at.map(|d| d.to_rfc3339()).unwrap_or_default());
        body.push(',');
        body.push_str(&r.posted_at.map(|d| d.to_rfc3339()).unwrap_or_default());
        body.push(',');
        body.push_str(&r.expires_at.map(|d| d.to_rfc3339()).unwrap_or_default());
        body.push(',');
        body.push_str(&r.created_at.to_rfc3339());
        body.push('\n');
    }

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/csv; charset=utf-8"),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("attachment; filename=\"telegram-stories.csv\""),
    );
    (StatusCode::OK, headers, body).into_response()
}
