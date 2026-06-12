//! HTTP handlers for the §1.4 Sales Order entity.
//!
//! Mirrors `src/app/actions/crm-sales-orders.actions.ts` — read-only
//! research reference; the TS file stays in production until the API
//! host crate routes traffic here. Five handlers:
//!
//! | Method  | Path             | Function                |
//! |---------|------------------|-------------------------|
//! | `GET`   | `/`              | [`list_sales_orders`]   |
//! | `GET`   | `/:soId`         | [`get_sales_order`]     |
//! | `POST`  | `/`              | [`create_sales_order`]  |
//! | `PATCH` | `/:soId`         | [`update_sales_order`]  |
//! | `DELETE`| `/:soId`         | [`delete_sales_order`]  |
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the
//! router constructors in [`crate::router`]):
//!
//! - `/v1/crm/sales-orders` (legacy) — `userId == AuthUser.user_id`,
//!   the CRM tenant root from `crm-core::Identity`. Unchanged
//!   behaviour.
//! - `/v1/sabcrm/finance/sales-orders` (SabCRM Finance suite) —
//!   `projectId == ?projectId` / body `projectId`, required per-request
//!   (4xx when absent). Membership is validated by the Next.js action
//!   gate before the request reaches Rust.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{
    Assignment, Attribution, Audit, Identity, LineageRef, ScopeMode, TenantScope,
    build_lineage_from_parent, sabcrm_project_oid,
};
use crm_sales_types::{SalesOrder, SalesOrderStatus};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::{instrument, warn};

use crate::dto::{
    CreateSalesOrderInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, ScopeQuery, UpdateSalesOrderInput,
};

/// Mongo collection name. Must match the TS `crm-sales-orders.actions.ts`
/// literal so the Rust BFF and the legacy Next.js action share the same
/// backing collection during the migration window.
const SALES_ORDERS_COLL: &str = "crm_sales_orders";

/// Allowed values for `fromKind` on the create endpoint. Mirrors the TS
/// `ALLOWED_PARENT_KINDS` guard in `saveSalesOrder`.
const ALLOWED_PARENT_KINDS: &[&str] = &["quotation", "lead", "deal", "proforma"];

/// Map a `fromKind` value to its parent Mongo collection.
fn parent_collection_for(kind: &str) -> Option<&'static str> {
    match kind {
        "quotation" => Some("crm_quotations"),
        "lead" => Some("crm_leads"),
        "deal" => Some("crm_deals"),
        "proforma" => Some("crm_proforma_invoices"),
        _ => None,
    }
}

// =========================================================================
// Helpers
// =========================================================================

/// Resolve the calling tenant root from the verified [`AuthUser`].
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Resolve the per-request [`TenantScope`] from the mount's
/// [`ScopeMode`] (attached as an axum `Extension` by the router
/// constructor):
///
/// - `ScopeMode::User` (legacy `/v1/crm/sales-orders`) — scope by the
///   verified JWT subject. Identical to the historical behaviour.
/// - `ScopeMode::Project` (`/v1/sabcrm/finance/sales-orders`) — scope by
///   the caller-supplied `projectId`, 4xx when absent/invalid. The
///   Next.js action gate has already validated project membership before
///   the request reaches Rust.
fn resolve_scope(mode: ScopeMode, user: &AuthUser, project_id: Option<&str>) -> Result<TenantScope> {
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

/// Materialize the base ownership filter for the resolved scope:
/// `{ <userId|projectId>, archived: { $ne: true } }`.
/// Soft-deleted rows (`archived = true`) are excluded by default;
/// callers that want to surface them must build their own filter.
fn base_ownership_filter(scope: &TenantScope) -> Document {
    let mut f = scope.filter();
    f.insert("archived", doc! { "$ne": true });
    f
}

/// Optional-string update helper. When the input field is `Some`,
/// inserts the value at `key` in `$set`; when `None`, leaves the
/// document untouched (PATCH semantics — absent ≠ `null`).
fn set_opt_str(set: &mut Document, key: &str, val: Option<&String>) {
    if let Some(v) = val {
        set.insert(key, v.as_str());
    }
}

/// Optional-ObjectId-like update helper. Parses a 24-char hex string
/// when present and stores the OID; rejects malformed input with
/// `BadRequest`.
fn set_opt_oid(set: &mut Document, key: &str, val: Option<&String>) -> Result<()> {
    if let Some(v) = val {
        let oid = oid_from_str(v)?;
        set.insert(key, oid);
    }
    Ok(())
}

/// Status-string → enum parser used by the list filter. Returns
/// `BadRequest` for unknown values; `None` short-circuits to "no
/// filter".
fn parse_status_filter(s: &str) -> Result<SalesOrderStatus> {
    match s.trim().to_ascii_lowercase().as_str() {
        "open" => Ok(SalesOrderStatus::Open),
        "partial" => Ok(SalesOrderStatus::Partial),
        "fulfilled" => Ok(SalesOrderStatus::Fulfilled),
        "closed" => Ok(SalesOrderStatus::Closed),
        "cancelled" => Ok(SalesOrderStatus::Cancelled),
        other => Err(ApiError::BadRequest(format!(
            "unknown status filter '{other}' — expected one of open/partial/fulfilled/closed/cancelled"
        ))),
    }
}

/// Render a [`SalesOrderStatus`] as the lowercase string the TS code
/// stores on Mongo (matches `#[serde(rename_all = "lowercase")]`).
fn status_to_str(s: &SalesOrderStatus) -> &'static str {
    match s {
        SalesOrderStatus::Open => "open",
        SalesOrderStatus::Partial => "partial",
        SalesOrderStatus::Fulfilled => "fulfilled",
        SalesOrderStatus::Closed => "closed",
        SalesOrderStatus::Cancelled => "cancelled",
    }
}

/// Fetch a parent record (quotation/lead/deal/proforma) under the same
/// tenant scope as the new SO and build the lineage chain a
/// freshly-created SO should inherit. Returns `Ok(None)` if the parent
/// doesn't exist or isn't owned by the caller's scope.
async fn seed_lineage_from_parent(
    mongo: &MongoHandle,
    scope: &TenantScope,
    kind: &str,
    parent_id_hex: &str,
) -> Result<Option<(Vec<LineageRef>, ObjectId, &'static str)>> {
    let coll_name = match parent_collection_for(kind) {
        Some(c) => c,
        None => return Ok(None),
    };
    let parent_oid = oid_from_str(parent_id_hex)?;
    let parents = mongo.collection::<Document>(coll_name);
    let mut parent_filter = scope.filter();
    parent_filter.insert("_id", parent_oid);
    let parent = match parents
        .find_one(parent_filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_sales_orders.lineage_parent_find"),
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

    let chain = build_lineage_from_parent(kind, parent_oid, &parent_chain);
    Ok(Some((chain, parent_oid, coll_name)))
}

// =========================================================================
// GET / — list_sales_orders
// =========================================================================

/// `GET /v1/crm/sales-orders` — paginated list scoped to the
/// authenticated user's sales orders. The `q` query param does a
/// case-insensitive substring search across `soNo`, `poNo`, and
/// `customerNotes`. `clientId` and `status` narrow further. Sorted by
/// `createdAt` desc to match the TS action.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_sales_orders(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<SalesOrder>>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;

    let mut filter = base_ownership_filter(&scope);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "soNo": regex.clone() }),
                Bson::Document(doc! { "poNo": regex.clone() }),
                Bson::Document(doc! { "customerNotes": regex }),
            ]),
        );
    }
    if let Some(client) = q.client_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("clientId", oid_from_str(client)?);
    }
    if let Some(status) = q.status.as_deref().filter(|s| !s.is_empty()) {
        let parsed = parse_status_filter(status)?;
        filter.insert("status", status_to_str(&parsed));
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<SalesOrder>(SALES_ORDERS_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_sales_orders.find"))
        })?;
    let orders: Vec<SalesOrder> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_sales_orders.collect"))
    })?;

    Ok(Json(orders))
}

// =========================================================================
// GET /:soId — get_sales_order
// =========================================================================

/// `GET /v1/crm/sales-orders/:soId` — fetch a single sales order. Returns
/// 404 if the SO doesn't exist OR isn't owned by the caller (we
/// deliberately collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, so_id = %so_id))]
pub async fn get_sales_order(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(so_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<SalesOrder>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let so_oid = oid_from_str(&so_id)?;

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", so_oid);

    let coll = mongo.collection::<SalesOrder>(SALES_ORDERS_COLL);
    let order = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_sales_orders.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sales order".to_owned()))?;

    Ok(Json(order))
}

// =========================================================================
// POST / — create_sales_order
// =========================================================================

/// `POST /v1/crm/sales-orders` — insert a new sales order.
///
/// Builds a [`SalesOrder`] from the curated [`CreateSalesOrderInput`],
/// stamps `Identity` + `Audit`, optionally seeds `lineage[]` from a
/// parent record (`quotation` / `lead` / `deal` / `proforma`), persists
/// it, and returns the full document.
///
/// **Lineage:** mirrors the TS `saveSalesOrder` action — when both
/// `fromKind` and `fromId` are provided AND `fromKind` is in the
/// allow-list AND the parent exists under the same `userId`, the new
/// SO's `lineage[]` is built via [`crm_core::build_lineage_from_parent`]
/// and a best-effort back-link is pushed onto the parent doc. Failures
/// during the back-link write are non-fatal (matches the TS
/// `try { ... } catch {}` behaviour).
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_sales_order(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSalesOrderInput>,
) -> Result<Json<SalesOrder>> {
    if input.so_no.trim().is_empty() {
        return Err(ApiError::Validation("soNo is required.".to_owned()));
    }
    if input.client_id.trim().is_empty() {
        return Err(ApiError::Validation("clientId is required.".to_owned()));
    }
    if input.currency.trim().is_empty() {
        return Err(ApiError::Validation("currency is required.".to_owned()));
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
            // The §1.4 spec requires a project scope, but the legacy TS
            // action did not — single-tenant callers omit it and pick
            // up a freshly-minted id at insert time. Match the legacy
            // behaviour so existing UI keeps working during the
            // migration window.
            None => ObjectId::new(),
        },
    };
    let client_oid = oid_from_str(&input.client_id)?;
    let quotation_oid = match input.quotation_ref.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    // ---- Lineage seeding (mirrors `saveSalesOrder` §13.5 logic) -------
    let mut lineage: Vec<LineageRef> = Vec::new();
    let mut parent_link: Option<(ObjectId, &'static str)> = None;
    if let (Some(kind), Some(parent_id)) = (input.from_kind.as_deref(), input.from_id.as_deref()) {
        let kind_lc = kind.trim().to_ascii_lowercase();
        if !parent_id.is_empty() && ALLOWED_PARENT_KINDS.contains(&kind_lc.as_str()) {
            match seed_lineage_from_parent(&mongo, &scope, &kind_lc, parent_id).await {
                Ok(Some((chain, parent_oid, coll_name))) => {
                    lineage = chain;
                    parent_link = Some((parent_oid, coll_name));
                }
                Ok(None) => {
                    // Parent not found / not owned — quietly skip,
                    // matches TS behaviour.
                }
                Err(e) => {
                    warn!(
                        error = %e,
                        "lineage seed failed; saving sales order without lineage",
                    );
                }
            }
        }
    }

    let new_id = ObjectId::new();
    let order = SalesOrder {
        identity: Identity {
            id: new_id,
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        attribution: Attribution::default(),
        assignment: Assignment::default(),
        so_no: input.so_no.trim().to_owned(),
        date: input.date,
        client_id: client_oid,
        quotation_ref: quotation_oid,
        po_no: input.po_no.clone(),
        po_date: input.po_date,
        expected_shipment_date: input.expected_shipment_date,
        delivery_method: input.delivery_method,
        payment_terms: input.payment_terms.clone(),
        // Ship-to address from the create body (finance-rollout gap G7).
        shipping_address: input.shipping_address.clone(),
        currency: input.currency.trim().to_owned(),
        exchange_rate: input.exchange_rate,
        items: input.items.clone(),
        totals: input.totals.clone(),
        customer_notes: input.customer_notes.clone(),
        internal_notes: input.internal_notes.clone(),
        attachments: Vec::new(),
        status: input.status.unwrap_or_default(),
        // Server-managed; never trusted from input.
        linked_delivery_ids: Vec::new(),
        linked_invoice_ids: Vec::new(),
        lineage: lineage.clone(),
        design_metadata: input
            .design_metadata
            .and_then(|v| bson::to_document(&v).ok()),
    };

    let coll = mongo.collection::<SalesOrder>(SALES_ORDERS_COLL);
    coll.insert_one(&order).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_sales_orders.insert_one"))
    })?;

    // Best-effort back-link onto the parent's lineage. Non-fatal — the
    // SO is already persisted.
    if let Some((parent_oid, coll_name)) = parent_link {
        let parents = mongo.collection::<Document>(coll_name);
        let now = bson::DateTime::from_chrono(Utc::now());
        let mut parent_filter = scope.filter();
        parent_filter.insert("_id", parent_oid);
        let _ = parents
            .update_one(
                parent_filter,
                doc! {
                    "$push": { "lineage": { "kind": "salesOrder", "id": new_id } },
                    "$set":  { "updatedAt": now },
                },
            )
            .await;
    }

    Ok(Json(order))
}

// =========================================================================
// PATCH /:soId — update_sales_order
// =========================================================================

/// `PATCH /v1/crm/sales-orders/:soId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt` and
/// `updatedBy` are always refreshed. Fails with 404 if the SO doesn't
/// exist OR isn't owned by the caller.
///
/// `linkedDeliveryIds` / `linkedInvoiceIds` / `lineage` / `clientId` /
/// `soNo` are NOT mutable here.
#[instrument(skip_all, fields(user_id = %user.user_id, so_id = %so_id))]
pub async fn update_sales_order(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(so_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(input): Json<UpdateSalesOrderInput>,
) -> Result<Json<SalesOrder>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let so_oid = oid_from_str(&so_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    if let Some(d) = input.date {
        set.insert("date", bson::DateTime::from_chrono(d));
    }
    set_opt_oid(&mut set, "quotationRef", input.quotation_ref.as_ref())?;
    set_opt_str(&mut set, "poNo", input.po_no.as_ref());
    if let Some(d) = input.po_date {
        set.insert("poDate", bson::DateTime::from_chrono(d));
    }
    if let Some(d) = input.expected_shipment_date {
        set.insert("expectedShipmentDate", bson::DateTime::from_chrono(d));
    }
    if let Some(dm) = input.delivery_method.as_ref() {
        // The enum is `#[serde(rename_all = "snake_case")]`; we
        // round-trip via bson::to_bson so the stored value matches the
        // TS literal.
        let b = bson::to_bson(dm).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("delivery_method serialize"))
        })?;
        set.insert("deliveryMethod", b);
    }
    if let Some(addr) = input.shipping_address.as_ref() {
        // Ship-to address replacement (finance-rollout gap G7).
        let b = bson::to_bson(addr).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("shipping_address serialize"))
        })?;
        set.insert("shippingAddress", b);
    }
    set_opt_str(&mut set, "paymentTerms", input.payment_terms.as_ref());
    set_opt_str(&mut set, "currency", input.currency.as_ref());
    if let Some(rate) = input.exchange_rate {
        set.insert("exchangeRate", rate);
    }
    if let Some(items) = input.items.as_ref() {
        let b = bson::to_bson(items)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("items serialize")))?;
        set.insert("items", b);
    }
    if let Some(totals) = input.totals.as_ref() {
        let b = bson::to_bson(totals)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("totals serialize")))?;
        set.insert("totals", b);
    }
    set_opt_str(&mut set, "customerNotes", input.customer_notes.as_ref());
    set_opt_str(&mut set, "internalNotes", input.internal_notes.as_ref());
    if let Some(s) = input.status.as_ref() {
        set.insert("status", status_to_str(s));
    }
    if let Some(v) = input.design_metadata {
        if let Ok(doc) = bson::to_document(&v) {
            set.insert("designMetadata", doc);
        }
    }

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", so_oid);

    let coll = mongo.collection::<Document>(SALES_ORDERS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_sales_orders.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("sales order".to_owned()));
    }

    // Re-read via the typed collection so the response is the canonical
    // [`SalesOrder`] shape (and any defaults / skipped fields render
    // correctly).
    let typed = mongo.collection::<SalesOrder>(SALES_ORDERS_COLL);
    let order = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_sales_orders.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("sales order".to_owned()))?;

    Ok(Json(order))
}

// =========================================================================
// DELETE /:soId — delete_sales_order (hard)
// =========================================================================

/// `DELETE /v1/crm/sales-orders/:soId` — **hard delete**. Per the CRM
/// ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities use
/// hard deletes — the row is removed from the collection. Fails with
/// 404 if the SO doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, so_id = %so_id))]
pub async fn delete_sales_order(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(so_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let so_oid = oid_from_str(&so_id)?;

    let mut filter = scope.filter();
    filter.insert("_id", so_oid);

    let coll = mongo.collection::<Document>(SALES_ORDERS_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_sales_orders.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("sales order".to_owned()));
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
    fn base_filter_excludes_archived_user_scope() {
        let oid = ObjectId::new();
        let f = base_ownership_filter(&TenantScope::User(oid));
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        assert!(!f.contains_key("projectId"));
        let archived = f.get_document("archived").unwrap();
        assert!(archived.contains_key("$ne"));
    }

    #[test]
    fn base_filter_excludes_archived_project_scope() {
        let oid = ObjectId::new();
        let f = base_ownership_filter(&TenantScope::Project(oid));
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
        let archived = f.get_document("archived").unwrap();
        assert!(archived.contains_key("$ne"));
    }

    #[test]
    fn parent_collection_for_known_kinds() {
        assert_eq!(parent_collection_for("quotation"), Some("crm_quotations"));
        assert_eq!(parent_collection_for("lead"), Some("crm_leads"));
        assert_eq!(parent_collection_for("deal"), Some("crm_deals"));
        assert_eq!(
            parent_collection_for("proforma"),
            Some("crm_proforma_invoices"),
        );
        assert_eq!(parent_collection_for("invoice"), None);
        assert_eq!(parent_collection_for(""), None);
    }

    #[test]
    fn allowed_parent_kinds_match_ts_action() {
        // Mirrors `ALLOWED_PARENT_KINDS` in `crm-sales-orders.actions.ts`.
        assert_eq!(
            ALLOWED_PARENT_KINDS,
            &["quotation", "lead", "deal", "proforma"],
        );
    }

    #[test]
    fn parse_status_filter_accepts_known_values() {
        assert!(matches!(
            parse_status_filter("open").unwrap(),
            SalesOrderStatus::Open,
        ));
        assert!(matches!(
            parse_status_filter("FULFILLED").unwrap(),
            SalesOrderStatus::Fulfilled,
        ));
        assert!(matches!(
            parse_status_filter(" cancelled ").unwrap(),
            SalesOrderStatus::Cancelled,
        ));
    }

    #[test]
    fn parse_status_filter_rejects_unknown() {
        let err = parse_status_filter("bogus").unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn status_to_str_matches_lowercase_serde() {
        assert_eq!(status_to_str(&SalesOrderStatus::Open), "open");
        assert_eq!(status_to_str(&SalesOrderStatus::Partial), "partial");
        assert_eq!(status_to_str(&SalesOrderStatus::Fulfilled), "fulfilled");
        assert_eq!(status_to_str(&SalesOrderStatus::Closed), "closed");
        assert_eq!(status_to_str(&SalesOrderStatus::Cancelled), "cancelled");
    }

    #[test]
    fn set_opt_str_skips_none() {
        let mut d = doc! {};
        set_opt_str(&mut d, "name", None);
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_str_inserts_some() {
        let mut d = doc! {};
        let v = "hello".to_owned();
        set_opt_str(&mut d, "name", Some(&v));
        assert_eq!(d.get_str("name").unwrap(), "hello");
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "quotationRef", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }
}
