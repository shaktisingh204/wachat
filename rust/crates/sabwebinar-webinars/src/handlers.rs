//! HTTP handlers for the SabWebinar Webinar entity.

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
use rand::{Rng, distributions::Alphanumeric, thread_rng};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateWebinarInput, CreateWebinarResponse, DeleteWebinarResponse, ListQuery, ListResponse,
    UpdateWebinarInput,
};
use crate::types::Webinar;

const COLL: &str = "sabwebinar_webinars";
const STATUS_VARIANTS: &[&str] = &["draft", "scheduled", "live", "ended", "cancelled"];

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn slugify(input: &str) -> String {
    let cleaned: String = input
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();
    let collapsed: Vec<&str> = cleaned.split('-').filter(|s| !s.is_empty()).collect();
    collapsed.join("-")
}

fn random_suffix(n: usize) -> String {
    let mut rng = thread_rng();
    (0..n)
        .map(|_| rng.sample(Alphanumeric) as char)
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn list_filter(user_id: ObjectId, q: &ListQuery) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q
        .status
        .as_deref()
        .filter(|s| STATUS_VARIANTS.contains(s))
    {
        filter.insert("status", s);
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    match q.when.as_deref().unwrap_or("all") {
        "all" => {}
        "live" => {
            filter.insert("status", "live");
        }
        "past" => {
            filter.insert(
                "$or",
                vec![
                    bson::Bson::Document(doc! { "status": "ended" }),
                    bson::Bson::Document(doc! { "scheduledStart": { "$lt": now } }),
                ],
            );
        }
        "upcoming" => {
            filter.insert(
                "$or",
                vec![
                    bson::Bson::Document(doc! { "scheduledStart": { "$gte": now } }),
                    bson::Bson::Document(doc! { "status": "scheduled" }),
                    bson::Bson::Document(doc! { "status": "live" }),
                ],
            );
        }
        _ => {}
    }
    filter
}

fn webinar_from_create(input: CreateWebinarInput, user_id: ObjectId) -> Result<Webinar> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    let host = input
        .host_user_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
        .unwrap_or(user_id);

    let slug = match input.slug.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) => slugify(s),
        None => {
            let base = slugify(&input.title);
            if base.is_empty() {
                format!("webinar-{}", random_suffix(8))
            } else {
                format!("{}-{}", base, random_suffix(6))
            }
        }
    };

    Ok(Webinar {
        id: None,
        user_id,
        slug,
        title: input.title.trim().to_owned(),
        description: input.description,
        host_user_id: host,
        host_name: input.host_name,
        scheduled_start: input.scheduled_start.as_deref().and_then(parse_date),
        duration_minutes: input.duration_minutes,
        timezone: input.timezone,
        status: "draft".to_owned(),
        landing_theme: input.landing_theme,
        hero_file_id: input.hero_file_id,
        recording_file_id: None,
        require_registration: input.require_registration.unwrap_or(true),
        capacity: input.capacity,
        started_at: None,
        ended_at: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateWebinarInput) -> Result<Document> {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };

    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.host_name {
        set.insert("hostName", v);
    }
    if let Some(v) = patch.scheduled_start.as_deref().and_then(parse_date) {
        set.insert("scheduledStart", v);
    }
    if let Some(v) = patch.duration_minutes {
        set.insert("durationMinutes", v as i64);
    }
    if let Some(v) = patch.timezone {
        set.insert("timezone", v);
    }
    if let Some(theme) = patch.landing_theme {
        if let Ok(b) = bson::to_bson(&theme) {
            set.insert("landingTheme", b);
        }
    }
    if let Some(v) = patch.hero_file_id {
        set.insert("heroFileId", v);
    }
    if let Some(v) = patch.recording_file_id {
        set.insert("recordingFileId", v);
    }
    if let Some(v) = patch.require_registration {
        set.insert("requireRegistration", v);
    }
    if let Some(v) = patch.capacity {
        set.insert("capacity", v as i64);
    }
    if let Some(v) = patch.status.as_deref() {
        if !STATUS_VARIANTS.contains(&v) {
            return Err(ApiError::Validation(format!(
                "status must be one of {:?}",
                STATUS_VARIANTS
            )));
        }
        set.insert("status", v);
        if v == "live" {
            set.insert("startedAt", now);
        }
        if v == "ended" || v == "cancelled" {
            set.insert("endedAt", now);
        }
    }
    Ok(doc! { "$set": set })
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_webinars(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, &q);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "description", "slug"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "scheduledStart": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<Webinar>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_webinars.find"))
    })?;
    let mut rows: Vec<Webinar> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_webinars.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %webinar_id))]
pub async fn get_webinar(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(webinar_id): Path<String>,
) -> Result<Json<Webinar>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&webinar_id)?;
    let coll = mongo.collection::<Webinar>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_webinars.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("webinar".to_owned()))?;
    Ok(Json(row))
}

/// Public — unauthenticated landing-page lookup by slug.
#[instrument(skip_all, fields(slug = %slug))]
pub async fn get_webinar_by_slug(
    State(mongo): State<MongoHandle>,
    Path(slug): Path<String>,
) -> Result<Json<Webinar>> {
    let coll = mongo.collection::<Webinar>(COLL);
    let row = coll
        .find_one(doc! { "slug": &slug })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_webinars.by_slug"))
        })?
        .ok_or_else(|| ApiError::NotFound("webinar".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_webinar(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateWebinarInput>,
) -> Result<Json<CreateWebinarResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = webinar_from_create(input, user_id)?;
    let coll = mongo.collection::<Webinar>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_webinars.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateWebinarResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %webinar_id))]
pub async fn update_webinar(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(webinar_id): Path<String>,
    Json(patch): Json<UpdateWebinarInput>,
) -> Result<Json<Webinar>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&webinar_id)?;
    let coll = mongo.collection::<Webinar>(COLL);
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_webinars.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("webinar".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_webinars.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("webinar".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %webinar_id))]
pub async fn delete_webinar(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(webinar_id): Path<String>,
) -> Result<Json<DeleteWebinarResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&webinar_id)?;
    let coll = mongo.collection::<Webinar>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "cancelled",
                "endedAt": BsonDateTime::from_chrono(Utc::now()),
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_webinars.cancel"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("webinar".to_owned()));
    }
    Ok(Json(DeleteWebinarResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn webinar_from_create_defaults() {
        let uid = ObjectId::new();
        let input = CreateWebinarInput {
            title: "Q4 Product Launch".into(),
            ..Default::default()
        };
        let w = webinar_from_create(input, uid).unwrap();
        assert_eq!(w.status, "draft");
        assert_eq!(w.host_user_id, uid);
        assert!(w.require_registration);
        assert!(w.slug.starts_with("q4-product-launch-"));
    }

    #[test]
    fn rejects_empty_title() {
        let uid = ObjectId::new();
        let input = CreateWebinarInput {
            title: "   ".into(),
            ..Default::default()
        };
        assert!(webinar_from_create(input, uid).is_err());
    }

    #[test]
    fn build_update_stamps_started_when_live() {
        let patch = UpdateWebinarInput {
            status: Some("live".into()),
            ..Default::default()
        };
        let upd = build_update_doc(patch).unwrap();
        let set = upd.get_document("$set").unwrap();
        assert!(set.contains_key("startedAt"));
    }

    #[test]
    fn build_update_rejects_bad_status() {
        let patch = UpdateWebinarInput {
            status: Some("blasting".into()),
            ..Default::default()
        };
        assert!(build_update_doc(patch).is_err());
    }

    #[test]
    fn slugify_lowercases_and_dashes() {
        assert_eq!(slugify("Hello World!"), "hello-world");
        assert_eq!(slugify("  Multi   Space "), "multi-space");
    }
}
