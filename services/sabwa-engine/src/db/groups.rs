//! `sabwa_groups` — group-specific metadata cache.
//!
//! See SABWA_PLAN.md §3 "sabwa_groups".

use anyhow::{Context, Result};
use bson::{doc, oid::ObjectId, Bson};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::{Collection, Database};
use serde::{Deserialize, Serialize};

pub const COLLECTION: &str = "sabwa_groups";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Participant {
    pub jid: String,
    #[serde(default)]
    pub is_admin: bool,
    #[serde(default)]
    pub is_super_admin: bool,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwaGroup {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub project_id: ObjectId,
    pub session_id: ObjectId,
    /// Always ends in `@g.us`.
    pub jid: String,
    pub subject: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creator: Option<String>,
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    pub participants: Vec<Participant>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub invite_code: Option<String>,
    #[serde(default)]
    pub announcement: bool,
    #[serde(default)]
    pub restrict: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ephemeral_duration: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

pub struct GroupsRepo<'a> {
    col: Collection<SabwaGroup>,
    _phantom: std::marker::PhantomData<&'a ()>,
}

impl<'a> GroupsRepo<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self {
            col: db.collection::<SabwaGroup>(COLLECTION),
            _phantom: std::marker::PhantomData,
        }
    }

    pub async fn find_by_jid(
        &self,
        session_id: &ObjectId,
        jid: &str,
    ) -> Result<Option<SabwaGroup>> {
        self.col
            .find_one(doc! { "sessionId": session_id, "jid": jid })
            .await
            .context("sabwa_groups.find_by_jid")
    }

    pub async fn upsert(&self, group: &SabwaGroup) -> Result<()> {
        self.col
            .replace_one(
                doc! { "sessionId": &group.session_id, "jid": &group.jid },
                group,
            )
            .upsert(true)
            .await
            .context("sabwa_groups.upsert")?;
        Ok(())
    }

    pub async fn update_participants(
        &self,
        session_id: &ObjectId,
        jid: &str,
        participants: &[Participant],
    ) -> Result<()> {
        let arr = bson::to_bson(participants).context("encode participants")?;
        self.col
            .update_one(
                doc! { "sessionId": session_id, "jid": jid },
                doc! { "$set": { "participants": arr } },
            )
            .await
            .context("sabwa_groups.update_participants")?;
        Ok(())
    }

    pub async fn set_category(
        &self,
        session_id: &ObjectId,
        jid: &str,
        category: Option<&str>,
    ) -> Result<()> {
        let value = match category {
            Some(c) => Bson::String(c.to_string()),
            None => Bson::Null,
        };
        self.col
            .update_one(
                doc! { "sessionId": session_id, "jid": jid },
                doc! { "$set": { "category": value } },
            )
            .await
            .context("sabwa_groups.set_category")?;
        Ok(())
    }

    pub async fn list_by_session(&self, session_id: &ObjectId) -> Result<Vec<SabwaGroup>> {
        let cursor = self
            .col
            .find(doc! { "sessionId": session_id })
            .await
            .context("sabwa_groups.list_by_session")?;
        let out: Vec<SabwaGroup> = cursor.try_collect().await.context("collect groups")?;
        Ok(out)
    }
}

pub fn collection(db: &Database) -> Collection<SabwaGroup> {
    db.collection::<SabwaGroup>(COLLECTION)
}

// ---------------------------------------------------------------------------
// Phase 1 route-compat shims.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupParticipantRow {
    pub jid: String,
    pub is_admin: bool,
    pub is_super_admin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupRow {
    pub jid: String,
    pub subject: String,
    pub description: Option<String>,
    pub creator: Option<String>,
    pub participant_count: u32,
    pub category: Option<String>,
    pub announcement: bool,
    pub restrict: bool,
    pub ephemeral_duration: Option<u32>,
    pub participants: Vec<GroupParticipantRow>,
}

fn group_to_row(g: SabwaGroup) -> GroupRow {
    let participant_count = g.participants.len() as u32;
    GroupRow {
        jid: g.jid,
        subject: g.subject,
        description: g.description,
        creator: g.creator,
        participant_count,
        category: g.category,
        announcement: g.announcement,
        restrict: g.restrict,
        ephemeral_duration: g.ephemeral_duration.and_then(|v| u32::try_from(v).ok()),
        participants: g
            .participants
            .into_iter()
            .map(|p| GroupParticipantRow {
                jid: p.jid,
                is_admin: p.is_admin,
                is_super_admin: p.is_super_admin,
            })
            .collect(),
    }
}

fn parse_oid_loose(id: &str) -> ObjectId {
    ObjectId::parse_str(id).unwrap_or_else(|_| ObjectId::new())
}

pub async fn list(
    db: &Database,
    session_id: &str,
    _category: Option<&str>,
) -> Result<Vec<GroupRow>> {
    let repo = GroupsRepo::new(db);
    let oid = parse_oid_loose(session_id);
    let rows = repo.list_by_session(&oid).await?;
    Ok(rows.into_iter().map(group_to_row).collect())
}

pub async fn get(db: &Database, session_id: &str, jid: &str) -> Result<GroupRow> {
    let repo = GroupsRepo::new(db);
    let oid = parse_oid_loose(session_id);
    let row = repo
        .find_by_jid(&oid, jid)
        .await?
        .ok_or_else(|| anyhow::anyhow!("group not found: {jid}"))?;
    Ok(group_to_row(row))
}

pub async fn set_category(
    db: &Database,
    session_id: &str,
    jid: &str,
    category: &str,
) -> Result<()> {
    let repo = GroupsRepo::new(db);
    let oid = parse_oid_loose(session_id);
    repo.set_category(&oid, jid, Some(category)).await
}

pub async fn get_invite_code(
    db: &Database,
    session_id: &str,
    jid: &str,
) -> Result<Option<String>> {
    let repo = GroupsRepo::new(db);
    let oid = parse_oid_loose(session_id);
    Ok(repo.find_by_jid(&oid, jid).await?.and_then(|g| g.invite_code))
}
