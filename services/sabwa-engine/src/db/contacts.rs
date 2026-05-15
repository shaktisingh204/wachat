//! `sabwa_contacts` — contact list cache.
//!
//! See SABWA_PLAN.md §3 "sabwa_contacts".

use anyhow::{Context, Result};
use bson::{doc, oid::ObjectId, Bson};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::{Collection, Database};
use serde::{Deserialize, Serialize};

use crate::db::serde_dates::chrono_dt_opt;

pub const COLLECTION: &str = "sabwa_contacts";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwaContact {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub project_id: ObjectId,
    pub session_id: ObjectId,
    pub jid: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone_e164: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub push_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_pic_url: Option<String>,
    #[serde(default)]
    pub is_business: bool,
    #[serde(default)]
    pub is_blocked: bool,
    #[serde(default)]
    pub is_my_contact: bool,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_fields: Option<bson::Document>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", with = "chrono_dt_opt")]
    pub last_interaction_at: Option<DateTime<Utc>>,
}

pub struct ContactsRepo<'a> {
    col: Collection<SabwaContact>,
    _phantom: std::marker::PhantomData<&'a ()>,
}

impl<'a> ContactsRepo<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self {
            col: db.collection::<SabwaContact>(COLLECTION),
            _phantom: std::marker::PhantomData,
        }
    }

    pub async fn upsert_many(&self, contacts: &[SabwaContact]) -> Result<u64> {
        let mut total = 0u64;
        for c in contacts {
            let res = self
                .col
                .replace_one(doc! { "sessionId": &c.session_id, "jid": &c.jid }, c)
                .upsert(true)
                .await
                .context("sabwa_contacts.upsert_many")?;
            total += res.matched_count + res.upserted_id.is_some() as u64;
        }
        Ok(total)
    }

    pub async fn find_by_session(&self, session_id: &ObjectId) -> Result<Vec<SabwaContact>> {
        let cursor = self
            .col
            .find(doc! { "sessionId": session_id })
            .await
            .context("sabwa_contacts.find_by_session")?;
        let out: Vec<SabwaContact> =
            cursor.try_collect().await.context("collect contacts")?;
        Ok(out)
    }

    pub async fn find_by_jid(
        &self,
        session_id: &ObjectId,
        jid: &str,
    ) -> Result<Option<SabwaContact>> {
        self.col
            .find_one(doc! { "sessionId": session_id, "jid": jid })
            .await
            .context("sabwa_contacts.find_by_jid")
    }

    pub async fn set_tags(
        &self,
        session_id: &ObjectId,
        jid: &str,
        tags: &[String],
    ) -> Result<()> {
        let arr: Vec<Bson> = tags.iter().map(|t| Bson::String(t.clone())).collect();
        self.col
            .update_one(
                doc! { "sessionId": session_id, "jid": jid },
                doc! { "$set": { "tags": arr } },
            )
            .await
            .context("sabwa_contacts.set_tags")?;
        Ok(())
    }

    pub async fn set_blocked(
        &self,
        session_id: &ObjectId,
        jid: &str,
        blocked: bool,
    ) -> Result<()> {
        self.col
            .update_one(
                doc! { "sessionId": session_id, "jid": jid },
                doc! { "$set": { "isBlocked": blocked } },
            )
            .await
            .context("sabwa_contacts.set_blocked")?;
        Ok(())
    }
}

pub fn collection(db: &Database) -> Collection<SabwaContact> {
    db.collection::<SabwaContact>(COLLECTION)
}

// ---------------------------------------------------------------------------
// Phase 1 route-compat shims.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactRow {
    pub jid: String,
    pub phone_e164: Option<String>,
    pub name: Option<String>,
    pub push_name: Option<String>,
    pub profile_pic_url: Option<String>,
    pub is_business: bool,
    pub is_blocked: bool,
    pub is_my_contact: bool,
    pub tags: Vec<String>,
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", with = "chrono_dt_opt")]
    pub last_interaction_at: Option<DateTime<Utc>>,
}

fn contact_to_row(c: SabwaContact) -> ContactRow {
    ContactRow {
        jid: c.jid,
        phone_e164: c.phone_e164,
        name: c.name,
        push_name: c.push_name,
        profile_pic_url: c.profile_pic_url,
        is_business: c.is_business,
        is_blocked: c.is_blocked,
        is_my_contact: c.is_my_contact,
        tags: c.tags,
        notes: c.notes,
        last_interaction_at: c.last_interaction_at,
    }
}

fn parse_oid_loose(id: &str) -> ObjectId {
    ObjectId::parse_str(id).unwrap_or_else(|_| ObjectId::new())
}

pub async fn list(
    db: &Database,
    session_id: &str,
    _search: Option<&str>,
    _tag: Option<&str>,
) -> Result<Vec<ContactRow>> {
    let repo = ContactsRepo::new(db);
    let oid = parse_oid_loose(session_id);
    let rows = repo.find_by_session(&oid).await?;
    Ok(rows.into_iter().map(contact_to_row).collect())
}

pub async fn get(db: &Database, session_id: &str, jid: &str) -> Result<ContactRow> {
    let repo = ContactsRepo::new(db);
    let oid = parse_oid_loose(session_id);
    let row = repo
        .find_by_jid(&oid, jid)
        .await?
        .ok_or_else(|| anyhow::anyhow!("contact not found: {jid}"))?;
    Ok(contact_to_row(row))
}

pub async fn update(
    db: &Database,
    session_id: &str,
    jid: &str,
    tags: Option<&[String]>,
    _notes: Option<&str>,
    _custom_fields: Option<&serde_json::Value>,
) -> Result<()> {
    let repo = ContactsRepo::new(db);
    let oid = parse_oid_loose(session_id);
    if let Some(t) = tags {
        repo.set_tags(&oid, jid, t).await?;
    }
    Ok(())
}
