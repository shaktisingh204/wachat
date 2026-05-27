//! HTTP handlers for the SabPractice Engagement entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateEngagementInput, CreateEngagementResponse, DeleteEngagementResponse, ListQuery,
    UpdateEngagementInput,
};
use crate::types::SabPracticeEngagement;

const ENGAGEMENTS_COLL: &str = "sabpractice_engagements";

fn list_filter(user_id: ObjectId, status: Option<&str>, client_id: Option<ObjectId>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "completed" => {
            filter.insert("status", "completed");
        }
        "paused" => {
            filter.insert("status", "paused");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "completed" });
        }
    }
    if let Some(c) = client_id {
        filter.insert("clientId", c);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn entity_from_create(
    input: CreateEngagementInput,
    user_id: ObjectId,
) -> Result<SabPracticeEngagement> {
    let client_oid = oid_from_str(&input.client_id)?;
    let scope_bson = match input.scope_json {
        Some(v) => Some(bson::to_bson(&v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("encode scopeJson"))
        })?),
        None => None,
    };
    Ok(SabPracticeEngagement {
        id: None,
        user_id,
        client_id: client_oid,
        name: input.name,
        scope_json: scope_bson,
        start_date: BsonDateTime::from_chrono(input.start_date),
        end_date: input.end_date.map(BsonDateTime::from_chrono),
        status: Some(input.status.unwrap_or_else(|| "active".to_owned())),
        hourly_rate_minor: input.hourly_rate_minor,
        currency: input.currency,
        billing_cadence: input.billing_cadence,
        assigned_user_ids: input.assigned_user_ids,
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateEngagementInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.client_id {
        set.insert("clientId", oid_from_str(&v)?);
    }
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.scope_json {
        let bson = bson::to_bson(&v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("encode scopeJson"))
        })?;
        set.insert("scopeJson", bson);
    }
    if let Some(v) = patch.start_date {
        set.insert("startDate", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.end_date {
        set.insert("endDate", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.hourly_rate_minor {
        set.insert("hourlyRateMinor", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.billing_cadence {
        set.insert("billingCadence", v);
    }
    if let Some(v) = patch.assigned_user_ids {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("assignedUserIds", arr);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    Ok(doc! { "$set": set })
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabPracticeEngagement>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_engagements(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let client_oid = match q.client_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    let mut filter = list_filter(user_id, q.status.as_deref(), client_oid);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "notes"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "startDate": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabPracticeEngagement>(ENGAGEMENTS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_engagements.find")))?;
    let mut rows: Vec<SabPracticeEngagement> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_engagements.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn get_engagement(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabPracticeEngagement>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeEngagement>(ENGAGEMENTS_COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_engagements.find_one")))?
        .ok_or_else(|| ApiError::NotFound("engagement".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_engagement(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateEngagementInput>,
) -> Result<Json<CreateEngagementResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<SabPracticeEngagement>(ENGAGEMENTS_COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_engagements.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateEngagementResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_engagement(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateEngagementInput>,
) -> Result<Json<SabPracticeEngagement>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeEngagement>(ENGAGEMENTS_COLL);
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_engagements.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("engagement".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_engagements.refetch")))?
        .ok_or_else(|| ApiError::NotFound("engagement".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_engagement(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteEngagementResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeEngagement>(ENGAGEMENTS_COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "completed",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_engagements.complete")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("engagement".to_owned()));
    }
    Ok(Json(DeleteEngagementResponse { deleted: true }))
}
