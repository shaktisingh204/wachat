//! HTTP handlers for the Delivery Challan entity.

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
    CreateChallanInput, CreateChallanResponse, DeleteChallanResponse, ListQuery,
    UpdateChallanInput,
};
use crate::types::CrmDeliveryChallan;

const COLL: &str = "crm_delivery_challans";
const ENTITY_KIND: &str = "delivery_challan";

fn list_filter(user_id: ObjectId, status: Option<&str>, account_id: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "Draft" | "Issued" | "Delivered" | "Cancelled" => {
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

fn challan_from_create(
    input: CreateChallanInput,
    user_id: ObjectId,
) -> Result<CrmDeliveryChallan> {
    if input.challan_number.trim().is_empty() {
        return Err(ApiError::Validation(
            "challanNumber is required".to_owned(),
        ));
    }
    if input.line_items.is_empty() {
        return Err(ApiError::Validation(
            "at least one lineItem is required".to_owned(),
        ));
    }
    let date = parse_date(&input.challan_date)
        .ok_or_else(|| ApiError::Validation("challanDate must be RFC3339".to_owned()))?;
    Ok(CrmDeliveryChallan {
        id: None,
        user_id,
        challan_number: input.challan_number.trim().to_owned(),
        account_id: input
            .account_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        challan_date: date,
        line_items: input.line_items,
        reason: input.reason,
        transport_details: input.transport_details,
        notes: input.notes,
        status: Some("Draft".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateChallanInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.challan_number {
        set.insert("challanNumber", v);
    }
    if let Some(v) = patch
        .account_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("accountId", v);
    }
    if let Some(v) = patch.challan_date.as_deref().and_then(parse_date) {
        set.insert("challanDate", v);
    }
    if let Some(items) = patch.line_items {
        let arr: Vec<Document> = items
            .into_iter()
            .filter_map(|c| bson::to_document(&c).ok())
            .collect();
        set.insert("lineItems", arr);
    }
    if let Some(v) = patch.reason {
        set.insert("reason", v);
    }
    if let Some(td) = patch.transport_details {
        if let Ok(d) = bson::to_document(&td) {
            set.insert("transportDetails", d);
        }
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmDeliveryChallan) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmDeliveryChallan>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_challans(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.account_id.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["challanNumber", "reason", "notes"]);
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
    let coll = mongo.collection::<CrmDeliveryChallan>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_delivery_challans.find"))
    })?;
    let mut rows: Vec<CrmDeliveryChallan> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_delivery_challans.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %challan_id))]
pub async fn get_challan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(challan_id): Path<String>,
) -> Result<Json<CrmDeliveryChallan>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&challan_id)?;
    let coll = mongo.collection::<CrmDeliveryChallan>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_delivery_challans.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("delivery_challan".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_challan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateChallanInput>,
) -> Result<Json<CreateChallanResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = challan_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmDeliveryChallan>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_delivery_challans.insert"))
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
    Ok(Json(CreateChallanResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %challan_id))]
pub async fn update_challan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(challan_id): Path<String>,
    Json(patch): Json<UpdateChallanInput>,
) -> Result<Json<CrmDeliveryChallan>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&challan_id)?;
    let coll = mongo.collection::<CrmDeliveryChallan>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_delivery_challans.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("delivery_challan".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_delivery_challans.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("delivery_challan".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_delivery_challans.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("delivery_challan".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %challan_id))]
pub async fn delete_challan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(challan_id): Path<String>,
) -> Result<Json<DeleteChallanResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&challan_id)?;
    let coll = mongo.collection::<CrmDeliveryChallan>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_delivery_challans.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("delivery_challan".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteChallanResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ChallanLineItem;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn challan_from_create_seeds_status_draft() {
        let user_id = ObjectId::new();
        let input = CreateChallanInput {
            challan_number: "DC-1".into(),
            challan_date: "2026-05-16T00:00:00Z".into(),
            line_items: vec![ChallanLineItem {
                item_id: None,
                description: "Widget".into(),
                quantity: 5.0,
                unit: None,
                hsn_code: None,
            }],
            ..Default::default()
        };
        let c = challan_from_create(input, user_id).unwrap();
        assert_eq!(c.status.as_deref(), Some("Draft"));
    }

    #[test]
    fn challan_from_create_rejects_empty_line_items() {
        let user_id = ObjectId::new();
        let input = CreateChallanInput {
            challan_number: "DC-1".into(),
            challan_date: "2026-05-16T00:00:00Z".into(),
            ..Default::default()
        };
        assert!(challan_from_create(input, user_id).is_err());
    }
}
