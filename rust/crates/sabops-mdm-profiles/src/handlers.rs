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
    CreateProfileInput, CreateProfileResponse, DeleteProfileResponse, DeployProfileInput,
    DeployProfileResponse, ListQuery, UpdateProfileInput,
};
use crate::types::SabopsMdmProfile;

const COLL: &str = "sabops_mdm_profiles";
const VALID_PLATFORM: &[&str] = &["ios", "android"];
const VALID_STATUS: &[&str] = &["draft", "deployed"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabopsMdmProfile>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_profiles(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(p) = q.platform.as_deref() {
        if VALID_PLATFORM.contains(&p) {
            filter.insert("platform", p);
        }
    }
    if let Some(s) = q.status.as_deref() {
        if VALID_STATUS.contains(&s) {
            filter.insert("status", s);
        }
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabopsMdmProfile>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_mdm_profiles.find"))
    })?;
    let mut rows: Vec<SabopsMdmProfile> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_mdm_profiles.collect"))
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
pub async fn create_profile(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateProfileInput>,
) -> Result<Json<CreateProfileResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if !VALID_PLATFORM.contains(&input.platform.as_str()) {
        return Err(ApiError::Validation(format!(
            "platform must be one of {:?}",
            VALID_PLATFORM
        )));
    }
    let mut entity = SabopsMdmProfile {
        id: None,
        user_id,
        name: input.name,
        platform: input.platform,
        config_json: input.config_json,
        status: "draft".to_owned(),
        deployed_to_endpoint_ids: Vec::new(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabopsMdmProfile>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_mdm_profiles.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateProfileResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, profile_id = %profile_id))]
pub async fn update_profile(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(profile_id): Path<String>,
    Json(patch): Json<UpdateProfileInput>,
) -> Result<Json<SabopsMdmProfile>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&profile_id)?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.config_json {
        let d = bson::to_bson(&v)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("configJson encode")))?;
        set.insert("configJson", d);
    }
    if let Some(v) = patch.status {
        if !VALID_STATUS.contains(&v.as_str()) {
            return Err(ApiError::Validation("invalid status".to_owned()));
        }
        set.insert("status", v);
    }
    let coll = mongo.collection::<SabopsMdmProfile>(COLL);
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_mdm_profiles.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("profile".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_mdm_profiles.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("profile".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, profile_id = %profile_id))]
pub async fn delete_profile(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(profile_id): Path<String>,
) -> Result<Json<DeleteProfileResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&profile_id)?;
    let coll = mongo.collection::<SabopsMdmProfile>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_mdm_profiles.delete"))
        })?;
    Ok(Json(DeleteProfileResponse {
        deleted: result.deleted_count > 0,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, profile_id = %profile_id))]
pub async fn deploy_profile(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(profile_id): Path<String>,
    Json(input): Json<DeployProfileInput>,
) -> Result<Json<DeployProfileResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&profile_id)?;
    let target_oids: Vec<ObjectId> = input
        .endpoint_ids
        .iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .collect();
    if target_oids.is_empty() {
        return Err(ApiError::Validation(
            "endpointIds must contain at least one valid id".to_owned(),
        ));
    }
    let arr: Vec<Bson> = target_oids.iter().map(|o| Bson::ObjectId(*o)).collect();

    let coll = mongo.collection::<SabopsMdmProfile>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! {
                "$set": {
                    "status": "deployed",
                    "updatedAt": BsonDateTime::from_chrono(Utc::now()),
                },
                "$addToSet": {
                    "deployedToEndpointIds": { "$each": arr.clone() }
                },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_mdm_profiles.deploy"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("profile".to_owned()));
    }
    Ok(Json(DeployProfileResponse {
        profile_id: oid.to_hex(),
        deployed_count: target_oids.len(),
    }))
}
