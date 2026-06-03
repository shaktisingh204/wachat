//! HTTP handlers for the SabRewards Redemption ledger.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_update, write_audit},
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
    CreateRedemptionInput, CreateRedemptionResponse, ListQuery, UpdateRedemptionStatusInput,
};
use crate::types::RewardsRedemption;

const COLL: &str = "sabrewards_redemptions";
const ENTITY_KIND: &str = "sabrewards_redemption";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn redemption_from_create(
    input: CreateRedemptionInput,
    user_id: ObjectId,
) -> Result<RewardsRedemption> {
    if input.points <= 0 {
        return Err(ApiError::Validation("points must be positive".to_owned()));
    }
    let member_id = oid_from_str(&input.member_id)?;
    let catalog_item_id = oid_from_str(&input.catalog_item_id)?;
    Ok(RewardsRedemption {
        id: None,
        user_id,
        member_id,
        catalog_item_id,
        points: input.points,
        status: "pending".to_owned(),
        redeemed_at: BsonDateTime::from_chrono(Utc::now()),
        fulfilled_at: None,
        cancelled_at: None,
        notes: input.notes,
        updated_at: None,
    })
}

fn doc_for_audit(entity: &RewardsRedemption) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<RewardsRedemption>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_redemptions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(m) = q.member_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("memberId", oid_from_str(m)?);
    }
    if let Some(s) = q.status.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("status", s);
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "redeemedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<RewardsRedemption>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_redemptions.find"))
    })?;
    let mut rows: Vec<RewardsRedemption> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_redemptions.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %redemption_id))]
pub async fn get_redemption(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(redemption_id): Path<String>,
) -> Result<Json<RewardsRedemption>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&redemption_id)?;
    let coll = mongo.collection::<RewardsRedemption>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_redemptions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabrewards_redemption".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_redemption(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRedemptionInput>,
) -> Result<Json<CreateRedemptionResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = redemption_from_create(input, user_id)?;
    let coll = mongo.collection::<RewardsRedemption>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_redemptions.insert"))
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

    // TODO(integrator): also `$inc` sabrewards_members.currentPoints by -points
    // and bump stock on sabrewards_catalog. For now the route is append-only;
    // the orchestrating server action does the balance update via the
    // members adjust endpoint.

    Ok(Json(CreateRedemptionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %redemption_id))]
pub async fn update_redemption_status(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(redemption_id): Path<String>,
    Json(patch): Json<UpdateRedemptionStatusInput>,
) -> Result<Json<RewardsRedemption>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&redemption_id)?;

    let target = patch.status.as_str();
    if target != "fulfilled" && target != "cancelled" {
        return Err(ApiError::Validation(
            "status must be fulfilled or cancelled".to_owned(),
        ));
    }

    let coll = mongo.collection::<RewardsRedemption>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_redemptions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabrewards_redemption".to_owned()))?;

    if before.status != "pending" {
        return Err(ApiError::Validation(format!(
            "cannot transition from {} to {}",
            before.status, target
        )));
    }

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "status": target, "updatedAt": now };
    if target == "fulfilled" {
        set.insert("fulfilledAt", now);
    } else {
        set.insert("cancelledAt", now);
    }
    if let Some(notes) = patch.notes {
        set.insert("notes", notes);
    }

    coll.update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_redemptions.update"))
        })?;

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_redemptions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabrewards_redemption".to_owned()))?;

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_rejects_non_positive_points() {
        let user = ObjectId::new();
        let input = CreateRedemptionInput {
            member_id: ObjectId::new().to_hex(),
            catalog_item_id: ObjectId::new().to_hex(),
            points: 0,
            notes: None,
        };
        assert!(redemption_from_create(input, user).is_err());
    }

    #[test]
    fn create_seeds_pending_status() {
        let user = ObjectId::new();
        let input = CreateRedemptionInput {
            member_id: ObjectId::new().to_hex(),
            catalog_item_id: ObjectId::new().to_hex(),
            points: 500,
            notes: None,
        };
        let r = redemption_from_create(input, user).unwrap();
        assert_eq!(r.status, "pending");
        assert!(r.fulfilled_at.is_none());
        assert!(r.cancelled_at.is_none());
    }
}
