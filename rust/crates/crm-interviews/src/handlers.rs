//! HTTP handlers for the HR Interview entity.

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
    CreateInterviewInput, CreateInterviewResponse, DeleteInterviewResponse, ListQuery,
    UpdateInterviewInput,
};
use crate::types::CrmInterview;

const COLL: &str = "crm_interviews";
const ENTITY_KIND: &str = "interview";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    candidate_id: Option<&str>,
    job_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "scheduled" | "rescheduled" | "completed" | "no_show" | "cancelled" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(c) = candidate_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("candidateId", c);
    }
    if let Some(j) = job_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("jobId", j);
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

fn parse_oid_vec(input: Option<Vec<String>>) -> Vec<ObjectId> {
    input
        .unwrap_or_default()
        .into_iter()
        .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
        .collect()
}

fn interview_from_create(input: CreateInterviewInput, user_id: ObjectId) -> Result<CrmInterview> {
    let candidate_id = ObjectId::parse_str(input.candidate_id.trim())
        .map_err(|_| ApiError::Validation("candidateId must be a valid ObjectId".to_owned()))?;
    let scheduled_at = parse_date(input.scheduled_at.trim())
        .ok_or_else(|| ApiError::Validation("scheduledAt must be RFC3339 datetime".to_owned()))?;
    let job_id = input
        .job_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok());
    let round = input.round.unwrap_or(1);
    Ok(CrmInterview {
        id: None,
        user_id,
        candidate_id,
        candidate_name: input
            .candidate_name
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        job_id,
        round,
        round_name: input
            .round_name
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        interview_type: input
            .interview_type
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        scheduled_at,
        duration_minutes: input.duration_minutes,
        location: input
            .location
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        interviewers: parse_oid_vec(input.interviewers),
        interviewer_names: input.interviewer_names.unwrap_or_default(),
        status: "scheduled".to_owned(),
        feedback: None,
        rating: None,
        recommendation: None,
        completed_at: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateInterviewInput, before_status: &str) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .candidate_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let oid = ObjectId::parse_str(v)
            .map_err(|_| ApiError::Validation("candidateId must be a valid ObjectId".to_owned()))?;
        set.insert("candidateId", oid);
    }
    if let Some(v) = patch.candidate_name {
        set.insert("candidateName", v);
    }
    if let Some(v) = patch
        .job_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        if let Ok(oid) = ObjectId::parse_str(v) {
            set.insert("jobId", oid);
        }
    }
    if let Some(v) = patch.round {
        set.insert("round", v);
    }
    if let Some(v) = patch.round_name {
        set.insert("roundName", v);
    }
    if let Some(v) = patch.interview_type {
        set.insert("interviewType", v);
    }
    if let Some(s) = patch.scheduled_at.as_deref() {
        let dt = parse_date(s.trim()).ok_or_else(|| {
            ApiError::Validation("scheduledAt must be RFC3339 datetime".to_owned())
        })?;
        set.insert("scheduledAt", dt);
    }
    if let Some(v) = patch.duration_minutes {
        set.insert("durationMinutes", v);
    }
    if let Some(v) = patch.location {
        set.insert("location", v);
    }
    if let Some(v) = patch.interviewers {
        let arr: Vec<ObjectId> = v
            .into_iter()
            .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
            .collect();
        set.insert("interviewers", arr);
    }
    if let Some(v) = patch.interviewer_names {
        set.insert("interviewerNames", v);
    }
    let new_status_is_completed = matches!(patch.status.as_deref(), Some("completed"));
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.feedback {
        set.insert("feedback", v);
    }
    if let Some(v) = patch.rating {
        set.insert("rating", v);
    }
    if let Some(v) = patch.recommendation {
        set.insert("recommendation", v);
    }
    // Stamp completedAt on transition into "completed".
    if new_status_is_completed && before_status != "completed" {
        set.insert("completedAt", BsonDateTime::from_chrono(Utc::now()));
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmInterview) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmInterview>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_interviews(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.candidate_id.as_deref(),
        q.job_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &["candidateName", "roundName", "location", "feedback"],
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
    let coll = mongo.collection::<CrmInterview>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_interviews.find"))
        })?;
    let mut rows: Vec<CrmInterview> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_interviews.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %interview_id))]
pub async fn get_interview(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(interview_id): Path<String>,
) -> Result<Json<CrmInterview>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&interview_id)?;
    let coll = mongo.collection::<CrmInterview>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_interviews.find_one")))?
        .ok_or_else(|| ApiError::NotFound("interview".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_interview(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateInterviewInput>,
) -> Result<Json<CreateInterviewResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = interview_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmInterview>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_interviews.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateInterviewResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %interview_id))]
pub async fn update_interview(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(interview_id): Path<String>,
    Json(patch): Json<UpdateInterviewInput>,
) -> Result<Json<CrmInterview>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&interview_id)?;
    let coll = mongo.collection::<CrmInterview>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_interviews.find_one")))?
        .ok_or_else(|| ApiError::NotFound("interview".to_owned()))?;
    let update = build_update_doc(patch, &before.status)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_interviews.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("interview".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_interviews.refetch")))?
        .ok_or_else(|| ApiError::NotFound("interview".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %interview_id))]
pub async fn delete_interview(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(interview_id): Path<String>,
) -> Result<Json<DeleteInterviewResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&interview_id)?;
    let coll = mongo.collection::<CrmInterview>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_interviews.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("interview".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteInterviewResponse { deleted: true }))
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
    fn create_defaults_round_to_1_and_status_scheduled() {
        let user_id = ObjectId::new();
        let candidate = ObjectId::new();
        let input = CreateInterviewInput {
            candidate_id: candidate.to_hex(),
            scheduled_at: "2026-06-01T10:00:00Z".into(),
            ..Default::default()
        };
        let iv = interview_from_create(input, user_id).unwrap();
        assert_eq!(iv.round, 1);
        assert_eq!(iv.status, "scheduled");
        assert_eq!(iv.candidate_id, candidate);
        assert!(iv.completed_at.is_none());
    }

    #[test]
    fn create_rejects_invalid_candidate_id_and_bad_date() {
        let user_id = ObjectId::new();
        let bad_candidate = CreateInterviewInput {
            candidate_id: "not-an-oid".into(),
            scheduled_at: "2026-06-01T10:00:00Z".into(),
            ..Default::default()
        };
        assert!(interview_from_create(bad_candidate, user_id).is_err());

        let bad_date = CreateInterviewInput {
            candidate_id: ObjectId::new().to_hex(),
            scheduled_at: "tomorrow at noon".into(),
            ..Default::default()
        };
        assert!(interview_from_create(bad_date, user_id).is_err());
    }
}
