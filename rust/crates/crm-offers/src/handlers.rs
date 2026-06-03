//! HTTP handlers for the Offer entity.

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
    CreateOfferInput, CreateOfferResponse, DeleteOfferResponse, ListQuery, UpdateOfferInput,
};
use crate::types::CrmOffer;

const COLL: &str = "crm_offers";
const ENTITY_KIND: &str = "offer";

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
        "draft" | "sent" | "accepted" | "rejected" | "expired" | "withdrawn" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(c) = candidate_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("candidateId", c);
    }
    if let Some(j) = job_id.and_then(|s| ObjectId::parse_str(s).ok()) {
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

fn offer_from_create(input: CreateOfferInput, user_id: ObjectId) -> Result<CrmOffer> {
    let candidate_oid = ObjectId::parse_str(&input.candidate_id)
        .map_err(|_| ApiError::Validation("candidateId must be a valid ObjectId".to_owned()))?;
    if input.salary_amount < 0.0 || !input.salary_amount.is_finite() {
        return Err(ApiError::Validation(
            "salaryAmount must be a non-negative finite number".to_owned(),
        ));
    }
    let period = input.salary_period.unwrap_or_else(|| "annual".to_owned());
    if !matches!(period.as_str(), "annual" | "monthly" | "hourly") {
        return Err(ApiError::Validation(
            "salaryPeriod must be one of annual/monthly/hourly".to_owned(),
        ));
    }
    Ok(CrmOffer {
        id: None,
        user_id,
        candidate_id: candidate_oid,
        candidate_name: input.candidate_name,
        job_id: input
            .job_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        job_title: input.job_title,
        offer_letter_url: input.offer_letter_url,
        salary_amount: input.salary_amount,
        salary_currency: Some(input.salary_currency.unwrap_or_else(|| "INR".to_owned())),
        salary_period: period,
        bonus: input.bonus,
        equity: input.equity,
        benefits: input.benefits,
        joining_date: input.joining_date.as_deref().and_then(parse_date),
        expires_at: input.expires_at.as_deref().and_then(parse_date),
        notes: input.notes,
        status: "draft".to_owned(),
        sent_at: None,
        responded_at: None,
        response_notes: None,
        approver_id: input
            .approver_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        approved_at: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateOfferInput, before_status: &str) -> Document {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.candidate_name {
        set.insert("candidateName", v);
    }
    if let Some(v) = patch
        .job_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("jobId", v);
    }
    if let Some(v) = patch.job_title {
        set.insert("jobTitle", v);
    }
    if let Some(v) = patch.offer_letter_url {
        set.insert("offerLetterUrl", v);
    }
    if let Some(v) = patch.salary_amount {
        set.insert("salaryAmount", v);
    }
    if let Some(v) = patch.salary_currency {
        set.insert("salaryCurrency", v);
    }
    if let Some(v) = patch.salary_period {
        set.insert("salaryPeriod", v);
    }
    if let Some(v) = patch.bonus {
        set.insert("bonus", v);
    }
    if let Some(v) = patch.equity {
        set.insert("equity", v);
    }
    if let Some(v) = patch.benefits {
        set.insert("benefits", v);
    }
    if let Some(v) = patch.joining_date.as_deref().and_then(parse_date) {
        set.insert("joiningDate", v);
    }
    if let Some(v) = patch.expires_at.as_deref().and_then(parse_date) {
        set.insert("expiresAt", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.response_notes {
        set.insert("responseNotes", v);
    }
    if let Some(v) = patch
        .approver_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("approverId", v);
    }
    if let Some(new_status) = patch.status {
        if new_status == "sent" && before_status != "sent" {
            set.insert("sentAt", now);
        }
        if matches!(new_status.as_str(), "accepted" | "rejected")
            && !matches!(before_status, "accepted" | "rejected")
        {
            set.insert("respondedAt", now);
        }
        set.insert("status", new_status);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmOffer) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmOffer>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_offers(
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
        let or = build_q_filter(needle, &["candidateName", "jobTitle", "notes"]);
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
    let coll = mongo.collection::<CrmOffer>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_offers.find")))?;
    let mut rows: Vec<CrmOffer> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_offers.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %offer_id))]
pub async fn get_offer(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(offer_id): Path<String>,
) -> Result<Json<CrmOffer>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&offer_id)?;
    let coll = mongo.collection::<CrmOffer>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_offers.find_one")))?
        .ok_or_else(|| ApiError::NotFound("offer".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_offer(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateOfferInput>,
) -> Result<Json<CreateOfferResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = offer_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmOffer>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_offers.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateOfferResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %offer_id))]
pub async fn update_offer(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(offer_id): Path<String>,
    Json(patch): Json<UpdateOfferInput>,
) -> Result<Json<CrmOffer>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&offer_id)?;
    let coll = mongo.collection::<CrmOffer>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_offers.find_one")))?
        .ok_or_else(|| ApiError::NotFound("offer".to_owned()))?;
    let update = build_update_doc(patch, &before.status);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_offers.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("offer".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_offers.refetch")))?
        .ok_or_else(|| ApiError::NotFound("offer".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %offer_id))]
pub async fn delete_offer(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(offer_id): Path<String>,
) -> Result<Json<DeleteOfferResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&offer_id)?;
    let coll = mongo.collection::<CrmOffer>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_offers.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("offer".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteOfferResponse { deleted: true }))
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
    fn offer_from_create_defaults_status_and_currency() {
        let user_id = ObjectId::new();
        let input = CreateOfferInput {
            candidate_id: ObjectId::new().to_hex(),
            salary_amount: 100000.0,
            ..Default::default()
        };
        let o = offer_from_create(input, user_id).unwrap();
        assert_eq!(o.status, "draft");
        assert_eq!(o.salary_period, "annual");
        assert_eq!(o.salary_currency.as_deref(), Some("INR"));
    }

    #[test]
    fn offer_from_create_rejects_bad_candidate_and_negative_salary() {
        let user_id = ObjectId::new();
        let bad = CreateOfferInput {
            candidate_id: "not-an-oid".into(),
            salary_amount: 100.0,
            ..Default::default()
        };
        assert!(offer_from_create(bad, user_id).is_err());
        let neg = CreateOfferInput {
            candidate_id: ObjectId::new().to_hex(),
            salary_amount: -1.0,
            ..Default::default()
        };
        assert!(offer_from_create(neg, user_id).is_err());
    }
}
