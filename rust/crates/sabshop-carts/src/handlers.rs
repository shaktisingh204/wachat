use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
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
use crate::types::{CartTotals, SabshopCart};

const COLL: &str = "sabshop_carts";
const ENTITY_KIND: &str = "sabshop_cart";

fn ownership(uid: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": uid }
}

fn compute_totals(items: &[crate::types::CartLineItem]) -> CartTotals {
    let subtotal: f64 = items.iter().map(|i| i.line_total).sum();
    CartTotals {
        subtotal,
        tax: 0.0,
        shipping: 0.0,
        discount: 0.0,
        total: subtotal,
    }
}

fn entity_from_create(input: CreateCartInput, uid: ObjectId) -> Result<SabshopCart> {
    let sf = ObjectId::parse_str(&input.storefront_id)
        .map_err(|_| ApiError::Validation("storefrontId invalid".into()))?;
    if input.customer_id.is_none() && input.guest_session_id.is_none() {
        return Err(ApiError::Validation(
            "customerId or guestSessionId is required".into(),
        ));
    }
    let now = Utc::now();
    let expires = now + Duration::days(14);
    let totals = compute_totals(&input.line_items);
    Ok(SabshopCart {
        id: None,
        user_id: uid,
        storefront_id: sf,
        customer_id: input
            .customer_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        guest_session_id: input.guest_session_id,
        line_items: input.line_items,
        totals,
        currency: input.currency,
        coupon_code: input.coupon_code,
        expires_at: Some(BsonDateTime::from_chrono(expires)),
        created_at: BsonDateTime::from_chrono(now),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateCartInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(items) = patch.line_items {
        let totals = compute_totals(&items);
        if let Ok(b) = bson::to_bson(&items) {
            set.insert("lineItems", b);
        }
        if let Ok(b) = bson::to_bson(&totals) {
            set.insert("totals", b);
        }
    }
    if let Some(t) = patch.totals {
        if let Ok(b) = bson::to_bson(&t) {
            set.insert("totals", b);
        }
    }
    if let Some(v) = patch.coupon_code {
        set.insert("couponCode", v);
    }
    if let Some(v) = patch
        .customer_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("customerId", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(e: &SabshopCart) -> Document {
    bson::to_document(e).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabshopCart>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_carts(
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
    let coll = mongo.collection::<SabshopCart>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_carts.find")))?;
    let mut rows: Vec<SabshopCart> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_carts.collect")))?;
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
pub async fn get_cart(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabshopCart>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopCart>(COLL);
    let row = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_carts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("cart".into()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_cart(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCartInput>,
) -> Result<Json<CreateCartResponse>> {
    let uid = user_oid(&user)?;
    let mut entity = entity_from_create(input, uid)?;
    let coll = mongo.collection::<SabshopCart>(COLL);
    let ins = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_carts.insert")))?;
    let nid = ins
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(nid);
    if let Some(ev) = audit_for_create(&user, ENTITY_KIND, nid, Some(doc_for_audit(&entity))) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(CreateCartResponse {
        id: nid.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_cart(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateCartInput>,
) -> Result<Json<SabshopCart>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopCart>(COLL);
    let before = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_carts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("cart".into()))?;
    let upd = build_update_doc(patch);
    let r = coll
        .update_one(ownership(uid, oid), upd)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_carts.update")))?;
    if r.matched_count == 0 {
        return Err(ApiError::NotFound("cart".into()));
    }
    let after = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_carts.refetch")))?
        .ok_or_else(|| ApiError::NotFound("cart".into()))?;
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
pub async fn delete_cart(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteCartResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopCart>(COLL);
    let r = coll
        .delete_one(ownership(uid, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_carts.delete")))?;
    if r.deleted_count == 0 {
        return Err(ApiError::NotFound("cart".into()));
    }
    if let Some(ev) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(DeleteCartResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::CartLineItem;
    #[test]
    fn requires_owner() {
        let u = ObjectId::new();
        let sf = ObjectId::new().to_hex();
        let r = entity_from_create(
            CreateCartInput {
                storefront_id: sf,
                ..Default::default()
            },
            u,
        );
        assert!(r.is_err());
    }
    #[test]
    fn totals_subtotal() {
        let items = vec![CartLineItem {
            product_id: ObjectId::new(),
            variant_id: None,
            name: "x".into(),
            image_url: None,
            unit_price: 10.0,
            quantity: 2,
            line_total: 20.0,
        }];
        let t = compute_totals(&items);
        assert_eq!(t.subtotal, 20.0);
    }
}
