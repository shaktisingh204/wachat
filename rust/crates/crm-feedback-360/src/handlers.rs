//! HTTP handlers for the 360° Feedback entity.

use std::collections::BTreeMap;

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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
    CreateFeedback360Input, CreateFeedback360Response, DeleteFeedback360Response, ListQuery,
    ReviewerResponseInput, UpdateFeedback360Input,
};
use crate::types::{CrmFeedback360, ReviewerResponse};

const COLL: &str = "crm_feedback_360";
const ENTITY_KIND: &str = "feedback_360";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" => {
            filter.insert("status", "draft");
        }
        "in_progress" => {
            filter.insert("status", "in_progress");
        }
        "completed" => {
            filter.insert("status", "completed");
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

fn reviewer_from_input(r: ReviewerResponseInput) -> ReviewerResponse {
    ReviewerResponse {
        reviewer_id: r.reviewer_id,
        role: r.role,
        scores: r.scores,
        comments: r.comments,
        submitted_at: r.submitted_at.map(BsonDateTime::from_chrono),
    }
}

/// Returns `(aggregatedScores, overallRating)` averaged across all
/// reviewer responses that carry per-competency scores.
fn aggregate(responses: &[ReviewerResponse]) -> (BTreeMap<String, f64>, Option<f64>) {
    let mut sums: BTreeMap<String, (f64, u32)> = BTreeMap::new();
    for r in responses {
        for (k, v) in &r.scores {
            let slot = sums.entry(k.clone()).or_insert((0.0, 0));
            slot.0 += *v;
            slot.1 += 1;
        }
    }
    let mut aggregated: BTreeMap<String, f64> = BTreeMap::new();
    for (k, (total, n)) in sums {
        if n > 0 {
            let avg = (total / f64::from(n) * 100.0).round() / 100.0;
            aggregated.insert(k, avg);
        }
    }
    let overall = if aggregated.is_empty() {
        None
    } else {
        let sum: f64 = aggregated.values().sum();
        let n = aggregated.len() as f64;
        Some((sum / n * 100.0).round() / 100.0)
    };
    (aggregated, overall)
}

fn entity_from_create(input: CreateFeedback360Input, user_id: ObjectId) -> Result<CrmFeedback360> {
    if input.employee_id.trim().is_empty() {
        return Err(ApiError::Validation("employeeId is required".to_owned()));
    }
    let reviewer_responses: Vec<ReviewerResponse> = input
        .reviewer_responses
        .into_iter()
        .map(reviewer_from_input)
        .collect();
    let (aggregated_scores, computed_overall) = aggregate(&reviewer_responses);
    let overall_rating = input.overall_rating.or(computed_overall);

    Ok(CrmFeedback360 {
        id: None,
        user_id,
        employee_id: input.employee_id.trim().to_string(),
        employee_name: input.employee_name,
        period: input.period,
        reviewer_ids: input.reviewer_ids,
        reviewer_responses,
        aggregated_scores,
        overall_rating,
        status: Some(input.status.unwrap_or_else(|| "draft".to_owned())),
        completed_at: input.completed_at.map(BsonDateTime::from_chrono),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateFeedback360Input) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.employee_id {
        set.insert("employeeId", v.trim());
    }
    if let Some(v) = patch.employee_name {
        set.insert("employeeName", v);
    }
    if let Some(v) = patch.period {
        set.insert("period", v);
    }
    if let Some(v) = patch.reviewer_ids {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("reviewerIds", Bson::Array(arr));
    }
    if let Some(v) = patch.reviewer_responses {
        let rs: Vec<ReviewerResponse> = v.into_iter().map(reviewer_from_input).collect();
        let (aggregated, computed_overall) = aggregate(&rs);
        let docs: Vec<Bson> = rs
            .iter()
            .filter_map(|r| bson::to_document(r).ok().map(Bson::Document))
            .collect();
        set.insert("reviewerResponses", Bson::Array(docs));
        let mut agg_doc = Document::new();
        for (k, v) in &aggregated {
            agg_doc.insert(k, *v);
        }
        set.insert("aggregatedScores", agg_doc);
        if let Some(o) = computed_overall {
            set.insert("overallRating", o);
        }
    }
    if let Some(v) = patch.overall_rating {
        set.insert("overallRating", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.completed_at {
        set.insert("completedAt", BsonDateTime::from_chrono(v));
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmFeedback360) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmFeedback360>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_reviews(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(emp) = q
        .employee_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("employeeId", emp);
    }
    if let Some(p) = q.period.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("period", p);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["employeeName", "employeeId", "period"]);
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

    let coll = mongo.collection::<CrmFeedback360>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_feedback_360.find"))
        })?;
    let mut rows: Vec<CrmFeedback360> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_feedback_360.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %review_id))]
pub async fn get_review(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(review_id): Path<String>,
) -> Result<Json<CrmFeedback360>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&review_id)?;
    let coll = mongo.collection::<CrmFeedback360>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_feedback_360.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("feedback_360".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_review(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateFeedback360Input>,
) -> Result<Json<CreateFeedback360Response>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmFeedback360>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_feedback_360.insert"))
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

    Ok(Json(CreateFeedback360Response {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %review_id))]
pub async fn update_review(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(review_id): Path<String>,
    Json(patch): Json<UpdateFeedback360Input>,
) -> Result<Json<CrmFeedback360>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&review_id)?;

    let coll = mongo.collection::<CrmFeedback360>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_feedback_360.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("feedback_360".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_feedback_360.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("feedback_360".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_feedback_360.refetch")))?
        .ok_or_else(|| ApiError::NotFound("feedback_360".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %review_id))]
pub async fn delete_review(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(review_id): Path<String>,
) -> Result<Json<DeleteFeedback360Response>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&review_id)?;

    let coll = mongo.collection::<CrmFeedback360>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_feedback_360.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("feedback_360".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteFeedback360Response { deleted: true }))
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
    fn entity_from_create_defaults_to_draft() {
        let user_id = ObjectId::new();
        let input = CreateFeedback360Input {
            employee_id: "emp_42".into(),
            ..Default::default()
        };
        let e = entity_from_create(input, user_id).unwrap();
        assert_eq!(e.status.as_deref(), Some("draft"));
        assert_eq!(e.employee_id, "emp_42");
    }

    #[test]
    fn entity_from_create_rejects_missing_employee() {
        let user_id = ObjectId::new();
        let input = CreateFeedback360Input {
            employee_id: "  ".into(),
            ..Default::default()
        };
        assert!(entity_from_create(input, user_id).is_err());
    }

    #[test]
    fn aggregate_averages_scores_across_reviewers() {
        let r1 = ReviewerResponse {
            reviewer_id: "a".into(),
            role: "peer".into(),
            scores: BTreeMap::from([
                ("communication".to_string(), 4.0),
                ("ownership".to_string(), 5.0),
            ]),
            comments: None,
            submitted_at: None,
        };
        let r2 = ReviewerResponse {
            reviewer_id: "b".into(),
            role: "manager".into(),
            scores: BTreeMap::from([("communication".to_string(), 5.0)]),
            comments: None,
            submitted_at: None,
        };
        let (agg, overall) = aggregate(&[r1, r2]);
        // communication = (4+5)/2 = 4.5, ownership = 5
        assert!((agg.get("communication").copied().unwrap_or(0.0) - 4.5).abs() < f64::EPSILON);
        assert!((agg.get("ownership").copied().unwrap_or(0.0) - 5.0).abs() < f64::EPSILON);
        // overall = (4.5 + 5.0) / 2 = 4.75
        assert!((overall.unwrap_or(0.0) - 4.75).abs() < f64::EPSILON);
    }
}
