#!/bin/bash

cd /Users/harshkhandelwal/Downloads/sabnode/rust/crates/

CRATES=(
    "sabcheckout-customer-portal"
    "sabcheckout-reseller"
    "sabcheckout-payouts"
    "sabcheckout-payment-gateways"
    "sabcheckout-disputes"
)

for CRATE_NAME in "${CRATES[@]}"; do
    CRATE_UNDERSCORE=${CRATE_NAME//-/_}
    
    if [ "$CRATE_NAME" = "sabcheckout-customer-portal" ]; then
        STRUCT_NAME="SabcheckoutCustomerPortal"
        COLL_NAME="sabcheckout_customer_portals"
        ROUTE_PATH="customer-portals"
        PARAM_ID="portalId"
    elif [ "$CRATE_NAME" = "sabcheckout-reseller" ]; then
        STRUCT_NAME="SabcheckoutReseller"
        COLL_NAME="sabcheckout_resellers"
        ROUTE_PATH="resellers"
        PARAM_ID="resellerId"
    elif [ "$CRATE_NAME" = "sabcheckout-payouts" ]; then
        STRUCT_NAME="SabcheckoutPayout"
        COLL_NAME="sabcheckout_payouts"
        ROUTE_PATH="payouts"
        PARAM_ID="payoutId"
    elif [ "$CRATE_NAME" = "sabcheckout-payment-gateways" ]; then
        STRUCT_NAME="SabcheckoutPaymentGateway"
        COLL_NAME="sabcheckout_payment_gateways"
        ROUTE_PATH="payment-gateways"
        PARAM_ID="gatewayId"
    elif [ "$CRATE_NAME" = "sabcheckout-disputes" ]; then
        STRUCT_NAME="SabcheckoutDispute"
        COLL_NAME="sabcheckout_disputes"
        ROUTE_PATH="disputes"
        PARAM_ID="disputeId"
    fi

    mkdir -p "$CRATE_NAME/src"
    
    # Cargo.toml
    cat <<INNER_EOF > "$CRATE_NAME/Cargo.toml"
[package]
name = "$CRATE_NAME"
version = "0.1.0"
edition = "2024"
description = "SabCheckout — $CRATE_NAME CRUD."
license = "UNLICENSED"
publish = false

[lib]
name = "$CRATE_UNDERSCORE"
path = "src/lib.rs"

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
bson = { version = "2", features = ["chrono-0_4"] }
chrono = { version = "0.4", default-features = false, features = ["clock", "serde"] }
mongodb = "3.2"
futures = "0.3"
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
axum = { version = "0.8", default-features = false, features = ["json", "http1", "query"] }
tracing = "0.1"
anyhow = "1.0"

crm-common = { path = "../crm-common" }
sabnode-auth = { path = "../auth" }
sabnode-common = { path = "../common" }
sabnode-db = { path = "../db" }

[lints]
workspace = true
INNER_EOF

    # src/lib.rs
    cat <<INNER_EOF > "$CRATE_NAME/src/lib.rs"
pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
INNER_EOF

    # src/types.rs
    cat <<INNER_EOF > "$CRATE_NAME/src/types.rs"
use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct $STRUCT_NAME {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default = "default_status")]
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_status() -> String {
    "draft".to_owned()
}
INNER_EOF

    # src/dto.rs
    cat <<INNER_EOF > "$CRATE_NAME/src/dto.rs"
use serde::{Deserialize, Serialize};
use crate::types::$STRUCT_NAME;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateResponse {
    pub id: String,
    pub entity: $STRUCT_NAME,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub deleted: bool,
}
INNER_EOF

    # src/handlers.rs
    cat <<INNER_EOF > "$CRATE_NAME/src/handlers.rs"
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
    CreateInput, CreateResponse, DeleteResponse, ListQuery, UpdateInput,
};
use crate::types::$STRUCT_NAME;

const COLL: &str = "$COLL_NAME";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status {
        Some("all") | None => {}
        Some(s) => {
            filter.insert("status", s);
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn entity_from_create(input: CreateInput, user_id: ObjectId) -> Result<$STRUCT_NAME> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok($STRUCT_NAME {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "\\\$set": set }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<$STRUCT_NAME>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_items(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
        if let Ok(arr) = or.get_array("\\\$or") {
            filter.insert("\\\$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<$STRUCT_NAME>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("$CRATE_UNDERSCORE.find")))?;
    let mut rows: Vec<$STRUCT_NAME> = cursor
        .try_collect()
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("$CRATE_UNDERSCORE.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, item_id = %item_id))]
pub async fn get_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(item_id): Path<String>,
) -> Result<Json<$STRUCT_NAME>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&item_id)?;
    let coll = mongo.collection::<$STRUCT_NAME>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("$CRATE_UNDERSCORE.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("$CRATE_UNDERSCORE".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateInput>,
) -> Result<Json<CreateResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<$STRUCT_NAME>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("$CRATE_UNDERSCORE.insert"))
        })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, item_id = %item_id))]
pub async fn update_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(item_id): Path<String>,
    Json(patch): Json<UpdateInput>,
) -> Result<Json<$STRUCT_NAME>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&item_id)?;
    let coll = mongo.collection::<$STRUCT_NAME>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("$CRATE_UNDERSCORE.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("$CRATE_UNDERSCORE".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("$CRATE_UNDERSCORE.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("$CRATE_UNDERSCORE".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, item_id = %item_id))]
pub async fn delete_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(item_id): Path<String>,
) -> Result<Json<DeleteResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&item_id)?;
    let coll = mongo.collection::<$STRUCT_NAME>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "\\\$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("$CRATE_UNDERSCORE.archive"))
        })?;
    Ok(Json(DeleteResponse {
        deleted: result.matched_count > 0,
    }))
}
INNER_EOF

    # src/router.rs
    cat <<INNER_EOF > "$CRATE_NAME/src/router.rs"
use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_items).post(handlers::create_item))
        .route(
            "/{$PARAM_ID}",
            get(handlers::get_item)
                .patch(handlers::update_item)
                .delete(handlers::delete_item),
        )
}
INNER_EOF

done

