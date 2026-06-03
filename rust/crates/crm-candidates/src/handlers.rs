//! HTTP handlers for the Candidate entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
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
    CreateCandidateInput, CreateCandidateResponse, DeleteCandidateResponse, ListQuery,
    UpdateCandidateInput,
};
use crate::types::CrmCandidate;

const COLL: &str = "crm_candidates";
const ENTITY_KIND: &str = "candidate";

fn is_valid_email(s: &str) -> bool {
    let trimmed = s.trim();
    if trimmed.is_empty() || trimmed.len() > 320 {
        return false;
    }
    let at = match trimmed.find('@') {
        Some(i) => i,
        None => return false,
    };
    if at == 0 || at == trimmed.len() - 1 {
        return false;
    }
    let (local, domain) = trimmed.split_at(at);
    let domain = &domain[1..];
    if local.is_empty() || domain.is_empty() {
        return false;
    }
    // Domain must contain a dot and no whitespace.
    if !domain.contains('.') {
        return false;
    }
    if trimmed.chars().any(char::is_whitespace) {
        return false;
    }
    true
}

fn normalize_email(s: &str) -> String {
    s.trim().to_lowercase()
}

fn list_filter(
    user_id: ObjectId,
    stage: Option<&str>,
    job_id: Option<&str>,
    source: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match stage.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("stage", "archived");
        }
        "applied" | "screening" | "interview" | "offer" | "hired" | "rejected" => {
            filter.insert("stage", stage.unwrap());
        }
        _ => {
            filter.insert("stage", doc! { "$ne": "archived" });
        }
    }
    if let Some(j) = job_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("jobId", j);
    }
    if let Some(s) = source.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("source", s);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn validate_rating(r: Option<i32>) -> Result<Option<i32>> {
    match r {
        None => Ok(None),
        Some(v) if (1..=5).contains(&v) => Ok(Some(v)),
        Some(_) => Err(ApiError::Validation(
            "rating must be between 1 and 5".to_owned(),
        )),
    }
}

fn candidate_from_create(input: CreateCandidateInput, user_id: ObjectId) -> Result<CrmCandidate> {
    if input.first_name.trim().is_empty() {
        return Err(ApiError::Validation("firstName is required".to_owned()));
    }
    if !is_valid_email(&input.email) {
        return Err(ApiError::Validation("email is invalid".to_owned()));
    }
    let rating = validate_rating(input.rating)?;
    Ok(CrmCandidate {
        id: None,
        user_id,
        first_name: input.first_name.trim().to_owned(),
        last_name: input
            .last_name
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        email: normalize_email(&input.email),
        phone: input.phone,
        current_company: input.current_company,
        current_title: input.current_title,
        location: input.location,
        source: input.source,
        job_id: input
            .job_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        resume_url: input.resume_url,
        cover_letter: input.cover_letter,
        skills: input.skills.unwrap_or_default(),
        experience_years: input.experience_years,
        expected_salary: input.expected_salary,
        currency: input.currency,
        stage: input.stage.unwrap_or_else(|| "applied".to_owned()),
        rating,
        notes: input.notes,
        tags: input.tags.unwrap_or_default(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateCandidateInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.first_name {
        let t = v.trim().to_owned();
        if t.is_empty() {
            return Err(ApiError::Validation("firstName cannot be empty".to_owned()));
        }
        set.insert("firstName", t);
    }
    if let Some(v) = patch.last_name {
        set.insert("lastName", v);
    }
    if let Some(v) = patch.email {
        if !is_valid_email(&v) {
            return Err(ApiError::Validation("email is invalid".to_owned()));
        }
        set.insert("email", normalize_email(&v));
    }
    if let Some(v) = patch.phone {
        set.insert("phone", v);
    }
    if let Some(v) = patch.current_company {
        set.insert("currentCompany", v);
    }
    if let Some(v) = patch.current_title {
        set.insert("currentTitle", v);
    }
    if let Some(v) = patch.location {
        set.insert("location", v);
    }
    if let Some(v) = patch.source {
        set.insert("source", v);
    }
    if let Some(v) = patch
        .job_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("jobId", v);
    }
    if let Some(v) = patch.resume_url {
        set.insert("resumeUrl", v);
    }
    if let Some(v) = patch.cover_letter {
        set.insert("coverLetter", v);
    }
    if let Some(v) = patch.skills {
        set.insert("skills", v);
    }
    if let Some(v) = patch.experience_years {
        set.insert("experienceYears", v);
    }
    if let Some(v) = patch.expected_salary {
        set.insert("expectedSalary", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.stage {
        set.insert("stage", v);
    }
    if let Some(v) = validate_rating(patch.rating)? {
        set.insert("rating", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmCandidate) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmCandidate>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_candidates(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.stage.as_deref(),
        q.job_id.as_deref(),
        q.source.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &[
                "firstName",
                "lastName",
                "email",
                "currentCompany",
                "currentTitle",
                "notes",
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
    let coll = mongo.collection::<CrmCandidate>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_candidates.find"))
        })?;
    let mut rows: Vec<CrmCandidate> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_candidates.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %candidate_id))]
pub async fn get_candidate(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(candidate_id): Path<String>,
) -> Result<Json<CrmCandidate>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&candidate_id)?;
    let coll = mongo.collection::<CrmCandidate>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_candidates.find_one")))?
        .ok_or_else(|| ApiError::NotFound("candidate".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_candidate(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCandidateInput>,
) -> Result<Json<CreateCandidateResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = candidate_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmCandidate>(COLL);

    // Enforce email uniqueness per tenant.
    let existing = coll
        .find_one(doc! { "userId": user_id, "email": &entity.email })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_candidates.find_dup"))
        })?;
    if existing.is_some() {
        return Err(ApiError::Validation(
            "a candidate with this email already exists".to_owned(),
        ));
    }

    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_candidates.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateCandidateResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %candidate_id))]
pub async fn update_candidate(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(candidate_id): Path<String>,
    Json(patch): Json<UpdateCandidateInput>,
) -> Result<Json<CrmCandidate>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&candidate_id)?;
    let coll = mongo.collection::<CrmCandidate>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_candidates.find_one")))?
        .ok_or_else(|| ApiError::NotFound("candidate".to_owned()))?;

    // If email is being changed, enforce uniqueness per tenant.
    if let Some(new_email) = patch.email.as_deref() {
        if is_valid_email(new_email) {
            let normalized = normalize_email(new_email);
            if normalized != before.email {
                let dup = coll
                    .find_one(doc! {
                        "userId": user_id,
                        "email": &normalized,
                        "_id": { "$ne": oid },
                    })
                    .await
                    .map_err(|e| {
                        ApiError::Internal(
                            anyhow::Error::new(e).context("crm_candidates.find_dup_update"),
                        )
                    })?;
                if dup.is_some() {
                    return Err(ApiError::Validation(
                        "a candidate with this email already exists".to_owned(),
                    ));
                }
            }
        }
    }

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_candidates.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("candidate".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_candidates.refetch")))?
        .ok_or_else(|| ApiError::NotFound("candidate".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %candidate_id))]
pub async fn delete_candidate(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(candidate_id): Path<String>,
) -> Result<Json<DeleteCandidateResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&candidate_id)?;
    let coll = mongo.collection::<CrmCandidate>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "stage": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_candidates.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("candidate".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteCandidateResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn candidate_from_create_defaults_stage_and_normalizes_email() {
        let user_id = ObjectId::new();
        let input = CreateCandidateInput {
            first_name: "Ada".into(),
            email: "  Ada@Example.COM  ".into(),
            ..Default::default()
        };
        let c = candidate_from_create(input, user_id).unwrap();
        assert_eq!(c.stage, "applied");
        assert_eq!(c.email, "ada@example.com");
        assert_eq!(c.first_name, "Ada");
    }

    #[test]
    fn candidate_from_create_rejects_empty_first_name() {
        let user_id = ObjectId::new();
        let input = CreateCandidateInput {
            first_name: "   ".into(),
            email: "x@y.com".into(),
            ..Default::default()
        };
        assert!(candidate_from_create(input, user_id).is_err());
    }

    #[test]
    fn candidate_from_create_rejects_invalid_email() {
        let user_id = ObjectId::new();
        let bad = [
            "",
            "noatsign",
            "missing@tld",
            "@nolocal.com",
            "spaces in@email.com",
        ];
        for email in bad {
            let input = CreateCandidateInput {
                first_name: "Ada".into(),
                email: email.into(),
                ..Default::default()
            };
            assert!(
                candidate_from_create(input, user_id).is_err(),
                "expected reject for {email:?}",
            );
        }
    }
}
