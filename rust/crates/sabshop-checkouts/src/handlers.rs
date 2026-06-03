use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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

use crate::dto::*;
use crate::types::SabshopCheckout;

const COLL: &str = "sabshop_checkouts";
const ENTITY_KIND: &str = "sabshop_checkout";

fn ownership(uid: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": uid }
}

fn value_to_bson(v: serde_json::Value) -> Bson {
    bson::to_bson(&v).unwrap_or(Bson::Null)
}

fn entity_from_create(input: CreateCheckoutInput, uid: ObjectId) -> Result<SabshopCheckout> {
    let cart = ObjectId::parse_str(&input.cart_id)
        .map_err(|_| ApiError::Validation("cartId invalid".into()))?;
    let sf = ObjectId::parse_str(&input.storefront_id)
        .map_err(|_| ApiError::Validation("storefrontId invalid".into()))?;
    Ok(SabshopCheckout {
        id: None,
        user_id: uid,
        cart_id: cart,
        storefront_id: sf,
        step: input.step.unwrap_or_else(|| "address".into()),
        payload: input
            .payload
            .map(value_to_bson)
            .unwrap_or(Bson::Document(Document::new())),
        order_id: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(p: UpdateCheckoutInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = p.step {
        set.insert("step", v);
    }
    if let Some(v) = p.payload {
        set.insert("payload", value_to_bson(v));
    }
    if let Some(v) = p
        .order_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("orderId", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(e: &SabshopCheckout) -> Document {
    bson::to_document(e).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabshopCheckout>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_checkouts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let uid = user_oid(&user)?;
    let mut filter = doc! { "userId": uid };
    if let Some(sf) = q
        .storefront_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("storefrontId", sf);
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabshopCheckout>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_checkouts.find"))
        })?;
    let mut rows: Vec<SabshopCheckout> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_checkouts.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn get_checkout(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabshopCheckout>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopCheckout>(COLL);
    let row = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_checkouts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("checkout".into()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_checkout(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCheckoutInput>,
) -> Result<Json<CreateCheckoutResponse>> {
    let uid = user_oid(&user)?;
    let mut entity = entity_from_create(input, uid)?;
    let coll = mongo.collection::<SabshopCheckout>(COLL);
    let ins = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_checkouts.insert"))
    })?;
    let nid = ins
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(nid);
    if let Some(ev) = audit_for_create(&user, ENTITY_KIND, nid, Some(doc_for_audit(&entity))) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(CreateCheckoutResponse {
        id: nid.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_checkout(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateCheckoutInput>,
) -> Result<Json<SabshopCheckout>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopCheckout>(COLL);
    let before = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_checkouts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("checkout".into()))?;
    let upd = build_update_doc(patch);
    let r = coll
        .update_one(ownership(uid, oid), upd)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_checkouts.update"))
        })?;
    if r.matched_count == 0 {
        return Err(ApiError::NotFound("checkout".into()));
    }
    let after = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_checkouts.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("checkout".into()))?;
    if let Some(ev) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_checkout(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteCheckoutResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopCheckout>(COLL);
    let r = coll.delete_one(ownership(uid, oid)).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_checkouts.delete"))
    })?;
    if r.deleted_count == 0 {
        return Err(ApiError::NotFound("checkout".into()));
    }
    if let Some(ev) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(DeleteCheckoutResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn starts_at_address_step() {
        let u = ObjectId::new();
        let c = ObjectId::new().to_hex();
        let sf = ObjectId::new().to_hex();
        let e = entity_from_create(
            CreateCheckoutInput {
                cart_id: c,
                storefront_id: sf,
                ..Default::default()
            },
            u,
        )
        .unwrap();
        assert_eq!(e.step, "address");
    }
}
