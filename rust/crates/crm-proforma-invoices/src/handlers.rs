//! HTTP handlers for the Proforma Invoice entity.

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
    CreateProformaInput, CreateProformaResponse, DeleteProformaResponse, ListQuery,
    UpdateProformaInput,
};
use crate::types::{CrmProformaInvoice, ProformaLineItem};

const COLL: &str = "crm_proforma_invoices";
const ENTITY_KIND: &str = "proforma_invoice";

fn list_filter(user_id: ObjectId, status: Option<&str>, account_id: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "Draft" | "Issued" | "Converted" | "Cancelled" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(a) = account_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("accountId", a);
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

fn calc_subtotal(items: &[ProformaLineItem]) -> f64 {
    items.iter().map(|i| i.quantity * i.rate).sum()
}

fn proforma_from_create(
    input: CreateProformaInput,
    user_id: ObjectId,
) -> Result<CrmProformaInvoice> {
    if input.proforma_number.trim().is_empty() {
        return Err(ApiError::Validation(
            "proformaNumber is required".to_owned(),
        ));
    }
    if input.line_items.is_empty() {
        return Err(ApiError::Validation(
            "at least one lineItem is required".to_owned(),
        ));
    }
    let date = parse_date(&input.proforma_date)
        .ok_or_else(|| ApiError::Validation("proformaDate must be RFC3339".to_owned()))?;
    let subtotal = calc_subtotal(&input.line_items);
    let tax = input.tax_total.unwrap_or(0.0);
    let discount = input.discount_total.unwrap_or(0.0);
    let total = subtotal + tax - discount;
    Ok(CrmProformaInvoice {
        id: None,
        user_id,
        proforma_number: input.proforma_number.trim().to_owned(),
        account_id: input
            .account_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        proforma_date: date,
        valid_till_date: input.valid_till_date.as_deref().and_then(parse_date),
        currency: input.currency,
        line_items: input.line_items,
        subtotal,
        total,
        tax_total: input.tax_total,
        discount_total: input.discount_total,
        terms_and_conditions: input.terms_and_conditions,
        notes: input.notes,
        status: Some("Draft".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
        design_metadata: input.design_metadata.and_then(|v| bson::to_document(&v).ok()),
    })
}

fn build_update_doc(patch: UpdateProformaInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.proforma_number {
        set.insert("proformaNumber", v);
    }
    if let Some(v) = patch
        .account_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("accountId", v);
    }
    if let Some(v) = patch.proforma_date.as_deref().and_then(parse_date) {
        set.insert("proformaDate", v);
    }
    if let Some(v) = patch.valid_till_date.as_deref().and_then(parse_date) {
        set.insert("validTillDate", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(items) = patch.line_items {
        let subtotal = calc_subtotal(&items);
        let arr: Vec<Document> = items
            .into_iter()
            .filter_map(|c| bson::to_document(&c).ok())
            .collect();
        set.insert("lineItems", arr);
        set.insert("subtotal", subtotal);
        set.insert("total", subtotal);
    }
    if let Some(v) = patch.terms_and_conditions {
        set.insert("termsAndConditions", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.tax_total {
        set.insert("taxTotal", v);
    }
    if let Some(v) = patch.discount_total {
        set.insert("discountTotal", v);
    }
    if let Some(v) = patch.design_metadata {
        if let Ok(doc) = bson::to_document(&v) {
            set.insert("designMetadata", doc);
        }
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmProformaInvoice) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmProformaInvoice>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_proforma(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.account_id.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["proformaNumber", "notes"]);
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
    let coll = mongo.collection::<CrmProformaInvoice>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_proforma_invoices.find"))
    })?;
    let mut rows: Vec<CrmProformaInvoice> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_proforma_invoices.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %proforma_id))]
pub async fn get_proforma(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(proforma_id): Path<String>,
) -> Result<Json<CrmProformaInvoice>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&proforma_id)?;
    let coll = mongo.collection::<CrmProformaInvoice>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_proforma_invoices.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("proforma_invoice".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_proforma(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateProformaInput>,
) -> Result<Json<CreateProformaResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = proforma_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmProformaInvoice>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_proforma_invoices.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) =
        audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateProformaResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %proforma_id))]
pub async fn update_proforma(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(proforma_id): Path<String>,
    Json(patch): Json<UpdateProformaInput>,
) -> Result<Json<CrmProformaInvoice>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&proforma_id)?;
    let coll = mongo.collection::<CrmProformaInvoice>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_proforma_invoices.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("proforma_invoice".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_proforma_invoices.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("proforma_invoice".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_proforma_invoices.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("proforma_invoice".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %proforma_id))]
pub async fn delete_proforma(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(proforma_id): Path<String>,
) -> Result<Json<DeleteProformaResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&proforma_id)?;
    let coll = mongo.collection::<CrmProformaInvoice>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_proforma_invoices.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("proforma_invoice".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteProformaResponse { deleted: true }))
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
    fn proforma_from_create_computes_subtotal_and_status_draft() {
        let user_id = ObjectId::new();
        let input = CreateProformaInput {
            proforma_number: "PI-1".into(),
            proforma_date: "2026-05-16T00:00:00Z".into(),
            line_items: vec![ProformaLineItem {
                item_id: None,
                description: "Widget".into(),
                quantity: 3.0,
                rate: 100.0,
                unit: None,
                tax_pct: None,
                amount: None,
            }],
            ..Default::default()
        };
        let p = proforma_from_create(input, user_id).unwrap();
        assert_eq!(p.subtotal, 300.0);
        assert_eq!(p.total, 300.0);
        assert_eq!(p.status.as_deref(), Some("Draft"));
    }

    #[test]
    fn proforma_from_create_rejects_empty_line_items() {
        let user_id = ObjectId::new();
        let input = CreateProformaInput {
            proforma_number: "PI-1".into(),
            proforma_date: "2026-05-16T00:00:00Z".into(),
            ..Default::default()
        };
        assert!(proforma_from_create(input, user_id).is_err());
    }
}
