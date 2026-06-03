//! HTTP handlers for the Appraisal Review entity.

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
    CreateReviewInput, CreateReviewResponse, DeleteReviewResponse, ListQuery, UpdateReviewInput,
};
use crate::types::CrmAppraisalReview;

const COLL: &str = "crm_appraisal_reviews";
const ENTITY_KIND: &str = "appraisal_review";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    period: Option<&str>,
    employee_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "submitted" | "finalized" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(p) = period.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("period", p);
    }
    if let Some(eid) = employee_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("employeeId", eid);
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

fn review_from_create(input: CreateReviewInput, user_id: ObjectId) -> Result<CrmAppraisalReview> {
    if input.employee_name.trim().is_empty() {
        return Err(ApiError::Validation("employeeName is required".to_owned()));
    }
    let status = input.status.unwrap_or_else(|| "draft".to_owned());
    let finalized_at = if status == "finalized" {
        Some(BsonDateTime::from_chrono(Utc::now()))
    } else {
        None
    };
    Ok(CrmAppraisalReview {
        id: None,
        user_id,
        employee_name: input.employee_name.trim().to_owned(),
        employee_id: input
            .employee_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        reviewer: input.reviewer,
        period: input.period,
        kpis: input.kpis.unwrap_or_default(),
        overall_rating: input.overall_rating,
        comments: input.comments,
        status,
        finalized_at,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateReviewInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.employee_name {
        set.insert("employeeName", v);
    }
    if let Some(v) = patch
        .employee_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("employeeId", v);
    }
    if let Some(v) = patch.reviewer {
        set.insert("reviewer", v);
    }
    if let Some(v) = patch.period {
        set.insert("period", v);
    }
    if let Some(v) = patch.kpis {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|k| bson::to_document(&k).ok())
            .collect();
        set.insert("kpis", arr);
    }
    if let Some(v) = patch.overall_rating {
        set.insert("overallRating", v);
    }
    if let Some(v) = patch.comments {
        set.insert("comments", v);
    }
    if let Some(v) = patch.status.as_deref() {
        set.insert("status", v);
        if v == "finalized" {
            set.insert("finalizedAt", BsonDateTime::from_chrono(Utc::now()));
        }
    }
    if let Some(v) = patch.finalized_at.as_deref().and_then(parse_date) {
        set.insert("finalizedAt", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmAppraisalReview) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmAppraisalReview>,
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
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.period.as_deref(),
        q.employee_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["employeeName", "reviewer", "period", "comments"]);
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
    let coll = mongo.collection::<CrmAppraisalReview>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_appraisal_reviews.find"))
    })?;
    let mut rows: Vec<CrmAppraisalReview> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_appraisal_reviews.collect"))
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
) -> Result<Json<CrmAppraisalReview>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&review_id)?;
    let coll = mongo.collection::<CrmAppraisalReview>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_appraisal_reviews.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("appraisal_review".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_review(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateReviewInput>,
) -> Result<Json<CreateReviewResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = review_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmAppraisalReview>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_appraisal_reviews.insert"))
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
    Ok(Json(CreateReviewResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %review_id))]
pub async fn update_review(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(review_id): Path<String>,
    Json(patch): Json<UpdateReviewInput>,
) -> Result<Json<CrmAppraisalReview>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&review_id)?;
    let coll = mongo.collection::<CrmAppraisalReview>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_appraisal_reviews.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("appraisal_review".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_appraisal_reviews.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("appraisal_review".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_appraisal_reviews.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("appraisal_review".to_owned()))?;
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
) -> Result<Json<DeleteReviewResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&review_id)?;
    let coll = mongo.collection::<CrmAppraisalReview>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_appraisal_reviews.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("appraisal_review".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteReviewResponse { deleted: true }))
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
    fn review_from_create_defaults_status_to_draft() {
        let user_id = ObjectId::new();
        let input = CreateReviewInput {
            employee_name: "Jane".into(),
            ..Default::default()
        };
        let r = review_from_create(input, user_id).unwrap();
        assert_eq!(r.status, "draft");
        assert!(r.finalized_at.is_none());
        assert!(r.kpis.is_empty());
    }

    #[test]
    fn review_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateReviewInput {
            employee_name: "   ".into(),
            ..Default::default()
        };
        assert!(review_from_create(input, user_id).is_err());
    }
}
