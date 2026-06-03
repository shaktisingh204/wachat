//! HTTP handlers for the Job Opening entity.

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

use crate::dto::{CreateJobInput, CreateJobResponse, DeleteJobResponse, ListQuery, UpdateJobInput};
use crate::types::CrmJob;

const COLL: &str = "crm_jobs";
const ENTITY_KIND: &str = "job";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    department_id: Option<&str>,
    employment_type: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "open" | "on_hold" | "filled" | "closed" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(d) = department_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("departmentId", d);
    }
    if let Some(t) = employment_type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("employmentType", t);
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

fn job_from_create(input: CreateJobInput, user_id: ObjectId) -> Result<CrmJob> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    let openings = input.openings.unwrap_or(1);
    if openings <= 0 {
        return Err(ApiError::Validation(
            "openings must be greater than 0".to_owned(),
        ));
    }
    Ok(CrmJob {
        id: None,
        user_id,
        title: input.title.trim().to_owned(),
        department_id: input
            .department_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        department_name: input.department_name,
        description: input.description,
        responsibilities: input.responsibilities,
        requirements: input.requirements,
        employment_type: input
            .employment_type
            .unwrap_or_else(|| "full_time".to_owned()),
        experience_min: input.experience_min,
        experience_max: input.experience_max,
        salary_min: input.salary_min,
        salary_max: input.salary_max,
        currency: input.currency,
        location: input.location,
        remote_policy: input.remote_policy,
        openings,
        filled: 0,
        hiring_manager_id: input
            .hiring_manager_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        publish_url: input.publish_url,
        publish_at: input.publish_at.as_deref().and_then(parse_date),
        close_at: input.close_at.as_deref().and_then(parse_date),
        status: "draft".to_owned(),
        tags: input.tags.unwrap_or_default(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateJobInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch
        .department_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("departmentId", v);
    }
    if let Some(v) = patch.department_name {
        set.insert("departmentName", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.responsibilities {
        set.insert("responsibilities", v);
    }
    if let Some(v) = patch.requirements {
        set.insert("requirements", v);
    }
    if let Some(v) = patch.employment_type {
        set.insert("employmentType", v);
    }
    if let Some(v) = patch.experience_min {
        set.insert("experienceMin", v);
    }
    if let Some(v) = patch.experience_max {
        set.insert("experienceMax", v);
    }
    if let Some(v) = patch.salary_min {
        set.insert("salaryMin", v);
    }
    if let Some(v) = patch.salary_max {
        set.insert("salaryMax", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.location {
        set.insert("location", v);
    }
    if let Some(v) = patch.remote_policy {
        set.insert("remotePolicy", v);
    }
    if let Some(v) = patch.openings {
        set.insert("openings", v);
    }
    if let Some(v) = patch.filled {
        set.insert("filled", v);
    }
    if let Some(v) = patch
        .hiring_manager_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("hiringManagerId", v);
    }
    if let Some(v) = patch.publish_url {
        set.insert("publishUrl", v);
    }
    if let Some(v) = patch.publish_at.as_deref().and_then(parse_date) {
        set.insert("publishAt", v);
    }
    if let Some(v) = patch.close_at.as_deref().and_then(parse_date) {
        set.insert("closeAt", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmJob) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmJob>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_jobs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.department_id.as_deref(),
        q.employment_type.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &[
                "title",
                "description",
                "responsibilities",
                "requirements",
                "location",
                "departmentName",
            ],
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
    let coll = mongo.collection::<CrmJob>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_jobs.find")))?;
    let mut rows: Vec<CrmJob> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_jobs.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %job_id))]
pub async fn get_job(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(job_id): Path<String>,
) -> Result<Json<CrmJob>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&job_id)?;
    let coll = mongo.collection::<CrmJob>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_jobs.find_one")))?
        .ok_or_else(|| ApiError::NotFound("job".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_job(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateJobInput>,
) -> Result<Json<CreateJobResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = job_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmJob>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_jobs.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateJobResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %job_id))]
pub async fn update_job(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(job_id): Path<String>,
    Json(patch): Json<UpdateJobInput>,
) -> Result<Json<CrmJob>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&job_id)?;
    let coll = mongo.collection::<CrmJob>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_jobs.find_one")))?
        .ok_or_else(|| ApiError::NotFound("job".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_jobs.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("job".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_jobs.refetch")))?
        .ok_or_else(|| ApiError::NotFound("job".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %job_id))]
pub async fn delete_job(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(job_id): Path<String>,
) -> Result<Json<DeleteJobResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&job_id)?;
    let coll = mongo.collection::<CrmJob>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_jobs.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("job".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteJobResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn job_from_create_defaults_employment_type_status_openings() {
        let user_id = ObjectId::new();
        let input = CreateJobInput {
            title: "Senior Engineer".into(),
            ..Default::default()
        };
        let j = job_from_create(input, user_id).unwrap();
        assert_eq!(j.employment_type, "full_time");
        assert_eq!(j.status, "draft");
        assert_eq!(j.openings, 1);
        assert_eq!(j.filled, 0);
    }

    #[test]
    fn job_from_create_rejects_empty_title_and_zero_openings() {
        let user_id = ObjectId::new();
        let empty = CreateJobInput {
            title: "  ".into(),
            ..Default::default()
        };
        assert!(job_from_create(empty, user_id).is_err());

        let zero = CreateJobInput {
            title: "Engineer".into(),
            openings: Some(0),
            ..Default::default()
        };
        assert!(job_from_create(zero, user_id).is_err());
    }
}
