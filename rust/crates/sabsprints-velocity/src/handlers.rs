//! HTTP handlers for velocity snapshots.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{ListQuery, RecordVelocityInput, RecordVelocityResponse};
use crate::types::AgileVelocity;

const COLL: &str = "agile_velocity";

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn clamp_limit(n: Option<u32>) -> i64 {
    let n = n.unwrap_or(10);
    n.clamp(1, 50) as i64
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<AgileVelocity>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_velocity(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter: Document = doc! { "userId": user_id };
    if let Some(pid) = q
        .project_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("projectId", pid);
    }
    let limit = clamp_limit(q.limit);
    let opts = FindOptions::builder()
        .sort(doc! { "completedAt": -1 })
        .limit(limit)
        .build();
    let coll = mongo.collection::<AgileVelocity>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("agile_velocity.find"))
        })?;
    let mut rows: Vec<AgileVelocity> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("agile_velocity.collect")))?;
    // Surface oldest-first for chart rendering.
    rows.reverse();
    Ok(Json(ListResponse { items: rows }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn record_velocity(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<RecordVelocityInput>,
) -> Result<Json<RecordVelocityResponse>> {
    let user_id = user_oid(&user)?;
    let project_id = ObjectId::parse_str(input.project_id.trim())
        .map_err(|_| ApiError::Validation("projectId must be a valid ObjectId".to_owned()))?;
    let sprint_id = ObjectId::parse_str(input.sprint_id.trim())
        .map_err(|_| ApiError::Validation("sprintId must be a valid ObjectId".to_owned()))?;
    if input.sprint_name.trim().is_empty() {
        return Err(ApiError::Validation("sprintName is required".to_owned()));
    }
    let completed_at = input
        .completed_at
        .as_deref()
        .and_then(parse_date)
        .unwrap_or_else(|| BsonDateTime::from_chrono(Utc::now()));
    let entity = AgileVelocity {
        id: None,
        user_id,
        project_id,
        sprint_id,
        sprint_name: input.sprint_name.trim().to_owned(),
        planned_points: input.planned_points,
        completed_points: input.completed_points,
        completed_at,
        created_at: BsonDateTime::from_chrono(Utc::now()),
    };
    let coll = mongo.collection::<AgileVelocity>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("agile_velocity.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    let mut entity = entity;
    entity.id = Some(new_id);
    Ok(Json(RecordVelocityResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_limit_bounds() {
        assert_eq!(clamp_limit(None), 10);
        assert_eq!(clamp_limit(Some(0)), 1);
        assert_eq!(clamp_limit(Some(999)), 50);
    }
}
