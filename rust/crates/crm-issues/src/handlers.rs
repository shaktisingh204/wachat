//! HTTP handlers for the Project Issue entity.

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
    CreateIssueInput, CreateIssueResponse, DeleteIssueResponse, ListQuery, UpdateIssueInput,
};
use crate::types::CrmIssue;

const COLL: &str = "crm_issues";
const ENTITY_KIND: &str = "issue";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    issue_type: Option<&str>,
    priority: Option<&str>,
    project_id: Option<&str>,
    assignee_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "open" | "in_progress" | "resolved" | "closed" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(t) = issue_type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("issueType", t);
    }
    if let Some(p) = priority.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("priority", p);
    }
    if let Some(pid) = project_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("projectId", pid);
    }
    if let Some(aid) = assignee_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("assigneeId", aid);
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

fn is_terminal_status(status: &str) -> bool {
    matches!(status, "resolved" | "closed")
}

fn issue_from_create(input: CreateIssueInput, user_id: ObjectId) -> Result<CrmIssue> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    Ok(CrmIssue {
        id: None,
        user_id,
        title: input.title.trim().to_owned(),
        description: input.description,
        project_id: input
            .project_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        milestone_id: input
            .milestone_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        assignee_id: input
            .assignee_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        reporter_id: input
            .reporter_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        issue_type: input.issue_type.unwrap_or_else(|| "task".to_owned()),
        priority: input.priority.unwrap_or_else(|| "medium".to_owned()),
        severity: input.severity,
        status: "open".to_owned(),
        labels: input.labels.unwrap_or_default(),
        due_date: input.due_date.as_deref().and_then(parse_date),
        resolved_at: None,
        resolution: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateIssueInput, before: &CrmIssue) -> Document {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.title {
        set.insert("title", v);
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
        .milestone_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("milestoneId", v);
    }
    if let Some(v) = patch
        .assignee_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("assigneeId", v);
    }
    if let Some(v) = patch
        .reporter_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("reporterId", v);
    }
    if let Some(v) = patch.issue_type {
        set.insert("issueType", v);
    }
    if let Some(v) = patch.priority {
        set.insert("priority", v);
    }
    if let Some(v) = patch.severity {
        set.insert("severity", v);
    }
    let next_status = patch.status.clone();
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.labels {
        set.insert("labels", v);
    }
    if let Some(v) = patch.due_date.as_deref().and_then(parse_date) {
        set.insert("dueDate", v);
    }
    if let Some(v) = patch.resolution {
        set.insert("resolution", v);
    }
    // Explicit resolved_at takes precedence over auto-stamp.
    let explicit_resolved = patch.resolved_at.as_deref().and_then(parse_date);
    if let Some(v) = explicit_resolved {
        set.insert("resolvedAt", v);
    } else if let Some(s) = next_status.as_deref() {
        // Auto-stamp resolved_at when transitioning to a terminal status
        // and the document does not already have one.
        if is_terminal_status(s) && before.resolved_at.is_none() {
            set.insert("resolvedAt", now);
        }
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmIssue) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmIssue>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_issues(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.issue_type.as_deref(),
        q.priority.as_deref(),
        q.project_id.as_deref(),
        q.assignee_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "description", "resolution"]);
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
    let coll = mongo.collection::<CrmIssue>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_issues.find")))?;
    let mut rows: Vec<CrmIssue> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_issues.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %issue_id))]
pub async fn get_issue(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(issue_id): Path<String>,
) -> Result<Json<CrmIssue>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&issue_id)?;
    let coll = mongo.collection::<CrmIssue>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_issues.find_one")))?
        .ok_or_else(|| ApiError::NotFound("issue".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_issue(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateIssueInput>,
) -> Result<Json<CreateIssueResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = issue_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmIssue>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_issues.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateIssueResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %issue_id))]
pub async fn update_issue(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(issue_id): Path<String>,
    Json(patch): Json<UpdateIssueInput>,
) -> Result<Json<CrmIssue>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&issue_id)?;
    let coll = mongo.collection::<CrmIssue>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_issues.find_one")))?
        .ok_or_else(|| ApiError::NotFound("issue".to_owned()))?;
    let update = build_update_doc(patch, &before);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_issues.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("issue".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_issues.refetch")))?
        .ok_or_else(|| ApiError::NotFound("issue".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %issue_id))]
pub async fn delete_issue(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(issue_id): Path<String>,
) -> Result<Json<DeleteIssueResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&issue_id)?;
    let coll = mongo.collection::<CrmIssue>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_issues.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("issue".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteIssueResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn issue_from_create_defaults_type_priority_status() {
        let user_id = ObjectId::new();
        let input = CreateIssueInput {
            title: "Fix crash on save".into(),
            ..Default::default()
        };
        let issue = issue_from_create(input, user_id).unwrap();
        assert_eq!(issue.issue_type, "task");
        assert_eq!(issue.priority, "medium");
        assert_eq!(issue.status, "open");
        assert!(issue.resolved_at.is_none());
        assert!(issue.labels.is_empty());
    }

    #[test]
    fn issue_from_create_rejects_empty_title() {
        let user_id = ObjectId::new();
        let input = CreateIssueInput {
            title: "   ".into(),
            ..Default::default()
        };
        assert!(issue_from_create(input, user_id).is_err());
    }

    #[test]
    fn update_stamps_resolved_at_on_transition_to_terminal() {
        let user_id = ObjectId::new();
        let before = issue_from_create(
            CreateIssueInput {
                title: "Test".into(),
                ..Default::default()
            },
            user_id,
        )
        .unwrap();
        let patch = UpdateIssueInput {
            status: Some("resolved".to_owned()),
            ..Default::default()
        };
        let update = build_update_doc(patch, &before);
        let set = update.get_document("$set").unwrap();
        assert!(set.contains_key("resolvedAt"));

        // Already-resolved issues should not have resolvedAt overwritten by auto-stamp.
        let mut already = before.clone();
        already.resolved_at = Some(BsonDateTime::from_chrono(Utc::now()));
        already.status = "resolved".to_owned();
        let patch2 = UpdateIssueInput {
            status: Some("closed".to_owned()),
            ..Default::default()
        };
        let update2 = build_update_doc(patch2, &already);
        let set2 = update2.get_document("$set").unwrap();
        assert!(!set2.contains_key("resolvedAt"));
    }
}
