//! `sabwa_messages` — append-only message log.
//!
//! See SABWA_PLAN.md §3 "sabwa_messages". Indexes (created elsewhere):
//! `(sessionId, chatJid, ts)`, `(sessionId, messageId)` unique,
//! `(sessionId, starred)`.

use anyhow::{Context, Result};
use bson::{doc, oid::ObjectId, Bson};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::{Collection, Database};
use serde::{Deserialize, Serialize};

use crate::db::serde_dates::{chrono_dt, chrono_dt_opt};

pub const COLLECTION: &str = "sabwa_messages";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MessageType {
    Text,
    Image,
    Video,
    Audio,
    Voice,
    Document,
    Sticker,
    Location,
    Contact,
    Poll,
    Reaction,
    System,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MessageStatus {
    Sending,
    Sent,
    Delivered,
    Read,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reaction {
    pub jid: String,
    pub emoji: String,
    #[serde(with = "chrono_dt")]
    pub ts: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwaMessage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub project_id: ObjectId,
    pub session_id: ObjectId,
    pub chat_jid: String,
    /// Baileys' `key.id` — unique per `(sessionId, messageId)`.
    pub message_id: String,
    pub from_jid: String,
    pub from_me: bool,
    #[serde(rename = "type")]
    pub message_type: MessageType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_mime: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_size: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quoted_message_id: Option<String>,
    #[serde(default)]
    pub reactions: Vec<Reaction>,
    pub status: MessageStatus,
    #[serde(default)]
    pub forwarded: bool,
    #[serde(default)]
    pub starred: bool,
    #[serde(with = "chrono_dt")]
    pub ts: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none", with = "chrono_dt_opt")]
    pub edited_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none", with = "chrono_dt_opt")]
    pub deleted_at: Option<DateTime<Utc>>,
}

/// One page of messages plus the cursor to fetch the next older page.
#[derive(Debug, Clone)]
pub struct MessagesPage {
    pub messages: Vec<SabwaMessage>,
    /// `ts` of the oldest message in this page — pass as `before` to paginate
    /// backwards. `None` once we've reached the start of the chat.
    pub next_cursor: Option<DateTime<Utc>>,
}

pub struct MessagesRepo<'a> {
    col: Collection<SabwaMessage>,
    _phantom: std::marker::PhantomData<&'a ()>,
}

impl<'a> MessagesRepo<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self {
            col: db.collection::<SabwaMessage>(COLLECTION),
            _phantom: std::marker::PhantomData,
        }
    }

    /// Bulk insert. `ordered=false` so a single duplicate `messageId` doesn't
    /// abort the whole batch (relies on the unique index on
    /// `(sessionId, messageId)`).
    pub async fn insert_many(&self, msgs: &[SabwaMessage]) -> Result<u64> {
        if msgs.is_empty() {
            return Ok(0);
        }
        let res = self
            .col
            .insert_many(msgs)
            .ordered(false)
            .await
            .context("sabwa_messages.insert_many")?;
        Ok(res.inserted_ids.len() as u64)
    }

    /// Cursor-paginated chat messages, newest first. `before` excludes any
    /// message with `ts >= before` so paging by `next_cursor` is stable.
    pub async fn find_by_chat(
        &self,
        session_id: &ObjectId,
        chat_jid: &str,
        before: Option<DateTime<Utc>>,
        limit: i64,
    ) -> Result<MessagesPage> {
        let mut filter = doc! {
            "sessionId": session_id,
            "chatJid": chat_jid,
        };
        if let Some(ts) = before {
            filter.insert("ts", doc! { "$lt": Bson::DateTime(ts.into()) });
        }

        let cursor = self
            .col
            .find(filter)
            .sort(doc! { "ts": -1 })
            .limit(limit.max(1))
            .await
            .context("sabwa_messages.find_by_chat")?;

        let messages: Vec<SabwaMessage> =
            cursor.try_collect().await.context("collect messages")?;
        let next_cursor = messages.last().map(|m| m.ts);
        Ok(MessagesPage {
            messages,
            next_cursor,
        })
    }

    pub async fn update_status(
        &self,
        session_id: &ObjectId,
        message_id: &str,
        status: MessageStatus,
    ) -> Result<()> {
        let status_bson = bson::to_bson(&status).context("encode MessageStatus")?;
        self.col
            .update_one(
                doc! { "sessionId": session_id, "messageId": message_id },
                doc! { "$set": { "status": status_bson } },
            )
            .await
            .context("sabwa_messages.update_status")?;
        Ok(())
    }

    pub async fn set_starred(
        &self,
        session_id: &ObjectId,
        message_id: &str,
        starred: bool,
    ) -> Result<()> {
        self.col
            .update_one(
                doc! { "sessionId": session_id, "messageId": message_id },
                doc! { "$set": { "starred": starred } },
            )
            .await
            .context("sabwa_messages.set_starred")?;
        Ok(())
    }

    pub async fn find_starred(&self, session_id: &ObjectId) -> Result<Vec<SabwaMessage>> {
        let cursor = self
            .col
            .find(doc! { "sessionId": session_id, "starred": true })
            .sort(doc! { "ts": -1 })
            .await
            .context("sabwa_messages.find_starred")?;
        let out: Vec<SabwaMessage> = cursor.try_collect().await.context("collect starred")?;
        Ok(out)
    }

    /// Naive text search over `body` and `caption`. For production use, build
    /// a text index (`createIndex({ body: 'text', caption: 'text' })`) and
    /// swap this to `$text`.
    pub async fn search_text(
        &self,
        session_id: &ObjectId,
        query: &str,
        limit: i64,
    ) -> Result<Vec<SabwaMessage>> {
        // Escape regex metacharacters defensively.
        let escaped = regex_escape(query);
        let pattern = bson::Regex {
            pattern: escaped,
            options: "i".to_string(),
        };
        let cursor = self
            .col
            .find(doc! {
                "sessionId": session_id,
                "$or": [
                    { "body": Bson::RegularExpression(pattern.clone()) },
                    { "caption": Bson::RegularExpression(pattern) },
                ],
            })
            .sort(doc! { "ts": -1 })
            .limit(limit.max(1))
            .await
            .context("sabwa_messages.search_text")?;
        let out: Vec<SabwaMessage> = cursor.try_collect().await.context("collect search")?;
        Ok(out)
    }
}

fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        if matches!(
            ch,
            '.' | '+' | '*' | '?' | '(' | ')' | '[' | ']' | '{' | '}' | '|' | '^' | '$' | '\\'
        ) {
            out.push('\\');
        }
        out.push(ch);
    }
    out
}

pub fn collection(db: &Database) -> Collection<SabwaMessage> {
    db.collection::<SabwaMessage>(COLLECTION)
}

// ---------------------------------------------------------------------------
// Phase 1 route-compat shims.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageRow {
    pub message_id: String,
    pub chat_jid: String,
    pub from_jid: String,
    pub from_me: bool,
    pub kind: String,
    pub body: Option<String>,
    pub media_url: Option<String>,
    pub media_mime: Option<String>,
    pub caption: Option<String>,
    pub quoted_message_id: Option<String>,
    pub status: String,
    pub starred: bool,
    pub forwarded: bool,
    pub ts: DateTime<Utc>,
    pub edited_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub reactions: Vec<serde_json::Value>,
}

fn msg_kind_str(t: MessageType) -> &'static str {
    match t {
        MessageType::Text => "text",
        MessageType::Image => "image",
        MessageType::Video => "video",
        MessageType::Audio => "audio",
        MessageType::Voice => "voice",
        MessageType::Document => "document",
        MessageType::Sticker => "sticker",
        MessageType::Location => "location",
        MessageType::Contact => "contact",
        MessageType::Poll => "poll",
        MessageType::Reaction => "reaction",
        MessageType::System => "system",
    }
}

fn msg_status_str(s: MessageStatus) -> &'static str {
    match s {
        MessageStatus::Sending => "sending",
        MessageStatus::Sent => "sent",
        MessageStatus::Delivered => "delivered",
        MessageStatus::Read => "read",
        MessageStatus::Failed => "failed",
    }
}

fn message_to_row(m: SabwaMessage) -> MessageRow {
    MessageRow {
        message_id: m.message_id,
        chat_jid: m.chat_jid,
        from_jid: m.from_jid,
        from_me: m.from_me,
        kind: msg_kind_str(m.message_type).to_string(),
        body: m.body,
        media_url: m.media_url,
        media_mime: m.media_mime,
        caption: m.caption,
        quoted_message_id: m.quoted_message_id,
        status: msg_status_str(m.status).to_string(),
        starred: m.starred,
        forwarded: m.forwarded,
        ts: m.ts,
        edited_at: m.edited_at,
        deleted_at: m.deleted_at,
        reactions: m
            .reactions
            .into_iter()
            .map(|r| serde_json::json!({ "jid": r.jid, "emoji": r.emoji, "ts": r.ts }))
            .collect(),
    }
}

fn parse_oid_loose(id: &str) -> ObjectId {
    ObjectId::parse_str(id).unwrap_or_else(|_| ObjectId::new())
}

/// Cursor-paginated chat history. Returns `(rows, next_cursor)`.
pub async fn list(
    db: &Database,
    session_id: &str,
    chat_jid: &str,
    before: Option<DateTime<Utc>>,
    limit: u32,
) -> Result<(Vec<MessageRow>, Option<DateTime<Utc>>)> {
    let repo = MessagesRepo::new(db);
    let oid = parse_oid_loose(session_id);
    let page = repo
        .find_by_chat(&oid, chat_jid, before, limit as i64)
        .await?;
    let rows: Vec<MessageRow> = page.messages.into_iter().map(message_to_row).collect();
    Ok((rows, page.next_cursor))
}

pub async fn list_starred(db: &Database, session_id: &str) -> Result<Vec<MessageRow>> {
    let repo = MessagesRepo::new(db);
    let oid = parse_oid_loose(session_id);
    let rows = repo.find_starred(&oid).await?;
    Ok(rows.into_iter().map(message_to_row).collect())
}

pub async fn search(
    db: &Database,
    session_id: &str,
    query: &str,
    _chat_jid: Option<&str>,
    limit: u32,
) -> Result<Vec<MessageRow>> {
    let repo = MessagesRepo::new(db);
    let oid = parse_oid_loose(session_id);
    let rows = repo.search_text(&oid, query, limit as i64).await?;
    Ok(rows.into_iter().map(message_to_row).collect())
}

pub async fn set_starred(
    db: &Database,
    session_id: &str,
    message_id: &str,
    starred: bool,
) -> Result<()> {
    let repo = MessagesRepo::new(db);
    let oid = parse_oid_loose(session_id);
    repo.set_starred(&oid, message_id, starred).await
}

pub async fn delete_for_chat(_db: &Database, _session_id: &str, _jid: &str) -> Result<()> {
    // removed for Phase 1 cleanup — bulk message delete lands with Phase 2.
    Ok(())
}
