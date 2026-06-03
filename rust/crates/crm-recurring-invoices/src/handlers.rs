//! HTTP handlers for the Recurring Invoice entity.

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
    CreateRecurringInvoiceInput, CreateRecurringInvoiceResponse, DeleteRecurringInvoiceResponse,
    ListQuery, UpdateRecurringInvoiceInput,
};
use crate::types::CrmRecurringInvoice;

const COLL: &str = "crm_recurring_invoices";
const ENTITY_KIND: &str = "recurring_invoice";

const VALID_FREQS: &[&str] = &["daily", "weekly", "monthly", "quarterly", "yearly"];
const VALID_STATUSES: &[&str] = &["active", "paused", "stopped", "completed", "archived"];

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "paused" => {
            filter.insert("status", "paused");
        }
        "stopped" => {
            filter.insert("status", "stopped");
        }
        "completed" => {
            filter.insert("status", "completed");
        }
        "active" => {
            filter.insert("status", "active");
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

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn pick_frequency(raw: Option<&str>) -> String {
    raw.map(str::trim)
        .filter(|s| VALID_FREQS.contains(&s.to_ascii_lowercase().as_str()))
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_else(|| "monthly".to_owned())
}

fn pick_status(raw: Option<&str>) -> Option<String> {
    raw.map(str::trim)
        .filter(|s| VALID_STATUSES.contains(&s.to_ascii_lowercase().as_str()))
        .map(|s| s.to_ascii_lowercase())
}

fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s.trim()).ok()
}

fn doc_from_create(
    input: CreateRecurringInvoiceInput,
    user_id: ObjectId,
) -> Result<CrmRecurringInvoice> {
    let customer_id = parse_oid(&input.customer_id)
        .ok_or_else(|| ApiError::Validation("customerId is required".to_owned()))?;

    let start_date = parse_date(&input.start_date)
        .ok_or_else(|| ApiError::Validation("startDate is invalid".to_owned()))?;

    let end_date = match input.end_date.as_deref() {
        Some(s) if !s.trim().is_empty() => match parse_date(s) {
            Some(d) => Some(d),
            None => return Err(ApiError::Validation("endDate is invalid".to_owned())),
        },
        _ => None,
    };

    let invoice_template_id = input
        .invoice_template_id
        .as_deref()
        .and_then(|s| if s.trim().is_empty() { None } else { Some(s) })
        .and_then(parse_oid);

    let frequency = pick_frequency(input.frequency.as_deref());
    let status = pick_status(input.status.as_deref()).unwrap_or_else(|| "active".to_owned());

    Ok(CrmRecurringInvoice {
        id: None,
        user_id,
        title: input
            .title
            .map(|t| t.trim().to_owned())
            .filter(|s| !s.is_empty()),
        invoice_template_id,
        customer_id: Some(customer_id),
        frequency,
        start_date: Some(start_date),
        end_date,
        next_run_at: Some(start_date),
        last_run_at: None,
        total_runs: Some(0),
        status,
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateRecurringInvoiceInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };

    if let Some(v) = patch.title {
        set.insert("title", v.trim());
    }
    if let Some(v) = patch.invoice_template_id {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            set.insert("invoiceTemplateId", bson::Bson::Null);
        } else {
            let oid = parse_oid(trimmed)
                .ok_or_else(|| ApiError::Validation("invoiceTemplateId is invalid".to_owned()))?;
            set.insert("invoiceTemplateId", oid);
        }
    }
    if let Some(v) = patch.customer_id {
        let oid = parse_oid(v.trim())
            .ok_or_else(|| ApiError::Validation("customerId is invalid".to_owned()))?;
        set.insert("customerId", oid);
    }
    if let Some(v) = patch.frequency {
        set.insert("frequency", pick_frequency(Some(&v)));
    }
    if let Some(v) = patch.start_date {
        let d = parse_date(&v)
            .ok_or_else(|| ApiError::Validation("startDate is invalid".to_owned()))?;
        set.insert("startDate", d);
    }
    if let Some(v) = patch.end_date {
        if v.trim().is_empty() {
            set.insert("endDate", bson::Bson::Null);
        } else {
            let d = parse_date(&v)
                .ok_or_else(|| ApiError::Validation("endDate is invalid".to_owned()))?;
            set.insert("endDate", d);
        }
    }
    if let Some(v) = patch.status {
        if let Some(s) = pick_status(Some(&v)) {
            set.insert("status", s);
        } else {
            return Err(ApiError::Validation("status is invalid".to_owned()));
        }
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }

    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmRecurringInvoice) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmRecurringInvoice>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_recurring_invoices(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "notes"]);
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

    let coll = mongo.collection::<CrmRecurringInvoice>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_recurring_invoices.find"))
    })?;
    let mut rows: Vec<CrmRecurringInvoice> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_recurring_invoices.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %recurring_id))]
pub async fn get_recurring_invoice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(recurring_id): Path<String>,
) -> Result<Json<CrmRecurringInvoice>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&recurring_id)?;
    let coll = mongo.collection::<CrmRecurringInvoice>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_recurring_invoices.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("recurring_invoice".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_recurring_invoice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRecurringInvoiceInput>,
) -> Result<Json<CreateRecurringInvoiceResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = doc_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmRecurringInvoice>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_recurring_invoices.insert"))
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

    Ok(Json(CreateRecurringInvoiceResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %recurring_id))]
pub async fn update_recurring_invoice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(recurring_id): Path<String>,
    Json(patch): Json<UpdateRecurringInvoiceInput>,
) -> Result<Json<CrmRecurringInvoice>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&recurring_id)?;

    let coll = mongo.collection::<CrmRecurringInvoice>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_recurring_invoices.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("recurring_invoice".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_recurring_invoices.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("recurring_invoice".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_recurring_invoices.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("recurring_invoice".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %recurring_id))]
pub async fn delete_recurring_invoice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(recurring_id): Path<String>,
) -> Result<Json<DeleteRecurringInvoiceResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&recurring_id)?;

    let coll = mongo.collection::<CrmRecurringInvoice>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_recurring_invoices.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("recurring_invoice".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteRecurringInvoiceResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_hides_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn pick_frequency_defaults_to_monthly() {
        assert_eq!(pick_frequency(None), "monthly");
        assert_eq!(pick_frequency(Some("WEEKLY")), "weekly");
        assert_eq!(pick_frequency(Some("garbage")), "monthly");
    }

    #[test]
    fn create_requires_customer_id() {
        let user_id = ObjectId::new();
        let input = CreateRecurringInvoiceInput {
            customer_id: "not-an-oid".into(),
            start_date: "2026-05-17T00:00:00Z".into(),
            ..Default::default()
        };
        assert!(doc_from_create(input, user_id).is_err());
    }

    #[test]
    fn create_stamps_active_and_next_run_at() {
        let user_id = ObjectId::new();
        let customer = ObjectId::new();
        let input = CreateRecurringInvoiceInput {
            customer_id: customer.to_hex(),
            start_date: "2026-05-17T00:00:00Z".into(),
            ..Default::default()
        };
        let row = doc_from_create(input, user_id).unwrap();
        assert_eq!(row.status, "active");
        assert_eq!(row.frequency, "monthly");
        assert!(row.next_run_at.is_some());
        assert_eq!(row.total_runs, Some(0));
    }
}
