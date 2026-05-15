//! `sabwa_sessions` — one document per linked WhatsApp number per project.
//!
//! See SABWA_PLAN.md §3 "sabwa_sessions".

use anyhow::{Context, Result};
use bson::{doc, oid::ObjectId, Binary, Bson};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::{Collection, Database};
use serde::{Deserialize, Serialize};

use crate::crypto::AuthStateCrypto;

pub const COLLECTION: &str = "sabwa_sessions";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Pending,
    Connected,
    LoggedOut,
    Banned,
    Error,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PairMethod {
    Qr,
    Code,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RateProfile {
    Safe,
    Normal,
    Aggressive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub battery_level: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BanSignal {
    pub ts: DateTime<Utc>,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwaSession {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub project_id: ObjectId,
    pub user_id: ObjectId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone_e164: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub push_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_pic_url: Option<String>,
    pub status: SessionStatus,
    pub pair_method: PairMethod,
    /// Encrypted Baileys creds blob — persisted as a BSON Binary blob.
    pub auth_state: Binary,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_meta: Option<DeviceMeta>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_connected_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub worker_node_id: Option<String>,
    #[serde(default)]
    pub ban_signals: Vec<BanSignal>,
    pub rate_limit_profile: RateProfile,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl SabwaSession {
    /// Convenience constructor — wraps a raw byte slice as a generic-subtype
    /// BSON Binary so callers don't need to import `bson::Binary`.
    pub fn auth_state_from_bytes(bytes: Vec<u8>) -> Binary {
        Binary {
            subtype: bson::spec::BinarySubtype::Generic,
            bytes,
        }
    }
}

pub struct SessionsRepo<'a> {
    col: Collection<SabwaSession>,
    _phantom: std::marker::PhantomData<&'a ()>,
}

impl<'a> SessionsRepo<'a> {
    /// Construct a repo from a `Database` handle. `Collection<T>` wraps an
    /// `Arc` internally so cloning it on each `new()` is cheap. The `'a`
    /// lifetime is preserved for API compatibility with future call-sites
    /// that want to borrow a shared collection cache.
    pub fn new(db: &'a Database) -> Self {
        Self {
            col: db.collection::<SabwaSession>(COLLECTION),
            _phantom: std::marker::PhantomData,
        }
    }

    pub async fn find_by_id(&self, id: &ObjectId) -> Result<Option<SabwaSession>> {
        self.col
            .find_one(doc! { "_id": id })
            .await
            .context("sabwa_sessions.find_by_id")
    }

    pub async fn find_by_project(&self, project_id: &ObjectId) -> Result<Vec<SabwaSession>> {
        let cursor = self
            .col
            .find(doc! { "projectId": project_id })
            .await
            .context("sabwa_sessions.find_by_project")?;
        let out: Vec<SabwaSession> = cursor.try_collect().await.context("collect sessions")?;
        Ok(out)
    }

    pub async fn insert(&self, session: &SabwaSession) -> Result<ObjectId> {
        let res = self
            .col
            .insert_one(session)
            .await
            .context("sabwa_sessions.insert")?;
        res.inserted_id
            .as_object_id()
            .context("inserted_id was not ObjectId")
    }

    pub async fn update_status(&self, id: &ObjectId, status: SessionStatus) -> Result<()> {
        let status_bson = bson::to_bson(&status).context("encode SessionStatus")?;
        self.col
            .update_one(
                doc! { "_id": id },
                doc! {
                    "$set": {
                        "status": status_bson,
                        "updatedAt": Bson::DateTime(bson::DateTime::now()),
                    }
                },
            )
            .await
            .context("sabwa_sessions.update_status")?;
        Ok(())
    }

    /// Persist `auth_state`, encrypting it first with the provided crypto
    /// helper. This is the only sanctioned write path — the raw blob from
    /// Baileys must never hit Mongo unencrypted.
    pub async fn update_auth_state(
        &self,
        id: &ObjectId,
        plaintext: &[u8],
        crypto: &AuthStateCrypto,
    ) -> Result<()> {
        let ciphertext = crypto
            .encrypt(plaintext)
            .context("encrypt auth_state for sabwa_sessions")?;
        let bin = Binary {
            subtype: bson::spec::BinarySubtype::Generic,
            bytes: ciphertext,
        };
        self.col
            .update_one(
                doc! { "_id": id },
                doc! {
                    "$set": {
                        "authState": Bson::Binary(bin),
                        "updatedAt": Bson::DateTime(bson::DateTime::now()),
                    }
                },
            )
            .await
            .context("sabwa_sessions.update_auth_state")?;
        Ok(())
    }

    pub async fn delete(&self, id: &ObjectId) -> Result<()> {
        self.col
            .delete_one(doc! { "_id": id })
            .await
            .context("sabwa_sessions.delete")?;
        Ok(())
    }
}

/// Convenience helper to fetch the typed collection from a `Database`.
pub fn collection(db: &Database) -> Collection<SabwaSession> {
    db.collection::<SabwaSession>(COLLECTION)
}

// ---------------------------------------------------------------------------
// Phase 1 route-compat shims.
//
// The Repo<'a> API above takes ObjectIds. Route handlers currently pass
// String ids and expect String-shaped projections. The thin row + free
// helpers below adapt between the two without forcing the routes to grow
// ObjectId-parsing boilerplate.
// ---------------------------------------------------------------------------

/// Wire-shape projection of a `sabwa_sessions` row used by route handlers.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRow {
    pub id: String,
    pub project_id: String,
    pub user_id: String,
    pub phone_e164: Option<String>,
    pub push_name: Option<String>,
    pub status: String,
}

fn to_row(s: SabwaSession) -> SessionRow {
    SessionRow {
        id: s.id.map(|o| o.to_hex()).unwrap_or_default(),
        project_id: s.project_id.to_hex(),
        user_id: s.user_id.to_hex(),
        phone_e164: s.phone_e164,
        push_name: s.push_name,
        status: match s.status {
            SessionStatus::Pending => "pending",
            SessionStatus::Connected => "connected",
            SessionStatus::LoggedOut => "logged_out",
            SessionStatus::Banned => "banned",
            SessionStatus::Error => "error",
        }
        .to_string(),
    }
}

/// List sessions for a project id (string form of ObjectId).
pub async fn list_by_project(db: &Database, project_id: &str) -> Result<Vec<SessionRow>> {
    let repo = SessionsRepo::new(db);
    let oid = ObjectId::parse_str(project_id).unwrap_or_else(|_| ObjectId::new());
    let rows = repo.find_by_project(&oid).await?;
    Ok(rows.into_iter().map(to_row).collect())
}

/// Get a single session by id (string form of ObjectId).
pub async fn get(db: &Database, id: &str) -> Result<SessionRow> {
    let repo = SessionsRepo::new(db);
    let oid = ObjectId::parse_str(id)
        .map_err(|_| anyhow::anyhow!("invalid session id: {id}"))?;
    let row = repo
        .find_by_id(&oid)
        .await?
        .ok_or_else(|| anyhow::anyhow!("session not found: {id}"))?;
    Ok(to_row(row))
}

/// Delete a session by id (string form of ObjectId).
pub async fn delete(db: &Database, id: &str) -> Result<()> {
    let repo = SessionsRepo::new(db);
    let oid = ObjectId::parse_str(id)
        .map_err(|_| anyhow::anyhow!("invalid session id: {id}"))?;
    repo.delete(&oid).await
}

/// Update mutable session metadata. Phase 1: only logs and returns Ok —
/// real label / rate-profile persistence lands when the routes own real
/// admin pages.
pub async fn update(
    _db: &Database,
    _id: &str,
    _label: Option<&str>,
    _rate_limit_profile: Option<&str>,
) -> Result<()> {
    // removed for Phase 1 cleanup — admin metadata mutators land later.
    Ok(())
}

// ---------------------------------------------------------------------------
// Encrypted auth-state helpers.
//
// The Baileys credential blob is sensitive — it grants full control of the
// linked WhatsApp number. We never persist it in the clear; instead, every
// read/write path goes through the helpers below which wrap
// [`AuthStateCrypto`] (AES-256-GCM with a fresh per-write nonce).
// ---------------------------------------------------------------------------

/// Encrypt `plaintext` with `crypto` and persist it onto
/// `sabwa_sessions.authState` for the row identified by `session_id`
/// (string form of the Mongo ObjectId).
pub async fn update_auth_state_encrypted(
    db: &Database,
    session_id: &str,
    plaintext: &[u8],
    crypto: &AuthStateCrypto,
) -> Result<()> {
    let oid = ObjectId::parse_str(session_id)
        .map_err(|_| anyhow::anyhow!("invalid session id: {session_id}"))?;
    let repo = SessionsRepo::new(db);
    repo.update_auth_state(&oid, plaintext, crypto).await
}

/// Read `sabwa_sessions.authState` for `session_id` and decrypt it with
/// `crypto`. Returns `Ok(None)` if the row doesn't exist or has no auth
/// state recorded.
pub async fn load_auth_state_decrypted(
    db: &Database,
    session_id: &str,
    crypto: &AuthStateCrypto,
) -> Result<Option<Vec<u8>>> {
    let oid = ObjectId::parse_str(session_id)
        .map_err(|_| anyhow::anyhow!("invalid session id: {session_id}"))?;
    let repo = SessionsRepo::new(db);
    let Some(session) = repo.find_by_id(&oid).await? else {
        return Ok(None);
    };
    if session.auth_state.bytes.is_empty() {
        return Ok(None);
    }
    let plaintext = crypto
        .decrypt(&session.auth_state.bytes)
        .context("decrypt sabwa_sessions.authState")?;
    Ok(Some(plaintext))
}
