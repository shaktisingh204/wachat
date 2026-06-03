//! HTTP handlers for the Purchase entity.

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
    CreatePurchaseInput, CreatePurchaseResponse, DeletePurchaseResponse, ListQuery,
    UpdatePurchaseInput,
};
use crate::types::CrmPurchase;

const COLL: &str = "crm_purchases";
const ENTITY_KIND: &str = "purchase";

fn list_filter(user_id: ObjectId, status: Option<&str>, vendor_id: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "received" | "paid" | "cancelled" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(vid) = vendor_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("vendorId", vid);
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

fn purchase_from_create(input: CreatePurchaseInput, user_id: ObjectId) -> Result<CrmPurchase> {
    let number = input.purchase_number.trim();
    if number.is_empty() {
        return Err(ApiError::Validation(
            "purchaseNumber is required".to_owned(),
        ));
    }
    let purchase_date = input
        .purchase_date
        .as_deref()
        .and_then(parse_date)
        .unwrap_or_else(|| BsonDateTime::from_chrono(Utc::now()));
    let subtotal = input.subtotal.unwrap_or(0.0);
    let total = input.total.unwrap_or(subtotal);
    Ok(CrmPurchase {
        id: None,
        user_id,
        purchase_number: number.to_owned(),
        vendor_id: input
            .vendor_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        vendor_name: input.vendor_name,
        purchase_date,
        items: input.items.unwrap_or_default(),
        subtotal,
        tax_total: input.tax_total,
        total,
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        notes: input.notes,
        currency: input.currency,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdatePurchaseInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.purchase_number {
        set.insert("purchaseNumber", v);
    }
    if let Some(v) = patch
        .vendor_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("vendorId", v);
    }
    if let Some(v) = patch.vendor_name {
        set.insert("vendorName", v);
    }
    if let Some(v) = patch.purchase_date.as_deref().and_then(parse_date) {
        set.insert("purchaseDate", v);
    }
    if let Some(v) = patch.items {
        set.insert("items", v);
    }
    if let Some(v) = patch.subtotal {
        set.insert("subtotal", v);
    }
    if let Some(v) = patch.tax_total {
        set.insert("taxTotal", v);
    }
    if let Some(v) = patch.total {
        set.insert("total", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmPurchase) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmPurchase>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_purchases(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.vendor_id.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["purchaseNumber", "vendorName", "notes"]);
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
    let coll = mongo.collection::<CrmPurchase>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_purchases.find")))?;
    let mut rows: Vec<CrmPurchase> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_purchases.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %purchase_id))]
pub async fn get_purchase(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(purchase_id): Path<String>,
) -> Result<Json<CrmPurchase>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&purchase_id)?;
    let coll = mongo.collection::<CrmPurchase>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_purchases.find_one")))?
        .ok_or_else(|| ApiError::NotFound("purchase".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_purchase(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePurchaseInput>,
) -> Result<Json<CreatePurchaseResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = purchase_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmPurchase>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_purchases.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreatePurchaseResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %purchase_id))]
pub async fn update_purchase(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(purchase_id): Path<String>,
    Json(patch): Json<UpdatePurchaseInput>,
) -> Result<Json<CrmPurchase>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&purchase_id)?;
    let coll = mongo.collection::<CrmPurchase>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_purchases.find_one")))?
        .ok_or_else(|| ApiError::NotFound("purchase".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_purchases.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("purchase".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_purchases.refetch")))?
        .ok_or_else(|| ApiError::NotFound("purchase".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %purchase_id))]
pub async fn delete_purchase(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(purchase_id): Path<String>,
) -> Result<Json<DeletePurchaseResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&purchase_id)?;
    let coll = mongo.collection::<CrmPurchase>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_purchases.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("purchase".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeletePurchaseResponse { deleted: true }))
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
    fn list_filter_applies_vendor_id_when_valid() {
        let user_id = ObjectId::new();
        let vendor = ObjectId::new();
        let f = list_filter(user_id, None, Some(&vendor.to_hex()));
        assert_eq!(f.get_object_id("vendorId").ok(), Some(vendor));
    }

    #[test]
    fn purchase_from_create_defaults_status_and_rejects_empty_number() {
        let user_id = ObjectId::new();
        let ok_input = CreatePurchaseInput {
            purchase_number: "PUR-0001".into(),
            ..Default::default()
        };
        let p = purchase_from_create(ok_input, user_id).unwrap();
        assert_eq!(p.status, "draft");
        assert_eq!(p.purchase_number, "PUR-0001");

        let bad_input = CreatePurchaseInput {
            purchase_number: "   ".into(),
            ..Default::default()
        };
        assert!(purchase_from_create(bad_input, user_id).is_err());
    }
}
