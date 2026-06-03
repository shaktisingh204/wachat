//! HTTP handlers for the Probation entity.

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

use crate::dto::{
    CreateProbationInput, CreateProbationResponse, DeleteProbationResponse, ListQuery,
    ProbationCriterionInput, UpdateProbationInput,
};
use crate::types::{CrmProbation, ProbationCriterion};

const COLL: &str = "crm_probations";
const ENTITY_KIND: &str = "probation";

const VALID_STATUSES: &[&str] = &[
    "in_progress",
    "confirmed",
    "extended",
    "terminated",
    "archived",
];

const VALID_RECOMMENDATIONS: &[&str] = &["confirm", "extend", "terminate"];

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        s if VALID_STATUSES.contains(&s) => {
            filter.insert("status", s);
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

fn coerce_status(raw: Option<&str>, default: &str) -> String {
    match raw {
        Some(s) if VALID_STATUSES.contains(&s) => s.to_owned(),
        _ => default.to_owned(),
    }
}

fn coerce_recommendation(raw: Option<&str>) -> Option<String> {
    raw.and_then(|s| {
        if VALID_RECOMMENDATIONS.contains(&s) {
            Some(s.to_owned())
        } else {
            None
        }
    })
}

fn criterion_from_input(c: ProbationCriterionInput) -> Option<ProbationCriterion> {
    let name = c.name.trim().to_owned();
    if name.is_empty() {
        return None;
    }
    Some(ProbationCriterion {
        name,
        target: c.target,
        achieved: c.achieved,
        score: c.score.filter(|s| s.is_finite()),
    })
}

fn probation_from_create(input: CreateProbationInput, user_id: ObjectId) -> Result<CrmProbation> {
    if input
        .employee_id
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .is_empty()
        && input
            .employee_name
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .is_empty()
    {
        return Err(ApiError::Validation(
            "employee_id or employee_name is required".to_owned(),
        ));
    }
    Ok(CrmProbation {
        id: None,
        user_id,
        employee_id: input
            .employee_id
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        employee_name: input
            .employee_name
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        start_date: input.start_date.as_deref().and_then(parse_date),
        end_date: input.end_date.as_deref().and_then(parse_date),
        evaluator_id: input.evaluator_id,
        evaluator_name: input.evaluator_name,
        criteria: input
            .criteria
            .into_iter()
            .filter_map(criterion_from_input)
            .collect(),
        overall_score: input.overall_score.filter(|s| s.is_finite()),
        recommendation: coerce_recommendation(input.recommendation.as_deref()),
        notes: input.notes,
        status: coerce_status(input.status.as_deref(), "in_progress"),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateProbationInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.employee_id {
        set.insert("employeeId", v.trim());
    }
    if let Some(v) = patch.employee_name {
        set.insert("employeeName", v.trim());
    }
    if let Some(v) = patch.start_date.as_deref().and_then(parse_date) {
        set.insert("startDate", v);
    }
    if let Some(v) = patch.end_date.as_deref().and_then(parse_date) {
        set.insert("endDate", v);
    }
    if let Some(v) = patch.evaluator_id {
        set.insert("evaluatorId", v);
    }
    if let Some(v) = patch.evaluator_name {
        set.insert("evaluatorName", v);
    }
    if let Some(v) = patch.criteria {
        let criteria: Vec<ProbationCriterion> =
            v.into_iter().filter_map(criterion_from_input).collect();
        let docs: Vec<Bson> = criteria
            .iter()
            .filter_map(|c| bson::to_document(c).ok().map(Bson::Document))
            .collect();
        set.insert("criteria", Bson::Array(docs));
    }
    if let Some(v) = patch.overall_score {
        if v.is_finite() {
            set.insert("overallScore", v);
        }
    }
    if let Some(v) = patch.recommendation {
        if let Some(r) = coerce_recommendation(Some(v.as_str())) {
            set.insert("recommendation", r);
        }
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        if VALID_STATUSES.contains(&v.as_str()) {
            set.insert("status", v);
        }
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmProbation) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmProbation>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_probations(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(emp) = q.employee_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("employeeId", emp);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &["employeeName", "employeeId", "evaluatorName", "notes"],
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

    let coll = mongo.collection::<CrmProbation>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_probation.find")))?;
    let mut rows: Vec<CrmProbation> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_probation.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %probation_id))]
pub async fn get_probation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(probation_id): Path<String>,
) -> Result<Json<CrmProbation>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&probation_id)?;
    let coll = mongo.collection::<CrmProbation>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_probation.find_one")))?
        .ok_or_else(|| ApiError::NotFound("probation".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_probation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateProbationInput>,
) -> Result<Json<CreateProbationResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = probation_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmProbation>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_probation.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateProbationResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %probation_id))]
pub async fn update_probation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(probation_id): Path<String>,
    Json(patch): Json<UpdateProbationInput>,
) -> Result<Json<CrmProbation>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&probation_id)?;

    let coll = mongo.collection::<CrmProbation>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_probation.find_one")))?
        .ok_or_else(|| ApiError::NotFound("probation".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_probation.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("probation".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_probation.refetch")))?
        .ok_or_else(|| ApiError::NotFound("probation".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %probation_id))]
pub async fn delete_probation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(probation_id): Path<String>,
) -> Result<Json<DeleteProbationResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&probation_id)?;

    let coll = mongo.collection::<CrmProbation>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_probation.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("probation".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteProbationResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn probation_from_create_defaults_status() {
        let user_id = ObjectId::new();
        let input = CreateProbationInput {
            employee_name: Some("Alice".into()),
            ..Default::default()
        };
        let p = probation_from_create(input, user_id).unwrap();
        assert_eq!(p.status, "in_progress");
        assert!(p.criteria.is_empty());
        assert!(p.recommendation.is_none());
    }

    #[test]
    fn probation_from_create_requires_employee_identity() {
        let user_id = ObjectId::new();
        let input = CreateProbationInput {
            employee_id: Some("  ".into()),
            employee_name: None,
            ..Default::default()
        };
        assert!(probation_from_create(input, user_id).is_err());
    }

    #[test]
    fn probation_from_create_filters_bad_criteria_and_recommendation() {
        let user_id = ObjectId::new();
        let input = CreateProbationInput {
            employee_id: Some("emp_1".into()),
            criteria: vec![
                ProbationCriterionInput {
                    name: " ".into(),
                    ..Default::default()
                },
                ProbationCriterionInput {
                    name: "Quality".into(),
                    score: Some(8.5),
                    ..Default::default()
                },
            ],
            recommendation: Some("noop".into()),
            ..Default::default()
        };
        let p = probation_from_create(input, user_id).unwrap();
        assert_eq!(p.criteria.len(), 1);
        assert_eq!(p.criteria[0].name, "Quality");
        assert_eq!(p.criteria[0].score, Some(8.5));
        assert!(p.recommendation.is_none());
    }
}
