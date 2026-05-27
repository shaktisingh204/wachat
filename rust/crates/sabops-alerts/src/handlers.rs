use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    AlertActionResponse, CreateAlertInput, CreateAlertResponse, ListQuery,
};
use crate::types::SabopsAlert;

const COLL: &str = "sabops_alerts";

const VALID_KINDS: &[&str] = &[
    "stale",
    "low_disk",
    "low_battery",
    "patch_failed",
    "unauthorized_software",
];
const VALID_SEV: &[&str] = &["critical", "high", "medium", "low"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabopsAlert>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_alerts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(e) = q.endpoint_id.as_deref().and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("endpointId", e);
    }
    if let Some(k) = q.kind.as_deref() {
        if VALID_KINDS.contains(&k) {
            filter.insert("kind", k);
        }
    }
    if let Some(s) = q.severity.as_deref() {
        if VALID_SEV.contains(&s) {
            filter.insert("severity", s);
        }
    }
    match q.state.as_deref().unwrap_or("open") {
        "open" => {
            filter.insert("resolvedAt", doc! { "$exists": false });
        }
        "acknowledged" => {
            filter.insert("acknowledgedAt", doc! { "$exists": true });
            filter.insert("resolvedAt", doc! { "$exists": false });
        }
        "resolved" => {
            filter.insert("resolvedAt", doc! { "$exists": true });
        }
        _ => {}
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "raisedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabopsAlert>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_alerts.find"))
    })?;
    let mut rows: Vec<SabopsAlert> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_alerts.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_alert(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAlertInput>,
) -> Result<Json<CreateAlertResponse>> {
    let user_id = user_oid(&user)?;
    let endpoint_oid = oid_from_str(&input.endpoint_id)?;
    if !VALID_KINDS.contains(&input.kind.as_str()) {
        return Err(ApiError::Validation(format!(
            "kind must be one of {:?}",
            VALID_KINDS
        )));
    }
    if !VALID_SEV.contains(&input.severity.as_str()) {
        return Err(ApiError::Validation("invalid severity".to_owned()));
    }
    let mut entity = SabopsAlert {
        id: None,
        user_id,
        endpoint_id: endpoint_oid,
        kind: input.kind,
        severity: input.severity,
        message: input.message,
        raised_at: BsonDateTime::from_chrono(Utc::now()),
        acknowledged_by: None,
        acknowledged_at: None,
        resolved_at: None,
    };
    let coll = mongo.collection::<SabopsAlert>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_alerts.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateAlertResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, alert_id = %alert_id))]
pub async fn acknowledge_alert(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(alert_id): Path<String>,
) -> Result<Json<AlertActionResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&alert_id)?;
    let coll = mongo.collection::<SabopsAlert>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! {
                "$set": {
                    "acknowledgedBy": user.user_id.to_string(),
                    "acknowledgedAt": BsonDateTime::from_chrono(Utc::now()),
                }
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_alerts.ack")))?;
    Ok(Json(AlertActionResponse {
        ok: result.matched_count > 0,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, alert_id = %alert_id))]
pub async fn resolve_alert(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(alert_id): Path<String>,
) -> Result<Json<AlertActionResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&alert_id)?;
    let coll = mongo.collection::<SabopsAlert>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! {
                "$set": { "resolvedAt": BsonDateTime::from_chrono(Utc::now()) }
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_alerts.resolve")))?;
    Ok(Json(AlertActionResponse {
        ok: result.matched_count > 0,
    }))
}
