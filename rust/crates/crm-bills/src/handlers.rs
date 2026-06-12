//! HTTP handlers for the §2.3 Bill entity (Purchases & Expenses).
//!
//! Five handlers — same shape as the sister `crm-purchase-orders` /
//! `crm-leads` crates:
//!
//! | Method  | Path             | Function           |
//! |---------|------------------|--------------------|
//! | `GET`   | `/`              | [`list_bills`]     |
//! | `GET`   | `/:billId`       | [`get_bill`]       |
//! | `POST`  | `/`              | [`create_bill`]    |
//! | `PATCH` | `/:billId`       | [`update_bill`]    |
//! | `DELETE`| `/:billId`       | [`delete_bill`]    |
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the
//! router constructors in [`crate::router`]):
//!
//! - `/v1/crm/bills` (legacy) — `userId == AuthUser.user_id`, the CRM
//!   tenant root from `crm-core::Identity`. Unchanged behaviour.
//! - `/v1/sabcrm/finance/bills` (SabCRM Finance suite) —
//!   `projectId == ?projectId` / body `projectId`, required per-request
//!   (4xx when absent). Membership is validated by the Next.js action
//!   gate before the request reaches Rust.
//!
//! ## Lineage seeding (§13.5)
//!
//! On create, the body may carry `fromKind: "purchaseOrder" | "grn"` +
//! `fromId`; when both are present we fetch the parent (under the same
//! `userId` scope) and seed the new Bill's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. We additionally stamp
//! `linkedPoId` (when parent is a PO) or push onto `linkedGrnIds` (when
//! parent is a GRN). Best-effort — a missing or mis-scoped parent
//! quietly skips the seed and still saves the Bill.

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
use crm_purchases_types::Bill;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::{instrument, warn};

use crate::dto::{
    ALLOWED_STATUSES, CreateBillInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, ScopeQuery,
    UpdateBillInput,
};

/// Mongo collection name. Must match the §2.3 spec literal so the Rust
/// BFF and any Next.js action share the same backing collection.
const BILLS_COLL: &str = "crm_bills";

/// Lineage parent collection — Purchase Orders.
const PURCHASE_ORDERS_COLL: &str = "crm_purchase_orders";

/// Lineage parent collection — Goods Receipt Notes.
const GRNS_COLL: &str = "crm_grns";

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
/// - `ScopeMode::User` (legacy `/v1/crm/bills`) — scope by the verified
///   JWT subject. Identical to the historical behaviour.
/// - `ScopeMode::Project` (`/v1/sabcrm/finance/bills`) — scope by the
///   caller-supplied `projectId`, 4xx when absent/invalid. The Next.js
///   action gate has already validated project membership before the
///   request reaches Rust.
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
/// `{ <userId|projectId>, archived: { $ne: true } }`. Soft-deleted rows
/// (`archived = true`) are excluded by default.
fn base_ownership_filter(scope: &TenantScope) -> Document {
    let mut f = scope.filter();
    f.insert("archived", doc! { "$ne": true });
    f
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
        "purchaseOrder" => Some(PURCHASE_ORDERS_COLL),
        "grn" => Some(GRNS_COLL),
        _ => None,
    }
}

/// Fetch the parent record (under the same tenant scope as the new
/// Bill) and build the lineage chain a freshly-created Bill should
/// inherit. Returns `Ok(None)` if the parent doesn't exist, isn't owned
/// by the caller's scope, or `kind` isn't a recognised Bill lineage
/// parent.
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
// GET / — list_bills
// =========================================================================

/// `GET /v1/crm/bills` — paginated list scoped to the authenticated
/// user's bills. The `q` query param does a case-insensitive substring
/// search across `billNo` and `vendorInvoiceNo`. `vendorId` and
/// `status` narrow further. Sorted by `createdAt` desc.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_bills(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Bill>>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;

    let mut filter = base_ownership_filter(&scope);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "billNo": regex.clone() }),
                Bson::Document(doc! { "vendorInvoiceNo": regex }),
            ]),
        );
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

    let coll = mongo.collection::<Bill>(BILLS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bills.find")))?;
    let bills: Vec<Bill> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bills.collect")))?;

    Ok(Json(bills))
}

// =========================================================================
// GET /:billId — get_bill
// =========================================================================

/// `GET /v1/crm/bills/:billId` — fetch a single bill. Returns 404 if
/// the bill doesn't exist OR isn't owned by the caller (we deliberately
/// collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, bill_id = %bill_id))]
pub async fn get_bill(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(bill_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<Bill>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let bill_oid = oid_from_str(&bill_id)?;

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", bill_oid);

    let coll = mongo.collection::<Bill>(BILLS_COLL);
    let bill = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bills.find_one")))?
        .ok_or_else(|| ApiError::NotFound("bill".to_owned()))?;

    Ok(Json(bill))
}

// =========================================================================
// POST / — create_bill
// =========================================================================

/// `POST /v1/crm/bills` — insert a new bill.
///
/// Builds the document directly (rather than going through the typed
/// [`Bill`] struct) so the curated input shape doesn't drag in
/// `crm-sales-types::LineItem` / `Totals` / `RecurringConfig` as a hard
/// dep — `items[]`, `expenseLines[]`, `totals`, and `recurring` pass
/// through verbatim from the wire JSON. The handler stamps
/// `Identity` + `Audit` + `Assignment` + status (`draft`) + payment
/// state (`amountPaid: 0`, `balance: totals.total`) and then re-reads
/// via the typed collection so the response is the canonical
/// [`Bill`] shape.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_bill(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateBillInput>,
) -> Result<Json<Bill>> {
    // ---- Required-field validation -----------------------------------
    if input.currency.trim().is_empty() {
        return Err(ApiError::Validation("currency is required.".to_owned()));
    }
    if input.vendor_id.trim().is_empty() {
        return Err(ApiError::Validation("vendorId is required.".to_owned()));
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
            // Match the §2.3 spec — projectId is required, but we mint
            // a fresh OID for legacy single-tenant callers that omit
            // it. The UI is expected to supply a real projectId in
            // production.
            None => ObjectId::new(),
        },
    };
    let vendor_oid = oid_from_str(&input.vendor_id)?;

    // ---- Lineage seeding (§13.5) -------------------------------------
    let mut lineage_array: Option<Vec<Bson>> = None;
    let mut parent_backlink: Option<(ObjectId, &'static str)> = None;
    let mut linked_po_oid: Option<ObjectId> = None;
    let mut linked_grn_oids: Vec<ObjectId> = Vec::new();
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
                // Stamp the sibling cross-ref the typed `Bill` carries
                // so downstream readers don't have to walk `lineage[]`.
                match kind {
                    "purchaseOrder" => linked_po_oid = Some(parent_oid),
                    "grn" => linked_grn_oids.push(parent_oid),
                    _ => {}
                }
                parent_backlink = Some((parent_oid, parent_coll));
            }
            Ok(None) => {
                // Unknown kind / parent not found / not owned —
                // silently skip; the bill still saves without a
                // lineage entry.
            }
            Err(e) => {
                warn!(error = %e, "lineage seed failed; saving bill without lineage");
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

    let totals_bson = json_to_bson(&input.totals, "totals")?;

    // Initial payment state — bills start unpaid; `balance` mirrors
    // `totals.total` if present, else 0.0. Payout receipts maintain
    // these going forward.
    let initial_total = input
        .totals
        .get("total")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    let mut new_doc = Document::new();
    new_doc.extend(identity_doc);
    new_doc.extend(audit_doc);
    new_doc.extend(assignment_doc);
    if let Some(bn) = input
        .bill_no
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        new_doc.insert("billNo", bn);
    }
    if let Some(vin) = input
        .vendor_invoice_no
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        new_doc.insert("vendorInvoiceNo", vin);
    }
    new_doc.insert("billDate", bson::DateTime::from_chrono(input.bill_date));
    if let Some(dd) = input.due_date {
        new_doc.insert("dueDate", bson::DateTime::from_chrono(dd));
    }
    new_doc.insert("vendorId", vendor_oid);

    if let Some(items) = input.items.as_ref().filter(|v| !v.is_empty()) {
        new_doc.insert(
            "items",
            json_to_bson(&serde_json::Value::Array(items.clone()), "items")?,
        );
    }
    if let Some(expense_lines) = input.expense_lines.as_ref().filter(|v| !v.is_empty()) {
        new_doc.insert(
            "expenseLines",
            json_to_bson(
                &serde_json::Value::Array(expense_lines.clone()),
                "expenseLines",
            )?,
        );
    }

    if let Some(s) = input.tds_section.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("tdsSection", s);
    }
    if let Some(amt) = input.tds_amount {
        new_doc.insert("tdsAmount", amt);
    }
    if let Some(rc) = input.reverse_charge {
        new_doc.insert("reverseCharge", rc);
    }
    if let Some(pos) = input.place_of_supply.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("placeOfSupply", pos);
    }

    new_doc.insert("currency", input.currency.trim());
    if let Some(rate) = input.exchange_rate {
        new_doc.insert("exchangeRate", rate);
    }
    new_doc.insert("totals", totals_bson);

    new_doc.insert("amountPaid", 0.0_f64);
    new_doc.insert("balance", initial_total);

    if let Some(rec) = input.recurring.as_ref() {
        new_doc.insert("recurring", json_to_bson(rec, "recurring")?);
    }

    if let Some(n) = input.notes.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("notes", n);
    }

    new_doc.insert("status", "draft");

    if let Some(po) = linked_po_oid {
        new_doc.insert("linkedPoId", po);
    }
    if !linked_grn_oids.is_empty() {
        new_doc.insert(
            "linkedGrnIds",
            Bson::Array(
                linked_grn_oids
                    .iter()
                    .copied()
                    .map(Bson::ObjectId)
                    .collect(),
            ),
        );
    }
    if let Some(la) = lineage_array {
        new_doc.insert("lineage", Bson::Array(la));
    }

    // The `Identity` serialization above stamps `_id: ObjectId` already
    // (see `crm_core::Identity` — `id` is renamed to `_id`). Sanity-
    // check by overwriting with the freshly minted oid so an upstream
    // change to `Identity` doesn't silently break us.
    new_doc.insert("_id", new_oid);

    let raw_coll = mongo.collection::<Document>(BILLS_COLL);
    raw_coll
        .insert_one(&new_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bills.insert_one")))?;

    // Best-effort back-link onto the parent's lineage (mirrors the
    // crm-purchase-orders create-PO flow). Non-fatal — a failed
    // back-link still returns the freshly-created Bill.
    if let Some((parent_oid, parent_coll)) = parent_backlink {
        let parent = mongo.collection::<Document>(parent_coll);
        let mut parent_filter = scope.filter();
        parent_filter.insert("_id", parent_oid);
        let _ = parent
            .update_one(
                parent_filter,
                doc! {
                    "$push": { "lineage": { "kind": "bill", "id": new_oid } },
                    "$set":  { "updatedAt": now },
                },
            )
            .await;
    }

    // Re-read via the typed collection so the response shape is stable.
    let typed = mongo.collection::<Bill>(BILLS_COLL);
    let mut reread_filter = scope.filter();
    reread_filter.insert("_id", new_oid);
    let bill = typed
        .find_one(reread_filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_bills.find_one(after-insert)"))
        })?
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!(
                "freshly-inserted bill disappeared during re-read"
            ))
        })?;

    Ok(Json(bill))
}

// =========================================================================
// PATCH /:billId — update_bill
// =========================================================================

/// `PATCH /v1/crm/bills/:billId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt`
/// and `updatedBy` are always refreshed. Fails with 404 if the bill
/// doesn't exist OR isn't owned by the caller.
///
/// `bill_no`, `amount_paid`, `balance`, `linked_po_id`,
/// `linked_grn_ids`, and `lineage` are intentionally NOT updatable here
/// — see the `UpdateBillInput` doc comment.
#[instrument(skip_all, fields(user_id = %user.user_id, bill_id = %bill_id))]
pub async fn update_bill(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(bill_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(input): Json<UpdateBillInput>,
) -> Result<Json<Bill>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let bill_oid = oid_from_str(&bill_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_str(
        &mut set,
        "vendorInvoiceNo",
        input.vendor_invoice_no.as_ref(),
    );
    if let Some(d) = input.bill_date {
        set.insert("billDate", bson::DateTime::from_chrono(d));
    }
    if let Some(d) = input.due_date {
        set.insert("dueDate", bson::DateTime::from_chrono(d));
    }
    set_opt_oid(&mut set, "vendorId", input.vendor_id.as_ref())?;

    if let Some(items) = input.items.as_ref() {
        let bson_items = json_to_bson(&serde_json::Value::Array(items.clone()), "items")?;
        set.insert("items", bson_items);
    }
    if let Some(expense_lines) = input.expense_lines.as_ref() {
        let bson_lines = json_to_bson(
            &serde_json::Value::Array(expense_lines.clone()),
            "expenseLines",
        )?;
        set.insert("expenseLines", bson_lines);
    }

    set_opt_str(&mut set, "tdsSection", input.tds_section.as_ref());
    if let Some(amt) = input.tds_amount {
        set.insert("tdsAmount", amt);
    }
    if let Some(rc) = input.reverse_charge {
        set.insert("reverseCharge", rc);
    }
    set_opt_str(&mut set, "placeOfSupply", input.place_of_supply.as_ref());

    set_opt_str(&mut set, "currency", input.currency.as_ref());
    if let Some(rate) = input.exchange_rate {
        set.insert("exchangeRate", rate);
    }
    if let Some(totals) = input.totals.as_ref() {
        set.insert("totals", json_to_bson(totals, "totals")?);
    }

    if let Some(rec) = input.recurring.as_ref() {
        set.insert("recurring", json_to_bson(rec, "recurring")?);
    }

    set_opt_str(&mut set, "notes", input.notes.as_ref());

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
    filter.insert("_id", bill_oid);

    let coll = mongo.collection::<Document>(BILLS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bills.update_one")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("bill".to_owned()));
    }

    // Re-read via the typed collection so the response shape is stable.
    let typed = mongo.collection::<Bill>(BILLS_COLL);
    let bill = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_bills.find_one(after-update)"))
        })?
        .ok_or_else(|| ApiError::NotFound("bill".to_owned()))?;

    Ok(Json(bill))
}

// =========================================================================
// DELETE /:billId — delete_bill
// =========================================================================

/// `DELETE /v1/crm/bills/:billId` — **hard delete**. Per the CRM
/// ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities use
/// hard deletes — the row is removed from the collection. Fails with
/// 404 if the bill doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, bill_id = %bill_id))]
pub async fn delete_bill(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(bill_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let bill_oid = oid_from_str(&bill_id)?;

    let mut filter = scope.filter();
    filter.insert("_id", bill_oid);

    let coll = mongo.collection::<Document>(BILLS_COLL);
    let res = coll
        .delete_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_bills.delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("bill".to_owned()));
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
        assert_eq!(
            parent_collection("purchaseOrder"),
            Some(PURCHASE_ORDERS_COLL)
        );
        assert_eq!(parent_collection("grn"), Some(GRNS_COLL));
        assert_eq!(parent_collection("rfq"), None);
        assert_eq!(parent_collection(""), None);
    }

    #[test]
    fn json_to_bson_accepts_object() {
        let v = serde_json::json!({ "subTotal": 100.0, "total": 118.0 });
        assert!(json_to_bson(&v, "totals").is_ok());
    }
}
