//! HTTP handlers for `/v1/sabprep/profiles`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::tenant::user_oid;
use sabprep_steps::Row;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::compute::profile_rows;
use crate::dto::{ComputeProfileInput, CreateProfileInput, ListQuery, ListResponse};
use crate::types::{ColumnProfile, SabprepProfile};

const PROFILES_COLL: &str = "sabprep_profiles";
const OUTPUTS_COLL: &str = "sabprep_outputs";

fn ownership(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

// ─── GET / ──────────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_profiles(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(ds_id) = q.dataset_id.as_deref().filter(|s| !s.is_empty()) {
        let oid = oid_from_str(ds_id)?;
        filter.insert("datasetId", oid);
    }
    let limit = q.limit.unwrap_or(20).min(200) as i64;
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(limit)
        .build();
    let coll = mongo.collection::<SabprepProfile>(PROFILES_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabprep_profiles.find")))?;
    let rows: Vec<SabprepProfile> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabprep_profiles.collect"))
    })?;
    Ok(Json(ListResponse { items: rows }))
}

// ─── GET /:id ───────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, profile_id = %profile_id))]
pub async fn get_profile(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(profile_id): Path<String>,
) -> Result<Json<SabprepProfile>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&profile_id)?;
    let coll = mongo.collection::<SabprepProfile>(PROFILES_COLL);
    let row = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabprep_profiles.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabprep_profile".to_owned()))?;
    Ok(Json(row))
}

// ─── POST / — compute + persist ─────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_profile(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateProfileInput>,
) -> Result<Json<SabprepProfile>> {
    let user_id = user_oid(&user)?;
    let (dataset_oid, rows): (Option<ObjectId>, Vec<Row>) = match (input.dataset_id, input.rows) {
        (Some(id), _) => {
            let oid = oid_from_str(&id)?;
            let outputs_coll = mongo.collection::<Document>(OUTPUTS_COLL);
            let rows: Vec<Row> = if let Some(doc) = outputs_coll
                .find_one(doc! { "_id": oid, "userId": user_id })
                .await
                .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabprep_outputs.find_one")))?
            {
                if let Ok(arr) = doc.get_array("rows") {
                    bson::from_bson::<Vec<Row>>(bson::Bson::Array(arr.clone())).unwrap_or_default()
                } else {
                    vec![]
                }
            } else {
                return Err(ApiError::NotFound("dataset".to_owned()));
            };
            (Some(oid), rows)
        }
        (None, Some(rows)) => (None, rows),
        (None, None) => return Err(ApiError::Validation("datasetId or rows required".to_owned())),
    };

    let per_column: Vec<ColumnProfile> = profile_rows(&rows);
    let profile = SabprepProfile {
        id: None,
        user_id,
        dataset_id: dataset_oid,
        rows_total: rows.len() as u32,
        per_column,
        created_at: BsonDateTime::from_chrono(Utc::now()),
    };
    let coll = mongo.collection::<SabprepProfile>(PROFILES_COLL);
    let inserted = coll
        .insert_one(&profile)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabprep_profiles.insert")))?;
    let mut persisted = profile;
    persisted.id = inserted.inserted_id.as_object_id();
    Ok(Json(persisted))
}

// ─── POST /compute — ad-hoc, no persist ─────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, n_rows = input.rows.len()))]
pub async fn compute_profile(
    user: AuthUser,
    State(_mongo): State<MongoHandle>,
    Json(input): Json<ComputeProfileInput>,
) -> Result<Json<Vec<ColumnProfile>>> {
    let _ = user_oid(&user)?;
    Ok(Json(profile_rows(&input.rows)))
}

// ─── DELETE /:id ────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, profile_id = %profile_id))]
pub async fn delete_profile(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(profile_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&profile_id)?;
    let coll = mongo.collection::<SabprepProfile>(PROFILES_COLL);
    let res = coll
        .delete_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabprep_profiles.delete")))?;
    Ok(Json(serde_json::json!({ "deleted": res.deleted_count > 0 })))
}
