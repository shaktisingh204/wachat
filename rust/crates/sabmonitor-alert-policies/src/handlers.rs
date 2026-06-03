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
use crate::types::SabmonitorAlertPolicy;

const COLL: &str = "sabmonitor_alert_policies";

fn user_oid(u: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&u.user_id)
        .map_err(|e| ApiError::Validation(format!("invalid userId: {e}")))
}
fn ownership(user_id: ObjectId, id: ObjectId) -> Document {
    doc! { "_id": id, "userId": user_id }
}

fn parse_oids(v: Vec<String>) -> Vec<ObjectId> {
    v.into_iter()
        .filter_map(|s| ObjectId::parse_str(&s).ok())
        .collect()
}

#[instrument(skip_all)]
pub async fn list_policies(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let filter = doc! { "userId": user_id };
    let limit = q.limit.unwrap_or(50).min(200) as i64;
    let skip = q.page.unwrap_or(0) as u64 * limit as u64;
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabmonitorAlertPolicy>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_alert_policies.find"))
    })?;
    let mut rows: Vec<SabmonitorAlertPolicy> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_alert_policies.collect"))
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
pub async fn get_policy(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabmonitorAlertPolicy>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    mongo
        .collection::<SabmonitorAlertPolicy>(COLL)
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_alert_policies.find_one"))
        })?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("alert_policy".into()))
}

#[instrument(skip_all)]
pub async fn create_policy(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePolicyInput>,
) -> Result<Json<CreatePolicyResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".into()));
    }
    let mut entity = SabmonitorAlertPolicy {
        id: None,
        user_id,
        name: input.name,
        check_ids: parse_oids(input.check_ids),
        tag_selector: input.tag_selector,
        conditions: input.conditions,
        channels: input.channels,
        escalate_after_min: input.escalate_after_min,
        escalate_to: input.escalate_to,
        status: input.status.unwrap_or_else(|| "active".into()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabmonitorAlertPolicy>(COLL);
    let r = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_alert_policies.insert"))
    })?;
    let id = r
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id missing")))?;
    entity.id = Some(id);
    Ok(Json(CreatePolicyResponse {
        id: id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all)]
pub async fn update_policy(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdatePolicyInput>,
) -> Result<Json<SabmonitorAlertPolicy>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.check_ids {
        let arr: Vec<bson::Bson> = parse_oids(v)
            .into_iter()
            .map(bson::Bson::ObjectId)
            .collect();
        set.insert("checkIds", arr);
    }
    if let Some(v) = patch.tag_selector {
        set.insert("tagSelector", v);
    }
    if let Some(v) = patch.conditions {
        if let Ok(b) = bson::to_bson(&v) {
            set.insert("conditions", b);
        }
    }
    if let Some(v) = patch.channels {
        if let Ok(b) = bson::to_bson(&v) {
            set.insert("channels", b);
        }
    }
    if let Some(v) = patch.escalate_after_min {
        set.insert("escalateAfterMin", v);
    }
    if let Some(v) = patch.escalate_to {
        if let Ok(b) = bson::to_bson(&v) {
            set.insert("escalateTo", b);
        }
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    let coll = mongo.collection::<SabmonitorAlertPolicy>(COLL);
    let r = coll
        .update_one(ownership(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_alert_policies.update"))
        })?;
    if r.matched_count == 0 {
        return Err(ApiError::NotFound("alert_policy".into()));
    }
    coll.find_one(ownership(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_alert_policies.refetch"))
        })?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("alert_policy".into()))
}

#[instrument(skip_all)]
pub async fn delete_policy(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeletePolicyResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabmonitorAlertPolicy>(COLL);
    let r = coll
        .delete_one(ownership(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_alert_policies.delete"))
        })?;
    if r.deleted_count == 0 {
        return Err(ApiError::NotFound("alert_policy".into()));
    }
    Ok(Json(DeletePolicyResponse { deleted: true }))
}
