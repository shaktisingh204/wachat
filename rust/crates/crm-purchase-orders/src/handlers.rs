//! HTTP handlers for the §2.2 Purchase Order entity.
//!
//! Five handlers — same shape as the sister `crm-leads` / `crm-deals`
//! crates:
//!
//! | Method  | Path             | Function                      |
//! |---------|------------------|-------------------------------|
//! | `GET`   | `/`              | [`list_purchase_orders`]      |
//! | `GET`   | `/:poId`         | [`get_purchase_order`]        |
//! | `POST`  | `/`              | [`create_purchase_order`]     |
//! | `PATCH` | `/:poId`         | [`update_purchase_order`]     |
//! | `DELETE`| `/:poId`         | [`delete_purchase_order`]     |
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! — the CRM tenant root from `crm-core::Identity`.
//!
//! ## Lineage seeding (§13.5)
//!
//! On create, the body may carry `fromKind: "rfq" | "vendorBid"` +
//! `fromId`; when both are present we fetch the parent (under the same
//! `userId` scope) and seed the new PO's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. Best-effort — a missing or
//! mis-scoped parent quietly skips the seed and still saves the PO.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{
    Assignment, Audit, Identity, LineageRef, ScopeMode, TenantScope, build_lineage_from_parent,
    sabcrm_project_oid,
};
use crm_purchases_types::{PurchaseOrder, PurchaseOrderStatus};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::{instrument, warn};

use crate::dto::{
    ALLOWED_STATUSES, CreatePurchaseOrderInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, ScopeQuery,
    UpdatePurchaseOrderInput,
};

/// Mongo collection name. Must match the §2.2 spec literal so the Rust
/// BFF and any Next.js action share the same backing collection.
const PURCHASE_ORDERS_COLL: &str = "crm_purchase_orders";

/// Lineage parent collection — RFQs (Request-For-Quote broadcasts).
const RFQS_COLL: &str = "crm_rfqs";

/// Lineage parent collection — vendor bids submitted against an RFQ.
const VENDOR_BIDS_COLL: &str = "crm_vendor_bids";

// =========================================================================
// Helpers
// =========================================================================

/// Resolve the calling tenant root from the verified [`AuthUser`].
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Resolve the per-request [`TenantScope`] from the mount's
/// [`ScopeMode`]: legacy mounts filter by the JWT's `userId`, SabCRM
/// mounts by the caller-supplied (required) `projectId`.
fn resolve_scope(
    mode: ScopeMode,
    user: &AuthUser,
    project_id: Option<&str>,
) -> Result<TenantScope> {
    match mode {
        ScopeMode::User => Ok(TenantScope::User(user_oid(user)?)),
        ScopeMode::Project => Ok(TenantScope::Project(sabcrm_project_oid(project_id)?)),
    }
}

/// Clamp `requested` page-size into `[1, MAX_LIMIT]`, defaulting to
/// [`DEFAULT_LIMIT`] when absent. Returns an `i64` to match the
/// `mongodb` driver's `FindOptions::limit` signature.
fn clamp_limit(requested: Option<u32>) -> i64 {
    match requested {
        None => DEFAULT_LIMIT,
        Some(n) => (n as i64).clamp(1, MAX_LIMIT),
    }
}

/// Materialize the base ownership filter:
/// `{ <userId|projectId>, archived: { $ne: true } }`. Soft-deleted rows
/// (`archived = true`) are excluded by default.
fn base_ownership_filter(scope: &TenantScope) -> Document {
    let mut filter = scope.filter();
    filter.insert("archived", doc! { "$ne": true });
    filter
}

/// Optional-string update helper. PATCH semantics — absent ≠ `null`.
fn set_opt_str(set: &mut Document, key: &str, val: Option<&String>) {
    if let Some(v) = val {
        set.insert(key, v.as_str());
    }
}

/// Optional-OID update helper. Parses a 24-char hex string when present
/// and stores the OID; rejects malformed input with `BadRequest`.
fn set_opt_oid(set: &mut Document, key: &str, val: Option<&String>) -> Result<()> {
    if let Some(v) = val {
        let oid = oid_from_str(v)?;
        set.insert(key, oid);
    }
    Ok(())
}

/// Convert a `serde_json::Value` into a `Bson` for `$set`. Rejects
/// payloads that can't round-trip into BSON (NaN floats, etc.).
fn json_to_bson(v: &serde_json::Value, ctx: &'static str) -> Result<Bson> {
    bson::to_bson(v)
        .map_err(|e| ApiError::Validation(format!("{ctx} did not serialise to BSON: {e}")))
}

/// Resolve a logical lineage parent kind to the backing Mongo
/// collection name. Returns `None` for unrecognised kinds — the caller
/// quietly skips lineage seeding rather than failing the create.
fn parent_collection(kind: &str) -> Option<&'static str> {
    match kind {
        "rfq" => Some(RFQS_COLL),
        "vendorBid" => Some(VENDOR_BIDS_COLL),
        _ => None,
    }
}

/// Fetch the parent record (scoped by the request's tenant scope) and
/// build the lineage chain a freshly-created PO should inherit. Returns
/// `Ok(None)` if the parent doesn't exist, isn't owned by the caller, or
/// `kind` isn't a recognised PO lineage parent.
async fn seed_lineage_from_parent(
    mongo: &MongoHandle,
    scope: &TenantScope,
    parent_kind: &str,
    parent_id_hex: &str,
) -> Result<Option<(Vec<LineageRef>, ObjectId, &'static str)>> {
    let coll_name = match parent_collection(parent_kind) {
        Some(c) => c,
        None => return Ok(None),
    };
    let parent_oid = oid_from_str(parent_id_hex)?;
    let coll = mongo.collection::<Document>(coll_name);
    let mut parent_filter = scope.filter();
    parent_filter.insert("_id", parent_oid);
    let parent = match coll
        .find_one(parent_filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context(format!("{coll_name}.find_one(lineage)")),
            )
        })? {
        Some(d) => d,
        None => return Ok(None),
    };

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
    Ok(Some((chain, parent_oid, coll_name)))
}

// =========================================================================
// GET / — list_purchase_orders
// =========================================================================

/// `GET /v1/crm/purchase-orders` — paginated list scoped to the
/// authenticated user's POs. The `q` query param does a
/// case-insensitive substring search across `poNo`. `vendorId` and
/// `status` narrow further. Sorted by `createdAt` desc.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_purchase_orders(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<PurchaseOrder>>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;

    let mut filter = base_ownership_filter(&scope);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("poNo", doc! { "$regex": needle, "$options": "i" });
    }
    if let Some(vid) = q.vendor_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("vendorId", oid_from_str(vid)?);
    }
    if let Some(status) = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        if !ALLOWED_STATUSES.contains(&status) {
            return Err(ApiError::Validation(format!(
                "status must be one of: {}",
                ALLOWED_STATUSES.join(", ")
            )));
        }
        filter.insert("status", status);
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<PurchaseOrder>(PURCHASE_ORDERS_COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_purchase_orders.find"))
    })?;
    let pos: Vec<PurchaseOrder> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_purchase_orders.collect"))
    })?;

    Ok(Json(pos))
}

// =========================================================================
// GET /:poId — get_purchase_order
// =========================================================================

/// `GET /v1/crm/purchase-orders/:poId` — fetch a single PO. Returns 404
/// if the PO doesn't exist OR isn't owned by the caller (we deliberately
/// collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, po_id = %po_id))]
pub async fn get_purchase_order(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(po_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<PurchaseOrder>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let po_oid = oid_from_str(&po_id)?;

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", po_oid);

    let coll = mongo.collection::<PurchaseOrder>(PURCHASE_ORDERS_COLL);
    let po = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_purchase_orders.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("purchaseOrder".to_owned()))?;

    Ok(Json(po))
}

// =========================================================================
// POST / — create_purchase_order
// =========================================================================

/// `POST /v1/crm/purchase-orders` — insert a new PO.
///
/// Builds the document directly (rather than going through the typed
/// [`PurchaseOrder`] struct) so the curated input shape doesn't drag in
/// `crm-sales-types::LineItem` / `Totals` as a hard dep — `items[]` and
/// `totals` are passed through verbatim from the wire JSON. The handler
/// stamps `Identity` + `Audit` + `Assignment` + `approval` (default) +
/// status (`draft` until an approval workflow promotes it) and then
/// re-reads via the typed collection so the response is the canonical
/// [`PurchaseOrder`] shape.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_purchase_order(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePurchaseOrderInput>,
) -> Result<Json<PurchaseOrder>> {
    // ---- Required-field validation -----------------------------------
    if input.po_no.trim().is_empty() {
        return Err(ApiError::Validation("poNo is required.".to_owned()));
    }
    if input.currency.trim().is_empty() {
        return Err(ApiError::Validation("currency is required.".to_owned()));
    }
    if input.items.is_empty() {
        return Err(ApiError::Validation(
            "items must contain at least one line.".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    // In project mode the body's `projectId` IS the tenant scope and is
    // therefore mandatory (4xx when absent) — `resolve_scope` enforces
    // that. In legacy user mode the scope is the JWT subject and the
    // body `projectId` stays optional, exactly as before.
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let project_id = match scope {
        TenantScope::Project(p) => p,
        TenantScope::User(_) => match input.project_id.as_deref().filter(|s| !s.is_empty()) {
            Some(s) => oid_from_str(s)?,
            // Match the §2.2 spec — projectId is required, but we mint a
            // fresh OID for legacy single-tenant callers that omit it.
            None => ObjectId::new(),
        },
    };
    let vendor_oid = oid_from_str(&input.vendor_id)?;
    let ship_to_warehouse_oid = match input
        .ship_to_warehouse_id
        .as_deref()
        .filter(|s| !s.is_empty())
    {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let billing_branch_oid = match input.billing_branch_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    // ---- Lineage seeding (§13.5) -------------------------------------
    let mut lineage_array: Option<Vec<Bson>> = None;
    let mut parent_backlink: Option<(ObjectId, &'static str)> = None;
    if let (Some(kind), Some(parent_id)) = (
        input
            .from_kind
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
        input
            .from_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    ) {
        match seed_lineage_from_parent(&mongo, &scope, kind, parent_id).await {
            Ok(Some((lineage, parent_oid, parent_coll))) => {
                lineage_array = Some(
                    lineage
                        .into_iter()
                        .map(|r| Bson::Document(doc! { "kind": r.kind, "id": r.id }))
                        .collect(),
                );
                parent_backlink = Some((parent_oid, parent_coll));
            }
            Ok(None) => {
                // Unknown kind / parent not found / not owned — silently
                // skip; the PO still saves without a lineage entry.
            }
            Err(e) => {
                warn!(error = %e, "lineage seed failed; saving PO without lineage");
            }
        }
    }

    // ---- Build BSON doc -----------------------------------------------
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();
    let identity_doc = bson::to_document(&Identity {
        id: new_oid,
        project_id,
        user_id,
        tenant_id: None,
    })
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("identity.bson")))?;
    let audit_doc = bson::to_document(&Audit::new(Some(user_id)))
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("audit.bson")))?;
    let assignment_doc = bson::to_document(&Assignment::default())
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("assignment.bson")))?;

    let items_bson = json_to_bson(&serde_json::Value::Array(input.items.clone()), "items")?;
    let totals_bson = json_to_bson(&input.totals, "totals")?;

    let mut new_doc = Document::new();
    new_doc.extend(identity_doc);
    new_doc.extend(audit_doc);
    new_doc.extend(assignment_doc);
    new_doc.insert("poNo", input.po_no.trim());
    new_doc.insert("date", bson::DateTime::from_chrono(input.date));
    if let Some(ed) = input.expected_delivery {
        new_doc.insert("expectedDelivery", bson::DateTime::from_chrono(ed));
    }
    new_doc.insert("vendorId", vendor_oid);
    if let Some(w) = ship_to_warehouse_oid {
        new_doc.insert("shipToWarehouseId", w);
    }
    if let Some(b) = billing_branch_oid {
        new_doc.insert("billingBranchId", b);
    }
    if let Some(pt) = input.payment_terms.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("paymentTerms", pt);
    }
    new_doc.insert("currency", input.currency.trim());
    new_doc.insert("items", items_bson);
    new_doc.insert("totals", totals_bson);
    if let Some(t) = input
        .terms_and_conditions
        .as_deref()
        .filter(|s| !s.is_empty())
    {
        new_doc.insert("termsAndConditions", t);
    }
    if let Some(n) = input.notes.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("notes", n);
    }
    // approval defaults to an empty subdoc — pre-approval the PO is in
    // `Draft`. Storing it explicitly keeps the shape stable for clients
    // that always read `approval.requestedAt` etc. without a guard.
    new_doc.insert("approval", Document::new());
    new_doc.insert("status", default_status_str(PurchaseOrderStatus::Draft));
    if let Some(la) = lineage_array {
        new_doc.insert("lineage", Bson::Array(la));
    }

    // The `Identity` serialization above stamps `_id: ObjectId` already
    // (see `crm_core::Identity` — `id` is renamed to `_id`). Sanity-
    // check by overwriting with the freshly minted oid so an upstream
    // change to `Identity` doesn't silently break us.
    new_doc.insert("_id", new_oid);

    let raw_coll = mongo.collection::<Document>(PURCHASE_ORDERS_COLL);
    raw_coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_purchase_orders.insert_one"))
    })?;

    // Best-effort back-link onto the parent's lineage (mirrors the
    // crm-deals create-deal flow). Non-fatal — a failed back-link still
    // returns the freshly-created PO.
    if let Some((parent_oid, parent_coll)) = parent_backlink {
        let parent = mongo.collection::<Document>(parent_coll);
        let mut backlink_filter = scope.filter();
        backlink_filter.insert("_id", parent_oid);
        let _ = parent
            .update_one(
                backlink_filter,
                doc! {
                    "$push": { "lineage": { "kind": "purchaseOrder", "id": new_oid } },
                    "$set":  { "updatedAt": now },
                },
            )
            .await;
    }

    // Re-read via the typed collection so the response shape is stable.
    let typed = mongo.collection::<PurchaseOrder>(PURCHASE_ORDERS_COLL);
    let mut reread_filter = scope.filter();
    reread_filter.insert("_id", new_oid);
    let po = typed
        .find_one(reread_filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_purchase_orders.find_one(after-insert)"),
            )
        })?
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!(
                "freshly-inserted purchase order disappeared during re-read"
            ))
        })?;

    Ok(Json(po))
}

/// Stringify a [`PurchaseOrderStatus`] using the same lowercase
/// `snake_case` representation serde produces. We don't want to hand-
/// maintain a parallel mapping — but we DO want a `&'static str` we
/// can drop straight into a BSON doc, so this delegates to
/// `serde_json::to_value` once and pattern-matches the result.
fn default_status_str(s: PurchaseOrderStatus) -> &'static str {
    match s {
        PurchaseOrderStatus::Draft => "draft",
        PurchaseOrderStatus::AwaitingApproval => "awaiting_approval",
        PurchaseOrderStatus::Approved => "approved",
        PurchaseOrderStatus::Sent => "sent",
        PurchaseOrderStatus::Partial => "partial",
        PurchaseOrderStatus::Received => "received",
        PurchaseOrderStatus::Closed => "closed",
        PurchaseOrderStatus::Cancelled => "cancelled",
    }
}

// =========================================================================
// PATCH /:poId — update_purchase_order
// =========================================================================

/// `PATCH /v1/crm/purchase-orders/:poId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt`
/// and `updatedBy` are always refreshed. Fails with 404 if the PO
/// doesn't exist OR isn't owned by the caller.
///
/// `poNo`, `approval`, `linked_grn_ids`, `linked_bill_ids`, and
/// `lineage` are intentionally NOT updatable here — see the
/// `UpdatePurchaseOrderInput` doc comment.
#[instrument(skip_all, fields(user_id = %user.user_id, po_id = %po_id))]
pub async fn update_purchase_order(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(po_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(input): Json<UpdatePurchaseOrderInput>,
) -> Result<Json<PurchaseOrder>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let po_oid = oid_from_str(&po_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    if let Some(d) = input.date {
        set.insert("date", bson::DateTime::from_chrono(d));
    }
    if let Some(ed) = input.expected_delivery {
        set.insert("expectedDelivery", bson::DateTime::from_chrono(ed));
    }
    set_opt_oid(&mut set, "vendorId", input.vendor_id.as_ref())?;
    set_opt_oid(
        &mut set,
        "shipToWarehouseId",
        input.ship_to_warehouse_id.as_ref(),
    )?;
    set_opt_oid(
        &mut set,
        "billingBranchId",
        input.billing_branch_id.as_ref(),
    )?;
    set_opt_str(&mut set, "paymentTerms", input.payment_terms.as_ref());
    set_opt_str(&mut set, "currency", input.currency.as_ref());
    set_opt_str(
        &mut set,
        "termsAndConditions",
        input.terms_and_conditions.as_ref(),
    );
    set_opt_str(&mut set, "notes", input.notes.as_ref());

    if let Some(items) = input.items.as_ref() {
        let bson_items = json_to_bson(&serde_json::Value::Array(items.clone()), "items")?;
        set.insert("items", bson_items);
    }
    if let Some(totals) = input.totals.as_ref() {
        set.insert("totals", json_to_bson(totals, "totals")?);
    }

    if let Some(status) = input
        .status
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        if !ALLOWED_STATUSES.contains(&status) {
            return Err(ApiError::Validation(format!(
                "status must be one of: {}",
                ALLOWED_STATUSES.join(", ")
            )));
        }
        set.insert("status", status);
    }

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", po_oid);

    let coll = mongo.collection::<Document>(PURCHASE_ORDERS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_purchase_orders.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("purchaseOrder".to_owned()));
    }

    // Re-read via the typed collection so the response shape is stable.
    let typed = mongo.collection::<PurchaseOrder>(PURCHASE_ORDERS_COLL);
    let po = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_purchase_orders.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("purchaseOrder".to_owned()))?;

    Ok(Json(po))
}

// =========================================================================
// DELETE /:poId — delete_purchase_order (hard)
// =========================================================================

/// `DELETE /v1/crm/purchase-orders/:poId` — **hard delete**. Per the
/// CRM ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities
/// use hard deletes — the row is removed from the collection. Fails
/// with 404 if the PO doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, po_id = %po_id))]
pub async fn delete_purchase_order(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(po_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let po_oid = oid_from_str(&po_id)?;

    let mut filter = scope.filter();
    filter.insert("_id", po_oid);

    let coll = mongo.collection::<Document>(PURCHASE_ORDERS_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_purchase_orders.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("purchaseOrder".to_owned()));
    }

    Ok(Json(serde_json::json!({ "ok": true, "deleted": true })))
}

// =========================================================================
// Tests
// =========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_limit_uses_default_when_absent() {
        assert_eq!(clamp_limit(None), DEFAULT_LIMIT);
    }

    #[test]
    fn clamp_limit_caps_at_max() {
        assert_eq!(clamp_limit(Some(500)), MAX_LIMIT);
    }

    #[test]
    fn clamp_limit_floors_at_one() {
        assert_eq!(clamp_limit(Some(0)), 1);
    }

    #[test]
    fn base_filter_excludes_archived() {
        let oid = ObjectId::new();
        let f = base_ownership_filter(&TenantScope::User(oid));
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        assert!(!f.contains_key("projectId"));
        let archived = f.get_document("archived").unwrap();
        assert!(archived.contains_key("$ne"));
    }

    #[test]
    fn base_filter_scopes_by_project_on_sabcrm_mounts() {
        let oid = ObjectId::new();
        let f = base_ownership_filter(&TenantScope::Project(oid));
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
        assert!(f.get_document("archived").unwrap().contains_key("$ne"));
    }

    #[test]
    fn resolve_scope_project_requires_project_id() {
        let user = AuthUser {
            user_id: ObjectId::new().to_hex(),
            tenant_id: String::new(),
            roles: Vec::new(),
        };
        assert!(resolve_scope(ScopeMode::Project, &user, None).is_err());
        let p = ObjectId::new();
        let scope = resolve_scope(ScopeMode::Project, &user, Some(&p.to_hex())).unwrap();
        assert_eq!(scope, TenantScope::Project(p));
    }

    #[test]
    fn set_opt_str_skips_none() {
        let mut d = doc! {};
        set_opt_str(&mut d, "currency", None);
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_str_inserts_some() {
        let mut d = doc! {};
        let v = "INR".to_owned();
        set_opt_str(&mut d, "currency", Some(&v));
        assert_eq!(d.get_str("currency").unwrap(), "INR");
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "vendorId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn parent_collection_known_kinds() {
        assert_eq!(parent_collection("rfq"), Some(RFQS_COLL));
        assert_eq!(parent_collection("vendorBid"), Some(VENDOR_BIDS_COLL));
        assert_eq!(parent_collection("lead"), None);
        assert_eq!(parent_collection(""), None);
    }

    #[test]
    fn default_status_str_round_trips_via_serde() {
        // The hard-coded mapping must agree with what serde produces;
        // if a new variant is added, this test catches the omission.
        for status in [
            PurchaseOrderStatus::Draft,
            PurchaseOrderStatus::AwaitingApproval,
            PurchaseOrderStatus::Approved,
            PurchaseOrderStatus::Sent,
            PurchaseOrderStatus::Partial,
            PurchaseOrderStatus::Received,
            PurchaseOrderStatus::Closed,
            PurchaseOrderStatus::Cancelled,
        ] {
            let mapped = default_status_str(status);
            let via_serde = serde_json::to_value(status).unwrap();
            assert_eq!(via_serde.as_str(), Some(mapped));
            assert!(ALLOWED_STATUSES.contains(&mapped));
        }
    }

    #[test]
    fn json_to_bson_accepts_object() {
        let v = serde_json::json!({ "subTotal": 100.0, "total": 118.0 });
        assert!(json_to_bson(&v, "totals").is_ok());
    }
}
