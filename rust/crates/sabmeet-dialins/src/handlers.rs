//! HTTP handlers for the SabMeet dial-in directory.

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
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateDialInInput, CreateDialInResponse, DeleteDialInResponse, ListQuery, ListResponse,
    UpdateDialInInput,
};
use crate::types::DialIn;

const COLL: &str = "meet_dialins";
const PIN_POLICY: &[&str] = &["required", "optional", "none"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_dialins(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(r) = q
        .region_code
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("regionCode", r);
    }
    if q.active_only.unwrap_or(true) {
        filter.insert("active", true);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["label", "phoneNumber", "regionCode", "language"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "regionCode": 1, "label": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<DialIn>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmeet_dialins.find"))
        })?;
    let mut rows: Vec<DialIn> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmeet_dialins.collect"))
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
pub async fn create_dialin(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDialInInput>,
) -> Result<Json<CreateDialInResponse>> {
    let user_id = user_oid(&user)?;
    if input.region_code.trim().is_empty()
        || input.phone_number.trim().is_empty()
        || input.label.trim().is_empty()
    {
        return Err(ApiError::Validation(
            "regionCode, label, and phoneNumber are required".to_owned(),
        ));
    }
    let pin_policy = input
        .pin_policy
        .unwrap_or_else(|| "optional".to_owned())
        .to_lowercase();
    if !PIN_POLICY.contains(&pin_policy.as_str()) {
        return Err(ApiError::Validation(format!(
            "pinPolicy must be one of {:?}",
            PIN_POLICY
        )));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = DialIn {
        id: None,
        user_id,
        region_code: input.region_code.trim().to_uppercase(),
        label: input.label.trim().to_owned(),
        phone_number: input.phone_number.trim().to_owned(),
        pin_policy,
        toll_free: input.toll_free.unwrap_or(false),
        is_default: input.is_default.unwrap_or(false),
        language: input.language,
        active: true,
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<DialIn>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_dialins.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateDialInResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %dialin_id))]
pub async fn update_dialin(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(dialin_id): Path<String>,
    Json(patch): Json<UpdateDialInInput>,
) -> Result<Json<DialIn>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&dialin_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.region_code {
        set.insert("regionCode", v.trim().to_uppercase());
    }
    if let Some(v) = patch.label {
        set.insert("label", v);
    }
    if let Some(v) = patch.phone_number {
        set.insert("phoneNumber", v);
    }
    if let Some(v) = patch.pin_policy.as_deref() {
        if !PIN_POLICY.contains(&v) {
            return Err(ApiError::Validation(format!(
                "pinPolicy must be one of {:?}",
                PIN_POLICY
            )));
        }
        set.insert("pinPolicy", v);
    }
    if let Some(v) = patch.toll_free {
        set.insert("tollFree", v);
    }
    if let Some(v) = patch.is_default {
        set.insert("isDefault", v);
    }
    if let Some(v) = patch.language {
        set.insert("language", v);
    }
    if let Some(v) = patch.active {
        set.insert("active", v);
    }
    let coll = mongo.collection::<DialIn>(COLL);
    coll.update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_dialins.update")))?;
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_dialins.refetch")))?
        .ok_or_else(|| ApiError::NotFound("dialin".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %dialin_id))]
pub async fn delete_dialin(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(dialin_id): Path<String>,
) -> Result<Json<DeleteDialInResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&dialin_id)?;
    let coll = mongo.collection::<DialIn>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": { "active": false, "updatedAt": BsonDateTime::from_chrono(Utc::now()) }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmeet_dialins.archive"))
        })?;
    Ok(Json(DeleteDialInResponse {
        deleted: result.matched_count > 0,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pin_policy_set() {
        for p in ["required", "optional", "none"] {
            assert!(PIN_POLICY.contains(&p));
        }
    }
}
