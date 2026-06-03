//! HTTP handlers for the Expense Claim entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Datelike, Utc};
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::{FindOneOptions, FindOptions};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateExpenseClaimInput, CreateExpenseClaimResponse, DeleteExpenseClaimResponse, ListQuery,
    UpdateExpenseClaimInput,
};
use crate::types::CrmExpenseClaim;

const COLL: &str = "crm_expense_claims";
const ENTITY_KIND: &str = "expense_claim";

const VALID_STATUSES: &[&str] = &[
    "draft",
    "submitted",
    "approved",
    "rejected",
    "reimbursed",
    "cancelled",
    "archived",
];

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

/// Build the next monthly claim number `EC-YYYYMM-NNNN` for a tenant.
///
/// Best-effort — race-free under low write rates only. Mongo `$regex`
/// over the indexed `claim_number` keeps this O(1) per insert.
async fn next_claim_number(mongo: &MongoHandle, user_id: ObjectId) -> Result<String> {
    let now = Utc::now();
    let prefix = format!("EC-{:04}{:02}-", now.year(), now.month());
    let filter = doc! {
        "userId": user_id,
        "claim_number": { "$regex": format!("^{}", prefix) },
    };
    let opts = FindOneOptions::builder()
        .sort(doc! { "claim_number": -1 })
        .projection(doc! { "claim_number": 1 })
        .build();
    let coll = mongo.collection::<Document>(COLL);
    let last = coll
        .find_one(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_expense_claims.last"))
        })?;

    let mut next: u32 = 1;
    if let Some(doc) = last {
        if let Ok(raw) = doc.get_str("claim_number") {
            if let Some(tail) = raw.strip_prefix(&prefix) {
                if let Ok(n) = tail.parse::<u32>() {
                    next = n + 1;
                }
            }
        }
    }
    Ok(format!("{}{:04}", prefix, next))
}

fn claim_from_create(
    input: CreateExpenseClaimInput,
    user_id: ObjectId,
    claim_number: String,
) -> Result<CrmExpenseClaim> {
    if input.employee_id.trim().is_empty() {
        return Err(ApiError::Validation("employee_id is required".to_owned()));
    }
    if !input.amount.is_finite() || input.amount < 0.0 {
        return Err(ApiError::Validation(
            "amount must be a non-negative finite number".to_owned(),
        ));
    }
    Ok(CrmExpenseClaim {
        id: None,
        user_id,
        employee_id: input.employee_id.trim().to_owned(),
        employee_name: input.employee_name,
        claim_number,
        category_id: input.category_id,
        category_name: input.category_name,
        amount: input.amount,
        currency: Some(input.currency.unwrap_or_else(|| "INR".to_owned())),
        expense_date: input.expense_date.as_deref().and_then(parse_date),
        description: input.description,
        receipt_url: input.receipt_url,
        receipt_name: input.receipt_name,
        status: coerce_status(input.status.as_deref(), "submitted"),
        approver_id: input.approver_id,
        approver_name: input.approver_name,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateExpenseClaimInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.employee_id {
        set.insert("employee_id", v.trim());
    }
    if let Some(v) = patch.employee_name {
        set.insert("employee_name", v);
    }
    if let Some(v) = patch.category_id {
        set.insert("category_id", v);
    }
    if let Some(v) = patch.category_name {
        set.insert("category_name", v);
    }
    if let Some(v) = patch.amount {
        if !v.is_finite() || v < 0.0 {
            return Err(ApiError::Validation(
                "amount must be a non-negative finite number".to_owned(),
            ));
        }
        set.insert("amount", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.expense_date.as_deref().and_then(parse_date) {
        set.insert("expense_date", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.receipt_url {
        set.insert("receipt_url", v);
    }
    if let Some(v) = patch.receipt_name {
        set.insert("receipt_name", v);
    }
    if let Some(v) = patch.status {
        if VALID_STATUSES.contains(&v.as_str()) {
            set.insert("status", v);
        }
    }
    if let Some(v) = patch.approver_id {
        set.insert("approver_id", v);
    }
    if let Some(v) = patch.approver_name {
        set.insert("approver_name", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmExpenseClaim) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmExpenseClaim>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_claims(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(emp) = q.employee_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("employee_id", emp);
    }
    if let Some(cat) = q.category_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("category_id", cat);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &[
                "employee_name",
                "employee_id",
                "claim_number",
                "description",
            ],
        );
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "expense_date": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmExpenseClaim>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_expense_claims.find"))
    })?;
    let mut rows: Vec<CrmExpenseClaim> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_expense_claims.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %claim_id))]
pub async fn get_claim(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(claim_id): Path<String>,
) -> Result<Json<CrmExpenseClaim>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&claim_id)?;
    let coll = mongo.collection::<CrmExpenseClaim>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_expense_claims.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("expense_claim".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_claim(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateExpenseClaimInput>,
) -> Result<Json<CreateExpenseClaimResponse>> {
    let user_id = user_oid(&user)?;
    let claim_number = match input.claim_number.as_deref() {
        Some(s) if !s.trim().is_empty() => s.trim().to_owned(),
        _ => next_claim_number(&mongo, user_id).await?,
    };
    let mut entity = claim_from_create(input, user_id, claim_number)?;
    let coll = mongo.collection::<CrmExpenseClaim>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_expense_claims.insert"))
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

    Ok(Json(CreateExpenseClaimResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %claim_id))]
pub async fn update_claim(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(claim_id): Path<String>,
    Json(patch): Json<UpdateExpenseClaimInput>,
) -> Result<Json<CrmExpenseClaim>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&claim_id)?;

    let coll = mongo.collection::<CrmExpenseClaim>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_expense_claims.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("expense_claim".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_expense_claims.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("expense_claim".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_expense_claims.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("expense_claim".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %claim_id))]
pub async fn delete_claim(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(claim_id): Path<String>,
) -> Result<Json<DeleteExpenseClaimResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&claim_id)?;

    let coll = mongo.collection::<CrmExpenseClaim>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_expense_claims.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("expense_claim".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteExpenseClaimResponse { deleted: true }))
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
    fn claim_from_create_defaults_status_and_currency() {
        let user_id = ObjectId::new();
        let input = CreateExpenseClaimInput {
            employee_id: "emp_1".into(),
            amount: 99.5,
            ..Default::default()
        };
        let c = claim_from_create(input, user_id, "EC-202605-0001".into()).unwrap();
        assert_eq!(c.status, "submitted");
        assert_eq!(c.currency.as_deref(), Some("INR"));
        assert_eq!(c.claim_number, "EC-202605-0001");
    }

    #[test]
    fn claim_from_create_rejects_negative_amount() {
        let user_id = ObjectId::new();
        let input = CreateExpenseClaimInput {
            employee_id: "emp_1".into(),
            amount: -10.0,
            ..Default::default()
        };
        assert!(claim_from_create(input, user_id, "EC-202605-0001".into()).is_err());
    }

    #[test]
    fn claim_from_create_rejects_empty_employee() {
        let user_id = ObjectId::new();
        let input = CreateExpenseClaimInput {
            employee_id: "  ".into(),
            amount: 10.0,
            ..Default::default()
        };
        assert!(claim_from_create(input, user_id, "EC-202605-0001".into()).is_err());
    }
}
