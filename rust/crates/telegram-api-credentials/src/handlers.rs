//! HTTP handlers for the `telegram-api-credentials` crate.
//!
//! All endpoints are tenant-scoped: the caller must own the `projectId`
//! they reference (enforced by [`require_project`]). `api_hash` is
//! stored plain in `telegram_api_credentials` and masked on every read.
//!
//! Login-session endpoints (`/login/start`, `/login/code`,
//! `/login/password`, `/logout`) are *placeholders* — they update the
//! state machine in Mongo (`telegram_api_login_sessions`) but do not
//! perform real MTProto handshakes. A follow-up worker crate will pick
//! these sessions up by id and complete them out-of-band.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::state::TelegramApiCredentialsState;

// ---------------------------------------------------------------------------
//  Collection names & constants
// ---------------------------------------------------------------------------

const PROJECTS: &str = "projects";
const CREDENTIALS: &str = "telegram_api_credentials";
const SESSIONS: &str = "telegram_api_login_sessions";
const AUDIT: &str = "telegram_api_credentials_audit";

/// Public Telegram endpoint used by the soft-verify ping. Hitting this
/// proves only network reachability and that the credential *shape* is
/// valid — it does **not** authenticate the credentials.
const TG_REACH_URL: &str = "https://my.telegram.org";

// ---------------------------------------------------------------------------
//  Generic ack envelope
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "credentialId")]
    pub credential_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "sessionId")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "sessionStatus")]
    pub session_status: Option<String>,
}

fn err(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        ..Default::default()
    })
}

// ---------------------------------------------------------------------------
//  Tenancy helpers
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

async fn require_project(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
) -> Result<(ObjectId, ObjectId), String> {
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
    Ok((project_oid, user_oid))
}

// ---------------------------------------------------------------------------
//  Masking & validation
// ---------------------------------------------------------------------------

/// `api_hash` is 32 hex chars. Mask all but the last 4.
fn mask_api_hash(hash: &str) -> String {
    let n = hash.chars().count();
    if n <= 4 {
        return "•".repeat(n);
    }
    let tail: String = hash
        .chars()
        .rev()
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    format!("{}{tail}", "•".repeat(n.saturating_sub(4).min(28)))
}

/// Mask a phone number, keeping country prefix and last 4.
fn mask_phone(phone: &str) -> String {
    let n = phone.chars().count();
    if n <= 4 {
        return "•".repeat(n);
    }
    // Keep first char (the +) and last 4.
    let chars: Vec<char> = phone.chars().collect();
    let head = chars[0];
    let tail: String = chars[chars.len().saturating_sub(4)..].iter().collect();
    let hidden = n.saturating_sub(5);
    format!("{head}{}{tail}", "•".repeat(hidden.min(10)))
}

fn validate_api_id(api_id: i64) -> Result<i64, String> {
    if api_id <= 0 {
        return Err("api_id must be a positive integer.".to_owned());
    }
    Ok(api_id)
}

fn validate_api_hash(hash: &str) -> Result<String, String> {
    // 32 hex chars, case-insensitive — normalise to lowercase for storage.
    let trimmed = hash.trim();
    let re = regex::Regex::new(r"^[A-Fa-f0-9]{32}$").expect("api_hash regex");
    if !re.is_match(trimmed) {
        return Err("api_hash must be exactly 32 hex characters.".to_owned());
    }
    Ok(trimmed.to_lowercase())
}

fn validate_phone(phone: &str) -> Result<String, String> {
    // E.164: `+` followed by 7–15 digits, leading digit not zero.
    let trimmed = phone.trim();
    let re = regex::Regex::new(r"^\+[1-9][0-9]{6,14}$").expect("phone regex");
    if !re.is_match(trimmed) {
        return Err(
            "phoneNumber must be E.164 — `+` then 7–15 digits (e.g. +14155552671).".to_owned(),
        );
    }
    Ok(trimmed.to_owned())
}

// ---------------------------------------------------------------------------
//  Wire types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct CredentialRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(rename = "apiId")]
    pub api_id: i64,
    /// Masked representation (last 4 of api_hash visible).
    #[serde(rename = "apiHashMasked")]
    pub api_hash_masked: String,
    #[serde(rename = "phoneNumberMasked")]
    pub phone_number_masked: String,
    #[serde(rename = "testMode")]
    pub test_mode: bool,
    pub status: String,
    #[serde(rename = "sessionState")]
    pub session_state: String,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "lastVerifiedAt"
    )]
    pub last_verified_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "lastUsedAt"
    )]
    pub last_used_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
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

fn doc_to_row(d: &Document) -> Option<CredentialRow> {
    let api_hash = d.get_str("apiHash").unwrap_or("");
    let phone = d.get_str("phoneNumber").unwrap_or("");
    Some(CredentialRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        user_id: d.get_object_id("userId").ok()?.to_hex(),
        label: d
            .get_str("label")
            .ok()
            .map(str::to_owned)
            .filter(|s| !s.is_empty()),
        api_id: d
            .get_i64("apiId")
            .or_else(|_| d.get_i32("apiId").map(i64::from))
            .unwrap_or(0),
        api_hash_masked: mask_api_hash(api_hash),
        phone_number_masked: mask_phone(phone),
        test_mode: d.get_bool("testMode").unwrap_or(false),
        status: d.get_str("status").unwrap_or("unverified").to_owned(),
        session_state: d.get_str("sessionState").unwrap_or("none").to_owned(),
        last_verified_at: d
            .get_datetime("lastVerifiedAt")
            .ok()
            .copied()
            .map(|b| dt(Some(b))),
        last_used_at: d
            .get_datetime("lastUsedAt")
            .ok()
            .copied()
            .map(|b| dt(Some(b))),
        notes: d
            .get_str("notes")
            .ok()
            .map(str::to_owned)
            .filter(|s| !s.is_empty()),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListResp {
    pub credentials: Vec<CredentialRow>,
    pub total: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct DetailResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credential: Option<CredentialRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Audit helper
// ---------------------------------------------------------------------------

async fn write_audit(
    mongo: &MongoHandle,
    credential_oid: ObjectId,
    project_oid: ObjectId,
    actor_oid: ObjectId,
    action: &str,
    detail: &str,
) {
    let now = bson::DateTime::now();
    let _ = mongo
        .collection::<Document>(AUDIT)
        .insert_one(doc! {
            "credentialId": credential_oid,
            "projectId": project_oid,
            "actorId": actor_oid,
            "action": action,
            "detail": detail,
            "at": now,
        })
        .await;
}

// ===========================================================================
//                             LIST
// ===========================================================================

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramApiCredentialsState>,
    Query(q): Query<ProjectQuery>,
) -> Json<ListResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let (project_oid, _user_oid) = match require_project(&user, &s.mongo, project_id).await {
        Ok(p) => p,
        Err(e) => {
            return Json(ListResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let coll = s.mongo.collection::<Document>(CREDENTIALS);
    let cursor = match coll
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let credentials: Vec<CredentialRow> = docs.iter().filter_map(doc_to_row).collect();
    let total = credentials.len() as i64;
    Json(ListResp {
        credentials,
        total,
        error: None,
    })
}

// ===========================================================================
//                             DETAIL
// ===========================================================================

pub async fn detail(
    user: AuthUser,
    State(s): State<TelegramApiCredentialsState>,
    Path(credential_id): Path<String>,
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
    let (project_oid, _) = match require_project(&user, &s.mongo, project_id).await {
        Ok(p) => p,
        Err(e) => {
            return Json(DetailResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let oid = match parse_oid(&credential_id) {
        Some(o) => o,
        None => {
            return Json(DetailResp {
                error: Some("Invalid credential id.".to_owned()),
                ..Default::default()
            });
        }
    };
    match s
        .mongo
        .collection::<Document>(CREDENTIALS)
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => Json(DetailResp {
            credential: doc_to_row(&d),
            error: None,
        }),
        Ok(None) => Json(DetailResp {
            error: Some("Credential not found.".to_owned()),
            ..Default::default()
        }),
        Err(e) => Json(DetailResp {
            error: Some(format!("mongo: {e}")),
            ..Default::default()
        }),
    }
}

// ===========================================================================
//                             CREATE
// ===========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct CreateBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(rename = "apiId")]
    pub api_id: i64,
    #[serde(rename = "apiHash")]
    pub api_hash: String,
    #[serde(rename = "phoneNumber")]
    pub phone_number: String,
    #[serde(default, rename = "testMode")]
    pub test_mode: Option<bool>,
    #[serde(default)]
    pub notes: Option<String>,
}

pub async fn create(
    user: AuthUser,
    State(s): State<TelegramApiCredentialsState>,
    Json(body): Json<CreateBody>,
) -> Json<AckResult> {
    let (project_oid, user_oid) = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => return err(e),
    };
    let api_id = match validate_api_id(body.api_id) {
        Ok(v) => v,
        Err(e) => return err(e),
    };
    let api_hash = match validate_api_hash(&body.api_hash) {
        Ok(v) => v,
        Err(e) => return err(e),
    };
    let phone = match validate_phone(&body.phone_number) {
        Ok(v) => v,
        Err(e) => return err(e),
    };

    // Uniqueness on (projectId, userId): one credential per user per project.
    // If a credential already exists, surface a friendly error so the caller
    // explicitly deletes the old one before storing a new pair.
    let coll = s.mongo.collection::<Document>(CREDENTIALS);
    match coll
        .find_one(doc! { "projectId": project_oid, "userId": user_oid })
        .await
    {
        Ok(Some(_)) => {
            return err(
                "Credentials already exist for this project — delete the existing record before adding new ones.",
            );
        }
        Ok(None) => {}
        Err(e) => return err(format!("mongo: {e}")),
    }

    let now = bson::DateTime::now();
    let mut doc = doc! {
        "projectId": project_oid,
        "userId": user_oid,
        "apiId": api_id,
        "apiHash": &api_hash,
        "phoneNumber": &phone,
        "testMode": body.test_mode.unwrap_or(false),
        "status": "unverified",
        "sessionState": "none",
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(label) = body
        .label
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        doc.insert("label", label);
    }
    if let Some(notes) = body
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        doc.insert("notes", notes);
    }

    match coll.insert_one(doc).await {
        Ok(res) => {
            let id = res
                .inserted_id
                .as_object_id()
                .map(|o| o.to_hex())
                .unwrap_or_default();
            if let Some(oid) = res.inserted_id.as_object_id() {
                write_audit(
                    &s.mongo,
                    oid,
                    project_oid,
                    user_oid,
                    "create",
                    "Credential created (unverified).",
                )
                .await;
            }
            Json(AckResult {
                success: true,
                credential_id: Some(id),
                message: Some("Credentials saved.".to_owned()),
                ..Default::default()
            })
        }
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ===========================================================================
//                             UPDATE (no rotation)
// ===========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default, rename = "phoneNumber")]
    pub phone_number: Option<String>,
    #[serde(default, rename = "testMode")]
    pub test_mode: Option<bool>,
    #[serde(default)]
    pub notes: Option<String>,
}

pub async fn update(
    user: AuthUser,
    State(s): State<TelegramApiCredentialsState>,
    Path(credential_id): Path<String>,
    Json(body): Json<UpdateBody>,
) -> Json<AckResult> {
    let (project_oid, user_oid) = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => return err(e),
    };
    let oid = match parse_oid(&credential_id) {
        Some(o) => o,
        None => return err("Invalid credential id."),
    };

    let mut set = doc! {
        "updatedAt": bson::DateTime::now(),
    };
    if let Some(label) = body.label.as_ref() {
        let trimmed = label.trim();
        if trimmed.is_empty() {
            set.insert("label", bson::Bson::Null);
        } else {
            set.insert("label", trimmed);
        }
    }
    if let Some(phone) = body.phone_number.as_deref() {
        match validate_phone(phone) {
            Ok(v) => {
                set.insert("phoneNumber", v);
            }
            Err(e) => return err(e),
        }
    }
    if let Some(tm) = body.test_mode {
        set.insert("testMode", tm);
    }
    if let Some(notes) = body.notes.as_ref() {
        let trimmed = notes.trim();
        if trimmed.is_empty() {
            set.insert("notes", bson::Bson::Null);
        } else {
            set.insert("notes", trimmed);
        }
    }

    match s
        .mongo
        .collection::<Document>(CREDENTIALS)
        .update_one(
            doc! { "_id": oid, "projectId": project_oid },
            doc! { "$set": set },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => err("Credential not found."),
        Ok(_) => {
            write_audit(
                &s.mongo,
                oid,
                project_oid,
                user_oid,
                "update",
                "Metadata updated.",
            )
            .await;
            Json(AckResult {
                success: true,
                credential_id: Some(credential_id),
                message: Some("Updated.".to_owned()),
                ..Default::default()
            })
        }
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ===========================================================================
//                             DELETE / REVOKE
// ===========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct DeleteQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub confirm: Option<String>,
}

pub async fn delete_credential(
    user: AuthUser,
    State(s): State<TelegramApiCredentialsState>,
    Path(credential_id): Path<String>,
    Query(q): Query<DeleteQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let (project_oid, user_oid) = match require_project(&user, &s.mongo, project_id).await {
        Ok(p) => p,
        Err(e) => return err(e),
    };
    let oid = match parse_oid(&credential_id) {
        Some(o) => o,
        None => return err("Invalid credential id."),
    };
    let coll = s.mongo.collection::<Document>(CREDENTIALS);

    // Two-stage: without `confirm=DELETE` we soft-revoke; with it we
    // hard-delete (revoke first as a safety net, then drop the row).
    let confirmed = q.confirm.as_deref() == Some("DELETE");

    if confirmed {
        // Revoke status first so any concurrent reader can see the intent
        // before the document disappears.
        let _ = coll
            .update_one(
                doc! { "_id": oid, "projectId": project_oid },
                doc! { "$set": {
                    "status": "revoked",
                    "sessionState": "none",
                    "updatedAt": bson::DateTime::now(),
                } },
            )
            .await;
        // Clear sessions.
        let _ = s
            .mongo
            .collection::<Document>(SESSIONS)
            .delete_many(doc! { "credentialId": oid, "projectId": project_oid })
            .await;
        match coll
            .delete_one(doc! { "_id": oid, "projectId": project_oid })
            .await
        {
            Ok(r) if r.deleted_count == 0 => err("Credential not found."),
            Ok(_) => {
                write_audit(
                    &s.mongo,
                    oid,
                    project_oid,
                    user_oid,
                    "delete",
                    "Credential revoked and deleted.",
                )
                .await;
                Json(AckResult {
                    success: true,
                    credential_id: Some(credential_id),
                    message: Some("Deleted.".to_owned()),
                    ..Default::default()
                })
            }
            Err(e) => err(format!("mongo: {e}")),
        }
    } else {
        match coll
            .update_one(
                doc! { "_id": oid, "projectId": project_oid },
                doc! { "$set": {
                    "status": "revoked",
                    "sessionState": "none",
                    "updatedAt": bson::DateTime::now(),
                } },
            )
            .await
        {
            Ok(r) if r.matched_count == 0 => err("Credential not found."),
            Ok(_) => {
                write_audit(
                    &s.mongo,
                    oid,
                    project_oid,
                    user_oid,
                    "revoke",
                    "Credential revoked.",
                )
                .await;
                Json(AckResult {
                    success: true,
                    credential_id: Some(credential_id),
                    message: Some(
                        "Credential revoked. Pass `confirm=DELETE` to drop the record.".to_owned(),
                    ),
                    ..Default::default()
                })
            }
            Err(e) => err(format!("mongo: {e}")),
        }
    }
}

// ===========================================================================
//                             VERIFY (soft)
// ===========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct VerifyBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
}

pub async fn verify(
    user: AuthUser,
    State(s): State<TelegramApiCredentialsState>,
    Path(credential_id): Path<String>,
    Json(body): Json<VerifyBody>,
) -> Json<AckResult> {
    let (project_oid, user_oid) = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => return err(e),
    };
    let oid = match parse_oid(&credential_id) {
        Some(o) => o,
        None => return err("Invalid credential id."),
    };
    let coll = s.mongo.collection::<Document>(CREDENTIALS);
    let cred = match coll
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Credential not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };

    // Re-validate format from stored values (defence in depth).
    let api_id = cred
        .get_i64("apiId")
        .or_else(|_| cred.get_i32("apiId").map(i64::from))
        .unwrap_or(0);
    if api_id <= 0 {
        return err("Stored api_id is invalid; re-create the credential.");
    }
    if validate_api_hash(cred.get_str("apiHash").unwrap_or("")).is_err() {
        return err("Stored api_hash is malformed; re-create the credential.");
    }

    // Soft check: ping my.telegram.org. We treat any HTTP response (even 4xx)
    // as "reachable" — the only failure mode we care about is a network/DNS
    // error that would mean the deployment can't reach Telegram at all.
    let reachable = match s.http.head(TG_REACH_URL).send().await {
        Ok(_) => true,
        Err(e) => {
            tracing::warn!(error = %e, "telegram reachability ping failed");
            false
        }
    };

    if !reachable {
        let _ = coll
            .update_one(
                doc! { "_id": oid, "projectId": project_oid },
                doc! { "$set": {
                    "status": "login_failed",
                    "updatedAt": bson::DateTime::now(),
                } },
            )
            .await;
        write_audit(
            &s.mongo,
            oid,
            project_oid,
            user_oid,
            "verify_failed",
            "Unable to reach my.telegram.org from the deployment.",
        )
        .await;
        return err("Unable to reach my.telegram.org from the deployment. Check egress.");
    }

    let now = bson::DateTime::now();
    let _ = coll
        .update_one(
            doc! { "_id": oid, "projectId": project_oid },
            doc! { "$set": {
                "status": "verified",
                "lastVerifiedAt": now,
                "updatedAt": now,
            } },
        )
        .await;
    write_audit(
        &s.mongo,
        oid,
        project_oid,
        user_oid,
        "verify",
        "Soft verification passed (format + Telegram reachability).",
    )
    .await;
    Json(AckResult {
        success: true,
        credential_id: Some(credential_id),
        message: Some(
            "Soft verification passed. A full MTProto handshake is required to confirm the credentials authenticate the user account."
                .to_owned(),
        ),
        ..Default::default()
    })
}

// ===========================================================================
//                             LOGIN — placeholders
// ===========================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct LoginStartBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LoginCodeBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub code: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LoginPasswordBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub password: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LogoutBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
}

pub async fn login_start(
    user: AuthUser,
    State(s): State<TelegramApiCredentialsState>,
    Path(credential_id): Path<String>,
    Json(body): Json<LoginStartBody>,
) -> Json<AckResult> {
    let (project_oid, user_oid) = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => return err(e),
    };
    let oid = match parse_oid(&credential_id) {
        Some(o) => o,
        None => return err("Invalid credential id."),
    };
    let creds = s.mongo.collection::<Document>(CREDENTIALS);
    if creds
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
        .ok()
        .flatten()
        .is_none()
    {
        return err("Credential not found.");
    }

    tracing::info!(
        credential_id = %credential_id,
        project_id = %body.project_id,
        "MTProto login/start requested — no MTProto worker is wired yet; storing placeholder session"
    );

    let now = bson::DateTime::now();
    let sessions = s.mongo.collection::<Document>(SESSIONS);
    let session_doc = doc! {
        "credentialId": oid,
        "projectId": project_oid,
        "status": "waiting_for_code",
        "startedAt": now,
        "updatedAt": now,
        "placeholder": true,
    };
    let session_id = match sessions.insert_one(session_doc).await {
        Ok(res) => res
            .inserted_id
            .as_object_id()
            .map(|o| o.to_hex())
            .unwrap_or_default(),
        Err(e) => return err(format!("mongo: {e}")),
    };

    let _ = creds
        .update_one(
            doc! { "_id": oid, "projectId": project_oid },
            doc! { "$set": {
                "status": "login_pending",
                "sessionState": "waiting_for_code",
                "updatedAt": now,
            } },
        )
        .await;
    write_audit(
        &s.mongo,
        oid,
        project_oid,
        user_oid,
        "login_start",
        "Placeholder login session created (MTProto worker not yet running).",
    )
    .await;

    Json(AckResult {
        success: true,
        credential_id: Some(credential_id),
        session_id: Some(session_id),
        session_status: Some("waiting_for_code".to_owned()),
        message: Some(
            "MTProto login flow is in preview — credentials stored, but no real `sendCode` was issued. A future MTProto worker will pick up this session."
                .to_owned(),
        ),
        ..Default::default()
    })
}

pub async fn login_code(
    user: AuthUser,
    State(s): State<TelegramApiCredentialsState>,
    Path(credential_id): Path<String>,
    Json(body): Json<LoginCodeBody>,
) -> Json<AckResult> {
    let (project_oid, user_oid) = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => return err(e),
    };
    let oid = match parse_oid(&credential_id) {
        Some(o) => o,
        None => return err("Invalid credential id."),
    };
    let session_oid = match parse_oid(&body.session_id) {
        Some(o) => o,
        None => return err("Invalid session id."),
    };
    if body.code.trim().is_empty() {
        return err("code is required.");
    }
    let sessions = s.mongo.collection::<Document>(SESSIONS);
    let now = bson::DateTime::now();
    let res = sessions
        .update_one(
            doc! {
                "_id": session_oid,
                "credentialId": oid,
                "projectId": project_oid,
            },
            doc! { "$set": {
                "status": "waiting_for_password",
                "submittedCodeAt": now,
                "updatedAt": now,
            } },
        )
        .await;
    match res {
        Ok(r) if r.matched_count == 0 => return err("Session not found."),
        Ok(_) => {}
        Err(e) => return err(format!("mongo: {e}")),
    }
    let _ = s
        .mongo
        .collection::<Document>(CREDENTIALS)
        .update_one(
            doc! { "_id": oid, "projectId": project_oid },
            doc! { "$set": {
                "sessionState": "waiting_for_password",
                "updatedAt": now,
            } },
        )
        .await;
    write_audit(
        &s.mongo,
        oid,
        project_oid,
        user_oid,
        "login_code",
        "Verification code accepted (placeholder).",
    )
    .await;
    Json(AckResult {
        success: true,
        credential_id: Some(credential_id),
        session_id: Some(body.session_id),
        session_status: Some("waiting_for_password".to_owned()),
        message: Some(
            "Code accepted (placeholder). If the account has 2FA, supply the password next."
                .to_owned(),
        ),
        ..Default::default()
    })
}

pub async fn login_password(
    user: AuthUser,
    State(s): State<TelegramApiCredentialsState>,
    Path(credential_id): Path<String>,
    Json(body): Json<LoginPasswordBody>,
) -> Json<AckResult> {
    let (project_oid, user_oid) = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => return err(e),
    };
    let oid = match parse_oid(&credential_id) {
        Some(o) => o,
        None => return err("Invalid credential id."),
    };
    let session_oid = match parse_oid(&body.session_id) {
        Some(o) => o,
        None => return err("Invalid session id."),
    };
    if body.password.is_empty() {
        return err("password is required.");
    }
    let now = bson::DateTime::now();
    let res = s
        .mongo
        .collection::<Document>(SESSIONS)
        .update_one(
            doc! {
                "_id": session_oid,
                "credentialId": oid,
                "projectId": project_oid,
            },
            doc! { "$set": {
                "status": "logged_in",
                "completedAt": now,
                "updatedAt": now,
            } },
        )
        .await;
    match res {
        Ok(r) if r.matched_count == 0 => return err("Session not found."),
        Ok(_) => {}
        Err(e) => return err(format!("mongo: {e}")),
    }
    let _ = s
        .mongo
        .collection::<Document>(CREDENTIALS)
        .update_one(
            doc! { "_id": oid, "projectId": project_oid },
            doc! { "$set": {
                "status": "active",
                "sessionState": "logged_in",
                "lastUsedAt": now,
                "updatedAt": now,
            } },
        )
        .await;
    write_audit(
        &s.mongo,
        oid,
        project_oid,
        user_oid,
        "login_password",
        "2FA password accepted (placeholder); credential marked active.",
    )
    .await;
    Json(AckResult {
        success: true,
        credential_id: Some(credential_id),
        session_id: Some(body.session_id),
        session_status: Some("logged_in".to_owned()),
        message: Some(
            "Placeholder login completed. The MTProto worker is not yet running, so no real session was established."
                .to_owned(),
        ),
        ..Default::default()
    })
}

pub async fn logout(
    user: AuthUser,
    State(s): State<TelegramApiCredentialsState>,
    Path(credential_id): Path<String>,
    Json(body): Json<LogoutBody>,
) -> Json<AckResult> {
    let (project_oid, user_oid) = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => return err(e),
    };
    let oid = match parse_oid(&credential_id) {
        Some(o) => o,
        None => return err("Invalid credential id."),
    };
    let now = bson::DateTime::now();
    let _ = s
        .mongo
        .collection::<Document>(SESSIONS)
        .update_many(
            doc! {
                "credentialId": oid,
                "projectId": project_oid,
                "status": { "$ne": "logged_out" },
            },
            doc! { "$set": {
                "status": "logged_out",
                "completedAt": now,
                "updatedAt": now,
            } },
        )
        .await;
    let res = s
        .mongo
        .collection::<Document>(CREDENTIALS)
        .update_one(
            doc! { "_id": oid, "projectId": project_oid },
            doc! { "$set": {
                "status": "verified",
                "sessionState": "none",
                "updatedAt": now,
            } },
        )
        .await;
    match res {
        Ok(r) if r.matched_count == 0 => err("Credential not found."),
        Ok(_) => {
            write_audit(
                &s.mongo,
                oid,
                project_oid,
                user_oid,
                "logout",
                "All sessions cleared; credential reverted to verified.",
            )
            .await;
            Json(AckResult {
                success: true,
                credential_id: Some(credential_id),
                message: Some("Logged out.".to_owned()),
                ..Default::default()
            })
        }
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ===========================================================================
//                             SESSIONS LIST
// ===========================================================================

#[derive(Debug, Clone, Serialize)]
pub struct LoginSessionRow {
    pub _id: String,
    #[serde(rename = "credentialId")]
    pub credential_id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<bool>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "startedAt"
    )]
    pub started_at: DateTime<Utc>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "updatedAt"
    )]
    pub updated_at: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "completedAt"
    )]
    pub completed_at: Option<DateTime<Utc>>,
}

fn session_doc_to_row(d: &Document) -> Option<LoginSessionRow> {
    Some(LoginSessionRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        credential_id: d.get_object_id("credentialId").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        status: d.get_str("status").unwrap_or("unknown").to_owned(),
        placeholder: d.get_bool("placeholder").ok(),
        started_at: dt(d.get_datetime("startedAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
        completed_at: d
            .get_datetime("completedAt")
            .ok()
            .copied()
            .map(|b| dt(Some(b))),
    })
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListSessionsResp {
    pub sessions: Vec<LoginSessionRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn list_sessions(
    user: AuthUser,
    State(s): State<TelegramApiCredentialsState>,
    Path(credential_id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<ListSessionsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListSessionsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let (project_oid, _) = match require_project(&user, &s.mongo, project_id).await {
        Ok(p) => p,
        Err(e) => {
            return Json(ListSessionsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let oid = match parse_oid(&credential_id) {
        Some(o) => o,
        None => {
            return Json(ListSessionsResp {
                error: Some("Invalid credential id.".to_owned()),
                ..Default::default()
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(SESSIONS)
        .find(doc! { "credentialId": oid, "projectId": project_oid })
        .sort(doc! { "startedAt": -1 })
        .limit(50)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListSessionsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListSessionsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    Json(ListSessionsResp {
        sessions: docs.iter().filter_map(session_doc_to_row).collect(),
        error: None,
    })
}

// ===========================================================================
//                             AUDIT LIST
// ===========================================================================

#[derive(Debug, Clone, Serialize)]
pub struct AuditRow {
    pub _id: String,
    #[serde(rename = "credentialId")]
    pub credential_id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "actorId")]
    pub actor_id: String,
    pub action: String,
    pub detail: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
}

fn audit_doc_to_row(d: &Document) -> Option<AuditRow> {
    Some(AuditRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        credential_id: d.get_object_id("credentialId").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        actor_id: d.get_object_id("actorId").ok()?.to_hex(),
        action: d.get_str("action").unwrap_or("").to_owned(),
        detail: d.get_str("detail").unwrap_or("").to_owned(),
        at: dt(d.get_datetime("at").ok().copied()),
    })
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct AuditListResp {
    pub items: Vec<AuditRow>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "nextCursor")]
    pub next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AuditQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
    #[serde(default, rename = "credentialId")]
    pub credential_id: Option<String>,
}

pub async fn audit_list(
    user: AuthUser,
    State(s): State<TelegramApiCredentialsState>,
    Query(q): Query<AuditQuery>,
) -> Json<AuditListResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(AuditListResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let (project_oid, _) = match require_project(&user, &s.mongo, project_id).await {
        Ok(p) => p,
        Err(e) => {
            return Json(AuditListResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let mut filter = doc! { "projectId": project_oid };
    if let Some(cid) = q.credential_id.as_deref().and_then(parse_oid) {
        filter.insert("credentialId", cid);
    }
    if let Some(cursor_oid) = q.cursor.as_deref().and_then(parse_oid) {
        filter.insert("_id", doc! { "$lt": cursor_oid });
    }

    let cursor = match s
        .mongo
        .collection::<Document>(AUDIT)
        .find(filter)
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(AuditListResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(AuditListResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let items: Vec<AuditRow> = docs.iter().filter_map(audit_doc_to_row).collect();
    let next_cursor = if items.len() as i64 == limit {
        items.last().map(|r| r._id.clone())
    } else {
        None
    };
    Json(AuditListResp {
        items,
        next_cursor,
        error: None,
    })
}

// ===========================================================================
//  IN-PROCESS HELPER — reserved for the (future) MTProto worker crate.
// ===========================================================================

#[derive(Debug, Clone)]
pub struct Credential {
    pub id: ObjectId,
    pub project_id: ObjectId,
    pub user_id: ObjectId,
    pub api_id: i64,
    /// The **raw** api_hash — never expose this over HTTP.
    pub api_hash: String,
    pub phone_number: String,
    pub test_mode: bool,
    pub status: String,
    pub session_state: String,
}

/// Look up a credential in-process. Returns the full record including
/// the unmasked `api_hash` — intended for a future MTProto worker that
/// needs the raw value to perform the actual handshake. Do **not** call
/// this from any handler that returns its result over HTTP.
pub async fn get_credential(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    credential_oid: ObjectId,
) -> Option<Credential> {
    let d = mongo
        .collection::<Document>(CREDENTIALS)
        .find_one(doc! { "_id": credential_oid, "projectId": project_oid })
        .await
        .ok()
        .flatten()?;
    Some(Credential {
        id: d.get_object_id("_id").ok()?,
        project_id: d.get_object_id("projectId").ok()?,
        user_id: d.get_object_id("userId").ok()?,
        api_id: d
            .get_i64("apiId")
            .or_else(|_| d.get_i32("apiId").map(i64::from))
            .ok()?,
        api_hash: d.get_str("apiHash").ok()?.to_owned(),
        phone_number: d.get_str("phoneNumber").ok()?.to_owned(),
        test_mode: d.get_bool("testMode").unwrap_or(false),
        status: d.get_str("status").unwrap_or("unverified").to_owned(),
        session_state: d.get_str("sessionState").unwrap_or("none").to_owned(),
    })
}
