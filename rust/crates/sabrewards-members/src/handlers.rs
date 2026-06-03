//! HTTP handlers for the SabRewards Member entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
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
    AdjustPointsInput, CreateMemberInput, CreateMemberResponse, DeleteMemberResponse, ListQuery,
};
use crate::types::RewardsMember;

const COLL: &str = "sabrewards_members";
const ENTITY_KIND: &str = "sabrewards_member";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn member_from_create(input: CreateMemberInput, user_id: ObjectId) -> Result<RewardsMember> {
    let program_id = oid_from_str(&input.program_id)?;
    let customer_id = oid_from_str(&input.customer_id)?;
    let bonus = input.welcome_bonus.unwrap_or(0);
    Ok(RewardsMember {
        id: None,
        user_id,
        program_id,
        customer_id,
        current_points: bonus,
        lifetime_points: bonus,
        current_tier: input.initial_tier,
        joined_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn doc_for_audit(entity: &RewardsMember) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<RewardsMember>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_members(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(p) = q.program_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("programId", oid_from_str(p)?);
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "lifetimePoints": -1, "joinedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<RewardsMember>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_members.find"))
    })?;
    let mut rows: Vec<RewardsMember> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_members.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %member_id))]
pub async fn get_member(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(member_id): Path<String>,
) -> Result<Json<RewardsMember>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&member_id)?;
    let coll = mongo.collection::<RewardsMember>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_members.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabrewards_member".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_member(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateMemberInput>,
) -> Result<Json<CreateMemberResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = member_from_create(input, user_id)?;
    let coll = mongo.collection::<RewardsMember>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_members.insert"))
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

    Ok(Json(CreateMemberResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %member_id))]
pub async fn adjust_points(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(member_id): Path<String>,
    Json(patch): Json<AdjustPointsInput>,
) -> Result<Json<RewardsMember>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&member_id)?;

    let coll = mongo.collection::<RewardsMember>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_members.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabrewards_member".to_owned()))?;

    let mut inc = doc! { "currentPoints": patch.delta };
    if patch.delta > 0 {
        inc.insert("lifetimePoints", patch.delta);
    }

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(tier) = patch.new_tier {
        set.insert("currentTier", tier);
    }

    coll.update_one(
        ownership_filter(user_id, oid),
        doc! { "$inc": inc, "$set": set },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabrewards_members.adjust")))?;

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_members.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabrewards_member".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %member_id))]
pub async fn delete_member(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(member_id): Path<String>,
) -> Result<Json<DeleteMemberResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&member_id)?;

    let coll = mongo.collection::<RewardsMember>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_members.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("sabrewards_member".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteMemberResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_seeds_lifetime_with_welcome_bonus() {
        let user = ObjectId::new();
        let input = CreateMemberInput {
            program_id: ObjectId::new().to_hex(),
            customer_id: ObjectId::new().to_hex(),
            welcome_bonus: Some(100),
            initial_tier: Some("Silver".into()),
        };
        let m = member_from_create(input, user).unwrap();
        assert_eq!(m.current_points, 100);
        assert_eq!(m.lifetime_points, 100);
        assert_eq!(m.current_tier.as_deref(), Some("Silver"));
    }

    #[test]
    fn create_defaults_to_zero_when_no_bonus() {
        let user = ObjectId::new();
        let input = CreateMemberInput {
            program_id: ObjectId::new().to_hex(),
            customer_id: ObjectId::new().to_hex(),
            ..Default::default()
        };
        let m = member_from_create(input, user).unwrap();
        assert_eq!(m.current_points, 0);
        assert_eq!(m.lifetime_points, 0);
        assert!(m.current_tier.is_none());
    }
}
