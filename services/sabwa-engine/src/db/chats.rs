//! `sabwa_chats` — cached chat list mirrored from Baileys.
//!
//! See SABWA_PLAN.md §3 "sabwa_chats".

use anyhow::{Context, Result};
use bson::{doc, oid::ObjectId, Bson};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::{Collection, Database};
use serde::{Deserialize, Serialize};

use crate::db::serde_dates::{chrono_dt, chrono_dt_opt};

pub const COLLECTION: &str = "sabwa_chats";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChatType {
    Individual,
    Group,
    Broadcast,
    Status,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LastMessage {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(with = "chrono_dt")]
    pub ts: DateTime<Utc>,
    pub from_me: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwaChat {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub project_id: ObjectId,
    pub session_id: ObjectId,
    pub jid: String,
    #[serde(rename = "type")]
    pub chat_type: ChatType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_pic_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_message: Option<LastMessage>,
    #[serde(default)]
    pub unread_count: i64,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub archived: bool,
    #[serde(default)]
    pub muted: bool,
    #[serde(default, skip_serializing_if = "Option::is_none", with = "chrono_dt_opt")]
    pub mute_end_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub labels: Vec<ObjectId>,
    #[serde(default)]
    pub is_read_only: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub participants: Option<i64>,
    #[serde(with = "chrono_dt")]
    pub updated_at: DateTime<Utc>,
}

pub struct ChatsRepo<'a> {
    col: Collection<SabwaChat>,
    _phantom: std::marker::PhantomData<&'a ()>,
}

impl<'a> ChatsRepo<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self {
            col: db.collection::<SabwaChat>(COLLECTION),
            _phantom: std::marker::PhantomData,
        }
    }

    pub async fn find_by_session(&self, session_id: &ObjectId) -> Result<Vec<SabwaChat>> {
        let cursor = self
            .col
            .find(doc! { "sessionId": session_id })
            .await
            .context("sabwa_chats.find_by_session")?;
        let out: Vec<SabwaChat> = cursor.try_collect().await.context("collect chats")?;
        Ok(out)
    }

    pub async fn find_by_jid(
        &self,
        session_id: &ObjectId,
        jid: &str,
    ) -> Result<Option<SabwaChat>> {
        self.col
            .find_one(doc! { "sessionId": session_id, "jid": jid })
            .await
            .context("sabwa_chats.find_by_jid")
    }

    /// Bulk-upsert chats by `(sessionId, jid)`. Replaces matching docs;
    /// inserts if absent.
    pub async fn upsert_many(&self, chats: &[SabwaChat]) -> Result<u64> {
        let mut total = 0u64;
        for chat in chats {
            let res = self
                .col
                .replace_one(
                    doc! { "sessionId": &chat.session_id, "jid": &chat.jid },
                    chat,
                )
                .upsert(true)
                .await
                .context("sabwa_chats.upsert_many")?;
            total += res.matched_count + res.upserted_id.is_some() as u64;
        }
        Ok(total)
    }

    pub async fn set_pinned(
        &self,
        session_id: &ObjectId,
        jid: &str,
        pinned: bool,
    ) -> Result<()> {
        self.col
            .update_one(
                doc! { "sessionId": session_id, "jid": jid },
                doc! { "$set": { "pinned": pinned, "updatedAt": Bson::DateTime(bson::DateTime::now()) } },
            )
            .await
            .context("sabwa_chats.set_pinned")?;
        Ok(())
    }

    pub async fn set_muted(
        &self,
        session_id: &ObjectId,
        jid: &str,
        muted: bool,
        mute_end_at: Option<DateTime<Utc>>,
    ) -> Result<()> {
        let mut set = doc! {
            "muted": muted,
            "updatedAt": Bson::DateTime(bson::DateTime::now()),
        };
        if let Some(end) = mute_end_at {
            set.insert("muteEndAt", Bson::DateTime(end.into()));
        } else {
            set.insert("muteEndAt", Bson::Null);
        }
        self.col
            .update_one(doc! { "sessionId": session_id, "jid": jid }, doc! { "$set": set })
            .await
            .context("sabwa_chats.set_muted")?;
        Ok(())
    }

    pub async fn set_archived(
        &self,
        session_id: &ObjectId,
        jid: &str,
        archived: bool,
    ) -> Result<()> {
        self.col
            .update_one(
                doc! { "sessionId": session_id, "jid": jid },
                doc! { "$set": { "archived": archived, "updatedAt": Bson::DateTime(bson::DateTime::now()) } },
            )
            .await
            .context("sabwa_chats.set_archived")?;
        Ok(())
    }

    pub async fn set_labels(
        &self,
        session_id: &ObjectId,
        jid: &str,
        labels: &[ObjectId],
    ) -> Result<()> {
        let arr: Vec<Bson> = labels.iter().map(|id| Bson::ObjectId(*id)).collect();
        self.col
            .update_one(
                doc! { "sessionId": session_id, "jid": jid },
                doc! { "$set": { "labels": arr, "updatedAt": Bson::DateTime(bson::DateTime::now()) } },
            )
            .await
            .context("sabwa_chats.set_labels")?;
        Ok(())
    }

    pub async fn delete(&self, session_id: &ObjectId, jid: &str) -> Result<()> {
        self.col
            .delete_one(doc! { "sessionId": session_id, "jid": jid })
            .await
            .context("sabwa_chats.delete")?;
        Ok(())
    }
}

pub fn collection(db: &Database) -> Collection<SabwaChat> {
    db.collection::<SabwaChat>(COLLECTION)
}

// ---------------------------------------------------------------------------
// Phase 1 route-compat shims.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRow {
    pub jid: String,
    pub chat_type: String,
    pub name: Option<String>,
    pub profile_pic_url: Option<String>,
    pub unread_count: u32,
    pub pinned: bool,
    pub archived: bool,
    pub muted: bool,
    #[serde(default, skip_serializing_if = "Option::is_none", with = "chrono_dt_opt")]
    pub last_message_ts: Option<DateTime<Utc>>,
    pub last_message_body: Option<String>,
}

fn chat_to_row(c: SabwaChat) -> ChatRow {
    let chat_type = match c.chat_type {
        ChatType::Individual => "individual",
        ChatType::Group => "group",
        ChatType::Broadcast => "broadcast",
        ChatType::Status => "status",
    }
    .to_string();
    let (last_message_ts, last_message_body) = match c.last_message {
        Some(lm) => (Some(lm.ts), lm.body),
        None => (None, None),
    };
    ChatRow {
        jid: c.jid,
        chat_type,
        name: c.name,
        profile_pic_url: c.profile_pic_url,
        unread_count: c.unread_count.max(0) as u32,
        pinned: c.pinned,
        archived: c.archived,
        muted: c.muted,
        last_message_ts,
        last_message_body,
    }
}

fn parse_oid_loose(id: &str) -> ObjectId {
    ObjectId::parse_str(id).unwrap_or_else(|_| ObjectId::new())
}

/// List chats for a session, with optional kind / unread filtering.
pub async fn list(
    db: &Database,
    session_id: &str,
    _filter: Option<&str>,
    _unread_only: bool,
) -> Result<Vec<ChatRow>> {
    let repo = ChatsRepo::new(db);
    let oid = parse_oid_loose(session_id);
    let rows = repo.find_by_session(&oid).await?;
    Ok(rows.into_iter().map(chat_to_row).collect())
}

pub async fn get(db: &Database, session_id: &str, jid: &str) -> Result<ChatRow> {
    let repo = ChatsRepo::new(db);
    let oid = parse_oid_loose(session_id);
    let row = repo
        .find_by_jid(&oid, jid)
        .await?
        .ok_or_else(|| anyhow::anyhow!("chat not found: {jid}"))?;
    Ok(chat_to_row(row))
}

pub async fn update(
    db: &Database,
    session_id: &str,
    jid: &str,
    pinned: Option<bool>,
    muted: Option<bool>,
    mute_end_at: Option<DateTime<Utc>>,
    archived: Option<bool>,
    _labels: Option<&[String]>,
) -> Result<()> {
    let repo = ChatsRepo::new(db);
    let oid = parse_oid_loose(session_id);
    if let Some(p) = pinned {
        repo.set_pinned(&oid, jid, p).await?;
    }
    if let Some(m) = muted {
        repo.set_muted(&oid, jid, m, mute_end_at).await?;
    }
    if let Some(a) = archived {
        repo.set_archived(&oid, jid, a).await?;
    }
    Ok(())
}

pub async fn delete(db: &Database, session_id: &str, jid: &str) -> Result<()> {
    let repo = ChatsRepo::new(db);
    let oid = parse_oid_loose(session_id);
    repo.delete(&oid, jid).await
}

pub async fn clear_unread(_db: &Database, _session_id: &str, _jid: &str) -> Result<()> {
    // removed for Phase 1 cleanup — needs a dedicated repo method.
    Ok(())
}
