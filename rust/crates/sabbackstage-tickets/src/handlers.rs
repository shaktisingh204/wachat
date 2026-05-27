//! HTTP handlers for sabbackstage-tickets.

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
    CheckInInput, CheckInResponse, CreateTicketResponse, DeleteTicketResponse, IssueTicketInput,
    ListQuery, ListResponse, UpdateTicketInput,
};
use crate::types::SabbackstageTicket;

const COLL: &str = "sabbackstage_tickets";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn entity_from_issue(
    input: IssueTicketInput,
    user_id: ObjectId,
) -> Result<SabbackstageTicket> {
    if input.attendee_name.trim().is_empty() {
        return Err(ApiError::Validation("attendeeName is required".to_owned()));
    }
    if input.attendee_email.trim().is_empty() {
        return Err(ApiError::Validation("attendeeEmail is required".to_owned()));
    }
    if input.qr_code.trim().is_empty() {
        return Err(ApiError::Validation("qrCode is required".to_owned()));
    }
    let type_id = ObjectId::parse_str(input.type_id.trim())
        .map_err(|_| ApiError::Validation("typeId must be a valid ObjectId".to_owned()))?;
    let event_id = ObjectId::parse_str(input.event_id.trim())
        .map_err(|_| ApiError::Validation("eventId must be a valid ObjectId".to_owned()))?;
    let order_id = ObjectId::parse_str(input.order_id.trim())
        .map_err(|_| ApiError::Validation("orderId must be a valid ObjectId".to_owned()))?;
    let now = BsonDateTime::from_chrono(Utc::now());
    Ok(SabbackstageTicket {
        id: None,
        user_id,
        type_id,
        event_id,
        order_id,
        attendee_name: input.attendee_name.trim().to_owned(),
        attendee_email: input.attendee_email.trim().to_owned(),
        attendee_phone: input.attendee_phone,
        qr_code: input.qr_code.trim().to_owned(),
        status: "issued".to_owned(),
        issued_at: now,
        checked_in_at: None,
        checked_in_by: None,
        created_at: now,
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateTicketInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.attendee_name {
        set.insert("attendeeName", v);
    }
    if let Some(v) = patch.attendee_email {
        set.insert("attendeeEmail", v);
    }
    if let Some(v) = patch.attendee_phone {
        set.insert("attendeePhone", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_tickets(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(v) = q.event_id.as_deref().and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("eventId", v);
    }
    if let Some(v) = q.type_id.as_deref().and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("typeId", v);
    }
    if let Some(v) = q.order_id.as_deref().and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("orderId", v);
    }
    if let Some(s) = q.status.as_deref().filter(|s| *s != "all") {
        filter.insert("status", s);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["attendeeName", "attendeeEmail", "qrCode"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "issuedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabbackstageTicket>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_tickets.find"))
    })?;
    let mut rows: Vec<SabbackstageTicket> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_tickets.collect"))
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
pub async fn get_ticket(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabbackstageTicket>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstageTicket>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_tickets.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_ticket".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn issue_ticket(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<IssueTicketInput>,
) -> Result<Json<CreateTicketResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_issue(input, user_id)?;
    let coll = mongo.collection::<SabbackstageTicket>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_tickets.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateTicketResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_ticket(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateTicketInput>,
) -> Result<Json<SabbackstageTicket>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstageTicket>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_tickets.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabbackstage_ticket".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_tickets.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_ticket".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_ticket(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteTicketResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabbackstageTicket>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_tickets.delete"))
        })?;
    Ok(Json(DeleteTicketResponse {
        deleted: result.deleted_count > 0,
    }))
}

/// Admin check-in by QR code. Idempotent — a second scan returns
/// `alreadyCheckedIn: true` instead of erroring.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn check_in_ticket(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CheckInInput>,
) -> Result<Json<CheckInResponse>> {
    let user_id = user_oid(&user)?;
    let qr = input.qr_code.trim();
    if qr.is_empty() {
        return Err(ApiError::Validation("qrCode is required".to_owned()));
    }
    let coll = mongo.collection::<SabbackstageTicket>(COLL);
    let existing = coll
        .find_one(doc! { "userId": user_id, "qrCode": qr })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_tickets.checkin_find"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_ticket".to_owned()))?;

    if existing.status == "cancelled" {
        return Err(ApiError::Validation("ticket is cancelled".to_owned()));
    }
    if existing.status == "checked_in" {
        return Ok(Json(CheckInResponse {
            ok: true,
            ticket: existing,
            already_checked_in: true,
        }));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    coll.update_one(
        doc! { "_id": existing.id.unwrap(), "userId": user_id },
        doc! { "$set": {
            "status": "checked_in",
            "checkedInAt": now,
            "checkedInBy": user_id,
            "updatedAt": now,
        } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_tickets.checkin_update"))
    })?;
    let refreshed = coll
        .find_one(doc! { "_id": existing.id.unwrap(), "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabbackstage_tickets.checkin_refetch"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("sabbackstage_ticket".to_owned()))?;
    Ok(Json(CheckInResponse {
        ok: true,
        ticket: refreshed,
        already_checked_in: false,
    }))
}

/// Public — unauthenticated. Returns all tickets for a given `orderId`.
/// Used by `/event/[slug]/tickets/[orderId]` to render printable
/// tickets right after checkout completes.
#[instrument(skip_all, fields(order_id = %order_id))]
pub async fn public_list_by_order(
    State(mongo): State<MongoHandle>,
    Path(order_id): Path<String>,
) -> Result<Json<Vec<SabbackstageTicket>>> {
    let oid = ObjectId::parse_str(order_id.trim())
        .map_err(|_| ApiError::Validation("orderId must be a valid ObjectId".to_owned()))?;
    let coll = mongo.collection::<SabbackstageTicket>(COLL);
    let opts = FindOptions::builder().sort(doc! { "issuedAt": 1 }).build();
    let cursor = coll
        .find(doc! { "orderId": oid })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbackstage_tickets.public_find"))
        })?;
    let rows: Vec<SabbackstageTicket> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabbackstage_tickets.public_collect"),
        )
    })?;
    Ok(Json(rows))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn issue_validates_required_fields() {
        let user_id = ObjectId::new();
        let input = IssueTicketInput {
            type_id: ObjectId::new().to_hex(),
            event_id: ObjectId::new().to_hex(),
            order_id: ObjectId::new().to_hex(),
            attendee_name: "".into(),
            attendee_email: "x@y.z".into(),
            attendee_phone: None,
            qr_code: "abc".into(),
        };
        assert!(entity_from_issue(input, user_id).is_err());
    }

    #[test]
    fn issue_validates_qr() {
        let user_id = ObjectId::new();
        let input = IssueTicketInput {
            type_id: ObjectId::new().to_hex(),
            event_id: ObjectId::new().to_hex(),
            order_id: ObjectId::new().to_hex(),
            attendee_name: "A".into(),
            attendee_email: "a@b.c".into(),
            attendee_phone: None,
            qr_code: "  ".into(),
        };
        assert!(entity_from_issue(input, user_id).is_err());
    }
}
