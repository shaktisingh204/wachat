//! HTTP handlers for SabSheet ephemeral presence.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{ListQuery, ListResponse, UpsertPresenceInput, UpsertPresenceResponse};
use crate::types::SabsheetPresence;

pub(crate) const COLL: &str = "sabsheet_presence";

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_presence(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let _ = user_oid(&user)?; // require auth (visibility is workbook-scoped)
    let wb = oid_from_str(&q.workbook_id)?;
    let within = q.within_secs.unwrap_or(30) as i64;
    let cutoff = Utc::now() - Duration::seconds(within);
    let mut filter = doc! {
        "workbookId": wb,
        "lastSeenAt": { "$gte": BsonDateTime::from_chrono(cutoff) },
    };
    if let Some(sid) = q.sheet_id.and_then(|s| ObjectId::parse_str(&s).ok()) {
        filter.insert("sheetId", sid);
    }
    let coll = mongo.collection::<SabsheetPresence>(COLL);
    let cursor = coll
        .find(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_presence.find")))?;
    let items: Vec<SabsheetPresence> = cursor.try_collect().await.unwrap_or_default();
    Ok(Json(ListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn upsert_presence(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<UpsertPresenceInput>,
) -> Result<Json<UpsertPresenceResponse>> {
    let user_id = user_oid(&user)?;
    let sheet_id = oid_from_str(&input.sheet_id)?;
    let workbook_id = oid_from_str(&input.workbook_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<bson::Document>(COLL);
    let filter = doc! { "sheetId": sheet_id, "userId": user_id };
    let update = doc! { "$set": {
        "sheetId": sheet_id,
        "workbookId": workbook_id,
        "userId": user_id,
        "selection": {
            "row": input.selection.row as i64,
            "col": input.selection.col as i64,
            "anchorRow": input.selection.anchor_row as i64,
            "anchorCol": input.selection.anchor_col as i64,
        },
        "color": input.color,
        "lastSeenAt": now,
    } };
    coll.update_one(filter, update)
        .upsert(true)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_presence.upsert"))
        })?;
    Ok(Json(UpsertPresenceResponse { ok: true }))
}
