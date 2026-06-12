//! HTTP handlers for the §1.7 PaymentReceipt entity.
//!
//! Mirrors `src/app/actions/crm-payment-receipts.actions.ts` — read-only
//! research reference; the TS file stays in production until the API
//! host crate routes traffic here. Five handlers:
//!
//! | Method  | Path             | Function                      |
//! |---------|------------------|-------------------------------|
//! | `GET`   | `/`              | [`list_payment_receipts`]     |
//! | `GET`   | `/:receiptId`    | [`get_payment_receipt`]       |
//! | `POST`  | `/`              | [`create_payment_receipt`]    |
//! | `PATCH` | `/:receiptId`    | [`update_payment_receipt`]    |
//! | `DELETE`| `/:receiptId`    | [`delete_payment_receipt`]    |
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the
//! router constructors in [`crate::router`]):
//!
//! - `/v1/crm/payment-receipts` (legacy) — `userId == AuthUser.user_id`,
//!   the CRM tenant root from `crm-core::Identity`. Unchanged behaviour.
//! - `/v1/sabcrm/finance/payment-receipts` (SabCRM Finance suite) —
//!   `projectId == ?projectId` / body `projectId`, required per-request
//!   (4xx when absent). Membership is validated by the Next.js action
//!   gate before the request reaches Rust. Cross-collection lookups
//!   (lineage parents on `crm_invoices` / `crm_proforma_invoices`)
//!   use the same scope filter so project-mode requests never leave the
//!   project tenant.
//!
//! ## Lineage seeding (G4 pattern)
//!
//! On create, the body may carry `fromKind` + `fromId`:
//!
//! - If `fromKind` ∈ {`invoice`, `proforma`} AND `fromId` is a valid
//!   ObjectId, that's the primary parent — the matching parent doc is
//!   fetched (under the same `userId` scope) and the new receipt's
//!   `lineage[]` is seeded via [`crm_core::build_lineage_from_parent`].
//! - Otherwise, if `applyTo[]` is non-empty, the **first** invoice in
//!   the allocation table becomes the implicit parent (kind =
//!   `"invoice"`).
//! - Otherwise no `lineage[]` is written.
//!
//! Multi-invoice settlements: only the first invoice in `applyTo[]`
//! seeds lineage. The rest of the allocation table lives on
//! `applyTo[]` itself, which is the canonical AR-side source of truth.
//! Best-effort — a missing or mis-scoped parent quietly skips the seed
//! and still saves the receipt (matches the TS action's `try/catch`).

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
use crm_sales_types::{PaymentReceipt, ReceiptStatus};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::{instrument, warn};

use crate::dto::{
    CreatePaymentReceiptInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, ScopeQuery,
    UpdatePaymentReceiptInput,
};

/// Mongo collection name. Must match the TS
/// `crm-payment-receipts.actions.ts` literal so the Rust BFF and the
/// legacy Next.js action share the same backing collection during the
/// migration window.
const RECEIPTS_COLL: &str = "crm_payment_receipts";

/// Companion collections for lineage seed lookups.
const INVOICES_COLL: &str = "crm_invoices";
const PROFORMA_COLL: &str = "crm_proforma_invoices";

/// Lineage parent kinds the create endpoint accepts. Anything outside
/// this set falls through to the `applyTo[]`-implicit fallback.
const ALLOWED_PARENT_KINDS: &[&str] = &["invoice", "proforma"];

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
/// - `ScopeMode::User` (legacy `/v1/crm/payment-receipts`) — scope by
///   the verified JWT subject. Identical to the historical behaviour.
/// - `ScopeMode::Project` (`/v1/sabcrm/finance/payment-receipts`) —
///   scope by the caller-supplied `projectId`, 4xx when absent/invalid.
///   The Next.js action gate has already validated project membership
///   before the request reaches Rust.
fn resolve_scope(mode: ScopeMode, user: &AuthUser, project_id: Option<&str>) -> Result<TenantScope> {
    match mode {
        ScopeMode::User => Ok(TenantScope::User(user_oid(user)?)),
        ScopeMode::Project => Ok(TenantScope::Project(sabcrm_project_oid(project_id)?)),
    }
}

/// Clamp `requested` page-size into `[1, MAX_LIMIT]`, defaulting to
/// [`DEFAULT_LIMIT`] when absent.
fn clamp_limit(requested: Option<u32>) -> i64 {
    match requested {
        None => DEFAULT_LIMIT,
        Some(n) => (n as i64).clamp(1, MAX_LIMIT),
    }
}

/// Materialize the base ownership filter for the resolved scope:
/// `{ <userId|projectId>, archived: { $ne: true } }`.
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

/// Optional-ObjectId update helper. Parses a 24-char hex string when
/// present; rejects malformed input with `BadRequest`.
fn set_opt_oid(set: &mut Document, key: &str, val: Option<&String>) -> Result<()> {
    if let Some(v) = val {
        let oid = oid_from_str(v)?;
        set.insert(key, oid);
    }
    Ok(())
}

/// Map a parent kind string to the Mongo collection it lives in.
fn parent_collection(kind: &str) -> Option<&'static str> {
    match kind {
        "invoice" => Some(INVOICES_COLL),
        "proforma" => Some(PROFORMA_COLL),
        _ => None,
    }
}

// =========================================================================
// GET / — list_payment_receipts
// =========================================================================

/// `GET /v1/crm/payment-receipts` — paginated list scoped to the
/// authenticated user's receipts. The `q` query param does a
/// case-insensitive substring search across `receiptNo`, `reference`,
/// `txnId`, and `chequeNo`. `clientId` and `status` narrow further.
/// Sorted by `date` desc to match the TS action's `receiptDate` order.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_payment_receipts(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<PaymentReceipt>>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;

    let mut filter = base_ownership_filter(&scope);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "receiptNo": regex.clone() }),
                Bson::Document(doc! { "reference": regex.clone() }),
                Bson::Document(doc! { "txnId": regex.clone() }),
                Bson::Document(doc! { "chequeNo": regex }),
            ]),
        );
    }
    if let Some(cid) = q.client_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("clientId", oid_from_str(cid)?);
    }
    if let Some(s) = q.status.as_deref().map(|s| s.trim().to_ascii_lowercase()) {
        if !matches!(s.as_str(), "received" | "cleared" | "bounced") {
            return Err(ApiError::Validation(
                "status must be one of: received, cleared, bounced.".to_owned(),
            ));
        }
        filter.insert("status", s);
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "date": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<PaymentReceipt>(RECEIPTS_COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payment_receipts.find"))
    })?;
    let receipts: Vec<PaymentReceipt> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payment_receipts.collect"))
    })?;

    Ok(Json(receipts))
}

// =========================================================================
// GET /:receiptId — get_payment_receipt
// =========================================================================

/// `GET /v1/crm/payment-receipts/:receiptId` — fetch a single receipt.
/// Returns 404 if the receipt doesn't exist OR isn't owned by the
/// caller (we collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, receipt_id = %receipt_id))]
pub async fn get_payment_receipt(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(receipt_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<PaymentReceipt>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let receipt_oid = oid_from_str(&receipt_id)?;

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", receipt_oid);

    let coll = mongo.collection::<PaymentReceipt>(RECEIPTS_COLL);
    let receipt = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payment_receipts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("paymentReceipt".to_owned()))?;

    Ok(Json(receipt))
}

// =========================================================================
// POST / — create_payment_receipt
// =========================================================================

/// `POST /v1/crm/payment-receipts` — insert a new receipt.
///
/// Builds a [`PaymentReceipt`] from the curated [`CreatePaymentReceiptInput`],
/// stamps `Identity` + `Audit`, seeds `lineage[]` from the resolved
/// primary parent (per the G4 pattern), persists, and returns the full
/// document.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_payment_receipt(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePaymentReceiptInput>,
) -> Result<Json<PaymentReceipt>> {
    // ---- Validation ----------------------------------------------------
    if input.receipt_no.trim().is_empty() {
        return Err(ApiError::Validation("receiptNo is required.".to_owned()));
    }
    if !input.amount.is_finite() || input.amount <= 0.0 {
        return Err(ApiError::Validation(
            "amount must be a positive finite number.".to_owned(),
        ));
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
            // The §1.7 spec requires a project scope, but the legacy TS
            // action did not — single-tenant callers omit it and pick
            // up a freshly-minted id at insert time.
            None => ObjectId::new(),
        },
    };

    let client_oid = oid_from_str(&input.client_id)?;
    let bank_account_oid = oid_from_str(&input.bank_account_id)?;

    let new_oid = ObjectId::new();

    // ---- Lineage resolution (G4 pattern) -------------------------------
    //
    // 1. Explicit fromKind/fromId in ALLOWED_PARENT_KINDS.
    // 2. Fallback: first invoice in applyTo[] when applyTo is non-empty
    //    AND no explicit parent was supplied.
    let mut resolved_kind: Option<&'static str> = None;
    let mut resolved_id: Option<ObjectId> = None;

    let raw_kind = input
        .from_kind
        .as_deref()
        .map(|s| s.trim().to_ascii_lowercase());
    let raw_id = input.from_id.as_deref().filter(|s| !s.is_empty());

    if let (Some(kind), Some(id_hex)) = (raw_kind.as_deref(), raw_id) {
        if let Some(matched) = ALLOWED_PARENT_KINDS.iter().find(|&&k| k == kind) {
            match oid_from_str(id_hex) {
                Ok(oid) => {
                    resolved_kind = Some(matched);
                    resolved_id = Some(oid);
                }
                Err(_) => {
                    warn!(
                        from_kind = kind,
                        from_id = id_hex,
                        "create_payment_receipt: malformed fromId; falling through to applyTo[]"
                    );
                }
            }
        } else {
            warn!(
                from_kind = kind,
                "create_payment_receipt: fromKind not in allowed parent kinds; falling through"
            );
        }
    }
    if resolved_kind.is_none() && !input.apply_to.is_empty() {
        // Fallback: first invoice in applyTo[] becomes the implicit
        // primary parent. Multi-invoice allocations are NOT
        // cross-linked into lineage[]; the rest of the chain lives on
        // applyTo[] itself.
        resolved_kind = Some("invoice");
        resolved_id = Some(input.apply_to[0].invoice_id);
    }

    // Fetch parent + build chain when we have a candidate.
    let mut lineage: Vec<LineageRef> = Vec::new();
    let mut parent_back_link: Option<(&'static str, ObjectId)> = None;
    if let (Some(kind), Some(parent_oid)) = (resolved_kind, resolved_id) {
        match seed_lineage_from_parent(&mongo, &scope, kind, parent_oid).await {
            Ok(Some(chain)) => {
                lineage = chain;
                parent_back_link = Some((kind, parent_oid));
            }
            Ok(None) => {
                // Parent not found / not owned — quietly skip; receipt
                // still saves without lineage.
            }
            Err(e) => {
                warn!(error = %e, kind = kind, "lineage seed failed; saving receipt without lineage");
            }
        }
    }

    let receipt = PaymentReceipt {
        identity: Identity {
            id: new_oid,
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        assignment: Assignment::default(),

        receipt_no: input.receipt_no.trim().to_owned(),
        date: input.date,

        client_id: client_oid,
        mode: input.mode,
        bank_account_id: bank_account_oid,

        cheque_no: input.cheque_no.clone(),
        cheque_date: input.cheque_date,
        txn_id: input.txn_id.clone(),
        reference: input.reference.clone(),

        amount: input.amount,
        currency: input.currency.trim().to_owned(),
        exchange_rate: None,

        apply_to: input.apply_to.clone(),
        excess_as_advance: input.excess_as_advance,

        tds_deducted: input.tds_deducted,
        bank_charges: input.bank_charges,

        notes: input.notes.clone(),
        attachments: Vec::new(),

        status: ReceiptStatus::default(),
        lineage,
    };

    let coll = mongo.collection::<PaymentReceipt>(RECEIPTS_COLL);
    coll.insert_one(&receipt).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payment_receipts.insert_one"))
    })?;

    // Best-effort back-link onto the primary parent's lineage. Non-fatal
    // — mirrors the TS action's `try { ... } catch {}`.
    if let Some((kind, parent_oid)) = parent_back_link {
        if let Some(parent_coll_name) = parent_collection(kind) {
            let parents = mongo.collection::<Document>(parent_coll_name);
            let now = bson::DateTime::from_chrono(Utc::now());
            let mut parent_filter = scope.filter();
            parent_filter.insert("_id", parent_oid);
            let _ = parents
                .update_one(
                    parent_filter,
                    doc! {
                        "$push": { "lineage": { "kind": "paymentReceipt", "id": new_oid } },
                        "$set":  { "updatedAt": now },
                    },
                )
                .await;
        }
    }

    Ok(Json(receipt))
}

/// Fetch the parent doc (under the same tenant scope as the new
/// receipt) and build the lineage chain a freshly-created receipt
/// should inherit. Returns `Ok(None)` if the parent doesn't exist or
/// isn't owned by the caller's scope.
async fn seed_lineage_from_parent(
    mongo: &MongoHandle,
    scope: &TenantScope,
    parent_kind: &str,
    parent_oid: ObjectId,
) -> Result<Option<Vec<LineageRef>>> {
    let coll_name = match parent_collection(parent_kind) {
        Some(c) => c,
        None => return Ok(None),
    };
    let parents = mongo.collection::<Document>(coll_name);
    let mut parent_filter = scope.filter();
    parent_filter.insert("_id", parent_oid);
    let parent = match parents
        .find_one(parent_filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_payment_receipts.lineage.find_one"),
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
    Ok(Some(chain))
}

// =========================================================================
// PATCH /:receiptId — update_payment_receipt
// =========================================================================

/// `PATCH /v1/crm/payment-receipts/:receiptId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt`
/// and `updatedBy` are always refreshed. Fails with 404 if the receipt
/// doesn't exist OR isn't owned by the caller.
///
/// Financial fields (`amount`, `mode`, `applyTo`, `clientId`,
/// `currency`, `exchangeRate`, `excessAsAdvance`) ARE patchable
/// (finance-rollout gap G4) — see the contract note on
/// [`UpdatePaymentReceiptInput`](crate::dto::UpdatePaymentReceiptInput):
/// the action layer owns re-running linked-invoice status flips after
/// an allocation change.
#[instrument(skip_all, fields(user_id = %user.user_id, receipt_id = %receipt_id))]
pub async fn update_payment_receipt(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(receipt_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(input): Json<UpdatePaymentReceiptInput>,
) -> Result<Json<PaymentReceipt>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }
    // ---- G4 financial-field validation ---------------------------------
    if let Some(amount) = input.amount {
        if !amount.is_finite() || amount <= 0.0 {
            return Err(ApiError::Validation(
                "amount must be a positive finite number.".to_owned(),
            ));
        }
    }
    if let Some(currency) = input.currency.as_deref() {
        if currency.trim().is_empty() {
            return Err(ApiError::Validation(
                "currency cannot be blank when provided.".to_owned(),
            ));
        }
    }
    if let Some(rate) = input.exchange_rate {
        if !rate.is_finite() || rate <= 0.0 {
            return Err(ApiError::Validation(
                "exchangeRate must be a positive finite number.".to_owned(),
            ));
        }
    }
    if let Some(rows) = input.apply_to.as_ref() {
        if rows.iter().any(|r| !r.amount.is_finite() || r.amount < 0.0) {
            return Err(ApiError::Validation(
                "applyTo amounts must be non-negative finite numbers.".to_owned(),
            ));
        }
    }

    let user_id = user_oid(&user)?;
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let receipt_oid = oid_from_str(&receipt_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_str(&mut set, "receiptNo", input.receipt_no.as_ref());
    set_opt_str(&mut set, "chequeNo", input.cheque_no.as_ref());
    set_opt_str(&mut set, "txnId", input.txn_id.as_ref());
    set_opt_str(&mut set, "reference", input.reference.as_ref());
    set_opt_str(&mut set, "notes", input.notes.as_ref());
    set_opt_oid(&mut set, "bankAccountId", input.bank_account_id.as_ref())?;
    set_opt_oid(&mut set, "clientId", input.client_id.as_ref())?;
    if let Some(when) = input.date {
        set.insert("date", bson::DateTime::from_chrono(when));
    }
    if let Some(when) = input.cheque_date {
        set.insert("chequeDate", bson::DateTime::from_chrono(when));
    }
    // ---- G4 financial fields -------------------------------------------
    if let Some(amount) = input.amount {
        set.insert("amount", amount);
    }
    if let Some(currency) = input.currency.as_deref() {
        set.insert("currency", currency.trim());
    }
    if let Some(rate) = input.exchange_rate {
        set.insert("exchangeRate", rate);
    }
    if let Some(pm) = input.mode.as_ref() {
        // Serialize via serde so the lowercase tag matches
        // `PaymentMode`'s wire shape.
        let b = bson::to_bson(pm).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("serialize PaymentMode"))
        })?;
        set.insert("mode", b);
    }
    if let Some(rows) = input.apply_to.as_ref() {
        // Full replacement — `[]` deliberately clears all allocations.
        let b = bson::to_bson(rows).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("serialize applyTo"))
        })?;
        set.insert("applyTo", b);
    }
    if let Some(excess) = input.excess_as_advance {
        set.insert("excessAsAdvance", excess);
    }
    if let Some(att) = input.attachments.as_ref() {
        // Full replacement — `[]` deliberately clears all attachments.
        let b = bson::to_bson(att).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("serialize attachments"))
        })?;
        set.insert("attachments", b);
    }
    if let Some(tds) = input.tds_deducted {
        set.insert("tdsDeducted", tds);
    }
    if let Some(bc) = input.bank_charges {
        set.insert("bankCharges", bc);
    }
    if let Some(status) = input.status {
        // Serialize via serde so the lowercase tag matches `ReceiptStatus`'s wire shape.
        let s = match bson::to_bson(&status).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("serialize ReceiptStatus"))
        })? {
            Bson::String(s) => s,
            other => {
                return Err(ApiError::Internal(anyhow::anyhow!(
                    "ReceiptStatus did not serialize to a String, got: {:?}",
                    other
                )));
            }
        };
        set.insert("status", s);
    }

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", receipt_oid);

    let coll = mongo.collection::<Document>(RECEIPTS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payment_receipts.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("paymentReceipt".to_owned()));
    }

    // Re-read via the typed collection so the response is the canonical
    // [`PaymentReceipt`] shape.
    let typed = mongo.collection::<PaymentReceipt>(RECEIPTS_COLL);
    let receipt = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_payment_receipts.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("paymentReceipt".to_owned()))?;

    Ok(Json(receipt))
}

// =========================================================================
// DELETE /:receiptId — delete_payment_receipt
// =========================================================================

/// `DELETE /v1/crm/payment-receipts/:receiptId` — **hard delete**. Per
/// the CRM ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM
/// entities use hard deletes — the row is removed from the collection.
/// Fails with 404 if the receipt doesn't exist OR isn't owned by the
/// caller.
#[instrument(skip_all, fields(user_id = %user.user_id, receipt_id = %receipt_id))]
pub async fn delete_payment_receipt(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(receipt_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let receipt_oid = oid_from_str(&receipt_id)?;

    let mut filter = scope.filter();
    filter.insert("_id", receipt_oid);

    let coll = mongo.collection::<Document>(RECEIPTS_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payment_receipts.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("paymentReceipt".to_owned()));
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
        set_opt_str(&mut d, "receiptNo", None);
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_str_inserts_some() {
        let mut d = doc! {};
        let v = "RCPT-99".to_owned();
        set_opt_str(&mut d, "receiptNo", Some(&v));
        assert_eq!(d.get_str("receiptNo").unwrap(), "RCPT-99");
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "bankAccountId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn parent_collection_maps_known_kinds() {
        assert_eq!(parent_collection("invoice"), Some(INVOICES_COLL));
        assert_eq!(parent_collection("proforma"), Some(PROFORMA_COLL));
        assert_eq!(parent_collection("lead"), None);
    }

    #[test]
    fn allowed_parent_kinds_is_invoice_and_proforma() {
        // Compile-time guard against accidentally widening the set;
        // updating this set requires reviewing the G4 fallback logic.
        assert_eq!(ALLOWED_PARENT_KINDS, &["invoice", "proforma"]);
    }
}
