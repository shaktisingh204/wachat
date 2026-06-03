//! HTTP handlers for sabbackstage-orders.

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
    ConfirmOrderInput, CreateOrderResponse, DeleteOrderResponse, ListQuery, ListResponse,
    PublicCreateOrderInput, UpdateOrderInput,
};
use crate::types::{OrderItem, OrderTotals, SabbackstageOrder};

const COLL: &str = "sabbackstage_orders";
const EVENTS_COLL: &str = "crm_events";
const TICKET_TYPES_COLL: &str = "sabbackstage_ticket_types";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn build_update_doc(patch: UpdateOrderInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.buyer_name {
        set.insert("buyerName", v);
    }
    if let Some(v) = patch.buyer_email {
        set.insert("buyerEmail", v);
    }
    if let Some(v) = patch.buyer_phone {
        set.insert("buyerPhone", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.payment_ref {
        set.insert("paymentRef", v);
    }
    if let Some(v) = patch.items {
        if let Ok(arr) = bson::to_bson(&v) {
            set.insert("items", arr);
        }
    }
    if let Some(v) = patch.totals {
        if let Ok(t) = bson::to_bson(&v) {
            set.insert("totals", t);
        }
    }
    doc! { "$set": set }
}

/// Looks up `userId` for an event from `crm_events`. The public order
/// flow has no session, so we bind the order's tenant by walking the
/// event document.
async fn user_id_for_event(mongo: &MongoHandle, event_id: ObjectId) -> Result<ObjectId> {
    let evs = mongo.collection::<Document>(EVENTS_COLL);
    let row = evs
        .find_one(doc! { "_id": event_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_events.find_one")))?
        .ok_or_else(|| ApiError::NotFound("event".to_owned()))?;
    row.get_object_id("userId")
        .map_err(|_| ApiError::Validation("event has no userId".to_owned()))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_orders(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(v) = q
        .event_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("eventId", v);
    }
    if let Some(s) = q.status.as_deref().filter(|s| *s != "all") {
        filter.insert("status", s);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["buyerName", "buyerEmail", "paymentRef"]);
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
    let coll = mongo.collection::<SabbackstageOrder>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_orders.find"))
    })?;
    let mut rows: Vec<SabbackstageOrder> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_orders.collect"))
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
pub async fn get_order(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabbackstageOrder>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstageOrder>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_orders.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_order".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_order(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateOrderInput>,
) -> Result<Json<SabbackstageOrder>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstageOrder>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_orders.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabbackstage_order".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_orders.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_order".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_order(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteOrderResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstageOrder>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_orders.delete"))
        })?;
    Ok(Json(DeleteOrderResponse {
        deleted: result.deleted_count > 0,
    }))
}

/// Public — unauthenticated. Creates a pending order using prices
/// snapshotted from `sabbackstage_ticket_types`. Tenant is bound via
/// the event document.
#[instrument(skip_all, fields(event_id = %input.event_id))]
pub async fn public_create_order(
    State(mongo): State<MongoHandle>,
    Json(input): Json<PublicCreateOrderInput>,
) -> Result<Json<CreateOrderResponse>> {
    if input.buyer_name.trim().is_empty() {
        return Err(ApiError::Validation("buyerName is required".to_owned()));
    }
    if input.buyer_email.trim().is_empty() {
        return Err(ApiError::Validation("buyerEmail is required".to_owned()));
    }
    if input.items.is_empty() {
        return Err(ApiError::Validation("items must not be empty".to_owned()));
    }
    let event_id = ObjectId::parse_str(input.event_id.trim())
        .map_err(|_| ApiError::Validation("eventId must be a valid ObjectId".to_owned()))?;
    let user_id = user_id_for_event(&mongo, event_id).await?;

    let tt_coll = mongo.collection::<Document>(TICKET_TYPES_COLL);
    let mut items: Vec<OrderItem> = Vec::new();
    let mut subtotal: i64 = 0;
    let mut currency = "INR".to_owned();
    for it in input.items {
        if it.qty <= 0 {
            return Err(ApiError::Validation("qty must be positive".to_owned()));
        }
        let type_oid = ObjectId::parse_str(it.type_id.trim()).map_err(|_| {
            ApiError::Validation("items[].typeId must be a valid ObjectId".to_owned())
        })?;
        let row = tt_coll
            .find_one(doc! { "_id": type_oid, "userId": user_id, "eventId": event_id })
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("sabbackstage_ticket_types.find_one"),
                )
            })?
            .ok_or_else(|| ApiError::NotFound("sabbackstage_ticket_type".to_owned()))?;
        let status = row.get_str("status").unwrap_or("draft");
        if status != "live" {
            return Err(ApiError::Validation(
                "ticket type is not on sale".to_owned(),
            ));
        }
        let price = row.get_i64("priceMinor").unwrap_or(0);
        let label = row.get_str("name").ok().map(|s| s.to_owned());
        if let Ok(c) = row.get_str("currency") {
            currency = c.to_owned();
        }
        subtotal = subtotal.saturating_add(price.saturating_mul(it.qty as i64));
        items.push(OrderItem {
            type_id: type_oid,
            qty: it.qty,
            price_minor: price,
            label,
        });
    }

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabbackstageOrder {
        id: None,
        user_id,
        event_id,
        buyer_name: input.buyer_name.trim().to_owned(),
        buyer_email: input.buyer_email.trim().to_owned(),
        buyer_phone: input.buyer_phone,
        items,
        totals: OrderTotals {
            subtotal_minor: subtotal,
            tax_minor: 0,
            discount_minor: 0,
            total_minor: subtotal,
            currency,
        },
        status: "pending".to_owned(),
        payment_ref: None,
        completed_at: None,
        created_at: now,
        updated_at: None,
    };

    let coll = mongo.collection::<SabbackstageOrder>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_orders.public_insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateOrderResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

/// Public — unauthenticated. Marks a pending order paid and stamps a
/// gateway ref. The TS server-action `confirmPublicTicketOrder` calls
/// this AFTER the gateway returns success.
#[instrument(skip_all, fields(id = %id))]
pub async fn public_confirm_order(
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(input): Json<ConfirmOrderInput>,
) -> Result<Json<SabbackstageOrder>> {
    let oid = oid_from_str(&id)?;
    if input.payment_ref.trim().is_empty() {
        return Err(ApiError::Validation("paymentRef is required".to_owned()));
    }
    let coll = mongo.collection::<SabbackstageOrder>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let result = coll
        .update_one(
            doc! { "_id": oid, "status": "pending" },
            doc! { "$set": {
                "status": "paid",
                "paymentRef": input.payment_ref.trim(),
                "completedAt": now,
                "updatedAt": now,
            } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_orders.public_confirm"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabbackstage_order".to_owned()));
    }
    let after = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_orders.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_order".to_owned()))?;
    Ok(Json(after))
}

/// Public — unauthenticated read of a single order. Used by the
/// `/event/[slug]/success` page so the buyer can confirm their order
/// landed.
#[instrument(skip_all, fields(id = %id))]
pub async fn public_get_order(
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabbackstageOrder>> {
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstageOrder>(COLL);
    let row = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_orders.public_find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_order".to_owned()))?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_update_doc_includes_fields() {
        let patch = UpdateOrderInput {
            buyer_name: Some("X".into()),
            status: Some("refunded".into()),
            payment_ref: Some("pay_123".into()),
            ..Default::default()
        };
        let d = build_update_doc(patch);
        let set = d.get_document("$set").unwrap();
        assert_eq!(set.get_str("buyerName").unwrap(), "X");
        assert_eq!(set.get_str("status").unwrap(), "refunded");
        assert_eq!(set.get_str("paymentRef").unwrap(), "pay_123");
    }
}
