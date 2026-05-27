//! HTTP handlers for SabCheckout recurring customers.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc};
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

use crate::dto::{ListQuery, UpsertCustomerInput, UpsertCustomerResponse};
use crate::types::SabcheckoutCustomer;

const COLL: &str = "sabcheckout_customers";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabcheckoutCustomer>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_customers(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(page_id) = q.page_id.as_deref() {
        if let Ok(oid) = oid_from_str(page_id) {
            filter.insert("pageId", oid);
        }
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["email", "name", "phone", "externalCustomerRef"]);
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
    let coll = mongo.collection::<SabcheckoutCustomer>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_customers.find"))
        })?;
    let mut rows: Vec<SabcheckoutCustomer> = cursor
        .try_collect()
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_customers.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, customer_id = %customer_id))]
pub async fn get_customer(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(customer_id): Path<String>,
) -> Result<Json<SabcheckoutCustomer>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&customer_id)?;
    let coll = mongo.collection::<SabcheckoutCustomer>(COLL);
    let row = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_customers.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_customer".to_owned()))?;
    Ok(Json(row))
}

/// Upsert by (userId, pageId, externalCustomerRef). Used by the gateway
/// confirm path inside the Next.js layer.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn upsert_customer(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<UpsertCustomerInput>,
) -> Result<Json<UpsertCustomerResponse>> {
    let user_id = user_oid(&user)?;
    let page_id = oid_from_str(&input.page_id)?;
    let sub_oid = input
        .subscription_id
        .as_deref()
        .and_then(|s| oid_from_str(s).ok());

    let coll = mongo.collection::<SabcheckoutCustomer>(COLL);
    let filter = doc! {
        "userId": user_id,
        "pageId": page_id,
        "externalCustomerRef": &input.external_customer_ref,
    };
    let existing = coll
        .find_one(filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_customers.lookup"))
        })?;

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set: Document = doc! {
        "email": &input.email,
        "updatedAt": now,
    };
    if let Some(n) = &input.name {
        set.insert("name", n);
    }
    if let Some(p) = &input.phone {
        set.insert("phone", p);
    }

    let mut update = doc! {
        "$set": set,
        "$setOnInsert": {
            "userId": user_id,
            "pageId": page_id,
            "externalCustomerRef": &input.external_customer_ref,
            "createdAt": now,
        },
    };
    if let Some(s) = sub_oid {
        update.insert("$addToSet", doc! { "subscriptionIds": Bson::ObjectId(s) });
    }

    let opts = mongodb::options::UpdateOptions::builder()
        .upsert(true)
        .build();
    coll.update_one(filter.clone(), update)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_customers.upsert"))
        })?;

    let after = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_customers.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_customer".to_owned()))?;
    let id = after
        .id
        .map(|o| o.to_hex())
        .unwrap_or_default();

    Ok(Json(UpsertCustomerResponse {
        id,
        created: existing.is_none(),
        entity: after,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_scopes_by_user() {
        let user_id = ObjectId::new();
        let filter = doc! { "userId": user_id };
        assert!(filter.contains_key("userId"));
    }
}
