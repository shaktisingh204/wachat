//! HTTP handlers for the Loan entity.

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
    CreateLoanInput, CreateLoanResponse, DeleteLoanResponse, ListQuery, UpdateLoanInput,
};
use crate::types::CrmLoan;

const COLL: &str = "crm_loans";
const ENTITY_KIND: &str = "loan";

fn parse_iso(s: &str) -> Option<BsonDateTime> {
    chrono::DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| BsonDateTime::from_chrono(dt.with_timezone(&Utc)))
}

fn list_filter(user_id: ObjectId, status: Option<&str>, direction: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "closed" => {
            filter.insert("status", "closed");
        }
        "defaulted" => {
            filter.insert("status", "defaulted");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(d) = direction.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("direction", d);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn loan_from_create(input: CreateLoanInput, user_id: ObjectId) -> Result<CrmLoan> {
    if input.party_name.trim().is_empty() {
        return Err(ApiError::Validation("partyName is required".to_owned()));
    }
    if input.principal <= 0.0 {
        return Err(ApiError::Validation(
            "principal must be positive".to_owned(),
        ));
    }
    Ok(CrmLoan {
        id: None,
        user_id,
        party_name: input.party_name.trim().to_string(),
        direction: input.direction.or_else(|| Some("taken".to_owned())),
        principal: input.principal,
        currency: input.currency,
        interest_rate: input.interest_rate,
        tenure_months: input.tenure_months,
        start_date: input.start_date.as_deref().and_then(parse_iso),
        emi: input.emi,
        outstanding: input.principal,
        paid: 0.0,
        status: Some("active".to_owned()),
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateLoanInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.party_name {
        set.insert("partyName", v);
    }
    if let Some(v) = patch.direction {
        set.insert("direction", v);
    }
    if let Some(v) = patch.principal {
        set.insert("principal", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.interest_rate {
        set.insert("interestRate", v);
    }
    if let Some(v) = patch.tenure_months {
        set.insert("tenureMonths", v);
    }
    if let Some(v) = patch.start_date.as_deref().and_then(parse_iso) {
        set.insert("startDate", v);
    }
    if let Some(v) = patch.emi {
        set.insert("emi", v);
    }
    if let Some(v) = patch.outstanding {
        set.insert("outstanding", v);
    }
    if let Some(v) = patch.paid {
        set.insert("paid", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmLoan) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmLoan>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_loans(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.direction.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["partyName", "notes"]);
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
    let coll = mongo.collection::<CrmLoan>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_loans.find")))?;
    let mut rows: Vec<CrmLoan> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_loans.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %loan_id))]
pub async fn get_loan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(loan_id): Path<String>,
) -> Result<Json<CrmLoan>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&loan_id)?;
    let coll = mongo.collection::<CrmLoan>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_loans.find_one")))?
        .ok_or_else(|| ApiError::NotFound("loan".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_loan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateLoanInput>,
) -> Result<Json<CreateLoanResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = loan_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmLoan>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_loans.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateLoanResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %loan_id))]
pub async fn update_loan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(loan_id): Path<String>,
    Json(patch): Json<UpdateLoanInput>,
) -> Result<Json<CrmLoan>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&loan_id)?;
    let coll = mongo.collection::<CrmLoan>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_loans.find_one")))?
        .ok_or_else(|| ApiError::NotFound("loan".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_loans.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("loan".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_loans.refetch")))?
        .ok_or_else(|| ApiError::NotFound("loan".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %loan_id))]
pub async fn delete_loan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(loan_id): Path<String>,
) -> Result<Json<DeleteLoanResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&loan_id)?;
    let coll = mongo.collection::<CrmLoan>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_loans.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("loan".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteLoanResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn loan_from_create_stamps_active_and_seeds_outstanding() {
        let user_id = ObjectId::new();
        let input = CreateLoanInput {
            party_name: "Bank of X".into(),
            principal: 100000.0,
            interest_rate: Some(8.5),
            tenure_months: Some(60),
            ..Default::default()
        };
        let l = loan_from_create(input, user_id).unwrap();
        assert_eq!(l.status.as_deref(), Some("active"));
        assert_eq!(l.direction.as_deref(), Some("taken"));
        assert_eq!(l.outstanding, 100000.0);
        assert_eq!(l.paid, 0.0);
    }

    #[test]
    fn loan_from_create_rejects_zero_principal() {
        let user_id = ObjectId::new();
        let input = CreateLoanInput {
            party_name: "Bank".into(),
            principal: 0.0,
            ..Default::default()
        };
        assert!(loan_from_create(input, user_id).is_err());
    }
}
