//! HTTP handlers for the Workplace Event entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
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

use crate::dto::{
    CreateEventInput, CreateEventResponse, DeleteEventResponse, ListQuery, UpdateEventInput,
};
use crate::types::CrmEvent;

const COLL: &str = "crm_events";
const ENTITY_KIND: &str = "event";

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    event_type: Option<&str>,
    organizer_id: Option<&str>,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "scheduled" | "in_progress" | "completed" | "cancelled" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(t) = event_type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("eventType", t);
    }
    if let Some(oid) = organizer_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("organizerId", oid);
    }
    let from = date_from.and_then(parse_date);
    let to = date_to.and_then(parse_date);
    match (from, to) {
        (Some(f), Some(t)) => {
            filter.insert("startsAt", doc! { "$gte": f, "$lte": t });
        }
        (Some(f), None) => {
            filter.insert("startsAt", doc! { "$gte": f });
        }
        (None, Some(t)) => {
            filter.insert("startsAt", doc! { "$lte": t });
        }
        (None, None) => {}
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_oid_vec(v: Option<Vec<String>>) -> Vec<ObjectId> {
    v.unwrap_or_default()
        .into_iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .collect()
}

fn event_from_create(input: CreateEventInput, user_id: ObjectId) -> Result<CrmEvent> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let starts_at = parse_date(&input.starts_at)
        .ok_or_else(|| ApiError::Validation("startsAt must be a valid ISO-8601 date".to_owned()))?;
    let ends_at = match input.ends_at.as_deref() {
        Some(s) if !s.trim().is_empty() => {
            let parsed = parse_date(s).ok_or_else(|| {
                ApiError::Validation("endsAt must be a valid ISO-8601 date".to_owned())
            })?;
            if parsed < starts_at {
                return Err(ApiError::Validation(
                    "endsAt must be greater than or equal to startsAt".to_owned(),
                ));
            }
            Some(parsed)
        }
        _ => None,
    };
    Ok(CrmEvent {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        event_type: input.event_type,
        starts_at,
        ends_at,
        is_all_day: input.is_all_day.unwrap_or(false),
        location: input.location,
        is_online: input.is_online.unwrap_or(false),
        meeting_url: input.meeting_url,
        organizer_id: input
            .organizer_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        organizer_name: input.organizer_name,
        attendee_ids: parse_oid_vec(input.attendee_ids),
        max_attendees: input.max_attendees,
        rsvp_count: 0,
        is_recurring: input.is_recurring.unwrap_or(false),
        recurrence_rule: input.recurrence_rule,
        parent_event_id: input
            .parent_event_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        color: input.color,
        banner_url: input.banner_url,
        reminder_minutes: input.reminder_minutes,
        status: "scheduled".to_owned(),
        tags: input.tags.unwrap_or_default(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateEventInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    let starts_at = patch.starts_at.as_deref().and_then(parse_date);
    let ends_at = patch.ends_at.as_deref().and_then(parse_date);
    if let (Some(s), Some(e)) = (starts_at, ends_at)
        && e < s
    {
        return Err(ApiError::Validation(
            "endsAt must be greater than or equal to startsAt".to_owned(),
        ));
    }
    if let Some(v) = patch.name {
        if v.trim().is_empty() {
            return Err(ApiError::Validation("name cannot be empty".to_owned()));
        }
        set.insert("name", v.trim());
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.event_type {
        set.insert("eventType", v);
    }
    if let Some(v) = starts_at {
        set.insert("startsAt", v);
    }
    if let Some(v) = ends_at {
        set.insert("endsAt", v);
    }
    if let Some(v) = patch.is_all_day {
        set.insert("isAllDay", v);
    }
    if let Some(v) = patch.location {
        set.insert("location", v);
    }
    if let Some(v) = patch.is_online {
        set.insert("isOnline", v);
    }
    if let Some(v) = patch.meeting_url {
        set.insert("meetingUrl", v);
    }
    if let Some(v) = patch
        .organizer_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("organizerId", v);
    }
    if let Some(v) = patch.organizer_name {
        set.insert("organizerName", v);
    }
    if let Some(v) = patch.attendee_ids {
        let arr = parse_oid_vec(Some(v));
        set.insert("attendeeIds", arr);
    }
    if let Some(v) = patch.max_attendees {
        set.insert("maxAttendees", v);
    }
    if let Some(v) = patch.rsvp_count {
        set.insert("rsvpCount", v);
    }
    if let Some(v) = patch.is_recurring {
        set.insert("isRecurring", v);
    }
    if let Some(v) = patch.recurrence_rule {
        set.insert("recurrenceRule", v);
    }
    if let Some(v) = patch
        .parent_event_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("parentEventId", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.banner_url {
        set.insert("bannerUrl", v);
    }
    if let Some(v) = patch.reminder_minutes {
        set.insert("reminderMinutes", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmEvent) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmEvent>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_events(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.event_type.as_deref(),
        q.organizer_id.as_deref(),
        q.date_from.as_deref(),
        q.date_to.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &["name", "description", "location", "organizerName"],
        );
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "startsAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmEvent>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_events.find")))?;
    let mut rows: Vec<CrmEvent> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_events.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %event_id))]
pub async fn get_event(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(event_id): Path<String>,
) -> Result<Json<CrmEvent>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&event_id)?;
    let coll = mongo.collection::<CrmEvent>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_events.find_one")))?
        .ok_or_else(|| ApiError::NotFound("event".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_event(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateEventInput>,
) -> Result<Json<CreateEventResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = event_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmEvent>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_events.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateEventResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %event_id))]
pub async fn update_event(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(event_id): Path<String>,
    Json(patch): Json<UpdateEventInput>,
) -> Result<Json<CrmEvent>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&event_id)?;
    let coll = mongo.collection::<CrmEvent>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_events.find_one")))?
        .ok_or_else(|| ApiError::NotFound("event".to_owned()))?;
    // If only one of starts_at / ends_at is patched, validate against the stored counterpart.
    let new_starts = patch.starts_at.as_deref().and_then(parse_date);
    let new_ends = patch.ends_at.as_deref().and_then(parse_date);
    let effective_starts = new_starts.unwrap_or(before.starts_at);
    let effective_ends = new_ends.or(before.ends_at);
    if let Some(e) = effective_ends
        && e < effective_starts
    {
        return Err(ApiError::Validation(
            "endsAt must be greater than or equal to startsAt".to_owned(),
        ));
    }
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_events.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("event".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_events.refetch")))?
        .ok_or_else(|| ApiError::NotFound("event".to_owned()))?;
    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %event_id))]
pub async fn delete_event(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(event_id): Path<String>,
) -> Result<Json<DeleteEventResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&event_id)?;
    let coll = mongo.collection::<CrmEvent>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_events.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("event".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteEventResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None, None, None);
        assert!(f.contains_key("status"));
        assert!(!f.contains_key("startsAt"));
    }

    #[test]
    fn event_from_create_defaults_status_and_flags() {
        let user_id = ObjectId::new();
        let input = CreateEventInput {
            name: "All-hands".into(),
            starts_at: "2026-06-01T10:00:00Z".into(),
            ..Default::default()
        };
        let e = event_from_create(input, user_id).unwrap();
        assert_eq!(e.status, "scheduled");
        assert!(!e.is_all_day);
        assert!(!e.is_online);
        assert!(!e.is_recurring);
        assert_eq!(e.rsvp_count, 0);
        assert!(e.attendee_ids.is_empty());
    }

    #[test]
    fn event_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateEventInput {
            name: "   ".into(),
            starts_at: "2026-06-01T10:00:00Z".into(),
            ..Default::default()
        };
        assert!(event_from_create(input, user_id).is_err());
    }

    #[test]
    fn event_from_create_rejects_bad_starts_at() {
        let user_id = ObjectId::new();
        let input = CreateEventInput {
            name: "Town hall".into(),
            starts_at: "not-a-date".into(),
            ..Default::default()
        };
        assert!(event_from_create(input, user_id).is_err());
    }

    #[test]
    fn event_from_create_rejects_ends_before_starts() {
        let user_id = ObjectId::new();
        let input = CreateEventInput {
            name: "Workshop".into(),
            starts_at: "2026-06-01T10:00:00Z".into(),
            ends_at: Some("2026-06-01T09:00:00Z".into()),
            ..Default::default()
        };
        assert!(event_from_create(input, user_id).is_err());
    }
}
