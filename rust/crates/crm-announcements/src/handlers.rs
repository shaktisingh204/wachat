//! HTTP handlers for the Workplace Announcement entity.

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
    CreateAnnouncementInput, CreateAnnouncementResponse, DeleteAnnouncementResponse, ListQuery,
    UpdateAnnouncementInput,
};
use crate::types::CrmAnnouncement;

const COLL: &str = "crm_announcements";
const ENTITY_KIND: &str = "announcement";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    category: Option<&str>,
    audience: Option<&str>,
    pinned: Option<bool>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "scheduled" | "published" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(c) = category.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", c);
    }
    if let Some(a) = audience.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("audience", a);
    }
    if let Some(p) = pinned {
        filter.insert("pinned", p);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn parse_oid_vec(ids: &[String]) -> Vec<ObjectId> {
    ids.iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .collect()
}

fn announcement_from_create(
    input: CreateAnnouncementInput,
    user_id: ObjectId,
) -> Result<CrmAnnouncement> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    if input.body.trim().is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    let status = input.status.unwrap_or_else(|| "draft".to_owned());
    let published_at = if status == "published" {
        Some(now)
    } else {
        None
    };
    Ok(CrmAnnouncement {
        id: None,
        user_id,
        title: input.title.trim().to_owned(),
        body: input.body.trim().to_owned(),
        category: input.category,
        priority: input.priority.unwrap_or_else(|| "normal".to_owned()),
        audience: input.audience,
        audience_ids: input
            .audience_ids
            .as_deref()
            .map(parse_oid_vec)
            .unwrap_or_default(),
        publish_at: input.publish_at.as_deref().and_then(parse_date),
        expires_at: input.expires_at.as_deref().and_then(parse_date),
        pinned: input.pinned.unwrap_or(false),
        allow_comments: input.allow_comments.unwrap_or(true),
        require_acknowledgement: input.require_acknowledgement.unwrap_or(false),
        acknowledgement_count: 0,
        view_count: 0,
        banner_url: input.banner_url,
        author_id: input
            .author_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        author_name: input.author_name,
        status,
        published_at,
        tags: input.tags.unwrap_or_default(),
        created_at: now,
        updated_at: None,
    })
}

fn build_update_doc(
    patch: UpdateAnnouncementInput,
    before_status: &str,
    before_published_at: Option<BsonDateTime>,
) -> Document {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.body {
        set.insert("body", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.priority {
        set.insert("priority", v);
    }
    if let Some(v) = patch.audience {
        set.insert("audience", v);
    }
    if let Some(v) = patch.audience_ids.as_deref().map(parse_oid_vec) {
        set.insert("audienceIds", v);
    }
    if let Some(v) = patch.publish_at.as_deref().and_then(parse_date) {
        set.insert("publishAt", v);
    }
    if let Some(v) = patch.expires_at.as_deref().and_then(parse_date) {
        set.insert("expiresAt", v);
    }
    if let Some(v) = patch.pinned {
        set.insert("pinned", v);
    }
    if let Some(v) = patch.allow_comments {
        set.insert("allowComments", v);
    }
    if let Some(v) = patch.require_acknowledgement {
        set.insert("requireAcknowledgement", v);
    }
    if let Some(v) = patch.acknowledgement_count {
        set.insert("acknowledgementCount", v);
    }
    if let Some(v) = patch.view_count {
        set.insert("viewCount", v);
    }
    if let Some(v) = patch.banner_url {
        set.insert("bannerUrl", v);
    }
    if let Some(v) = patch
        .author_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("authorId", v);
    }
    if let Some(v) = patch.author_name {
        set.insert("authorName", v);
    }
    if let Some(ref v) = patch.status {
        set.insert("status", v.clone());
        // Stamp publishedAt on first transition to "published".
        if v == "published" && before_status != "published" && before_published_at.is_none() {
            set.insert("publishedAt", now);
        }
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmAnnouncement) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmAnnouncement>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_announcements(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.category.as_deref(),
        q.audience.as_deref(),
        q.pinned,
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "body", "authorName", "tags"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "pinned": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmAnnouncement>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_announcements.find"))
        })?;
    let mut rows: Vec<CrmAnnouncement> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_announcements.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %announcement_id))]
pub async fn get_announcement(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(announcement_id): Path<String>,
) -> Result<Json<CrmAnnouncement>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&announcement_id)?;
    let coll = mongo.collection::<CrmAnnouncement>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_announcements.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("announcement".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_announcement(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAnnouncementInput>,
) -> Result<Json<CreateAnnouncementResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = announcement_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmAnnouncement>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_announcements.insert"))
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
    Ok(Json(CreateAnnouncementResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %announcement_id))]
pub async fn update_announcement(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(announcement_id): Path<String>,
    Json(patch): Json<UpdateAnnouncementInput>,
) -> Result<Json<CrmAnnouncement>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&announcement_id)?;
    let coll = mongo.collection::<CrmAnnouncement>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_announcements.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("announcement".to_owned()))?;
    let update = build_update_doc(patch, &before.status, before.published_at);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_announcements.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("announcement".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_announcements.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("announcement".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %announcement_id))]
pub async fn delete_announcement(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(announcement_id): Path<String>,
) -> Result<Json<DeleteAnnouncementResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&announcement_id)?;
    let coll = mongo.collection::<CrmAnnouncement>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_announcements.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("announcement".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteAnnouncementResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dto::UpdateAnnouncementInput;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn announcement_from_create_defaults_and_required_fields() {
        let user_id = ObjectId::new();
        let input = CreateAnnouncementInput {
            title: "Holiday".into(),
            body: "Office closed Friday".into(),
            ..Default::default()
        };
        let a = announcement_from_create(input, user_id).unwrap();
        assert_eq!(a.priority, "normal");
        assert_eq!(a.status, "draft");
        assert!(!a.pinned);
        assert!(a.allow_comments);
        assert!(!a.require_acknowledgement);
        assert_eq!(a.acknowledgement_count, 0);
        assert_eq!(a.view_count, 0);
        assert!(a.published_at.is_none());
    }

    #[test]
    fn announcement_from_create_rejects_empty_title_or_body() {
        let user_id = ObjectId::new();
        let no_title = CreateAnnouncementInput {
            title: "   ".into(),
            body: "non-empty".into(),
            ..Default::default()
        };
        assert!(announcement_from_create(no_title, user_id).is_err());
        let no_body = CreateAnnouncementInput {
            title: "Title".into(),
            body: "".into(),
            ..Default::default()
        };
        assert!(announcement_from_create(no_body, user_id).is_err());
    }

    #[test]
    fn create_with_published_status_stamps_published_at() {
        let user_id = ObjectId::new();
        let input = CreateAnnouncementInput {
            title: "Now Live".into(),
            body: "Hello".into(),
            status: Some("published".into()),
            ..Default::default()
        };
        let a = announcement_from_create(input, user_id).unwrap();
        assert_eq!(a.status, "published");
        assert!(a.published_at.is_some());
    }

    #[test]
    fn update_to_published_stamps_published_at_when_missing() {
        let patch = UpdateAnnouncementInput {
            status: Some("published".into()),
            ..Default::default()
        };
        let doc = build_update_doc(patch, "draft", None);
        let set = doc.get_document("$set").unwrap();
        assert_eq!(set.get_str("status").unwrap(), "published");
        assert!(set.contains_key("publishedAt"));
    }

    #[test]
    fn update_to_published_does_not_overwrite_existing_published_at() {
        let existing = BsonDateTime::from_chrono(Utc::now());
        let patch = UpdateAnnouncementInput {
            status: Some("published".into()),
            ..Default::default()
        };
        let doc = build_update_doc(patch, "published", Some(existing));
        let set = doc.get_document("$set").unwrap();
        assert!(!set.contains_key("publishedAt"));
    }
}
