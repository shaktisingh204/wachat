//! HTTP handlers for the Milestone entity.

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
    CreateMilestoneInput, CreateMilestoneResponse, DeleteMilestoneResponse, ListQuery,
    UpdateMilestoneInput,
};
use crate::types::CrmMilestone;

const COLL: &str = "crm_milestones";
const ENTITY_KIND: &str = "milestone";

fn clamp_progress(v: f64) -> f64 {
    if v.is_nan() {
        0.0
    } else if v < 0.0 {
        0.0
    } else if v > 100.0 {
        100.0
    } else {
        v
    }
}

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    project_id: Option<&str>,
    parent_id: Option<&str>,
    owner_id: Option<&str>,
    priority: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "planned" | "in_progress" | "completed" | "overdue" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(pid) = project_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("projectId", pid);
    }
    if let Some(parent) = parent_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("parentId", parent);
    }
    if let Some(oid) = owner_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("ownerId", oid);
    }
    if let Some(p) = priority.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("priority", p);
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

fn milestone_from_create(input: CreateMilestoneInput, user_id: ObjectId) -> Result<CrmMilestone> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let status = input.status.unwrap_or_else(|| "planned".to_owned());
    let supplied_completed_at = input.completed_at.as_deref().and_then(parse_date);
    // When status==completed and no completed_at provided, stamp it now.
    let completed_at = if status == "completed" && supplied_completed_at.is_none() {
        Some(BsonDateTime::from_chrono(Utc::now()))
    } else {
        supplied_completed_at
    };
    Ok(CrmMilestone {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        project_id: input
            .project_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        parent_id: input
            .parent_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        due_date: input.due_date.as_deref().and_then(parse_date),
        completed_at,
        progress: input.progress.map(clamp_progress),
        priority: input.priority.unwrap_or_else(|| "medium".to_owned()),
        status,
        owner_id: input
            .owner_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        tags: input.tags.unwrap_or_default(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateMilestoneInput, before_status: &str) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch
        .project_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("projectId", v);
    }
    if let Some(v) = patch
        .parent_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("parentId", v);
    }
    if let Some(v) = patch.due_date.as_deref().and_then(parse_date) {
        set.insert("dueDate", v);
    }
    let supplied_completed_at = patch.completed_at.as_deref().and_then(parse_date);
    if let Some(v) = supplied_completed_at {
        set.insert("completedAt", v);
    }
    if let Some(v) = patch.progress {
        set.insert("progress", clamp_progress(v));
    }
    if let Some(v) = patch.priority {
        set.insert("priority", v);
    }
    if let Some(ref v) = patch.status {
        set.insert("status", v.clone());
        // When transitioning into "completed" and the patch didn't supply a
        // completedAt, stamp it now.
        if v == "completed" && before_status != "completed" && supplied_completed_at.is_none() {
            set.insert("completedAt", BsonDateTime::from_chrono(Utc::now()));
        }
    }
    if let Some(v) = patch
        .owner_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("ownerId", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmMilestone) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmMilestone>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_milestones(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.project_id.as_deref(),
        q.parent_id.as_deref(),
        q.owner_id.as_deref(),
        q.priority.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description", "tags"]);
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
    let coll = mongo.collection::<CrmMilestone>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_milestones.find"))
        })?;
    let mut rows: Vec<CrmMilestone> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_milestones.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %milestone_id))]
pub async fn get_milestone(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(milestone_id): Path<String>,
) -> Result<Json<CrmMilestone>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&milestone_id)?;
    let coll = mongo.collection::<CrmMilestone>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_milestones.find_one")))?
        .ok_or_else(|| ApiError::NotFound("milestone".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_milestone(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateMilestoneInput>,
) -> Result<Json<CreateMilestoneResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = milestone_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmMilestone>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_milestones.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateMilestoneResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %milestone_id))]
pub async fn update_milestone(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(milestone_id): Path<String>,
    Json(patch): Json<UpdateMilestoneInput>,
) -> Result<Json<CrmMilestone>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&milestone_id)?;
    let coll = mongo.collection::<CrmMilestone>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_milestones.find_one")))?
        .ok_or_else(|| ApiError::NotFound("milestone".to_owned()))?;
    let update = build_update_doc(patch, &before.status);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_milestones.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("milestone".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_milestones.refetch")))?
        .ok_or_else(|| ApiError::NotFound("milestone".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %milestone_id))]
pub async fn delete_milestone(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(milestone_id): Path<String>,
) -> Result<Json<DeleteMilestoneResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&milestone_id)?;
    let coll = mongo.collection::<CrmMilestone>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_milestones.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("milestone".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteMilestoneResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None, None, None);
        assert!(f.contains_key("status"));
        // default branch sets status != archived
        let s = f.get("status").unwrap();
        assert!(s.as_document().is_some(), "status should be a $ne doc");
    }

    #[test]
    fn milestone_from_create_clamps_progress_and_stamps_completed_at() {
        let user_id = ObjectId::new();
        // Out-of-range progress is clamped.
        let over = CreateMilestoneInput {
            name: "Beta launch".into(),
            progress: Some(250.0),
            ..Default::default()
        };
        let m = milestone_from_create(over, user_id).unwrap();
        assert_eq!(m.priority, "medium");
        assert_eq!(m.status, "planned");
        assert_eq!(m.progress, Some(100.0));

        let under = CreateMilestoneInput {
            name: "Alpha".into(),
            progress: Some(-12.0),
            ..Default::default()
        };
        let m2 = milestone_from_create(under, user_id).unwrap();
        assert_eq!(m2.progress, Some(0.0));

        // status=completed without completedAt auto-stamps.
        let completed = CreateMilestoneInput {
            name: "GA".into(),
            status: Some("completed".into()),
            ..Default::default()
        };
        let m3 = milestone_from_create(completed, user_id).unwrap();
        assert!(m3.completed_at.is_some());
    }

    #[test]
    fn milestone_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateMilestoneInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(milestone_from_create(input, user_id).is_err());
    }

    #[test]
    fn build_update_doc_stamps_completed_at_on_transition() {
        let patch = UpdateMilestoneInput {
            status: Some("completed".into()),
            ..Default::default()
        };
        let doc = build_update_doc(patch, "in_progress");
        let set = doc.get_document("$set").unwrap();
        assert_eq!(set.get_str("status").unwrap(), "completed");
        assert!(set.contains_key("completedAt"));
    }

    #[test]
    fn build_update_doc_clamps_progress_on_update() {
        let patch = UpdateMilestoneInput {
            progress: Some(500.0),
            ..Default::default()
        };
        let doc = build_update_doc(patch, "planned");
        let set = doc.get_document("$set").unwrap();
        assert_eq!(set.get_f64("progress").unwrap(), 100.0);
    }
}
