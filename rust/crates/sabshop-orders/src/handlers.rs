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

use crate::dto::*;
use crate::types::SabshopOrder;

const COLL: &str = "sabshop_orders";
const ENTITY_KIND: &str = "sabshop_order";

fn ownership(uid: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": uid }
}

fn gen_order_code() -> String {
    let now = Utc::now();
    format!(
        "CO-{}-{}",
        now.format("%Y%m%d"),
        now.timestamp_subsec_micros()
    )
}

fn entity_from_create(input: CreateOrderInput, uid: ObjectId) -> Result<SabshopOrder> {
    let sf = ObjectId::parse_str(&input.storefront_id)
        .map_err(|_| ApiError::Validation("storefrontId invalid".into()))?;
    if input.line_items.is_empty() {
        return Err(ApiError::Validation("lineItems cannot be empty".into()));
    }
    Ok(SabshopOrder {
        id: None,
        user_id: uid,
        storefront_id: sf,
        order_code: gen_order_code(),
        customer_id: input
            .customer_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        line_items: input.line_items,
        totals: input.totals,
        payment_status: "unpaid".into(),
        fulfillment_status: "unfulfilled".into(),
        shipping_address: input.shipping_address,
        billing_address: input.billing_address,
        payment_ref: input.payment_ref,
        payment_provider: input.payment_provider,
        currency: input.currency,
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(p: UpdateOrderInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = p.payment_status {
        set.insert("paymentStatus", v);
    }
    if let Some(v) = p.fulfillment_status {
        set.insert("fulfillmentStatus", v);
    }
    if let Some(v) = p.payment_ref {
        set.insert("paymentRef", v);
    }
    if let Some(v) = p.shipping_address {
        if let Ok(b) = bson::to_bson(&v) {
            set.insert("shippingAddress", b);
        }
    }
    if let Some(v) = p.billing_address {
        if let Ok(b) = bson::to_bson(&v) {
            set.insert("billingAddress", b);
        }
    }
    if let Some(v) = p.notes {
        set.insert("notes", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(e: &SabshopOrder) -> Document {
    bson::to_document(e).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabshopOrder>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_orders(
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
    if let Some(v) = q.payment_status {
        filter.insert("paymentStatus", v);
    }
    if let Some(v) = q.fulfillment_status {
        filter.insert("fulfillmentStatus", v);
    }
    if let Some(n) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(n, &["orderCode"]);
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
    let coll = mongo.collection::<SabshopOrder>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_orders.find"))
        })?;
    let mut rows: Vec<SabshopOrder> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_orders.collect")))?;
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
pub async fn get_order(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabshopOrder>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopOrder>(COLL);
    let row = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_orders.find_one")))?
        .ok_or_else(|| ApiError::NotFound("order".into()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_order(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateOrderInput>,
) -> Result<Json<CreateOrderResponse>> {
    let uid = user_oid(&user)?;
    let mut entity = entity_from_create(input, uid)?;
    let coll = mongo.collection::<SabshopOrder>(COLL);
    let ins = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_orders.insert")))?;
    let nid = ins
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(nid);
    if let Some(ev) = audit_for_create(&user, ENTITY_KIND, nid, Some(doc_for_audit(&entity))) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(CreateOrderResponse {
        id: nid.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_order(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateOrderInput>,
) -> Result<Json<SabshopOrder>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopOrder>(COLL);
    let before = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_orders.find_one")))?
        .ok_or_else(|| ApiError::NotFound("order".into()))?;
    let upd = build_update_doc(patch);
    let r = coll
        .update_one(ownership(uid, oid), upd)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_orders.update")))?;
    if r.matched_count == 0 {
        return Err(ApiError::NotFound("order".into()));
    }
    let after = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_orders.refetch")))?
        .ok_or_else(|| ApiError::NotFound("order".into()))?;
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
pub async fn delete_order(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteOrderResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopOrder>(COLL);
    let r = coll
        .delete_one(ownership(uid, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_orders.delete")))?;
    if r.deleted_count == 0 {
        return Err(ApiError::NotFound("order".into()));
    }
    if let Some(ev) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(DeleteOrderResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_empty_lines() {
        let u = ObjectId::new();
        let sf = ObjectId::new().to_hex();
        assert!(
            entity_from_create(
                CreateOrderInput {
                    storefront_id: sf,
                    ..Default::default()
                },
                u
            )
            .is_err()
        );
    }
    #[test]
    fn order_code_has_prefix() {
        assert!(gen_order_code().starts_with("CO-"));
    }
}
