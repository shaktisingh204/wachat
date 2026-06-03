//! HTTP handlers + pure entry points for the Telegram Business Inbox.
//!
//! Collections owned by this crate:
//!  * `telegram_inbox_threads`               — per-chat inbox state
//!  * `telegram_inbox_notes`                 — internal agent notes
//!  * `telegram_inbox_auto_assign_rules`     — routing rules (priority-ordered)
//!  * `telegram_inbox_sla_policies`          — SLA policies per project
//!
//! Read-only references (owned by other crates):
//!  * `telegram_chats`     — chat metadata, last message preview
//!  * `telegram_messages`  — message stream (proxied through `list_messages`)
//!  * `telegram_bots`      — bot ownership / project lookup
//!  * `projects`           — multi-tenant guard

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Datelike, Duration, TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::state::TelegramBusinessInboxState;

const PROJECTS: &str = "projects";
#[allow(dead_code)]
const BOTS: &str = "telegram_bots";
const CHATS: &str = "telegram_chats";
const MESSAGES: &str = "telegram_messages";
const THREADS: &str = "telegram_inbox_threads";
const NOTES: &str = "telegram_inbox_notes";
const RULES: &str = "telegram_inbox_auto_assign_rules";
const SLA: &str = "telegram_inbox_sla_policies";

// =========================================================================
// Helpers
// =========================================================================

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

// =========================================================================
// DTOs
// =========================================================================

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

fn ack_err(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        ..Default::default()
    })
}

#[derive(Debug, Clone, Serialize)]
pub struct InboxThread {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "chatId")]
    pub chat_id: String,
    #[serde(rename = "type")]
    pub chat_type: String,
    pub title: String,
    pub status: String,
    pub priority: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "assignedAgentId")]
    pub assigned_agent_id: Option<String>,
    pub tags: Vec<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "firstResponseAt"
    )]
    pub first_response_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "lastInboundAt"
    )]
    pub last_inbound_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "lastOutboundAt"
    )]
    pub last_outbound_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "lastAgentReplyAt"
    )]
    pub last_agent_reply_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "slaDueAt"
    )]
    pub sla_due_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "snoozedUntil"
    )]
    pub snoozed_until: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "resolvedAt"
    )]
    pub resolved_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "resolvedById")]
    pub resolved_by_id: Option<String>,
    #[serde(rename = "internalNotesCount")]
    pub internal_notes_count: i64,
    #[serde(rename = "unreadCount")]
    pub unread_count: i64,
    #[serde(rename = "lastMessagePreview", skip_serializing_if = "Option::is_none")]
    pub last_message_preview: Option<String>,
    #[serde(
        rename = "lastMessageDirection",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_message_direction: Option<String>,
    #[serde(rename = "slaBreached")]
    pub sla_breached: bool,
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

fn doc_to_thread(d: &Document) -> Option<InboxThread> {
    let now = Utc::now();
    let sla_due = dt_opt(d.get_datetime("slaDueAt").ok().copied());
    let resolved_at = dt_opt(d.get_datetime("resolvedAt").ok().copied());
    let breached = match (sla_due, resolved_at) {
        (Some(due), None) => due < now,
        _ => false,
    };
    Some(InboxThread {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        chat_id: d.get_str("chatId").unwrap_or("").to_owned(),
        chat_type: d.get_str("type").unwrap_or("private").to_owned(),
        title: d.get_str("title").unwrap_or("").to_owned(),
        status: d.get_str("status").unwrap_or("open").to_owned(),
        priority: d.get_str("priority").unwrap_or("normal").to_owned(),
        assigned_agent_id: d.get_str("assignedAgentId").ok().map(str::to_owned),
        tags: d
            .get_array("tags")
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(str::to_owned))
                    .collect()
            })
            .unwrap_or_default(),
        first_response_at: dt_opt(d.get_datetime("firstResponseAt").ok().copied()),
        last_inbound_at: dt_opt(d.get_datetime("lastInboundAt").ok().copied()),
        last_outbound_at: dt_opt(d.get_datetime("lastOutboundAt").ok().copied()),
        last_agent_reply_at: dt_opt(d.get_datetime("lastAgentReplyAt").ok().copied()),
        sla_due_at: sla_due,
        snoozed_until: dt_opt(d.get_datetime("snoozedUntil").ok().copied()),
        resolved_at,
        resolved_by_id: d.get_str("resolvedById").ok().map(str::to_owned),
        internal_notes_count: d
            .get_i64("internalNotesCount")
            .or_else(|_| d.get_i32("internalNotesCount").map(i64::from))
            .unwrap_or(0),
        unread_count: d
            .get_i64("unreadCount")
            .or_else(|_| d.get_i32("unreadCount").map(i64::from))
            .unwrap_or(0),
        last_message_preview: d.get_str("lastMessagePreview").ok().map(str::to_owned),
        last_message_direction: d.get_str("lastMessageDirection").ok().map(str::to_owned),
        sla_breached: breached,
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

// =========================================================================
// GET /threads — list with filters + pagination
// =========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct ListThreadsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default, rename = "assignedAgentId")]
    pub assigned_agent_id: Option<String>,
    #[serde(default)]
    pub tag: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default, rename = "hasUnread")]
    pub has_unread: Option<bool>,
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default, rename = "pageSize")]
    pub page_size: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListThreadsResp {
    pub threads: Vec<InboxThread>,
    pub total: i64,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
    pub page: i64,
    #[serde(rename = "pageSize")]
    pub page_size: i64,
    #[serde(rename = "openCount")]
    pub open_count: i64,
    #[serde(rename = "pendingCount")]
    pub pending_count: i64,
    #[serde(rename = "snoozedCount")]
    pub snoozed_count: i64,
    #[serde(rename = "resolvedCount")]
    pub resolved_count: i64,
    #[serde(rename = "breachedCount")]
    pub breached_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn build_threads_filter(project_oid: ObjectId, q: &ListThreadsQuery) -> Document {
    let mut filter = doc! { "projectId": project_oid };
    if let Some(b) = q.bot_id.as_deref().and_then(parse_oid) {
        filter.insert("botId", b);
    }
    if let Some(s) = q.status.as_deref() {
        if s != "all" && !s.is_empty() {
            filter.insert("status", s);
        }
    }
    if let Some(a) = q.assigned_agent_id.as_deref() {
        match a {
            "unassigned" => {
                // Treat missing / null / empty assignedAgentId as unassigned.
                filter.insert(
                    "assignedAgentId",
                    doc! { "$in": [bson::Bson::Null, bson::Bson::String(String::new())] },
                );
            }
            "anyone" | "any" | "" => {}
            v => {
                filter.insert("assignedAgentId", v);
            }
        }
    }
    if let Some(t) = q.tag.as_deref() {
        if !t.is_empty() {
            filter.insert("tags", t);
        }
    }
    if let Some(p) = q.priority.as_deref() {
        if !p.is_empty() && p != "all" {
            filter.insert("priority", p);
        }
    }
    if let Some(s) = q.search.as_deref() {
        let trimmed = s.trim();
        if !trimmed.is_empty() {
            let escaped = regex::escape(trimmed);
            let regex = doc! { "$regex": escaped, "$options": "i" };
            filter.insert(
                "$or",
                vec![
                    doc! { "title": regex.clone() },
                    doc! { "lastMessagePreview": regex.clone() },
                    doc! { "tags": regex },
                ],
            );
        }
    }
    if let Some(true) = q.has_unread {
        filter.insert("unreadCount", doc! { "$gt": 0i64 });
    }
    filter
}

pub async fn list_threads(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Query(q): Query<ListThreadsQuery>,
) -> Json<ListThreadsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListThreadsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListThreadsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.page_size.unwrap_or(30).clamp(1, 200);
    let skip = (page - 1) * page_size;
    let filter = build_threads_filter(project_oid, &q);

    let coll = s.mongo.collection::<Document>(THREADS);
    let total = match coll.count_documents(filter.clone()).await {
        Ok(n) => n as i64,
        Err(e) => {
            return Json(ListThreadsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    let cursor = match coll
        .find(filter)
        .sort(doc! { "lastInboundAt": -1, "updatedAt": -1 })
        .skip(skip as u64)
        .limit(page_size)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListThreadsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListThreadsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let threads: Vec<InboxThread> = docs.iter().filter_map(doc_to_thread).collect();

    // Stat counts (cheap to compute alongside the page).
    let open_count = coll
        .count_documents(doc! { "projectId": project_oid, "status": "open" })
        .await
        .unwrap_or(0) as i64;
    let pending_count = coll
        .count_documents(doc! { "projectId": project_oid, "status": "pending" })
        .await
        .unwrap_or(0) as i64;
    let snoozed_count = coll
        .count_documents(doc! { "projectId": project_oid, "status": "snoozed" })
        .await
        .unwrap_or(0) as i64;
    let resolved_count = coll
        .count_documents(doc! { "projectId": project_oid, "status": "resolved" })
        .await
        .unwrap_or(0) as i64;
    let now = bson::DateTime::now();
    let breached_count = coll
        .count_documents(doc! {
            "projectId": project_oid,
            "status": { "$in": ["open", "pending"] },
            "slaDueAt": { "$lt": now },
            "resolvedAt": { "$exists": false },
        })
        .await
        .unwrap_or(0) as i64;

    let has_more = skip + (threads.len() as i64) < total;
    Json(ListThreadsResp {
        threads,
        total,
        has_more,
        page,
        page_size,
        open_count,
        pending_count,
        snoozed_count,
        resolved_count,
        breached_count,
        error: None,
    })
}

// =========================================================================
// GET /threads/{id} — detail
// =========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct DetailResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thread: Option<InboxThread>,
    #[serde(rename = "relatedThreads")]
    pub related_threads: Vec<InboxThread>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chat: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn get_thread(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Path(id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<DetailResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(DetailResp {
                error: Some("projectId is required".to_owned()),
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
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => {
            return Json(DetailResp {
                error: Some("Invalid thread id.".to_owned()),
                ..Default::default()
            });
        }
    };
    let coll = s.mongo.collection::<Document>(THREADS);
    let doc = match coll
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => {
            return Json(DetailResp {
                error: Some("Thread not found.".to_owned()),
                ..Default::default()
            });
        }
        Err(e) => {
            return Json(DetailResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let thread = match doc_to_thread(&doc) {
        Some(t) => t,
        None => {
            return Json(DetailResp {
                error: Some("Thread is malformed.".to_owned()),
                ..Default::default()
            });
        }
    };

    // Related threads: same chatId, different bot.
    let chat_id_str = thread.chat_id.clone();
    let related_cursor = coll
        .find(doc! {
            "projectId": project_oid,
            "chatId": &chat_id_str,
            "_id": { "$ne": oid },
        })
        .sort(doc! { "lastInboundAt": -1 })
        .limit(10)
        .await;
    let related = match related_cursor {
        Ok(c) => {
            use futures::TryStreamExt;
            let docs: Vec<Document> = c.try_collect().await.unwrap_or_default();
            docs.iter().filter_map(doc_to_thread).collect()
        }
        Err(_) => vec![],
    };

    // Chat metadata (best-effort).
    let chat = match s
        .mongo
        .collection::<Document>(CHATS)
        .find_one(doc! { "chatId": &chat_id_str })
        .await
    {
        Ok(Some(d)) => serde_json::to_value(&d).ok(),
        _ => None,
    };

    Json(DetailResp {
        thread: Some(thread),
        related_threads: related,
        chat,
        error: None,
    })
}

// =========================================================================
// POST /threads/{id}/assign
// =========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct AssignBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "agentId")]
    pub agent_id: Option<String>,
}

pub async fn assign_thread(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Path(id): Path<String>,
    Json(body): Json<AssignBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return ack_err(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return ack_err("Invalid thread id."),
    };
    let now = bson::DateTime::now();
    let update = match &body.agent_id {
        Some(a) if !a.is_empty() => doc! {
            "$set": { "assignedAgentId": a, "updatedAt": now },
        },
        _ => doc! {
            "$unset": { "assignedAgentId": "" },
            "$set": { "updatedAt": now },
        },
    };
    match s
        .mongo
        .collection::<Document>(THREADS)
        .update_one(doc! { "_id": oid, "projectId": project_oid }, update)
        .await
    {
        Ok(r) if r.matched_count == 0 => ack_err("Thread not found."),
        Ok(_) => Json(AckResult {
            success: true,
            message: Some("Assignment updated.".to_owned()),
            id: Some(id),
            ..Default::default()
        }),
        Err(e) => ack_err(format!("mongo: {e}")),
    }
}

// =========================================================================
// POST /threads/{id}/status
// =========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct StatusBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub status: String,
    #[serde(default, rename = "snoozedUntil")]
    pub snoozed_until: Option<String>,
}

fn valid_status(s: &str) -> bool {
    matches!(s, "open" | "pending" | "snoozed" | "resolved" | "archived")
}

pub async fn set_status(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Path(id): Path<String>,
    Json(body): Json<StatusBody>,
) -> Json<AckResult> {
    if !valid_status(&body.status) {
        return ack_err("Invalid status.");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return ack_err(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return ack_err("Invalid thread id."),
    };

    let now = bson::DateTime::now();
    let mut set = doc! { "status": &body.status, "updatedAt": now };
    let mut unset = doc! {};
    match body.status.as_str() {
        "resolved" => {
            set.insert("resolvedAt", now);
            if let Some(uid) = parse_user_oid(&user) {
                set.insert("resolvedById", uid.to_hex());
            }
            unset.insert("snoozedUntil", "");
        }
        "open" | "pending" | "archived" => {
            unset.insert("snoozedUntil", "");
            unset.insert("resolvedAt", "");
            unset.insert("resolvedById", "");
        }
        "snoozed" => {
            if let Some(s_iso) = body.snoozed_until.as_deref().and_then(parse_iso) {
                set.insert(
                    "snoozedUntil",
                    bson::DateTime::from_millis(s_iso.timestamp_millis()),
                );
            }
        }
        _ => {}
    }

    let mut update = doc! { "$set": set };
    if !unset.is_empty() {
        update.insert("$unset", unset);
    }
    match s
        .mongo
        .collection::<Document>(THREADS)
        .update_one(doc! { "_id": oid, "projectId": project_oid }, update)
        .await
    {
        Ok(r) if r.matched_count == 0 => ack_err("Thread not found."),
        Ok(_) => Json(AckResult {
            success: true,
            message: Some("Status updated.".to_owned()),
            id: Some(id),
            ..Default::default()
        }),
        Err(e) => ack_err(format!("mongo: {e}")),
    }
}

// =========================================================================
// POST /threads/{id}/tags
// =========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct TagsBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default)]
    pub add: Vec<String>,
    #[serde(default)]
    pub remove: Vec<String>,
}

pub async fn set_tags(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Path(id): Path<String>,
    Json(body): Json<TagsBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return ack_err(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return ack_err("Invalid thread id."),
    };
    let coll = s.mongo.collection::<Document>(THREADS);
    let now = bson::DateTime::now();

    if !body.add.is_empty() {
        let arr: Vec<Bson> = body
            .add
            .iter()
            .filter(|t| !t.trim().is_empty())
            .map(|t| Bson::String(t.trim().to_owned()))
            .collect();
        if !arr.is_empty() {
            let _ = coll
                .update_one(
                    doc! { "_id": oid, "projectId": project_oid },
                    doc! {
                        "$addToSet": { "tags": { "$each": arr } },
                        "$set": { "updatedAt": now },
                    },
                )
                .await;
        }
    }
    if !body.remove.is_empty() {
        let arr: Vec<Bson> = body
            .remove
            .iter()
            .filter(|t| !t.trim().is_empty())
            .map(|t| Bson::String(t.trim().to_owned()))
            .collect();
        if !arr.is_empty() {
            let _ = coll
                .update_one(
                    doc! { "_id": oid, "projectId": project_oid },
                    doc! {
                        "$pullAll": { "tags": arr },
                        "$set": { "updatedAt": now },
                    },
                )
                .await;
        }
    }

    Json(AckResult {
        success: true,
        message: Some("Tags updated.".to_owned()),
        id: Some(id),
        ..Default::default()
    })
}

// =========================================================================
// POST /threads/{id}/priority
// =========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct PriorityBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub priority: String,
}

fn valid_priority(p: &str) -> bool {
    matches!(p, "low" | "normal" | "high" | "urgent")
}

pub async fn set_priority(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Path(id): Path<String>,
    Json(body): Json<PriorityBody>,
) -> Json<AckResult> {
    if !valid_priority(&body.priority) {
        return ack_err("Invalid priority.");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return ack_err(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return ack_err("Invalid thread id."),
    };
    match s
        .mongo
        .collection::<Document>(THREADS)
        .update_one(
            doc! { "_id": oid, "projectId": project_oid },
            doc! { "$set": { "priority": &body.priority, "updatedAt": bson::DateTime::now() } },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => ack_err("Thread not found."),
        Ok(_) => Json(AckResult {
            success: true,
            message: Some("Priority updated.".to_owned()),
            id: Some(id),
            ..Default::default()
        }),
        Err(e) => ack_err(format!("mongo: {e}")),
    }
}

// =========================================================================
// POST /threads/{id}/mark-read
// =========================================================================

pub async fn mark_read(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Path(id): Path<String>,
    Json(body): Json<ProjectBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return ack_err(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return ack_err("Invalid thread id."),
    };
    let now = bson::DateTime::now();
    match s
        .mongo
        .collection::<Document>(THREADS)
        .update_one(
            doc! { "_id": oid, "projectId": project_oid },
            doc! { "$set": { "unreadCount": 0i64, "updatedAt": now } },
        )
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            message: Some("Marked read.".to_owned()),
            id: Some(id),
            ..Default::default()
        }),
        Err(e) => ack_err(format!("mongo: {e}")),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
}

// =========================================================================
// GET /threads/{id}/messages — proxy to telegram_messages
// =========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct MessagesQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub cursor: Option<i64>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InboxMessage {
    pub _id: String,
    #[serde(rename = "messageId")]
    pub message_id: i64,
    pub direction: String,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "fromUserId")]
    pub from_user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "fromUsername")]
    pub from_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "replyToMessageId")]
    pub reply_to_message_id: Option<i64>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "errorMessage")]
    pub error_message: Option<String>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListMessagesResp {
    pub messages: Vec<InboxMessage>,
    #[serde(rename = "nextCursor", skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn doc_to_inbox_msg(d: &Document) -> Option<InboxMessage> {
    Some(InboxMessage {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        message_id: d
            .get_i64("messageId")
            .or_else(|_| d.get_i32("messageId").map(i64::from))
            .ok()?,
        direction: d.get_str("direction").unwrap_or("inbound").to_owned(),
        kind: d.get_str("type").unwrap_or("text").to_owned(),
        text: d.get_str("text").ok().map(str::to_owned),
        caption: d.get_str("caption").ok().map(str::to_owned),
        from_user_id: d.get_str("fromUserId").ok().map(str::to_owned),
        from_username: d.get_str("fromUsername").ok().map(str::to_owned),
        reply_to_message_id: d
            .get_i64("replyToMessageId")
            .or_else(|_| d.get_i32("replyToMessageId").map(i64::from))
            .ok(),
        status: d.get_str("status").unwrap_or("sent").to_owned(),
        error_message: d.get_str("errorMessage").ok().map(str::to_owned),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
    })
}

pub async fn list_messages(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Path(id): Path<String>,
    Query(q): Query<MessagesQuery>,
) -> Json<ListMessagesResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListMessagesResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListMessagesResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => {
            return Json(ListMessagesResp {
                error: Some("Invalid thread id.".to_owned()),
                ..Default::default()
            });
        }
    };
    let thread = match s
        .mongo
        .collection::<Document>(THREADS)
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => {
            return Json(ListMessagesResp {
                error: Some("Thread not found.".to_owned()),
                ..Default::default()
            });
        }
        Err(e) => {
            return Json(ListMessagesResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let bot_oid = match thread.get_object_id("botId") {
        Ok(o) => o,
        Err(_) => {
            return Json(ListMessagesResp {
                error: Some("Thread is missing botId.".to_owned()),
                ..Default::default()
            });
        }
    };
    let chat_id_str = thread.get_str("chatId").unwrap_or("").to_owned();

    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let mut filter = doc! { "botId": bot_oid, "chatId": &chat_id_str };
    if let Some(c) = q.cursor {
        filter.insert("messageId", doc! { "$lt": c });
    }
    let cursor_r = s
        .mongo
        .collection::<Document>(MESSAGES)
        .find(filter)
        .sort(doc! { "messageId": -1 })
        .limit(limit)
        .await;
    let cursor_v = match cursor_r {
        Ok(c) => c,
        Err(e) => {
            return Json(ListMessagesResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    use futures::TryStreamExt;
    let mut docs: Vec<Document> = match cursor_v.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListMessagesResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let next_cursor = if (docs.len() as i64) >= limit {
        docs.last().and_then(|d| {
            d.get_i64("messageId")
                .ok()
                .or_else(|| d.get_i32("messageId").ok().map(i64::from))
        })
    } else {
        None
    };
    docs.reverse();
    let messages: Vec<InboxMessage> = docs.iter().filter_map(doc_to_inbox_msg).collect();
    Json(ListMessagesResp {
        messages,
        next_cursor,
        error: None,
    })
}

// =========================================================================
// Notes: GET/POST /threads/{id}/notes, DELETE /threads/{id}/notes/{noteId}
// =========================================================================

#[derive(Debug, Clone, Serialize)]
pub struct InboxNote {
    pub _id: String,
    #[serde(rename = "threadId")]
    pub thread_id: String,
    #[serde(rename = "authorId")]
    pub author_id: String,
    pub body: String,
    pub mentions: Vec<String>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
}

fn doc_to_note(d: &Document) -> Option<InboxNote> {
    Some(InboxNote {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        thread_id: d.get_object_id("threadId").ok()?.to_hex(),
        author_id: d
            .get_str("authorId")
            .ok()
            .map(str::to_owned)
            .or_else(|| d.get_object_id("authorId").ok().map(|o| o.to_hex()))
            .unwrap_or_default(),
        body: d.get_str("body").unwrap_or("").to_owned(),
        mentions: d
            .get_array("mentions")
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(str::to_owned))
                    .collect()
            })
            .unwrap_or_default(),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct NotesQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListNotesResp {
    pub notes: Vec<InboxNote>,
    #[serde(rename = "nextCursor", skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn list_notes(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Path(id): Path<String>,
    Query(q): Query<NotesQuery>,
) -> Json<ListNotesResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListNotesResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListNotesResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let thread_oid = match parse_oid(&id) {
        Some(o) => o,
        None => {
            return Json(ListNotesResp {
                error: Some("Invalid thread id.".to_owned()),
                ..Default::default()
            });
        }
    };
    // Confirm thread belongs to project.
    if let Ok(None) = s
        .mongo
        .collection::<Document>(THREADS)
        .find_one(doc! { "_id": thread_oid, "projectId": project_oid })
        .await
    {
        return Json(ListNotesResp {
            error: Some("Thread not found.".to_owned()),
            ..Default::default()
        });
    }

    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let mut filter = doc! { "threadId": thread_oid };
    if let Some(c) = q.cursor.as_deref().and_then(parse_oid) {
        filter.insert("_id", doc! { "$lt": c });
    }
    let cursor_r = s
        .mongo
        .collection::<Document>(NOTES)
        .find(filter)
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .await;
    let cursor_v = match cursor_r {
        Ok(c) => c,
        Err(e) => {
            return Json(ListNotesResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor_v.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListNotesResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let next_cursor = if (docs.len() as i64) >= limit {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok().map(|o| o.to_hex()))
    } else {
        None
    };
    let notes: Vec<InboxNote> = docs.iter().filter_map(doc_to_note).collect();
    Json(ListNotesResp {
        notes,
        next_cursor,
        error: None,
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateNoteBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub body: String,
    #[serde(default)]
    pub mentions: Vec<String>,
}

pub async fn create_note(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Path(id): Path<String>,
    Json(body): Json<CreateNoteBody>,
) -> Json<AckResult> {
    let trimmed = body.body.trim();
    if trimmed.is_empty() {
        return ack_err("Note body is required.");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return ack_err(e),
    };
    let thread_oid = match parse_oid(&id) {
        Some(o) => o,
        None => return ack_err("Invalid thread id."),
    };
    let threads = s.mongo.collection::<Document>(THREADS);
    if let Ok(None) = threads
        .find_one(doc! { "_id": thread_oid, "projectId": project_oid })
        .await
    {
        return ack_err("Thread not found.");
    }

    let now = bson::DateTime::now();
    let mentions: Vec<Bson> = body
        .mentions
        .iter()
        .filter(|m| !m.trim().is_empty())
        .map(|m| Bson::String(m.trim().to_owned()))
        .collect();
    let author_id = parse_user_oid(&user)
        .map(|o| o.to_hex())
        .unwrap_or_default();
    let note_doc = doc! {
        "threadId": thread_oid,
        "projectId": project_oid,
        "authorId": &author_id,
        "body": trimmed,
        "mentions": mentions,
        "createdAt": now,
    };
    let coll = s.mongo.collection::<Document>(NOTES);
    let inserted_id = match coll.insert_one(note_doc).await {
        Ok(r) => r
            .inserted_id
            .as_object_id()
            .map(|o| o.to_hex())
            .unwrap_or_default(),
        Err(e) => return ack_err(format!("mongo: {e}")),
    };
    let _ = threads
        .update_one(
            doc! { "_id": thread_oid },
            doc! { "$inc": { "internalNotesCount": 1i64 }, "$set": { "updatedAt": now } },
        )
        .await;
    Json(AckResult {
        success: true,
        message: Some("Note added.".to_owned()),
        id: Some(inserted_id),
        ..Default::default()
    })
}

pub async fn delete_note(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Path((id, note_id)): Path<(String, String)>,
    Query(q): Query<ProjectQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return ack_err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return ack_err(e),
    };
    let thread_oid = match parse_oid(&id) {
        Some(o) => o,
        None => return ack_err("Invalid thread id."),
    };
    let note_oid = match parse_oid(&note_id) {
        Some(o) => o,
        None => return ack_err("Invalid note id."),
    };
    let res = match s
        .mongo
        .collection::<Document>(NOTES)
        .delete_one(doc! { "_id": note_oid, "threadId": thread_oid, "projectId": project_oid })
        .await
    {
        Ok(r) => r,
        Err(e) => return ack_err(format!("mongo: {e}")),
    };
    if res.deleted_count > 0 {
        let _ = s
            .mongo
            .collection::<Document>(THREADS)
            .update_one(
                doc! { "_id": thread_oid },
                doc! {
                    "$inc": { "internalNotesCount": -1i64 },
                    "$set": { "updatedAt": bson::DateTime::now() },
                },
            )
            .await;
    }
    Json(AckResult {
        success: true,
        message: Some("Note deleted.".to_owned()),
        id: Some(note_id),
        ..Default::default()
    })
}

// =========================================================================
// POST /threads/bulk
// =========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct BulkBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub ids: Vec<String>,
    pub action: String,
    #[serde(default)]
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct BulkResp {
    pub success: bool,
    pub updated: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

pub async fn bulk_threads(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Json(body): Json<BulkBody>,
) -> Json<BulkResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(BulkResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let oids: Vec<Bson> = body
        .ids
        .iter()
        .filter_map(|i| parse_oid(i))
        .map(Bson::ObjectId)
        .collect();
    if oids.is_empty() {
        return Json(BulkResp {
            error: Some("No valid ids supplied.".to_owned()),
            ..Default::default()
        });
    }
    let coll = s.mongo.collection::<Document>(THREADS);
    let filter = doc! { "_id": { "$in": oids }, "projectId": project_oid };
    let now = bson::DateTime::now();
    let update = match body.action.as_str() {
        "assign" => {
            let agent = body
                .payload
                .get("agentId")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(str::to_owned);
            match agent {
                Some(a) => doc! { "$set": { "assignedAgentId": a, "updatedAt": now } },
                None => doc! { "$unset": { "assignedAgentId": "" }, "$set": { "updatedAt": now } },
            }
        }
        "status" => {
            let status = body
                .payload
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if !valid_status(status) {
                return Json(BulkResp {
                    error: Some("Invalid status.".to_owned()),
                    ..Default::default()
                });
            }
            let mut set = doc! { "status": status, "updatedAt": now };
            if status == "resolved" {
                set.insert("resolvedAt", now);
            }
            doc! { "$set": set }
        }
        "tag" => {
            let add: Vec<Bson> = body
                .payload
                .get("add")
                .and_then(|v| v.as_array())
                .map(|a| {
                    a.iter()
                        .filter_map(|v| v.as_str().map(|s| Bson::String(s.to_owned())))
                        .collect()
                })
                .unwrap_or_default();
            if add.is_empty() {
                return Json(BulkResp {
                    error: Some("tag payload requires `add: string[]`.".to_owned()),
                    ..Default::default()
                });
            }
            doc! {
                "$addToSet": { "tags": { "$each": add } },
                "$set": { "updatedAt": now },
            }
        }
        "priority" => {
            let priority = body
                .payload
                .get("priority")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if !valid_priority(priority) {
                return Json(BulkResp {
                    error: Some("Invalid priority.".to_owned()),
                    ..Default::default()
                });
            }
            doc! { "$set": { "priority": priority, "updatedAt": now } }
        }
        other => {
            return Json(BulkResp {
                error: Some(format!("unknown action `{other}`")),
                ..Default::default()
            });
        }
    };

    match coll.update_many(filter, update).await {
        Ok(r) => Json(BulkResp {
            success: true,
            updated: r.modified_count as i64,
            message: Some(format!("Updated {}.", r.modified_count)),
            error: None,
        }),
        Err(e) => Json(BulkResp {
            error: Some(format!("mongo: {e}")),
            ..Default::default()
        }),
    }
}

// =========================================================================
// Auto-assign rules CRUD
// =========================================================================

#[derive(Debug, Clone, Serialize)]
pub struct AutoAssignRule {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    pub enabled: bool,
    pub priority: i64,
    #[serde(rename = "match")]
    pub match_: serde_json::Value,
    #[serde(rename = "assignTo")]
    pub assign_to: serde_json::Value,
    #[serde(rename = "applyTags", skip_serializing_if = "Option::is_none")]
    pub apply_tags: Option<Vec<String>>,
    #[serde(rename = "setPriority", skip_serializing_if = "Option::is_none")]
    pub set_priority: Option<String>,
    #[serde(rename = "setSlaSeconds", skip_serializing_if = "Option::is_none")]
    pub set_sla_seconds: Option<i64>,
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

fn doc_to_rule(d: &Document) -> Option<AutoAssignRule> {
    Some(AutoAssignRule {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        name: d.get_str("name").unwrap_or("").to_owned(),
        enabled: d.get_bool("enabled").unwrap_or(true),
        priority: d
            .get_i64("priority")
            .or_else(|_| d.get_i32("priority").map(i64::from))
            .unwrap_or(100),
        match_: d
            .get_document("match")
            .ok()
            .map(|m| serde_json::to_value(m).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        assign_to: d
            .get_document("assignTo")
            .ok()
            .map(|m| serde_json::to_value(m).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        apply_tags: d.get_array("applyTags").ok().map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(str::to_owned))
                .collect()
        }),
        set_priority: d.get_str("setPriority").ok().map(str::to_owned),
        set_sla_seconds: d
            .get_i64("setSlaSeconds")
            .or_else(|_| d.get_i32("setSlaSeconds").map(i64::from))
            .ok(),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListRulesResp {
    pub rules: Vec<AutoAssignRule>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn list_auto_assign(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Query(q): Query<ProjectQuery>,
) -> Json<ListRulesResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListRulesResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListRulesResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(RULES)
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "priority": 1, "createdAt": 1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListRulesResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = cursor.try_collect().await.unwrap_or_default();
    Json(ListRulesResp {
        rules: docs.iter().filter_map(doc_to_rule).collect(),
        error: None,
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct RuleBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub priority: Option<i64>,
    #[serde(default, rename = "match")]
    pub match_: Option<serde_json::Value>,
    #[serde(default, rename = "assignTo")]
    pub assign_to: Option<serde_json::Value>,
    #[serde(default, rename = "applyTags")]
    pub apply_tags: Option<Vec<String>>,
    #[serde(default, rename = "setPriority")]
    pub set_priority: Option<String>,
    #[serde(default, rename = "setSlaSeconds")]
    pub set_sla_seconds: Option<i64>,
}

fn json_to_bson_document(v: &serde_json::Value) -> Document {
    match bson::to_bson(v) {
        Ok(Bson::Document(d)) => d,
        _ => Document::new(),
    }
}

pub async fn create_auto_assign(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Json(body): Json<RuleBody>,
) -> Json<AckResult> {
    if body.name.trim().is_empty() {
        return ack_err("name is required");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return ack_err(e),
    };
    let now = bson::DateTime::now();
    let mut d = doc! {
        "projectId": project_oid,
        "name": body.name.trim(),
        "enabled": body.enabled.unwrap_or(true),
        "priority": body.priority.unwrap_or(100),
        "match": json_to_bson_document(body.match_.as_ref().unwrap_or(&serde_json::Value::Null)),
        "assignTo": json_to_bson_document(body.assign_to.as_ref().unwrap_or(&serde_json::Value::Null)),
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(tags) = body.apply_tags {
        let arr: Vec<Bson> = tags.into_iter().map(Bson::String).collect();
        d.insert("applyTags", arr);
    }
    if let Some(p) = body.set_priority {
        d.insert("setPriority", p);
    }
    if let Some(sla) = body.set_sla_seconds {
        d.insert("setSlaSeconds", sla);
    }
    match s.mongo.collection::<Document>(RULES).insert_one(d).await {
        Ok(r) => Json(AckResult {
            success: true,
            id: r.inserted_id.as_object_id().map(|o| o.to_hex()),
            message: Some("Rule created.".to_owned()),
            ..Default::default()
        }),
        Err(e) => ack_err(format!("mongo: {e}")),
    }
}

pub async fn update_auto_assign(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Path(id): Path<String>,
    Json(body): Json<RuleBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return ack_err(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return ack_err("Invalid rule id."),
    };
    let now = bson::DateTime::now();
    let mut set = doc! {
        "name": body.name.trim(),
        "enabled": body.enabled.unwrap_or(true),
        "priority": body.priority.unwrap_or(100),
        "match": json_to_bson_document(body.match_.as_ref().unwrap_or(&serde_json::Value::Null)),
        "assignTo": json_to_bson_document(body.assign_to.as_ref().unwrap_or(&serde_json::Value::Null)),
        "updatedAt": now,
    };
    if let Some(tags) = body.apply_tags {
        let arr: Vec<Bson> = tags.into_iter().map(Bson::String).collect();
        set.insert("applyTags", arr);
    }
    if let Some(p) = body.set_priority {
        set.insert("setPriority", p);
    }
    if let Some(sla) = body.set_sla_seconds {
        set.insert("setSlaSeconds", sla);
    }
    match s
        .mongo
        .collection::<Document>(RULES)
        .update_one(
            doc! { "_id": oid, "projectId": project_oid },
            doc! { "$set": set },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => ack_err("Rule not found."),
        Ok(_) => Json(AckResult {
            success: true,
            id: Some(id),
            message: Some("Rule updated.".to_owned()),
            ..Default::default()
        }),
        Err(e) => ack_err(format!("mongo: {e}")),
    }
}

pub async fn delete_auto_assign(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Path(id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return ack_err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return ack_err(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return ack_err("Invalid rule id."),
    };
    match s
        .mongo
        .collection::<Document>(RULES)
        .delete_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            id: Some(id),
            message: Some("Rule deleted.".to_owned()),
            ..Default::default()
        }),
        Err(e) => ack_err(format!("mongo: {e}")),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReorderBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub ids: Vec<String>,
}

pub async fn reorder_auto_assign(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Json(body): Json<ReorderBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return ack_err(e),
    };
    let coll = s.mongo.collection::<Document>(RULES);
    let now = bson::DateTime::now();
    let mut count: i64 = 0;
    for (idx, id) in body.ids.iter().enumerate() {
        if let Some(oid) = parse_oid(id) {
            if let Ok(r) = coll
                .update_one(
                    doc! { "_id": oid, "projectId": project_oid },
                    doc! { "$set": { "priority": (idx as i64) + 1, "updatedAt": now } },
                )
                .await
            {
                count += r.modified_count as i64;
            }
        }
    }
    Json(AckResult {
        success: true,
        message: Some(format!("Reordered {count}.")),
        ..Default::default()
    })
}

// =========================================================================
// SLA policies CRUD + sla_eval
// =========================================================================

#[derive(Debug, Clone, Serialize)]
pub struct SlaPolicy {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    #[serde(rename = "firstResponseSeconds")]
    pub first_response_seconds: i64,
    #[serde(rename = "resolutionSeconds")]
    pub resolution_seconds: i64,
    #[serde(rename = "businessHoursOnly")]
    pub business_hours_only: bool,
    #[serde(rename = "applyToTags", skip_serializing_if = "Option::is_none")]
    pub apply_to_tags: Option<Vec<String>>,
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

fn doc_to_sla(d: &Document) -> Option<SlaPolicy> {
    Some(SlaPolicy {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        name: d.get_str("name").unwrap_or("").to_owned(),
        first_response_seconds: d
            .get_i64("firstResponseSeconds")
            .or_else(|_| d.get_i32("firstResponseSeconds").map(i64::from))
            .unwrap_or(3600),
        resolution_seconds: d
            .get_i64("resolutionSeconds")
            .or_else(|_| d.get_i32("resolutionSeconds").map(i64::from))
            .unwrap_or(86400),
        business_hours_only: d.get_bool("businessHoursOnly").unwrap_or(false),
        apply_to_tags: d.get_array("applyToTags").ok().map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(str::to_owned))
                .collect()
        }),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListSlaResp {
    pub policies: Vec<SlaPolicy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn list_sla(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Query(q): Query<ProjectQuery>,
) -> Json<ListSlaResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListSlaResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListSlaResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(SLA)
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "createdAt": 1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListSlaResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = cursor.try_collect().await.unwrap_or_default();
    Json(ListSlaResp {
        policies: docs.iter().filter_map(doc_to_sla).collect(),
        error: None,
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct SlaBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    #[serde(rename = "firstResponseSeconds")]
    pub first_response_seconds: i64,
    #[serde(rename = "resolutionSeconds")]
    pub resolution_seconds: i64,
    #[serde(default, rename = "businessHoursOnly")]
    pub business_hours_only: Option<bool>,
    #[serde(default, rename = "applyToTags")]
    pub apply_to_tags: Option<Vec<String>>,
}

pub async fn create_sla(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Json(body): Json<SlaBody>,
) -> Json<AckResult> {
    if body.name.trim().is_empty() {
        return ack_err("name is required");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return ack_err(e),
    };
    let now = bson::DateTime::now();
    let mut d = doc! {
        "projectId": project_oid,
        "name": body.name.trim(),
        "firstResponseSeconds": body.first_response_seconds,
        "resolutionSeconds": body.resolution_seconds,
        "businessHoursOnly": body.business_hours_only.unwrap_or(false),
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(tags) = body.apply_to_tags {
        let arr: Vec<Bson> = tags.into_iter().map(Bson::String).collect();
        d.insert("applyToTags", arr);
    }
    match s.mongo.collection::<Document>(SLA).insert_one(d).await {
        Ok(r) => Json(AckResult {
            success: true,
            id: r.inserted_id.as_object_id().map(|o| o.to_hex()),
            message: Some("SLA created.".to_owned()),
            ..Default::default()
        }),
        Err(e) => ack_err(format!("mongo: {e}")),
    }
}

pub async fn update_sla(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Path(id): Path<String>,
    Json(body): Json<SlaBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return ack_err(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return ack_err("Invalid SLA id."),
    };
    let now = bson::DateTime::now();
    let mut set = doc! {
        "name": body.name.trim(),
        "firstResponseSeconds": body.first_response_seconds,
        "resolutionSeconds": body.resolution_seconds,
        "businessHoursOnly": body.business_hours_only.unwrap_or(false),
        "updatedAt": now,
    };
    if let Some(tags) = body.apply_to_tags {
        let arr: Vec<Bson> = tags.into_iter().map(Bson::String).collect();
        set.insert("applyToTags", arr);
    }
    match s
        .mongo
        .collection::<Document>(SLA)
        .update_one(
            doc! { "_id": oid, "projectId": project_oid },
            doc! { "$set": set },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => ack_err("SLA not found."),
        Ok(_) => Json(AckResult {
            success: true,
            id: Some(id),
            message: Some("SLA updated.".to_owned()),
            ..Default::default()
        }),
        Err(e) => ack_err(format!("mongo: {e}")),
    }
}

pub async fn delete_sla(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Path(id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return ack_err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return ack_err(e),
    };
    let oid = match parse_oid(&id) {
        Some(o) => o,
        None => return ack_err("Invalid SLA id."),
    };
    match s
        .mongo
        .collection::<Document>(SLA)
        .delete_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            id: Some(id),
            message: Some("SLA deleted.".to_owned()),
            ..Default::default()
        }),
        Err(e) => ack_err(format!("mongo: {e}")),
    }
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct SlaEvalResp {
    pub success: bool,
    pub evaluated: i64,
    pub breached: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SlaEvalBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
}

pub async fn sla_eval(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Json(body): Json<SlaEvalBody>,
) -> Json<SlaEvalResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(SlaEvalResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    match evaluate_slas(&s.mongo, project_oid).await {
        Ok((evaluated, breached)) => Json(SlaEvalResp {
            success: true,
            evaluated,
            breached,
            error: None,
        }),
        Err(e) => Json(SlaEvalResp {
            error: Some(e),
            ..Default::default()
        }),
    }
}

/// Recompute `slaDueAt` for every open/pending thread in a project.
/// Idempotent: only writes when the computed value differs.
/// Returns `(evaluated, breached)` counts.
pub async fn evaluate_slas(
    mongo: &MongoHandle,
    project_oid: ObjectId,
) -> Result<(i64, i64), String> {
    // Load all SLA policies for this project; pick the most-specific
    // matching policy per thread (tag overlap > base policy).
    let policies: Vec<SlaPolicy> = {
        let cur = mongo
            .collection::<Document>(SLA)
            .find(doc! { "projectId": project_oid })
            .await
            .map_err(|e| format!("mongo: {e}"))?;
        use futures::TryStreamExt;
        let docs: Vec<Document> = cur.try_collect().await.unwrap_or_default();
        docs.iter().filter_map(doc_to_sla).collect()
    };

    let now = Utc::now();
    let threads_coll = mongo.collection::<Document>(THREADS);
    let cur = threads_coll
        .find(doc! {
            "projectId": project_oid,
            "status": { "$in": ["open", "pending"] },
        })
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    use futures::TryStreamExt;
    let docs: Vec<Document> = cur.try_collect().await.unwrap_or_default();

    let mut evaluated: i64 = 0;
    let mut breached: i64 = 0;
    for d in &docs {
        evaluated += 1;
        let oid = match d.get_object_id("_id") {
            Ok(o) => o,
            Err(_) => continue,
        };
        let tags: Vec<String> = d
            .get_array("tags")
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(str::to_owned))
                    .collect()
            })
            .unwrap_or_default();
        let last_inbound = dt_opt(d.get_datetime("lastInboundAt").ok().copied())
            .unwrap_or_else(|| dt(d.get_datetime("createdAt").ok().copied()));

        // Most specific policy: largest overlap of applyToTags with thread tags.
        let mut best: Option<&SlaPolicy> = None;
        let mut best_score: i64 = -1;
        for p in &policies {
            let score: i64 = match &p.apply_to_tags {
                Some(t) if !t.is_empty() => t.iter().filter(|t| tags.contains(t)).count() as i64,
                _ => 0,
            };
            if score > best_score {
                best_score = score;
                best = Some(p);
            }
        }
        let policy = match best {
            Some(p) => p,
            None => continue,
        };
        let due = last_inbound + chrono::Duration::seconds(policy.first_response_seconds);
        let due_bson = bson::DateTime::from_millis(due.timestamp_millis());

        // Only touch if changed.
        let current = d.get_datetime("slaDueAt").ok().copied();
        if current.map(|c| c.timestamp_millis()) != Some(due.timestamp_millis()) {
            let _ = threads_coll
                .update_one(
                    doc! { "_id": oid },
                    doc! { "$set": { "slaDueAt": due_bson, "updatedAt": bson::DateTime::now() } },
                )
                .await;
        }
        if due < now {
            breached += 1;
        }
    }
    Ok((evaluated, breached))
}

// =========================================================================
// Agents
// =========================================================================

#[derive(Debug, Clone, Serialize)]
pub struct AgentRow {
    pub _id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(rename = "openCount")]
    pub open_count: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListAgentsResp {
    pub agents: Vec<AgentRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn list_agents(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Query(q): Query<ProjectQuery>,
) -> Json<ListAgentsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListAgentsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListAgentsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    // Try to read agents from the project document (`agents` sub-array
    // is the wachat convention). Fall back to the authenticated user.
    let mut agents: Vec<AgentRow> = vec![];
    if let Ok(Some(p)) = s
        .mongo
        .collection::<Document>(PROJECTS)
        .find_one(doc! { "_id": project_oid })
        .await
    {
        if let Ok(arr) = p.get_array("agents") {
            for a in arr {
                if let Some(d) = a.as_document() {
                    let id = d
                        .get_str("userId")
                        .ok()
                        .map(str::to_owned)
                        .or_else(|| d.get_object_id("userId").ok().map(|o| o.to_hex()))
                        .or_else(|| d.get_object_id("_id").ok().map(|o| o.to_hex()))
                        .unwrap_or_default();
                    if id.is_empty() {
                        continue;
                    }
                    let name = d
                        .get_str("name")
                        .ok()
                        .or_else(|| d.get_str("email").ok())
                        .unwrap_or("Agent")
                        .to_owned();
                    let email = d.get_str("email").ok().map(str::to_owned);
                    agents.push(AgentRow {
                        _id: id,
                        name,
                        email,
                        open_count: 0,
                    });
                }
            }
        }
    }
    if agents.is_empty() {
        if let Some(uid) = parse_user_oid(&user) {
            agents.push(AgentRow {
                _id: uid.to_hex(),
                name: user.user_id.clone(),
                email: None,
                open_count: 0,
            });
        }
    }

    // Populate open counts per agent.
    let threads = s.mongo.collection::<Document>(THREADS);
    for a in agents.iter_mut() {
        a.open_count = threads
            .count_documents(doc! {
                "projectId": project_oid,
                "assignedAgentId": &a._id,
                "status": { "$in": ["open", "pending"] },
            })
            .await
            .unwrap_or(0) as i64;
    }

    Json(ListAgentsResp {
        agents,
        error: None,
    })
}

// =========================================================================
// Analytics
// =========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct AnalyticsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
    #[serde(default, rename = "agentId")]
    pub agent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnalyticsByDay {
    pub date: String,
    pub created: i64,
    pub resolved: i64,
    pub breached: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentLeader {
    #[serde(rename = "agentId")]
    pub agent_id: String,
    pub resolved: i64,
    #[serde(rename = "avgResponseSeconds")]
    pub avg_response_seconds: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct AnalyticsResp {
    pub open: i64,
    pub pending: i64,
    pub snoozed: i64,
    pub resolved: i64,
    pub breached: i64,
    pub total: i64,
    #[serde(rename = "avgFirstResponseSeconds")]
    pub avg_first_response_seconds: i64,
    #[serde(rename = "avgResolutionSeconds")]
    pub avg_resolution_seconds: i64,
    #[serde(rename = "slaBreachRate")]
    pub sla_breach_rate: f64,
    #[serde(rename = "byDay")]
    pub by_day: Vec<AnalyticsByDay>,
    #[serde(rename = "leaderboard")]
    pub leaderboard: Vec<AgentLeader>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn analytics(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Query(q): Query<AnalyticsQuery>,
) -> Json<AnalyticsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(AnalyticsResp {
                error: Some("projectId is required".to_owned()),
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
    let now = Utc::now();
    let from = q
        .from
        .as_deref()
        .and_then(parse_iso)
        .unwrap_or_else(|| now - Duration::days(30));
    let to = q.to.as_deref().and_then(parse_iso).unwrap_or(now);

    let mut base = doc! { "projectId": project_oid };
    if let Some(a) = q.agent_id.as_deref() {
        if !a.is_empty() {
            base.insert("assignedAgentId", a);
        }
    }
    let threads = s.mongo.collection::<Document>(THREADS);

    let open = threads
        .count_documents({
            let mut f = base.clone();
            f.insert("status", "open");
            f
        })
        .await
        .unwrap_or(0) as i64;
    let pending = threads
        .count_documents({
            let mut f = base.clone();
            f.insert("status", "pending");
            f
        })
        .await
        .unwrap_or(0) as i64;
    let snoozed = threads
        .count_documents({
            let mut f = base.clone();
            f.insert("status", "snoozed");
            f
        })
        .await
        .unwrap_or(0) as i64;
    let resolved = threads
        .count_documents({
            let mut f = base.clone();
            f.insert("status", "resolved");
            f
        })
        .await
        .unwrap_or(0) as i64;
    let total = threads.count_documents(base.clone()).await.unwrap_or(0) as i64;
    let breached = threads
        .count_documents({
            let mut f = base.clone();
            f.insert("status", doc! { "$in": ["open", "pending"] });
            f.insert("slaDueAt", doc! { "$lt": bson::DateTime::now() });
            f
        })
        .await
        .unwrap_or(0) as i64;

    // Pull threads in range to compute averages and byDay (best-effort).
    let mut f = base.clone();
    f.insert(
        "createdAt",
        doc! {
            "$gte": bson::DateTime::from_millis(from.timestamp_millis()),
            "$lte": bson::DateTime::from_millis(to.timestamp_millis()),
        },
    );
    let cur = threads.find(f).await;
    let mut total_first_response: i64 = 0;
    let mut first_response_count: i64 = 0;
    let mut total_resolution: i64 = 0;
    let mut resolution_count: i64 = 0;
    let mut by_day_map: std::collections::BTreeMap<String, (i64, i64, i64)> =
        std::collections::BTreeMap::new();
    let mut leaderboard_map: std::collections::HashMap<String, (i64, i64, i64)> =
        std::collections::HashMap::new();

    // Seed by-day with zero entries.
    let mut day = from.date_naive();
    let end_day = to.date_naive();
    let mut guard = 0;
    while day <= end_day && guard < 400 {
        by_day_map.insert(day.format("%Y-%m-%d").to_string(), (0, 0, 0));
        match day.succ_opt() {
            Some(next) => day = next,
            None => break,
        }
        guard += 1;
    }

    if let Ok(cur) = cur {
        use futures::TryStreamExt;
        let docs: Vec<Document> = cur.try_collect().await.unwrap_or_default();
        for d in &docs {
            let created = dt(d.get_datetime("createdAt").ok().copied());
            let last_inbound =
                dt_opt(d.get_datetime("lastInboundAt").ok().copied()).unwrap_or(created);
            let first_resp = dt_opt(d.get_datetime("firstResponseAt").ok().copied());
            let resolved_at = dt_opt(d.get_datetime("resolvedAt").ok().copied());
            let sla_due = dt_opt(d.get_datetime("slaDueAt").ok().copied());

            let key = format!(
                "{:04}-{:02}-{:02}",
                created.year(),
                created.month(),
                created.day()
            );
            let e = by_day_map.entry(key).or_insert((0, 0, 0));
            e.0 += 1;
            if let Some(r) = resolved_at {
                let rkey = format!("{:04}-{:02}-{:02}", r.year(), r.month(), r.day());
                let e2 = by_day_map.entry(rkey).or_insert((0, 0, 0));
                e2.1 += 1;
                let secs = (r - created).num_seconds().max(0);
                total_resolution += secs;
                resolution_count += 1;
            }
            if let Some(fr) = first_resp {
                let secs = (fr - last_inbound).num_seconds().max(0);
                total_first_response += secs;
                first_response_count += 1;
            }
            if let Some(due) = sla_due {
                if resolved_at.is_none() && due < now {
                    let bkey = format!("{:04}-{:02}-{:02}", due.year(), due.month(), due.day());
                    let e3 = by_day_map.entry(bkey).or_insert((0, 0, 0));
                    e3.2 += 1;
                }
            }
            if let Some(agent) = d.get_str("assignedAgentId").ok() {
                let entry = leaderboard_map.entry(agent.to_owned()).or_insert((0, 0, 0));
                if resolved_at.is_some() {
                    entry.0 += 1;
                }
                if let Some(fr) = first_resp {
                    let secs = (fr - last_inbound).num_seconds().max(0);
                    entry.1 += secs;
                    entry.2 += 1;
                }
            }
        }
    }

    let avg_first_response_seconds = if first_response_count > 0 {
        total_first_response / first_response_count
    } else {
        0
    };
    let avg_resolution_seconds = if resolution_count > 0 {
        total_resolution / resolution_count
    } else {
        0
    };
    let sla_breach_rate = if total > 0 {
        breached as f64 / total as f64
    } else {
        0.0
    };
    let by_day = by_day_map
        .into_iter()
        .map(|(date, (created, resolved, breached))| AnalyticsByDay {
            date,
            created,
            resolved,
            breached,
        })
        .collect();
    let mut leaderboard: Vec<AgentLeader> = leaderboard_map
        .into_iter()
        .map(|(agent_id, (resolved, sum, cnt))| AgentLeader {
            agent_id,
            resolved,
            avg_response_seconds: if cnt > 0 { sum / cnt } else { 0 },
        })
        .collect();
    leaderboard.sort_by(|a, b| b.resolved.cmp(&a.resolved));
    leaderboard.truncate(10);

    Json(AnalyticsResp {
        open,
        pending,
        snoozed,
        resolved,
        breached,
        total,
        avg_first_response_seconds,
        avg_resolution_seconds,
        sla_breach_rate,
        by_day,
        leaderboard,
        error: None,
    })
}

// =========================================================================
// upsert_thread_from_message — entry point for the webhook
// =========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertThreadBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "chatId")]
    pub chat_id: String,
    #[serde(default, rename = "lastMessagePreview")]
    pub last_message_preview: Option<String>,
    #[serde(default)]
    pub direction: Option<String>,
    #[serde(default, rename = "hadUnread")]
    pub had_unread: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct UpsertThreadResp {
    pub success: bool,
    #[serde(rename = "threadId", skip_serializing_if = "Option::is_none")]
    pub thread_id: Option<String>,
    pub created: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn upsert_thread_endpoint(
    user: AuthUser,
    State(s): State<TelegramBusinessInboxState>,
    Json(body): Json<UpsertThreadBody>,
) -> Json<UpsertThreadResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(UpsertThreadResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match parse_oid(&body.bot_id) {
        Some(o) => o,
        None => {
            return Json(UpsertThreadResp {
                error: Some("Invalid bot id.".to_owned()),
                ..Default::default()
            });
        }
    };
    match upsert_thread_from_message(
        &s.mongo,
        project_oid,
        bot_oid,
        &body.chat_id,
        body.last_message_preview.as_deref(),
        body.direction.as_deref(),
        body.had_unread.unwrap_or(false),
    )
    .await
    {
        Ok((id, created)) => Json(UpsertThreadResp {
            success: true,
            thread_id: Some(id),
            created,
            error: None,
        }),
        Err(e) => Json(UpsertThreadResp {
            error: Some(e),
            ..Default::default()
        }),
    }
}

/// Idempotent upsert called by the Telegram webhook handler after a new
/// inbound (or outbound) message is persisted. Returns `(threadId,
/// createdNow)`.
///
/// On first-time creation the routine also evaluates auto-assign rules
/// in priority order and applies the first match's assignment, tags,
/// priority, and SLA.
pub async fn upsert_thread_from_message(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_oid: ObjectId,
    chat_id: &str,
    preview: Option<&str>,
    direction: Option<&str>,
    had_unread: bool,
) -> Result<(String, bool), String> {
    let threads = mongo.collection::<Document>(THREADS);
    let now = bson::DateTime::now();
    let dir = direction.unwrap_or("inbound");

    if let Some(existing) = threads
        .find_one(doc! { "projectId": project_oid, "botId": bot_oid, "chatId": chat_id })
        .await
        .map_err(|e| format!("mongo: {e}"))?
    {
        let oid = existing
            .get_object_id("_id")
            .map_err(|_| "thread missing _id".to_owned())?;
        let mut set = doc! { "updatedAt": now, "lastMessageDirection": dir };
        if let Some(p) = preview {
            set.insert("lastMessagePreview", p);
        }
        let mut unset = doc! {};
        if dir == "inbound" {
            set.insert("lastInboundAt", now);
            // Reopen if previously resolved/archived.
            let status_now = existing.get_str("status").unwrap_or("open");
            if matches!(status_now, "resolved" | "archived") {
                set.insert("status", "open");
                unset.insert("resolvedAt", "");
                unset.insert("resolvedById", "");
            }
        } else {
            set.insert("lastOutboundAt", now);
            set.insert("lastAgentReplyAt", now);
            // First response stamp.
            if existing.get_datetime("firstResponseAt").is_err() {
                set.insert("firstResponseAt", now);
            }
        }
        let mut update = doc! { "$set": set };
        if dir == "inbound" && had_unread {
            update.insert("$inc", doc! { "unreadCount": 1i64 });
        }
        if !unset.is_empty() {
            update.insert("$unset", unset);
        }
        threads
            .update_one(doc! { "_id": oid }, update)
            .await
            .map_err(|e| format!("mongo: {e}"))?;
        return Ok((oid.to_hex(), false));
    }

    // Pull chat metadata to seed title / type.
    let chat = mongo
        .collection::<Document>(CHATS)
        .find_one(doc! { "botId": bot_oid, "chatId": chat_id })
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    let title = chat
        .as_ref()
        .and_then(|c| {
            c.get_str("title")
                .ok()
                .or_else(|| c.get_str("username").ok())
                .or_else(|| c.get_str("firstName").ok())
                .map(str::to_owned)
        })
        .unwrap_or_else(|| chat_id.to_owned());
    let chat_type = chat
        .as_ref()
        .and_then(|c| c.get_str("type").ok().map(str::to_owned))
        .unwrap_or_else(|| "private".to_owned());

    // Evaluate auto-assign rules in priority order.
    let mut assigned_agent: Option<String> = None;
    let mut tags: Vec<String> = vec![];
    let mut priority: String = "normal".to_owned();
    let mut sla_seconds: Option<i64> = None;
    if let Ok(cur) = mongo
        .collection::<Document>(RULES)
        .find(doc! { "projectId": project_oid, "enabled": true })
        .sort(doc! { "priority": 1, "createdAt": 1 })
        .await
    {
        use futures::TryStreamExt;
        let docs: Vec<Document> = cur.try_collect().await.unwrap_or_default();
        for d in &docs {
            let m = d
                .get_document("match")
                .map(|m| serde_json::to_value(m).unwrap_or(serde_json::Value::Null))
                .unwrap_or(serde_json::Value::Null);
            // Match by botId / chatType / keywordIn against preview.
            let bot_match = m
                .get("botId")
                .and_then(|v| v.as_str())
                .map(|b| parse_oid(b).map(|o| o == bot_oid).unwrap_or(false))
                .unwrap_or(true);
            let type_match = m
                .get("chatType")
                .and_then(|v| v.as_str())
                .map(|t| t == chat_type)
                .unwrap_or(true);
            let keyword_match = m
                .get("keywordIn")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    let kws: Vec<&str> = arr.iter().filter_map(|v| v.as_str()).collect();
                    if kws.is_empty() {
                        return true;
                    }
                    let preview_l = preview.unwrap_or("").to_lowercase();
                    kws.iter().any(|k| preview_l.contains(&k.to_lowercase()))
                })
                .unwrap_or(true);
            if !(bot_match && type_match && keyword_match) {
                continue;
            }
            // Match -> apply.
            let assign = d
                .get_document("assignTo")
                .map(|d| serde_json::to_value(d).unwrap_or(serde_json::Value::Null))
                .unwrap_or(serde_json::Value::Null);
            let kind = assign
                .get("kind")
                .and_then(|v| v.as_str())
                .unwrap_or("agent");
            let agent_ids: Vec<String> = assign
                .get("agentIds")
                .and_then(|v| v.as_array())
                .map(|a| {
                    a.iter()
                        .filter_map(|v| v.as_str().map(str::to_owned))
                        .collect()
                })
                .unwrap_or_default();
            match kind {
                "agent" | "random" => {
                    if !agent_ids.is_empty() {
                        if kind == "random" {
                            use rand::seq::SliceRandom;
                            let mut rng = rand::thread_rng();
                            assigned_agent = agent_ids.choose(&mut rng).cloned();
                        } else {
                            assigned_agent = agent_ids.first().cloned();
                        }
                    }
                }
                "round_robin" => {
                    if !agent_ids.is_empty() {
                        // Pick the agent with the smallest count of open threads.
                        let mut best: Option<(String, i64)> = None;
                        for aid in &agent_ids {
                            let c = threads
                                .count_documents(doc! {
                                    "projectId": project_oid,
                                    "assignedAgentId": aid,
                                    "status": { "$in": ["open", "pending"] },
                                })
                                .await
                                .unwrap_or(0) as i64;
                            match &best {
                                None => best = Some((aid.clone(), c)),
                                Some((_, bc)) if c < *bc => best = Some((aid.clone(), c)),
                                _ => {}
                            }
                        }
                        assigned_agent = best.map(|(a, _)| a);
                    }
                }
                "least_loaded" => {
                    // Same as round_robin for now.
                    if !agent_ids.is_empty() {
                        let mut best: Option<(String, i64)> = None;
                        for aid in &agent_ids {
                            let c = threads
                                .count_documents(doc! {
                                    "projectId": project_oid,
                                    "assignedAgentId": aid,
                                    "status": { "$in": ["open", "pending"] },
                                })
                                .await
                                .unwrap_or(0) as i64;
                            match &best {
                                None => best = Some((aid.clone(), c)),
                                Some((_, bc)) if c < *bc => best = Some((aid.clone(), c)),
                                _ => {}
                            }
                        }
                        assigned_agent = best.map(|(a, _)| a);
                    }
                }
                _ => {}
            }
            if let Ok(arr) = d.get_array("applyTags") {
                for v in arr {
                    if let Some(s) = v.as_str() {
                        tags.push(s.to_owned());
                    }
                }
            }
            if let Some(p) = d.get_str("setPriority").ok() {
                if valid_priority(p) {
                    priority = p.to_owned();
                }
            }
            if let Some(secs) = d
                .get_i64("setSlaSeconds")
                .or_else(|_| d.get_i32("setSlaSeconds").map(i64::from))
                .ok()
            {
                sla_seconds = Some(secs);
            }
            break;
        }
    }

    // Pick SLA from policies if no rule overrode.
    if sla_seconds.is_none() {
        if let Ok(cur) = mongo
            .collection::<Document>(SLA)
            .find(doc! { "projectId": project_oid })
            .await
        {
            use futures::TryStreamExt;
            let docs: Vec<Document> = cur.try_collect().await.unwrap_or_default();
            // Pick the one with the most matching tags.
            let mut best: Option<(i64, i64)> = None;
            for d in &docs {
                let policy_tags: Vec<String> = d
                    .get_array("applyToTags")
                    .map(|a| {
                        a.iter()
                            .filter_map(|v| v.as_str().map(str::to_owned))
                            .collect()
                    })
                    .unwrap_or_default();
                let score: i64 = if policy_tags.is_empty() {
                    0
                } else {
                    policy_tags.iter().filter(|t| tags.contains(t)).count() as i64
                };
                let secs = d
                    .get_i64("firstResponseSeconds")
                    .or_else(|_| d.get_i32("firstResponseSeconds").map(i64::from))
                    .unwrap_or(3600);
                if best.is_none() || best.as_ref().unwrap().0 < score {
                    best = Some((score, secs));
                }
            }
            sla_seconds = best.map(|(_, s)| s);
        }
    }

    let mut new_doc = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "chatId": chat_id,
        "type": &chat_type,
        "title": &title,
        "status": "open",
        "priority": &priority,
        "tags": tags.iter().cloned().map(Bson::String).collect::<Vec<_>>(),
        "internalNotesCount": 0i64,
        "unreadCount": if had_unread { 1i64 } else { 0i64 },
        "lastInboundAt": now,
        "lastMessageDirection": dir,
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(p) = preview {
        new_doc.insert("lastMessagePreview", p);
    }
    if let Some(a) = assigned_agent {
        new_doc.insert("assignedAgentId", a);
    }
    if let Some(secs) = sla_seconds {
        let due_ms = chrono::Utc::now().timestamp_millis() + secs * 1000;
        new_doc.insert("slaDueAt", bson::DateTime::from_millis(due_ms));
    }

    let res = threads
        .insert_one(new_doc)
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    let id = res
        .inserted_id
        .as_object_id()
        .map(|o| o.to_hex())
        .unwrap_or_default();
    Ok((id, true))
}
