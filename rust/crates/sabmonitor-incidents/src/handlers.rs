use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::*;
use crate::types::SabmonitorIncident;

const COLL: &str = "sabmonitor_incidents";

fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|e| ApiError::Validation(format!("invalid userId: {e}")))
}
fn ownership(user_id: ObjectId, id: ObjectId) -> Document {
    doc! { "_id": id, "userId": user_id }
}

#[instrument(skip_all)]
pub async fn list_incidents(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    match q.status.as_deref().unwrap_or("all") {
        "all" => {}
        s => {
            filter.insert("status", s);
        }
    }
    if let Some(c) = q.check_id.as_deref() {
        filter.insert("checkId", oid_from_str(c)?);
    }
    let limit = q.limit.unwrap_or(50).min(200) as i64;
    let skip = q.page.unwrap_or(0) as u64 * limit as u64;
    let opts = FindOptions::builder()
        .sort(doc! { "startedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabmonitorIncident>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_incidents.find"))
    })?;
    let mut rows: Vec<SabmonitorIncident> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_incidents.collect"))
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

#[instrument(skip_all)]
pub async fn create_incident(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateIncidentInput>,
) -> Result<Json<CreateIncidentResponse>> {
    let user_id = user_oid(&user)?;
    let check_oid = oid_from_str(&input.check_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabmonitorIncident {
        id: None,
        user_id,
        check_id: check_oid,
        started_at: now,
        ended_at: None,
        status: "ongoing".into(),
        severity: input.severity,
        downtime_secs: None,
        root_cause_summary: input.root_cause_summary,
        acknowledged_by: None,
        acknowledged_at: None,
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SabmonitorIncident>(COLL);
    let r = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_incidents.insert"))
    })?;
    let id = r
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id missing")))?;
    entity.id = Some(id);
    Ok(Json(CreateIncidentResponse {
        id: id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all)]
pub async fn acknowledge_incident(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<AckResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<SabmonitorIncident>(COLL);
    let r = coll
        .update_one(
            ownership(user_id, oid),
            doc! { "$set": { "acknowledgedBy": user_id, "acknowledgedAt": now, "updatedAt": now } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_incidents.ack"))
        })?;
    if r.matched_count == 0 {
        return Err(ApiError::NotFound("incident".into()));
    }
    let row = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_incidents.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("incident".into()))?;
    Ok(Json(AckResponse { entity: row }))
}

#[instrument(skip_all)]
pub async fn resolve_incident(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<AckResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<SabmonitorIncident>(COLL);

    // Compute downtimeSecs from startedAt.
    let before = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabmonitor_incidents.find_for_resolve"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("incident".into()))?;
    let downtime = (Utc::now().timestamp() - before.started_at.timestamp_millis() / 1000).max(0);

    let r = coll
        .update_one(
            ownership(user_id, oid),
            doc! { "$set": {
                "status": "resolved",
                "endedAt": now,
                "downtimeSecs": downtime,
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_incidents.resolve"))
        })?;
    if r.matched_count == 0 {
        return Err(ApiError::NotFound("incident".into()));
    }
    let row = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_incidents.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("incident".into()))?;
    Ok(Json(AckResponse { entity: row }))
}
