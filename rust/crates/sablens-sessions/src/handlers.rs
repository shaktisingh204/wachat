//! HTTP handlers for SabLens sessions.
//!
//! Collection: `sablens_sessions`. Tenant-scoped by `userId`. Public
//! endpoints find by `customerJoinToken` and never expose `userId`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use rand::RngCore;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    AppendSnapshotInput, CreateSessionInput, CreateSessionResponse, DeleteSessionResponse,
    ListQuery, PublicSessionView, UpdateSessionInput,
};
use crate::types::SablensSession;

const COLL: &str = "sablens_sessions";

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

fn is_valid_status(s: &str) -> bool {
    matches!(s, "scheduled" | "waiting" | "active" | "ended")
}

fn is_valid_mode(s: &str) -> bool {
    matches!(s, "live_call" | "async_recorded")
}

/// Generate an opaque 48-hex-char (24-byte) join token.
fn mint_token() -> String {
    let mut buf = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut buf);
    buf.iter().map(|b| format!("{b:02x}")).collect()
}

fn list_filter(user_id: ObjectId, q: &ListQuery) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.status.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("status", s);
    }
    if let Some(m) = q.mode.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("mode", m);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["customerName", "customerEmail", "notes"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SablensSession>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

// -------------------------------------------------------------------------
// GET / — list
// -------------------------------------------------------------------------

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_sessions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let filter = list_filter(user_id, &q);
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SablensSession>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.find"))
        })?;
    let mut rows: Vec<SablensSession> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.collect"))
    })?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

// -------------------------------------------------------------------------
// GET /:id
// -------------------------------------------------------------------------

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn get_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
) -> Result<Json<SablensSession>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let coll = mongo.collection::<SablensSession>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sablens_session".to_owned()))?;
    Ok(Json(row))
}

// -------------------------------------------------------------------------
// POST / — create
// -------------------------------------------------------------------------

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSessionInput>,
) -> Result<Json<CreateSessionResponse>> {
    let user_id = user_oid(&user)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let technician_user_id = input
        .technician_user_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
        .unwrap_or(user_id);
    let mode = input.mode.unwrap_or_else(|| "live_call".to_owned());
    if !is_valid_mode(&mode) {
        return Err(ApiError::Validation(format!("invalid mode \"{mode}\"")));
    }
    let mut entity = SablensSession {
        id: None,
        user_id,
        technician_user_id,
        customer_name: input.customer_name,
        customer_email: input.customer_email,
        customer_join_token: mint_token(),
        status: "scheduled".to_owned(),
        mode,
        started_at: None,
        ended_at: None,
        duration_secs: None,
        recording_file_id: None,
        snapshot_file_ids: vec![],
        notes: input.notes,
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SablensSession>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateSessionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

// -------------------------------------------------------------------------
// PATCH /:id
// -------------------------------------------------------------------------

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn update_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
    Json(patch): Json<UpdateSessionInput>,
) -> Result<Json<SablensSession>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());

    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.customer_name {
        set.insert("customerName", v);
    }
    if let Some(v) = patch.customer_email {
        set.insert("customerEmail", v);
    }
    if let Some(v) = patch.status.as_deref() {
        if !is_valid_status(v) {
            return Err(ApiError::Validation(format!("invalid status \"{v}\"")));
        }
        set.insert("status", v);
    }
    if let Some(v) = patch.mode.as_deref() {
        if !is_valid_mode(v) {
            return Err(ApiError::Validation(format!("invalid mode \"{v}\"")));
        }
        set.insert("mode", v);
    }
    if let Some(v) = patch.recording_file_id {
        set.insert("recordingFileId", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }

    let coll = mongo.collection::<SablensSession>(COLL);
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sablens_session".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sablens_session".to_owned()))?;
    Ok(Json(after))
}

// -------------------------------------------------------------------------
// DELETE /:id (hard delete — sessions are user-facing artifacts)
// -------------------------------------------------------------------------

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn delete_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
) -> Result<Json<DeleteSessionResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let coll = mongo.collection::<SablensSession>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("sablens_session".to_owned()));
    }
    Ok(Json(DeleteSessionResponse { deleted: true }))
}

// -------------------------------------------------------------------------
// POST /:id/start  — stamp startedAt + flip status -> active
// -------------------------------------------------------------------------

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn start_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
) -> Result<Json<SablensSession>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<SablensSession>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "active",
                "startedAt": now,
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.start")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sablens_session".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sablens_session".to_owned()))?;
    Ok(Json(after))
}

// -------------------------------------------------------------------------
// POST /:id/end — stamp endedAt + compute durationSecs + status=ended
// -------------------------------------------------------------------------

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn end_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
) -> Result<Json<SablensSession>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let coll = mongo.collection::<SablensSession>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sablens_session".to_owned()))?;
    let now_dt = Utc::now();
    let now = BsonDateTime::from_chrono(now_dt);
    let duration_secs: u64 = match before.started_at {
        Some(started) => {
            let started_chrono = started.to_chrono();
            let delta = now_dt.signed_duration_since(started_chrono).num_seconds();
            delta.max(0) as u64
        }
        None => 0,
    };
    coll.update_one(
        ownership_filter(user_id, oid),
        doc! { "$set": {
            "status": "ended",
            "endedAt": now,
            "durationSecs": duration_secs as i64,
            "updatedAt": now,
        }},
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.end")))?;
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sablens_session".to_owned()))?;
    Ok(Json(after))
}

// -------------------------------------------------------------------------
// POST /:id/snapshots — append SabFiles fileId to snapshot list
// -------------------------------------------------------------------------

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn append_snapshot(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
    Json(input): Json<AppendSnapshotInput>,
) -> Result<Json<SablensSession>> {
    if input.file_id.trim().is_empty() {
        return Err(ApiError::Validation("fileId is required".to_owned()));
    }
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<SablensSession>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! {
                "$push": { "snapshotFileIds": &input.file_id },
                "$set":  { "updatedAt": now },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.push_snapshot"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sablens_session".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sablens_session".to_owned()))?;
    Ok(Json(after))
}

// -------------------------------------------------------------------------
// POST /:id/customer-token — mint a fresh token (invalidates old link)
// -------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenResponse {
    pub customer_join_token: String,
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn reissue_customer_token(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
) -> Result<Json<TokenResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let token = mint_token();
    let coll = mongo.collection::<SablensSession>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "customerJoinToken": &token,
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.reissue_token"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sablens_session".to_owned()));
    }
    Ok(Json(TokenResponse {
        customer_join_token: token,
    }))
}

// -------------------------------------------------------------------------
// Public — GET /:token  (no JWT)
// -------------------------------------------------------------------------

#[instrument(skip_all, fields(token_len = %token.len()))]
pub async fn redeem_customer_token(
    State(mongo): State<MongoHandle>,
    Path(token): Path<String>,
) -> Result<Json<PublicSessionView>> {
    let coll = mongo.collection::<SablensSession>(COLL);
    let row = coll
        .find_one(doc! { "customerJoinToken": &token })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.token_lookup"))
        })?
        .ok_or_else(|| ApiError::NotFound("sablens_session".to_owned()))?;
    Ok(Json(PublicSessionView {
        session_id: row.id.map(|o| o.to_hex()).unwrap_or_default(),
        status: row.status,
        mode: row.mode,
        technician_name: None,
        customer_name: row.customer_name,
    }))
}

// -------------------------------------------------------------------------
// Public — POST /:token/join  (customer flips status -> waiting/active)
// -------------------------------------------------------------------------

#[instrument(skip_all, fields(token_len = %token.len()))]
pub async fn customer_join(
    State(mongo): State<MongoHandle>,
    Path(token): Path<String>,
) -> Result<Json<PublicSessionView>> {
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<SablensSession>(COLL);
    let row = coll
        .find_one(doc! { "customerJoinToken": &token })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.token_lookup"))
        })?
        .ok_or_else(|| ApiError::NotFound("sablens_session".to_owned()))?;
    if row.status == "ended" {
        return Err(ApiError::Validation("session already ended".to_owned()));
    }
    let next_status = if row.status == "active" {
        "active"
    } else {
        "waiting"
    };
    coll.update_one(
        doc! { "customerJoinToken": &token },
        doc! { "$set": { "status": next_status, "updatedAt": now } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sablens_sessions.customer_join"))
    })?;
    Ok(Json(PublicSessionView {
        session_id: row.id.map(|o| o.to_hex()).unwrap_or_default(),
        status: next_status.to_owned(),
        mode: row.mode,
        technician_name: None,
        customer_name: row.customer_name,
    }))
}

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mint_token_is_48_hex_chars() {
        let t = mint_token();
        assert_eq!(t.len(), 48);
        assert!(t.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn valid_status_and_mode() {
        assert!(is_valid_status("scheduled"));
        assert!(is_valid_status("waiting"));
        assert!(is_valid_status("active"));
        assert!(is_valid_status("ended"));
        assert!(!is_valid_status("paused"));
        assert!(is_valid_mode("live_call"));
        assert!(is_valid_mode("async_recorded"));
        assert!(!is_valid_mode("offline"));
    }
}
