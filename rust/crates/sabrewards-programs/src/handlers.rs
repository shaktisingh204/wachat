//! HTTP handlers for the SabRewards Program entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
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
    CreateRewardsProgramInput, CreateRewardsProgramResponse, DeleteRewardsProgramResponse,
    ListQuery, UpdateRewardsProgramInput,
};
use crate::types::RewardsProgram;

const COLL: &str = "sabrewards_programs";
const ENTITY_KIND: &str = "sabrewards_program";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "paused" => {
            filter.insert("status", "paused");
        }
        "active" => {
            filter.insert("status", "active");
        }
        "draft" => {
            filter.insert("status", "draft");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn program_from_create(
    input: CreateRewardsProgramInput,
    user_id: ObjectId,
) -> Result<RewardsProgram> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let tier_engine_ref = match input.tier_engine_ref.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    Ok(RewardsProgram {
        id: None,
        user_id,
        name: input.name.trim().to_string(),
        description: input.description,
        tier_engine_ref,
        points_expire_after_days: input.points_expire_after_days,
        status: Some("active".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateRewardsProgramInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v.trim());
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.tier_engine_ref {
        if v.is_empty() {
            set.insert("tierEngineRef", bson::Bson::Null);
        } else {
            set.insert("tierEngineRef", oid_from_str(&v)?);
        }
    }
    if let Some(v) = patch.points_expire_after_days {
        set.insert("pointsExpireAfterDays", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &RewardsProgram) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<RewardsProgram>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_programs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
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

    let coll = mongo.collection::<RewardsProgram>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_programs.find"))
    })?;
    let mut rows: Vec<RewardsProgram> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_programs.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %program_id))]
pub async fn get_program(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(program_id): Path<String>,
) -> Result<Json<RewardsProgram>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&program_id)?;
    let coll = mongo.collection::<RewardsProgram>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_programs.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabrewards_program".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_program(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRewardsProgramInput>,
) -> Result<Json<CreateRewardsProgramResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = program_from_create(input, user_id)?;
    let coll = mongo.collection::<RewardsProgram>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_programs.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateRewardsProgramResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %program_id))]
pub async fn update_program(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(program_id): Path<String>,
    Json(patch): Json<UpdateRewardsProgramInput>,
) -> Result<Json<RewardsProgram>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&program_id)?;

    let coll = mongo.collection::<RewardsProgram>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_programs.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabrewards_program".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_programs.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabrewards_program".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_programs.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabrewards_program".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %program_id))]
pub async fn delete_program(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(program_id): Path<String>,
) -> Result<Json<DeleteRewardsProgramResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&program_id)?;

    let coll = mongo.collection::<RewardsProgram>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_programs.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabrewards_program".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteRewardsProgramResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn program_from_create_stamps_active_status() {
        let user_id = ObjectId::new();
        let input = CreateRewardsProgramInput {
            name: "Spring rewards".into(),
            ..Default::default()
        };
        let p = program_from_create(input, user_id).unwrap();
        assert_eq!(p.status.as_deref(), Some("active"));
        assert_eq!(p.name, "Spring rewards");
        assert!(p.tier_engine_ref.is_none());
    }

    #[test]
    fn program_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateRewardsProgramInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(program_from_create(input, user_id).is_err());
    }

    #[test]
    fn program_from_create_parses_tier_engine_ref() {
        let user_id = ObjectId::new();
        let other = ObjectId::new();
        let input = CreateRewardsProgramInput {
            name: "Gold".into(),
            tier_engine_ref: Some(other.to_hex()),
            ..Default::default()
        };
        let p = program_from_create(input, user_id).unwrap();
        assert_eq!(p.tier_engine_ref, Some(other));
    }
}
