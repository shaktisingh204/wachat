use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::{FindOptions, FindOneAndUpdateOptions, ReturnDocument};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{ListQuery, UpsertHardwareInput, UpsertHardwareResponse};
use crate::types::SabopsHardware;

const COLL: &str = "sabops_hardware";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabopsHardware>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_hardware(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter: Document = doc! { "userId": user_id };
    if let Some(e) = q.endpoint_id.as_deref().and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("endpointId", e);
    }
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(200)
        .build();
    let coll = mongo.collection::<SabopsHardware>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_hardware.find")))?;
    let rows: Vec<SabopsHardware> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_hardware.collect"))
    })?;
    Ok(Json(ListResponse { items: rows }))
}

/// One-row-per-endpoint upsert. Inserts on first call; replaces specs
/// on subsequent calls (preserving `_id` + `createdAt`).
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn upsert_hardware(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<UpsertHardwareInput>,
) -> Result<Json<UpsertHardwareResponse>> {
    let user_id = user_oid(&user)?;
    let endpoint_oid = oid_from_str(&input.endpoint_id)?;

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! {
        "userId": user_id,
        "endpointId": endpoint_oid,
        "updatedAt": now,
        "lastInventoryAt": now,
    };
    if let Some(v) = input.cpu {
        set.insert("cpu", v);
    }
    if let Some(v) = input.ram_gb {
        set.insert("ramGb", v);
    }
    if let Some(v) = input.disk_gb {
        set.insert("diskGb", v);
    }
    if let Some(v) = input.gpu {
        set.insert("gpu", v);
    }
    if let Some(v) = input.battery_health {
        set.insert("batteryHealth", v as i32);
    }

    let update = doc! {
        "$set": set,
        "$setOnInsert": { "createdAt": now },
    };
    let opts = FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(ReturnDocument::After)
        .build();
    let coll = mongo.collection::<SabopsHardware>(COLL);
    let entity = coll
        .find_one_and_update(
            doc! { "userId": user_id, "endpointId": endpoint_oid },
            update,
        )
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_hardware.upsert")))?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("upsert returned None")))?;
    let id_hex = entity.id.map(|o| o.to_hex()).unwrap_or_default();
    Ok(Json(UpsertHardwareResponse {
        id: id_hex,
        entity,
    }))
}
