//! HTTP handlers for SabCheckout subscriptions.

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
    CancelResponse, CreateSubscriptionInput, CreateSubscriptionResponse, ListQuery,
    UpdateSubscriptionInput,
};
use crate::types::SabcheckoutSubscription;

const COLL: &str = "sabcheckout_subscriptions";

fn parse_iso(s: &str) -> Result<BsonDateTime> {
    let dt = chrono::DateTime::parse_from_rfc3339(s)
        .map_err(|e| ApiError::Validation(format!("invalid date: {e}")))?;
    Ok(BsonDateTime::from_chrono(dt.with_timezone(&Utc)))
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabcheckoutSubscription>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_subscriptions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.status.as_deref().filter(|s| !s.is_empty() && *s != "all") {
        filter.insert("status", s);
    }
    if let Some(s) = q.plan_id.as_deref() {
        if let Ok(oid) = oid_from_str(s) {
            filter.insert("planId", oid);
        }
    }
    if let Some(s) = q.customer_id.as_deref() {
        if let Ok(oid) = oid_from_str(s) {
            filter.insert("customerId", oid);
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabcheckoutSubscription>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_subscriptions.find"))
    })?;
    let mut rows: Vec<SabcheckoutSubscription> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_subscriptions.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, subscription_id = %subscription_id))]
pub async fn get_subscription(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(subscription_id): Path<String>,
) -> Result<Json<SabcheckoutSubscription>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&subscription_id)?;
    let coll = mongo.collection::<SabcheckoutSubscription>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_subscriptions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_subscription".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_subscription(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSubscriptionInput>,
) -> Result<Json<CreateSubscriptionResponse>> {
    let user_id = user_oid(&user)?;
    let plan_id = oid_from_str(&input.plan_id)?;
    let customer_id = oid_from_str(&input.customer_id)?;
    let start = parse_iso(&input.current_period_start)?;
    let end = parse_iso(&input.current_period_end)?;

    let mut entity = SabcheckoutSubscription {
        id: None,
        user_id,
        plan_id,
        customer_id,
        status: input.status.unwrap_or_else(|| "active".to_owned()),
        current_period_start: start,
        current_period_end: end,
        provider_subscription_id: input.provider_subscription_id,
        cancelled_at: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };

    let coll = mongo.collection::<SabcheckoutSubscription>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_subscriptions.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    Ok(Json(CreateSubscriptionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, subscription_id = %subscription_id))]
pub async fn update_subscription(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(subscription_id): Path<String>,
    Json(patch): Json<UpdateSubscriptionInput>,
) -> Result<Json<SabcheckoutSubscription>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&subscription_id)?;

    let mut set: Document = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.current_period_start {
        set.insert("currentPeriodStart", parse_iso(&v)?);
    }
    if let Some(v) = patch.current_period_end {
        set.insert("currentPeriodEnd", parse_iso(&v)?);
    }
    if let Some(v) = patch.provider_subscription_id {
        set.insert("providerSubscriptionId", v);
    }

    let coll = mongo.collection::<SabcheckoutSubscription>(COLL);
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_subscriptions.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabcheckout_subscription".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_subscriptions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_subscription".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, subscription_id = %subscription_id))]
pub async fn cancel_subscription(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(subscription_id): Path<String>,
) -> Result<Json<CancelResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&subscription_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<SabcheckoutSubscription>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! {
                "$set": {
                    "status": "cancelled",
                    "cancelledAt": now,
                    "updatedAt": now,
                }
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_subscriptions.cancel"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabcheckout_subscription".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_subscriptions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_subscription".to_owned()))?;
    Ok(Json(CancelResponse {
        cancelled: true,
        entity: after,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_iso_round_trips() {
        let dt = parse_iso("2026-05-27T12:00:00Z").unwrap();
        let chrono_dt: chrono::DateTime<Utc> = dt.to_chrono();
        assert_eq!(
            chrono_dt.to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
            "2026-05-27T12:00:00Z"
        );
    }

    #[test]
    fn parse_iso_rejects_garbage() {
        assert!(parse_iso("not-a-date").is_err());
    }
}
