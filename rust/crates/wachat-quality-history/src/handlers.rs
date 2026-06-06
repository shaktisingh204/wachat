//! HTTP handlers for the wachat quality-history domain.
//!
//! All endpoints are scoped to the authenticated user (`userId`) and the
//! `phoneNumberId` in the path. The `/wachat/health` page is the primary
//! consumer; snapshots are also written here by a webhook later.
//!
//! | Endpoint                                          | Action            |
//! |---------------------------------------------------|-------------------|
//! | `GET  /v1/wachat/quality-history/{phoneNumberId}`          | list snapshots   |
//! | `POST /v1/wachat/quality-history/{phoneNumberId}/snapshot` | record snapshot  |

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::document_to_clean_json;
use tracing::instrument;

use crate::dto::{ListSnapshotsResponse, SnapshotBody, SuccessResponse};
use crate::state::WachatQualityHistoryState;

const COLL: &str = "wa_phone_quality_history";

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Normalize/validate the quality rating to one of `GREEN | YELLOW | RED`.
fn normalize_rating(raw: &str) -> Result<String> {
    let upper = raw.trim().to_uppercase();
    match upper.as_str() {
        "GREEN" | "YELLOW" | "RED" => Ok(upper),
        _ => Err(ApiError::Validation(
            "rating must be one of 'GREEN', 'YELLOW', or 'RED'.".to_owned(),
        )),
    }
}

/// Build the `event` BSON value from the optional string (empty -> null).
fn event_bson(event: &Option<String>) -> Bson {
    match event.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(e) => Bson::String(e.to_owned()),
        None => Bson::Null,
    }
}

// ===========================================================================
// GET /v1/wachat/quality-history/{phoneNumberId}
// ===========================================================================

/// Time-series snapshots for one phone number, sorted by `date` ascending.
/// Returns an empty array when there are none — an honest empty state, never
/// mock data.
#[instrument(skip_all)]
pub async fn list_snapshots(
    user: AuthUser,
    State(state): State<WachatQualityHistoryState>,
    Path(phone_number_id): Path<String>,
) -> Result<Json<ListSnapshotsResponse>> {
    let uid = user_oid(&user)?;
    if phone_number_id.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "phoneNumberId is required.".to_owned(),
        ));
    }
    let opts = FindOptions::builder().sort(doc! { "date": 1 }).build();
    let cursor = state
        .mongo
        .collection::<Document>(COLL)
        .find(doc! { "userId": uid, "phoneNumberId": &phone_number_id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("quality_history.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("quality_history.collect")))?;
    let snapshots = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListSnapshotsResponse { snapshots }))
}

// ===========================================================================
// POST /v1/wachat/quality-history/{phoneNumberId}/snapshot
// ===========================================================================

/// Record one quality snapshot for a phone number with a server timestamp.
#[instrument(skip_all)]
pub async fn create_snapshot(
    user: AuthUser,
    State(state): State<WachatQualityHistoryState>,
    Path(phone_number_id): Path<String>,
    Json(body): Json<SnapshotBody>,
) -> Result<Json<SuccessResponse>> {
    let uid = user_oid(&user)?;
    if phone_number_id.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "phoneNumberId is required.".to_owned(),
        ));
    }
    let rating = normalize_rating(&body.rating)?;
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_doc = doc! {
        "_id": ObjectId::new(),
        "userId": uid,
        "phoneNumberId": &phone_number_id,
        "rating": &rating,
        "event": event_bson(&body.event),
        "date": now,
        "createdAt": now,
    };
    state
        .mongo
        .collection::<Document>(COLL)
        .insert_one(new_doc)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("quality_history.insert_one"))
        })?;
    Ok(Json(SuccessResponse::ok()))
}
