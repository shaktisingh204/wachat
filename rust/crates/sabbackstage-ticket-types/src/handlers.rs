//! HTTP handlers for sabbackstage-ticket-types.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
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
    CreateTicketTypeInput, CreateTicketTypeResponse, DeleteTicketTypeResponse, ListQuery,
    ListResponse, UpdateTicketTypeInput,
};
use crate::types::SabbackstageTicketType;

const COLL: &str = "sabbackstage_ticket_types";

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn entity_from_create(
    input: CreateTicketTypeInput,
    user_id: ObjectId,
) -> Result<SabbackstageTicketType> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let event_id = ObjectId::parse_str(input.event_id.trim())
        .map_err(|_| ApiError::Validation("eventId must be a valid ObjectId".to_owned()))?;
    Ok(SabbackstageTicketType {
        id: None,
        user_id,
        event_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        price_minor: input.price_minor.unwrap_or(0),
        currency: input.currency.unwrap_or_else(|| "INR".to_owned()),
        capacity: input.capacity.unwrap_or(0),
        sold_count: 0,
        sales_start_at: input.sales_start_at.as_deref().and_then(parse_date),
        sales_end_at: input.sales_end_at.as_deref().and_then(parse_date),
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        order_rank: input.order_rank.unwrap_or(0),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateTicketTypeInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.price_minor {
        set.insert("priceMinor", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.capacity {
        set.insert("capacity", v);
    }
    if let Some(v) = patch.sales_start_at.as_deref().and_then(parse_date) {
        set.insert("salesStartAt", v);
    }
    if let Some(v) = patch.sales_end_at.as_deref().and_then(parse_date) {
        set.insert("salesEndAt", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.order_rank {
        set.insert("orderRank", v);
    }
    doc! { "$set": set }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_ticket_types(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(ev) = q
        .event_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("eventId", ev);
    }
    if let Some(s) = q.status.as_deref().filter(|s| *s != "all") {
        filter.insert("status", s);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "orderRank": 1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabbackstageTicketType>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_ticket_types.find"))
    })?;
    let mut rows: Vec<SabbackstageTicketType> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_ticket_types.collect"))
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
pub async fn get_ticket_type(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabbackstageTicketType>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstageTicketType>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_ticket_types.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_ticket_type".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_ticket_type(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTicketTypeInput>,
) -> Result<Json<CreateTicketTypeResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<SabbackstageTicketType>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_ticket_types.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateTicketTypeResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_ticket_type(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateTicketTypeInput>,
) -> Result<Json<SabbackstageTicketType>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstageTicketType>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_ticket_types.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabbackstage_ticket_type".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_ticket_types.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_ticket_type".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_ticket_type(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteTicketTypeResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstageTicketType>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_ticket_types.delete"))
        })?;
    Ok(Json(DeleteTicketTypeResponse {
        deleted: result.deleted_count > 0,
    }))
}

/// Public — unauthenticated. Lists only `live` ticket types for an
/// event, scoped by `eventId`. The public event page calls this when
/// rendering the buy-tickets section.
#[instrument(skip_all, fields(event_id = %event_id))]
pub async fn public_list_by_event(
    State(mongo): State<MongoHandle>,
    Path(event_id): Path<String>,
) -> Result<Json<Vec<SabbackstageTicketType>>> {
    let oid = ObjectId::parse_str(event_id.trim())
        .map_err(|_| ApiError::Validation("eventId must be a valid ObjectId".to_owned()))?;
    let coll = mongo.collection::<SabbackstageTicketType>(COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "orderRank": 1, "createdAt": 1 })
        .build();
    let cursor = coll
        .find(doc! { "eventId": oid, "status": "live" })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabbackstage_ticket_types.public_find"),
            )
        })?;
    let rows: Vec<SabbackstageTicketType> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabbackstage_ticket_types.public_collect"),
        )
    })?;
    Ok(Json(rows))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_requires_name() {
        let user_id = ObjectId::new();
        let input = CreateTicketTypeInput {
            event_id: ObjectId::new().to_hex(),
            name: "  ".into(),
            ..Default::default()
        };
        assert!(entity_from_create(input, user_id).is_err());
    }

    #[test]
    fn create_requires_valid_event_id() {
        let user_id = ObjectId::new();
        let input = CreateTicketTypeInput {
            event_id: "not-an-oid".into(),
            name: "VIP".into(),
            ..Default::default()
        };
        assert!(entity_from_create(input, user_id).is_err());
    }

    #[test]
    fn create_defaults_status_and_currency() {
        let user_id = ObjectId::new();
        let input = CreateTicketTypeInput {
            event_id: ObjectId::new().to_hex(),
            name: "Early Bird".into(),
            ..Default::default()
        };
        let e = entity_from_create(input, user_id).unwrap();
        assert_eq!(e.status, "draft");
        assert_eq!(e.currency, "INR");
        assert_eq!(e.sold_count, 0);
    }
}
