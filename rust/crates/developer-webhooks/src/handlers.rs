//! Axum handlers for the webhook control plane.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Deserialize;

use crate::{
    dto::{
        AckResult, CreateSubBody, CreateSubResult, Delivery, DeliveryList, Subscription,
        SubscriptionList, UpdateSubBody,
    },
    store,
};

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryListQuery {
    /// Filter to a single subscription.
    pub subscription_id: Option<String>,
    /// Page size (capped at 200 by the store layer).
    pub limit: Option<i64>,
}

pub async fn create_sub(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateSubBody>,
) -> Result<Json<CreateSubResult>> {
    let created = store::create(&mongo, &user.user_id, &body.url, body.events, body.description)
        .await?;
    Ok(Json(CreateSubResult {
        subscription: created.subscription,
        secret: created.plaintext_secret,
    }))
}

pub async fn list_subs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<SubscriptionList>> {
    let data = store::list(&mongo, &user.user_id).await?;
    Ok(Json(SubscriptionList { data }))
}

pub async fn get_sub(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(sub_id): Path<String>,
) -> Result<Json<Subscription>> {
    match store::get_one(&mongo, &user.user_id, &sub_id).await? {
        Some(sub) => Ok(Json(sub)),
        None => Err(ApiError::NotFound("subscription".to_owned())),
    }
}

pub async fn update_sub(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(sub_id): Path<String>,
    Json(body): Json<UpdateSubBody>,
) -> Result<Json<AckResult>> {
    let ok = store::update(
        &mongo,
        &user.user_id,
        &sub_id,
        body.url,
        body.events,
        body.description,
        body.status,
    )
    .await?;
    if !ok {
        return Err(ApiError::NotFound("subscription".to_owned()));
    }
    Ok(Json(AckResult {
        success: true,
        error: None,
    }))
}

pub async fn delete_sub(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(sub_id): Path<String>,
) -> Result<Json<AckResult>> {
    let ok = store::delete(&mongo, &user.user_id, &sub_id).await?;
    if !ok {
        return Err(ApiError::NotFound("subscription".to_owned()));
    }
    Ok(Json(AckResult {
        success: true,
        error: None,
    }))
}

pub async fn test_sub(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(sub_id): Path<String>,
) -> Result<Json<AckResult>> {
    let ok = store::enqueue_test(&mongo, &user.user_id, &sub_id).await?;
    if !ok {
        return Err(ApiError::NotFound("subscription".to_owned()));
    }
    Ok(Json(AckResult {
        success: true,
        error: None,
    }))
}

pub async fn list_deliveries(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<DeliveryListQuery>,
) -> Result<Json<DeliveryList>> {
    let data: Vec<Delivery> = store::list_deliveries(
        &mongo,
        &user.user_id,
        q.subscription_id.as_deref(),
        q.limit.unwrap_or(50),
    )
    .await?;
    Ok(Json(DeliveryList {
        data,
        next_cursor: None,
    }))
}

pub async fn retry_delivery(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(delivery_id): Path<String>,
) -> Result<Json<AckResult>> {
    let ok = store::retry_delivery(&mongo, &user.user_id, &delivery_id).await?;
    if !ok {
        return Err(ApiError::NotFound("delivery".to_owned()));
    }
    Ok(Json(AckResult {
        success: true,
        error: None,
    }))
}
