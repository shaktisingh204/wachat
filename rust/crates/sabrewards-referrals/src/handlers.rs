//! HTTP handlers for the SabRewards Referral entity.

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
    CreateReferralInput, CreateReferralResponse, DeleteReferralResponse, ListQuery,
    LogConversionInput,
};
use crate::types::{RewardsReferral, RewardsReferralConversion};

const COLL: &str = "sabrewards_referrals";
const ENTITY_KIND: &str = "sabrewards_referral";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn referral_from_create(
    input: CreateReferralInput,
    user_id: ObjectId,
) -> Result<RewardsReferral> {
    let code = input.code.trim().to_string();
    if code.is_empty() {
        return Err(ApiError::Validation("code is required".to_owned()));
    }
    let member_id = oid_from_str(&input.member_id)?;
    let program_id = match input.program_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    Ok(RewardsReferral {
        id: None,
        user_id,
        member_id,
        program_id,
        code,
        shared_at: BsonDateTime::from_chrono(Utc::now()),
        conversions: Vec::new(),
        reward_points: 0,
        active: true,
        updated_at: None,
    })
}

fn doc_for_audit(entity: &RewardsReferral) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<RewardsReferral>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_referrals(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(m) = q.member_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("memberId", oid_from_str(m)?);
    }
    if let Some(p) = q.program_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("programId", oid_from_str(p)?);
    }
    if q.active_only.unwrap_or(false) {
        filter.insert("active", true);
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "rewardPoints": -1, "sharedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<RewardsReferral>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_referrals.find"))
        })?;
    let mut rows: Vec<RewardsReferral> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_referrals.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %referral_id))]
pub async fn get_referral(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(referral_id): Path<String>,
) -> Result<Json<RewardsReferral>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&referral_id)?;
    let coll = mongo.collection::<RewardsReferral>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_referrals.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabrewards_referral".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_referral(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateReferralInput>,
) -> Result<Json<CreateReferralResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = referral_from_create(input, user_id)?;
    let coll = mongo.collection::<RewardsReferral>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_referrals.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) =
        audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateReferralResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %referral_id))]
pub async fn log_conversion(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(referral_id): Path<String>,
    Json(input): Json<LogConversionInput>,
) -> Result<Json<RewardsReferral>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&referral_id)?;
    let invitee = oid_from_str(&input.invitee_id)?;

    let coll = mongo.collection::<RewardsReferral>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_referrals.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabrewards_referral".to_owned()))?;

    let awarded = input.awarded_points.unwrap_or(0);
    let conversion = RewardsReferralConversion {
        invitee_id: invitee,
        converted_at: BsonDateTime::from_chrono(Utc::now()),
        kind: input.kind,
        awarded_points: awarded,
    };
    let conversion_doc = bson::to_document(&conversion).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_referrals.conversion_doc"))
    })?;

    coll.update_one(
        ownership_filter(user_id, oid),
        doc! {
            "$push": { "conversions": conversion_doc },
            "$inc": { "rewardPoints": awarded },
            "$set": { "updatedAt": BsonDateTime::from_chrono(Utc::now()) },
        },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabrewards_referrals.push_conversion"))
    })?;

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_referrals.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabrewards_referral".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    // TODO(integrator): also $inc sabrewards_members.currentPoints/lifetimePoints
    // for the inviter by `awarded`. Orchestrating server action handles it
    // via /v1/sabrewards/members/{id}/adjust for now.

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %referral_id))]
pub async fn delete_referral(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(referral_id): Path<String>,
) -> Result<Json<DeleteReferralResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&referral_id)?;
    let coll = mongo.collection::<RewardsReferral>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "active": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabrewards_referrals.deactivate"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabrewards_referral".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteReferralResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_rejects_empty_code() {
        let user = ObjectId::new();
        let input = CreateReferralInput {
            member_id: ObjectId::new().to_hex(),
            code: "   ".into(),
            program_id: None,
        };
        assert!(referral_from_create(input, user).is_err());
    }

    #[test]
    fn create_starts_zero_reward_active() {
        let user = ObjectId::new();
        let input = CreateReferralInput {
            member_id: ObjectId::new().to_hex(),
            code: "FRIEND10".into(),
            program_id: None,
        };
        let r = referral_from_create(input, user).unwrap();
        assert_eq!(r.reward_points, 0);
        assert!(r.active);
        assert!(r.conversions.is_empty());
    }
}
