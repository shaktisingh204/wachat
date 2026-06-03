//! HTTP handlers for the OneOnOne entity.

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
    CreateOneOnOneInput, CreateOneOnOneResponse, DeleteOneOnOneResponse, ListQuery,
    UpdateOneOnOneInput,
};
use crate::types::CrmOneOnOne;

const COLL: &str = "crm_one_on_ones";
const ENTITY_KIND: &str = "one_on_one";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    manager_id: Option<&str>,
    report_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(m) = manager_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("managerId", m);
    }
    if let Some(r) = report_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("reportId", r);
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

fn validate_engagement(score: Option<i32>) -> Result<()> {
    if let Some(s) = score {
        if !(1..=5).contains(&s) {
            return Err(ApiError::Validation(
                "engagementScore must be between 1 and 5".to_owned(),
            ));
        }
    }
    Ok(())
}

fn one_on_one_from_create(input: CreateOneOnOneInput, user_id: ObjectId) -> Result<CrmOneOnOne> {
    let manager_id = ObjectId::parse_str(input.manager_id.trim())
        .map_err(|_| ApiError::Validation("managerId must be a valid ObjectId".to_owned()))?;
    let report_id = ObjectId::parse_str(input.report_id.trim())
        .map_err(|_| ApiError::Validation("reportId must be a valid ObjectId".to_owned()))?;
    let scheduled_at = parse_date(input.scheduled_at.trim()).ok_or_else(|| {
        ApiError::Validation("scheduledAt must be an RFC3339 datetime".to_owned())
    })?;
    validate_engagement(input.engagement_score)?;
    Ok(CrmOneOnOne {
        id: None,
        user_id,
        manager_id,
        manager_name: input.manager_name,
        report_id,
        report_name: input.report_name,
        scheduled_at,
        duration_minutes: input.duration_minutes,
        location: input.location,
        agenda: input.agenda.unwrap_or_default(),
        discussion_notes: input.discussion_notes,
        action_items: input.action_items.unwrap_or_default(),
        mood: input.mood,
        engagement_score: input.engagement_score,
        next_meeting_at: input.next_meeting_at.as_deref().and_then(parse_date),
        is_private: input.is_private.unwrap_or(true),
        status: "scheduled".to_owned(),
        completed_at: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateOneOnOneInput) -> Result<Document> {
    validate_engagement(patch.engagement_score)?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(s) = patch.manager_id.as_deref().map(str::trim) {
        let oid = ObjectId::parse_str(s)
            .map_err(|_| ApiError::Validation("managerId must be a valid ObjectId".to_owned()))?;
        set.insert("managerId", oid);
    }
    if let Some(v) = patch.manager_name {
        set.insert("managerName", v);
    }
    if let Some(s) = patch.report_id.as_deref().map(str::trim) {
        let oid = ObjectId::parse_str(s)
            .map_err(|_| ApiError::Validation("reportId must be a valid ObjectId".to_owned()))?;
        set.insert("reportId", oid);
    }
    if let Some(v) = patch.report_name {
        set.insert("reportName", v);
    }
    if let Some(s) = patch.scheduled_at.as_deref().map(str::trim) {
        let dt = parse_date(s).ok_or_else(|| {
            ApiError::Validation("scheduledAt must be an RFC3339 datetime".to_owned())
        })?;
        set.insert("scheduledAt", dt);
    }
    if let Some(v) = patch.duration_minutes {
        set.insert("durationMinutes", v);
    }
    if let Some(v) = patch.location {
        set.insert("location", v);
    }
    if let Some(v) = patch.agenda {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|a| bson::to_document(&a).ok())
            .collect();
        set.insert("agenda", arr);
    }
    if let Some(v) = patch.discussion_notes {
        set.insert("discussionNotes", v);
    }
    if let Some(v) = patch.action_items {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|a| bson::to_document(&a).ok())
            .collect();
        set.insert("actionItems", arr);
    }
    if let Some(v) = patch.mood {
        set.insert("mood", v);
    }
    if let Some(v) = patch.engagement_score {
        set.insert("engagementScore", v);
    }
    if let Some(v) = patch.next_meeting_at.as_deref().and_then(parse_date) {
        set.insert("nextMeetingAt", v);
    }
    if let Some(v) = patch.is_private {
        set.insert("isPrivate", v);
    }
    if let Some(v) = patch.status {
        if v == "completed" {
            set.insert("completedAt", BsonDateTime::from_chrono(Utc::now()));
        }
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmOneOnOne) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmOneOnOne>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_one_on_ones(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.manager_id.as_deref(),
        q.report_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &["managerName", "reportName", "discussionNotes", "location"],
        );
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "scheduledAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmOneOnOne>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_one_on_ones.find"))
        })?;
    let mut rows: Vec<CrmOneOnOne> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_one_on_ones.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %one_on_one_id))]
pub async fn get_one_on_one(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(one_on_one_id): Path<String>,
) -> Result<Json<CrmOneOnOne>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&one_on_one_id)?;
    let coll = mongo.collection::<CrmOneOnOne>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_one_on_ones.find_one")))?
        .ok_or_else(|| ApiError::NotFound("one_on_one".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_one_on_one(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateOneOnOneInput>,
) -> Result<Json<CreateOneOnOneResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = one_on_one_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmOneOnOne>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_one_on_ones.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateOneOnOneResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %one_on_one_id))]
pub async fn update_one_on_one(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(one_on_one_id): Path<String>,
    Json(patch): Json<UpdateOneOnOneInput>,
) -> Result<Json<CrmOneOnOne>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&one_on_one_id)?;
    let coll = mongo.collection::<CrmOneOnOne>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_one_on_ones.find_one")))?
        .ok_or_else(|| ApiError::NotFound("one_on_one".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_one_on_ones.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("one_on_one".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_one_on_ones.refetch")))?
        .ok_or_else(|| ApiError::NotFound("one_on_one".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %one_on_one_id))]
pub async fn delete_one_on_one(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(one_on_one_id): Path<String>,
) -> Result<Json<DeleteOneOnOneResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&one_on_one_id)?;
    let coll = mongo.collection::<CrmOneOnOne>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_one_on_ones.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("one_on_one".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteOneOnOneResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_input() -> CreateOneOnOneInput {
        CreateOneOnOneInput {
            manager_id: ObjectId::new().to_hex(),
            report_id: ObjectId::new().to_hex(),
            scheduled_at: "2026-05-20T15:00:00Z".to_owned(),
            ..Default::default()
        }
    }

    #[test]
    fn create_rejects_invalid_manager_id() {
        let user_id = ObjectId::new();
        let input = CreateOneOnOneInput {
            manager_id: "not-an-oid".to_owned(),
            ..base_input()
        };
        assert!(one_on_one_from_create(input, user_id).is_err());
    }

    #[test]
    fn create_defaults_status_scheduled_and_is_private_true() {
        let user_id = ObjectId::new();
        let entity = one_on_one_from_create(base_input(), user_id).unwrap();
        assert_eq!(entity.status, "scheduled");
        assert!(entity.is_private);
        assert!(entity.completed_at.is_none());
    }

    #[test]
    fn update_to_completed_stamps_completed_at() {
        let patch = UpdateOneOnOneInput {
            status: Some("completed".to_owned()),
            ..Default::default()
        };
        let doc = build_update_doc(patch).unwrap();
        let set = doc.get_document("$set").unwrap();
        assert_eq!(set.get_str("status").unwrap(), "completed");
        assert!(set.contains_key("completedAt"));
    }

    #[test]
    fn engagement_score_out_of_range_rejected() {
        let user_id = ObjectId::new();
        let input = CreateOneOnOneInput {
            engagement_score: Some(7),
            ..base_input()
        };
        assert!(one_on_one_from_create(input, user_id).is_err());
    }
}
