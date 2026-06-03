//! HTTP handlers for the Bug entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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

use crate::dto::{CreateBugInput, CreateBugResponse, DeleteBugResponse, ListQuery, UpdateBugInput};
use crate::types::Bug;

const COLL: &str = "sabbugs_bugs";
const ENTITY_KIND: &str = "bug";

const STATUS_VARIANTS: &[&str] = &[
    "open",
    "in_progress",
    "fixed",
    "verified",
    "reopened",
    "closed",
];
const SEVERITY_VARIANTS: &[&str] = &["trivial", "minor", "major", "critical", "blocker"];

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn oid_vec(input: Option<&Vec<String>>) -> Option<Vec<ObjectId>> {
    input.map(|v| {
        v.iter()
            .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
            .collect()
    })
}

fn list_filter(user_id: ObjectId, q: &ListQuery, caller: ObjectId) -> Document {
    let mut filter = doc! { "userId": user_id };

    match q.status.as_deref().unwrap_or("active_visible") {
        "all" => {}
        s if STATUS_VARIANTS.contains(&s) => {
            filter.insert("status", s);
        }
        _ => {
            filter.insert("status", doc! { "$ne": "closed" });
        }
    }

    if let Some(s) = q
        .severity
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("severity", s);
    }
    if let Some(p) = q
        .priority
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("priority", p);
    }
    if let Some(pid) = q
        .project_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("projectId", pid);
    }
    if let Some(aid) = q
        .assignee_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("assigneeId", aid);
    }
    if let Some(rid) = q
        .reporter_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("reporterId", rid);
    }
    if let Some(vid) = q
        .version_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert(
            "$or",
            vec![
                Bson::Document(doc! { "affectedVersions": vid }),
                Bson::Document(doc! { "fixedInVersion": vid }),
            ],
        );
    }
    if q.mine.unwrap_or(false) {
        filter.insert("assigneeId", caller);
    }

    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn is_terminal_status(status: &str) -> bool {
    matches!(status, "fixed" | "verified" | "closed")
}

fn bug_from_create(input: CreateBugInput, user_id: ObjectId) -> Result<Bug> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }

    let severity = input
        .severity
        .unwrap_or_else(|| "minor".to_owned())
        .to_lowercase();
    if !SEVERITY_VARIANTS.contains(&severity.as_str()) {
        return Err(ApiError::Validation(format!(
            "severity must be one of {:?}",
            SEVERITY_VARIANTS
        )));
    }

    Ok(Bug {
        id: None,
        user_id,
        project_id: input
            .project_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        title: input.title.trim().to_owned(),
        description: input.description,
        repro_steps: input.repro_steps,
        environment: input.environment,
        severity,
        priority: input.priority.unwrap_or_else(|| "medium".to_owned()),
        status: "open".to_owned(),
        reporter_id: input
            .reporter_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok())
            .or(Some(user_id)),
        assignee_id: input
            .assignee_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        affected_versions: oid_vec(input.affected_versions.as_ref()).unwrap_or_default(),
        fixed_in_version: input
            .fixed_in_version
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        attachment_ids: input.attachment_ids.unwrap_or_default(),
        labels: input.labels.unwrap_or_default(),
        related_bug_ids: oid_vec(input.related_bug_ids.as_ref()).unwrap_or_default(),
        due_date: input.due_date.as_deref().and_then(parse_date),
        resolved_at: None,
        verified_at: None,
        closed_at: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateBugInput, before: &Bug) -> Document {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };

    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.repro_steps {
        set.insert("reproSteps", v);
    }
    if let Some(v) = patch.environment {
        set.insert("environment", v);
    }
    if let Some(v) = patch
        .project_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("projectId", v);
    }
    if let Some(v) = patch.severity {
        set.insert("severity", v);
    }
    if let Some(v) = patch.priority {
        set.insert("priority", v);
    }

    let next_status = patch.status.clone();
    if let Some(v) = patch.status {
        set.insert("status", v);
    }

    if let Some(v) = patch
        .reporter_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("reporterId", v);
    }
    if let Some(v) = patch
        .assignee_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("assigneeId", v);
    }
    if let Some(v) = oid_vec(patch.affected_versions.as_ref()) {
        set.insert("affectedVersions", v);
    }
    if let Some(v) = patch
        .fixed_in_version
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("fixedInVersion", v);
    }
    if let Some(v) = patch.attachment_ids {
        set.insert("attachmentIds", v);
    }
    if let Some(v) = patch.labels {
        set.insert("labels", v);
    }
    if let Some(v) = oid_vec(patch.related_bug_ids.as_ref()) {
        set.insert("relatedBugIds", v);
    }
    if let Some(v) = patch.due_date.as_deref().and_then(parse_date) {
        set.insert("dueDate", v);
    }

    // Auto-stamp terminal transitions.
    if let Some(s) = next_status.as_deref() {
        if s == "fixed" && before.resolved_at.is_none() {
            set.insert("resolvedAt", now);
        }
        if s == "verified" && before.verified_at.is_none() {
            set.insert("verifiedAt", now);
        }
        if s == "closed" && before.closed_at.is_none() {
            set.insert("closedAt", now);
        }
        if s == "reopened" {
            set.insert("resolvedAt", Bson::Null);
            set.insert("verifiedAt", Bson::Null);
            set.insert("closedAt", Bson::Null);
        }
        let _ = is_terminal_status(s); // retained for future workflow hooks
    }

    doc! { "$set": set }
}

fn doc_for_audit(entity: &Bug) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<Bug>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_bugs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, &q, user_id);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &["title", "description", "reproSteps", "environment"],
        );
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
    let coll = mongo.collection::<Bug>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbugs_bugs.find")))?;
    let mut rows: Vec<Bug> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbugs_bugs.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %bug_id))]
pub async fn get_bug(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(bug_id): Path<String>,
) -> Result<Json<Bug>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&bug_id)?;
    let coll = mongo.collection::<Bug>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbugs_bugs.find_one")))?
        .ok_or_else(|| ApiError::NotFound("bug".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_bug(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateBugInput>,
) -> Result<Json<CreateBugResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = bug_from_create(input, user_id)?;
    let coll = mongo.collection::<Bug>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbugs_bugs.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateBugResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %bug_id))]
pub async fn update_bug(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(bug_id): Path<String>,
    Json(patch): Json<UpdateBugInput>,
) -> Result<Json<Bug>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&bug_id)?;
    let coll = mongo.collection::<Bug>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbugs_bugs.find_one")))?
        .ok_or_else(|| ApiError::NotFound("bug".to_owned()))?;
    let update = build_update_doc(patch, &before);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbugs_bugs.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("bug".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbugs_bugs.refetch")))?
        .ok_or_else(|| ApiError::NotFound("bug".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %bug_id))]
pub async fn delete_bug(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(bug_id): Path<String>,
) -> Result<Json<DeleteBugResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&bug_id)?;
    let coll = mongo.collection::<Bug>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "closed",
                "closedAt": BsonDateTime::from_chrono(Utc::now()),
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbugs_bugs.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("bug".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteBugResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bug_from_create_defaults() {
        let user_id = ObjectId::new();
        let input = CreateBugInput {
            title: "Crash on save".into(),
            ..Default::default()
        };
        let bug = bug_from_create(input, user_id).unwrap();
        assert_eq!(bug.severity, "minor");
        assert_eq!(bug.priority, "medium");
        assert_eq!(bug.status, "open");
        assert_eq!(bug.reporter_id, Some(user_id));
    }

    #[test]
    fn rejects_empty_title() {
        let user_id = ObjectId::new();
        let input = CreateBugInput {
            title: "  ".into(),
            ..Default::default()
        };
        assert!(bug_from_create(input, user_id).is_err());
    }

    #[test]
    fn rejects_invalid_severity() {
        let user_id = ObjectId::new();
        let input = CreateBugInput {
            title: "x".into(),
            severity: Some("nuclear".into()),
            ..Default::default()
        };
        assert!(bug_from_create(input, user_id).is_err());
    }

    #[test]
    fn update_stamps_resolved_at_when_fixed() {
        let user_id = ObjectId::new();
        let before = bug_from_create(
            CreateBugInput {
                title: "x".into(),
                ..Default::default()
            },
            user_id,
        )
        .unwrap();
        let patch = UpdateBugInput {
            status: Some("fixed".into()),
            ..Default::default()
        };
        let update = build_update_doc(patch, &before);
        let set = update.get_document("$set").unwrap();
        assert!(set.contains_key("resolvedAt"));
    }

    #[test]
    fn reopen_clears_terminal_timestamps() {
        let user_id = ObjectId::new();
        let mut before = bug_from_create(
            CreateBugInput {
                title: "x".into(),
                ..Default::default()
            },
            user_id,
        )
        .unwrap();
        before.resolved_at = Some(BsonDateTime::from_chrono(Utc::now()));
        before.status = "fixed".into();
        let patch = UpdateBugInput {
            status: Some("reopened".into()),
            ..Default::default()
        };
        let update = build_update_doc(patch, &before);
        let set = update.get_document("$set").unwrap();
        assert_eq!(set.get("resolvedAt"), Some(&Bson::Null));
    }
}
