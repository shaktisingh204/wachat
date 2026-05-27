//! HTTP handlers for the Delivery Challan entity.
//!
//! ## Lineage seeding (§13.5)
//!
//! On create the body may carry `fromKind` + `fromId` where
//! `fromKind ∈ { salesOrder, invoice, quotation }`. When both are
//! present we fetch the parent (under the same `userId` scope) and
//! seed the new challan's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. Best-effort — a missing or
//! mis-scoped parent quietly skips the seed and still saves the
//! challan, mirroring the TS `try { ... } catch {}` pattern.

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
use crm_core::{LineageRef, build_lineage_from_parent};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::{instrument, warn};

use crate::dto::{
    CreateChallanInput, CreateChallanResponse, DeleteChallanResponse, ListQuery,
    UpdateChallanInput,
};
use crate::types::CrmDeliveryChallan;

const COLL: &str = "crm_delivery_challans";
const ENTITY_KIND: &str = "delivery_challan";

/// Allowed `fromKind` values for lineage seeding. Mirrors the TS
/// `ALLOWED_PARENT_KINDS` whitelist in `saveDeliveryChallan`.
const ALLOWED_PARENT_KINDS: &[&str] = &["salesOrder", "invoice", "quotation"];

/// Map of `fromKind` → backing Mongo collection. Mirrors the TS
/// `parentCollection` lookup table.
fn parent_collection_for(kind: &str) -> Option<&'static str> {
    match kind {
        "salesOrder" => Some("crm_sales_orders"),
        "invoice" => Some("crm_invoices"),
        "quotation" => Some("crm_quotations"),
        _ => None,
    }
}

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
        lineage: Vec::new(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
        design_metadata: input.design_metadata.and_then(|v| bson::to_document(&v).ok()),
    })
}

/// Fetch the parent doc (scoped by `userId`) and build the lineage chain
/// a freshly-created delivery challan should inherit. Returns
/// `Ok(None)` if the parent doesn't exist or isn't owned by the caller.
///
/// On success returns `(chain, parent_oid, parent_collection_name)` so
/// the caller can also push a back-link onto the parent.
async fn seed_lineage_from_parent(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    parent_kind: &str,
    parent_id_hex: &str,
) -> Result<Option<(Vec<LineageRef>, ObjectId, &'static str)>> {
    let parent_coll = match parent_collection_for(parent_kind) {
        Some(c) => c,
        None => return Ok(None),
    };
    let parent_oid = oid_from_str(parent_id_hex)?;
    let coll = mongo.collection::<Document>(parent_coll);
    let parent = match coll
        .find_one(doc! { "_id": parent_oid, "userId": user_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context(format!("{parent_coll}.find_one(lineage)")),
            )
        })? {
        Some(d) => d,
        None => return Ok(None),
    };

    // Existing lineage on the parent (if any) — passed through verbatim.
    let parent_chain: Vec<LineageRef> = parent
        .get_array("lineage")
        .ok()
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.as_document())
                .filter_map(|d| {
                    let kind = d.get_str("kind").ok()?.to_owned();
                    let id = d.get_object_id("id").ok()?;
                    Some(LineageRef::new(kind, id))
                })
                .collect()
        })
        .unwrap_or_default();

    let chain = build_lineage_from_parent(parent_kind, parent_oid, &parent_chain);
    Ok(Some((chain, parent_oid, parent_coll)))
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
    if let Some(v) = patch.design_metadata {
        if let Ok(doc) = bson::to_document(&v) {
            set.insert("designMetadata", doc);
        }
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

    // Extract lineage hints before the rest of `input` is moved into
    // `challan_from_create`.
    let from_kind = input.from_kind.clone();
    let from_id = input.from_id.clone();

    let mut entity = challan_from_create(input, user_id)?;

    // ---- Lineage seeding (§13.5) ---------------------------------------
    let mut parent_back_link: Option<(&'static str, ObjectId)> = None;
    if let (Some(kind), Some(parent_id)) = (from_kind.as_deref(), from_id.as_deref()) {
        let kind_trimmed = kind.trim();
        if ALLOWED_PARENT_KINDS.contains(&kind_trimmed) && !parent_id.is_empty() {
            match seed_lineage_from_parent(&mongo, user_id, kind_trimmed, parent_id).await {
                Ok(Some((chain, parent_oid, parent_coll))) => {
                    entity.lineage = chain;
                    parent_back_link = Some((parent_coll, parent_oid));
                }
                Ok(None) => {
                    // Parent not found / not owned — quietly skip.
                }
                Err(e) => {
                    warn!(error = %e, "lineage seed failed; saving challan without lineage");
                }
            }
        }
    }

    let coll = mongo.collection::<CrmDeliveryChallan>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_delivery_challans.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    // Best-effort back-link onto the parent doc's lineage. Non-fatal —
    // mirrors the TS server-action's `try { ... } catch {}` block.
    if let Some((parent_coll_name, parent_oid)) = parent_back_link {
        let parents = mongo.collection::<Document>(parent_coll_name);
        let now = BsonDateTime::from_chrono(Utc::now());
        let _ = parents
            .update_one(
                doc! { "_id": parent_oid, "userId": user_id },
                doc! {
                    "$push": { "lineage": { "kind": "deliveryChallan", "id": new_id } },
                    "$set":  { "updatedAt": now },
                },
            )
            .await;
    }

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

    #[test]
    fn challan_from_create_starts_with_empty_lineage() {
        let user_id = ObjectId::new();
        let input = CreateChallanInput {
            challan_number: "DC-1".into(),
            challan_date: "2026-05-16T00:00:00Z".into(),
            line_items: vec![ChallanLineItem {
                item_id: None,
                description: "Widget".into(),
                quantity: 1.0,
                unit: None,
                hsn_code: None,
            }],
            ..Default::default()
        };
        let c = challan_from_create(input, user_id).unwrap();
        assert!(c.lineage.is_empty());
    }

    #[test]
    fn parent_collection_lookup_matches_ts_table() {
        assert_eq!(parent_collection_for("salesOrder"), Some("crm_sales_orders"));
        assert_eq!(parent_collection_for("invoice"), Some("crm_invoices"));
        assert_eq!(parent_collection_for("quotation"), Some("crm_quotations"));
        assert_eq!(parent_collection_for("lead"), None);
        assert_eq!(parent_collection_for("unknown"), None);
    }

    #[test]
    fn allowed_parent_kinds_align_with_ts_whitelist() {
        // Mirrors `ALLOWED_PARENT_KINDS` in TS `saveDeliveryChallan`.
        assert_eq!(ALLOWED_PARENT_KINDS, &["salesOrder", "invoice", "quotation"]);
    }
}
