//! HTTP handlers for the SabBigin booking-page entity.
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! and writes a best-effort audit row to `crm_audit_log`.

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

use crate::dto::{
    CreateSabbiginBookingPageInput, CreateSabbiginBookingPageResponse,
    DeleteSabbiginBookingPageResponse, ListQuery, UpdateSabbiginBookingPageInput,
};
use crate::types::SabbiginBookingPage;

const COLL: &str = "sabbigin_booking_pages";
const ENTITY_KIND: &str = "sabbigin_booking_page";

/// The default meeting length for a fresh booking page (minutes).
const DEFAULT_DURATION_MIN: u32 = 30;
/// The default availability window length into the future (days).
const DEFAULT_DATE_RANGE_DAYS: u32 = 30;
/// The default IANA timezone for a fresh booking page.
const DEFAULT_TIMEZONE: &str = "Asia/Kolkata";

// ─── Filter helpers ──────────────────────────────────────────────────────

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

// ─── Mapping helpers ────────────────────────────────────────────────────

fn page_from_create(
    input: CreateSabbiginBookingPageInput,
    user_id: ObjectId,
) -> Result<SabbiginBookingPage> {
    let owner_oid = match input.owner_id.as_deref() {
        Some(s) if !s.trim().is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    let pipeline_oid = match input.pipeline_id.as_deref() {
        Some(s) if !s.trim().is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };

    Ok(SabbiginBookingPage {
        id: None,
        user_id,
        slug: input.slug,
        title: input.title,
        description: input.description,
        duration_min: input.duration_min.unwrap_or(DEFAULT_DURATION_MIN),
        timezone: input
            .timezone
            .unwrap_or_else(|| DEFAULT_TIMEZONE.to_owned()),
        weekly_availability: input.weekly_availability.unwrap_or_default(),
        buffer_min: input.buffer_min.unwrap_or(0),
        date_range_days: input.date_range_days.unwrap_or(DEFAULT_DATE_RANGE_DAYS),
        questions: input.questions.unwrap_or_default(),
        owner_id: owner_oid,
        pipeline_id: pipeline_oid,
        confirmation_message: input.confirmation_message,
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSabbiginBookingPageInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.slug {
        set.insert("slug", v);
    }
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.duration_min {
        set.insert("durationMin", v as i64);
    }
    if let Some(v) = patch.timezone {
        set.insert("timezone", v);
    }
    if let Some(v) = patch.weekly_availability {
        set.insert(
            "weeklyAvailability",
            bson::to_bson(&v).unwrap_or(Bson::Null),
        );
    }
    if let Some(v) = patch.buffer_min {
        set.insert("bufferMin", v as i64);
    }
    if let Some(v) = patch.date_range_days {
        set.insert("dateRangeDays", v as i64);
    }
    if let Some(v) = patch.questions {
        set.insert("questions", bson::to_bson(&v).unwrap_or(Bson::Null));
    }
    if let Some(v) = patch.owner_id {
        if v.trim().is_empty() {
            set.insert("ownerId", Bson::Null);
        } else {
            set.insert("ownerId", oid_from_str(&v)?);
        }
    }
    if let Some(v) = patch.pipeline_id {
        if v.trim().is_empty() {
            set.insert("pipelineId", Bson::Null);
        } else {
            set.insert("pipelineId", oid_from_str(&v)?);
        }
    }
    if let Some(v) = patch.confirmation_message {
        set.insert("confirmationMessage", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &SabbiginBookingPage) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

// ─── List response ───────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabbiginBookingPage>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

// ─── GET / — list ────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_pages(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let filter = list_filter(user_id, q.status.as_deref());

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabbiginBookingPage>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbigin_booking_pages.find"))
        })?;
    let mut rows: Vec<SabbiginBookingPage> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbigin_booking_pages.collect"))
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

// ─── GET /slug/:slug ───────────────────────────────────────────────────────

/// Find a tenant-owned booking page by its slug. Returns `404` when no page
/// with that slug exists for the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, slug = %slug))]
pub async fn get_by_slug(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(slug): Path<String>,
) -> Result<Json<SabbiginBookingPage>> {
    let user_id = user_oid(&user)?;
    let coll = mongo.collection::<SabbiginBookingPage>(COLL);
    let row = coll
        .find_one(doc! { "userId": user_id, "slug": &slug })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbigin_booking_pages.find_by_slug"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbigin_booking_page".to_owned()))?;
    Ok(Json(row))
}

// ─── GET /:id ────────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, id = %page_id))]
pub async fn get_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(page_id): Path<String>,
) -> Result<Json<SabbiginBookingPage>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&page_id)?;
    let coll = mongo.collection::<SabbiginBookingPage>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbigin_booking_pages.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbigin_booking_page".to_owned()))?;
    Ok(Json(row))
}

// ─── POST / ──────────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSabbiginBookingPageInput>,
) -> Result<Json<CreateSabbiginBookingPageResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = page_from_create(input, user_id)?;
    let coll = mongo.collection::<SabbiginBookingPage>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbigin_booking_pages.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateSabbiginBookingPageResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

// ─── PATCH /:id ──────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, id = %page_id))]
pub async fn update_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(page_id): Path<String>,
    Json(patch): Json<UpdateSabbiginBookingPageInput>,
) -> Result<Json<SabbiginBookingPage>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&page_id)?;
    let coll = mongo.collection::<SabbiginBookingPage>(COLL);

    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbigin_booking_pages.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbigin_booking_page".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbigin_booking_pages.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabbigin_booking_page".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbigin_booking_pages.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbigin_booking_page".to_owned()))?;

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

// ─── DELETE /:id (soft) ──────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, id = %page_id))]
pub async fn delete_page(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(page_id): Path<String>,
) -> Result<Json<DeleteSabbiginBookingPageResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&page_id)?;
    let coll = mongo.collection::<SabbiginBookingPage>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbigin_booking_pages.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabbigin_booking_page".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteSabbiginBookingPageResponse { deleted: true }))
}

// ─── Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::BookingQuestion;

    #[test]
    fn list_filter_defaults_to_active() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn list_filter_all_strips_status_clause() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("all"));
        assert!(!f.contains_key("status"));
    }

    #[test]
    fn list_filter_archived_matches_archived() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("archived"));
        assert_eq!(f.get_str("status").unwrap(), "archived");
    }

    #[test]
    fn page_from_create_defaults() {
        let user_id = ObjectId::new();
        let input = CreateSabbiginBookingPageInput {
            slug: "intro-call".to_owned(),
            title: "Intro Call".to_owned(),
            ..Default::default()
        };
        let p = page_from_create(input, user_id).unwrap();
        assert_eq!(p.duration_min, DEFAULT_DURATION_MIN);
        assert_eq!(p.date_range_days, DEFAULT_DATE_RANGE_DAYS);
        assert_eq!(p.timezone, DEFAULT_TIMEZONE);
        assert_eq!(p.buffer_min, 0);
        assert_eq!(p.status, "active");
        assert!(p.owner_id.is_none());
        assert!(p.pipeline_id.is_none());
        assert_eq!(p.user_id, user_id);
    }

    #[test]
    fn page_from_create_parses_oid_fields() {
        let user_id = ObjectId::new();
        let owner = ObjectId::new();
        let pipe = ObjectId::new();
        let input = CreateSabbiginBookingPageInput {
            slug: "demo".to_owned(),
            title: "Demo".to_owned(),
            duration_min: Some(45),
            owner_id: Some(owner.to_hex()),
            pipeline_id: Some(pipe.to_hex()),
            ..Default::default()
        };
        let p = page_from_create(input, user_id).unwrap();
        assert_eq!(p.duration_min, 45);
        assert_eq!(p.owner_id, Some(owner));
        assert_eq!(p.pipeline_id, Some(pipe));
    }

    #[test]
    fn build_update_doc_clears_pipeline_on_empty_string() {
        let patch = UpdateSabbiginBookingPageInput {
            pipeline_id: Some(String::new()),
            ..Default::default()
        };
        let d = build_update_doc(patch).unwrap();
        let set = d.get_document("$set").unwrap();
        assert!(set.contains_key("pipelineId"));
        assert_eq!(set.get("pipelineId").unwrap(), &Bson::Null);
    }

    #[test]
    fn build_update_doc_writes_questions_array() {
        let patch = UpdateSabbiginBookingPageInput {
            questions: Some(vec![BookingQuestion {
                key: "company".to_owned(),
                label: "Company".to_owned(),
                required: true,
            }]),
            ..Default::default()
        };
        let d = build_update_doc(patch).unwrap();
        let set = d.get_document("$set").unwrap();
        let arr = set.get_array("questions").unwrap();
        assert_eq!(arr.len(), 1);
    }
}
