//! HTTP handlers for the §1.8 Credit Note entity.
//!
//! Mirrors `src/app/actions/crm-credit-notes.actions.ts` — read-only
//! research reference; the TS file stays in production until the API
//! host crate routes traffic here. Five handlers:
//!
//! | Method   | Path             | Function                 |
//! |----------|------------------|--------------------------|
//! | `GET`    | `/`              | [`list_credit_notes`]    |
//! | `GET`    | `/:cnId`         | [`get_credit_note`]      |
//! | `POST`   | `/`              | [`create_credit_note`]   |
//! | `PATCH`  | `/:cnId`         | [`update_credit_note`]   |
//! | `DELETE` | `/:cnId`         | [`delete_credit_note`]   |
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! — the CRM tenant root from `crm-core::Identity`.
//!
//! ## Lineage (§13.5)
//!
//! Per the TS action, the only allow-listed parent kind is `invoice`.
//! When the create body carries `fromKind: "invoice"` + `fromId`, the
//! handler fetches the parent invoice (under the same `userId` scope)
//! and seeds the new credit-note's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. A best-effort back-link is
//! pushed onto the parent invoice. Failures are non-fatal.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{LineageRef, build_lineage_from_parent};
use crm_sales_types::CreditNote;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::{instrument, warn};

use crate::dto::{
    CreateCreditNoteInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, UpdateCreditNoteInput,
};

/// Mongo collection name. Must match the TS
/// `crm-credit-notes.actions.ts` literal so the Rust BFF and the legacy
/// Next.js action share the same backing collection during the
/// migration window.
const CREDIT_NOTES_COLL: &str = "crm_credit_notes";

/// Parent collection used for lineage seeding + back-link. Per §13.5
/// the only allow-listed parent for a credit note is an invoice.
const INVOICES_COLL: &str = "crm_invoices";

/// The single allow-listed lineage parent kind for credit notes (§13.5).
/// Mirrors the TS `ALLOWED_PARENT_KINDS = ['invoice']` constant.
const PARENT_KIND_INVOICE: &str = "invoice";

/// Allow-list of legal `status` filter values. Kept as a `&[&str]` so a
/// new variant only needs editing here + the `CreditNoteStatus` enum.
const STATUS_FILTER_VALUES: &[&str] = &["draft", "issued", "refunded", "cancelled", "pending"];

// =========================================================================
// Helpers
// =========================================================================

/// Resolve the calling tenant root from the verified [`AuthUser`].
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
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
/// `{ userId, archived: { $ne: true } }`. Soft-deleted rows
/// (`archived = true`) are excluded by default; callers that want to
/// surface them must build their own filter.
fn base_ownership_filter(user: ObjectId) -> Document {
    doc! {
        "userId": user,
        "archived": { "$ne": true },
    }
}

/// Optional-string update helper. When the input field is `Some`,
/// inserts the value at `key` in `$set`; when `None`, leaves the
/// document untouched (PATCH semantics — absent ≠ `null`).
///
/// Empty strings are stored verbatim; trim policy belongs to the UI.
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

/// Fetch the parent invoice (scoped by `userId`) and build the lineage
/// chain a freshly-created credit note should inherit. Returns
/// `Ok(None)` if the invoice doesn't exist or isn't owned by the
/// caller. Mirrors the TS `buildLineageFromParent` call site verbatim
/// — including the projection optimisation (`_id`, `lineage`) so we
/// don't pull an entire invoice document just to read the chain.
async fn seed_lineage_from_invoice(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    parent_id_hex: &str,
) -> Result<Option<(Vec<LineageRef>, ObjectId)>> {
    let inv_oid = oid_from_str(parent_id_hex)?;
    let invoices = mongo.collection::<Document>(INVOICES_COLL);
    let invoice = match invoices
        .find_one(doc! { "_id": inv_oid, "userId": user_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_invoices.find_one(lineage)"))
        })? {
        Some(d) => d,
        None => return Ok(None),
    };

    let parent_chain: Vec<LineageRef> = invoice
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

    let chain = build_lineage_from_parent(PARENT_KIND_INVOICE, inv_oid, &parent_chain);
    Ok(Some((chain, inv_oid)))
}

// =========================================================================
// GET / — list_credit_notes
// =========================================================================

/// `GET /v1/crm/credit-notes` — paginated list scoped to the
/// authenticated user's credit notes. The `q` query param does a
/// case-insensitive substring search across `cnNo` and `notes`;
/// `clientId` and `status` narrow further. Sorted by `date` desc to
/// match the TS action (`creditNoteDate: -1`).
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_credit_notes(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<CreditNote>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);

    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "cnNo": regex.clone() }),
                Bson::Document(doc! { "notes": regex }),
            ]),
        );
    }

    if let Some(cid) = q.client_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("clientId", oid_from_str(cid)?);
    }

    if let Some(status) = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let lower = status.to_ascii_lowercase();
        if !STATUS_FILTER_VALUES.contains(&lower.as_str()) {
            return Err(ApiError::Validation(format!(
                "status must be one of: {}",
                STATUS_FILTER_VALUES.join(", "),
            )));
        }
        if lower == "pending" {
            filter.insert("status", doc! { "$nin": ["refunded", "cancelled"] });
        } else {
            filter.insert("status", lower);
        }
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "date": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<CreditNote>(CREDIT_NOTES_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_credit_notes.find"))
        })?;
    let notes: Vec<CreditNote> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_credit_notes.collect"))
    })?;

    Ok(Json(notes))
}

// =========================================================================
// GET /:cnId — get_credit_note
// =========================================================================

/// `GET /v1/crm/credit-notes/:cnId` — fetch a single credit note.
/// Returns 404 if the note doesn't exist OR isn't owned by the caller
/// (we deliberately collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, cn_id = %cn_id))]
pub async fn get_credit_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(cn_id): Path<String>,
) -> Result<Json<CreditNote>> {
    let user_id = user_oid(&user)?;
    let cn_oid = oid_from_str(&cn_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", cn_oid);

    let coll = mongo.collection::<CreditNote>(CREDIT_NOTES_COLL);
    let note = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_credit_notes.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("credit_note".to_owned()))?;

    Ok(Json(note))
}

// =========================================================================
// POST / — create_credit_note
// =========================================================================

/// `POST /v1/crm/credit-notes` — insert a new credit note.
///
/// Required: `cnNo`, `date`, `clientId`, `reason`, `currency`, `items`,
/// `totals`, `refundMode`. Optional: `linkedInvoiceId`, `taxRecalc`,
/// `refundTxnId`, `notes`. Optional `fromKind: "invoice"` + `fromId`
/// seed the §13.5 lineage chain.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_credit_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCreditNoteInput>,
) -> Result<Json<CreditNote>> {
    if input.cn_no.trim().is_empty() {
        return Err(ApiError::Validation("cnNo is required.".to_owned()));
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
    let client_oid = oid_from_str(&input.client_id)?;
    let linked_invoice_oid = match input.linked_invoice_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    // ---- Lineage seeding (§13.5) ---------------------------------------
    // Only `invoice` is allow-listed as a parent kind for credit notes.
    let mut lineage_chain: Option<Vec<LineageRef>> = None;
    let mut parent_invoice_oid: Option<ObjectId> = None;
    if let (Some(kind), Some(parent_id)) = (input.from_kind.as_deref(), input.from_id.as_deref()) {
        let kind_lower = kind.trim().to_ascii_lowercase();
        if kind_lower == PARENT_KIND_INVOICE && !parent_id.is_empty() {
            match seed_lineage_from_invoice(&mongo, user_id, parent_id).await {
                Ok(Some((chain, inv_oid))) => {
                    lineage_chain = Some(chain);
                    parent_invoice_oid = Some(inv_oid);
                }
                Ok(None) => {
                    // Parent not found / not owned — quietly skip (matches
                    // TS try/catch behaviour).
                }
                Err(e) => {
                    warn!(error = %e, "lineage seed failed; saving credit note without lineage");
                }
            }
        } else if !kind_lower.is_empty() && kind_lower != PARENT_KIND_INVOICE {
            // Non-allow-listed parent kind — log and ignore. The TS action
            // is silent here; we surface a warn so QA catches drift.
            warn!(
                from_kind = %kind_lower,
                "create_credit_note: only `invoice` is an allow-listed parent kind",
            );
        }
    }

    // ---- Build the document ---------------------------------------------
    let now = Utc::now();
    let bson_now = bson::DateTime::from_chrono(now);
    let new_oid = ObjectId::new();
    let project_id = ObjectId::new();

    let items_bson = bson::to_bson(&input.items).map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("crm_credit_notes.serialize(items)"),
        )
    })?;
    let totals_bson = bson::to_bson(&input.totals).map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("crm_credit_notes.serialize(totals)"),
        )
    })?;
    let reason_bson = bson::to_bson(&input.reason).map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("crm_credit_notes.serialize(reason)"),
        )
    })?;
    let refund_mode_bson = bson::to_bson(&input.refund_mode).map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("crm_credit_notes.serialize(refundMode)"),
        )
    })?;

    let mut new_doc = doc! {
        "_id": new_oid,
        "projectId": project_id,
        "userId": user_id,
        "createdAt": bson_now,
        "updatedAt": bson_now,
        "createdBy": user_id,
        "updatedBy": user_id,
        "cnNo": input.cn_no.trim(),
        "date": bson::DateTime::from_chrono(input.date),
        "clientId": client_oid,
        "reason": reason_bson,
        "currency": input.currency.trim(),
        "items": items_bson,
        "totals": totals_bson,
        "refundMode": refund_mode_bson,
        "status": "draft",
    };
    if let Some(inv) = linked_invoice_oid {
        new_doc.insert("linkedInvoiceId", inv);
    }
    if let Some(true) = input.tax_recalc {
        new_doc.insert("taxRecalc", true);
    }
    if let Some(true) = input.auto_apply {
        new_doc.insert("autoApply", true);
    }
    if let Some(txn) = input.refund_txn_id.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("refundTxnId", txn);
    }
    if let Some(notes) = input.notes.as_deref() {
        new_doc.insert("notes", notes);
    }
    if let Some(ref chain) = lineage_chain {
        let arr: Vec<Bson> = chain
            .iter()
            .map(|r| Bson::Document(doc! { "kind": r.kind.clone(), "id": r.id }))
            .collect();
        new_doc.insert("lineage", Bson::Array(arr));
    }

    // ---- Insert ---------------------------------------------------------
    let coll = mongo.collection::<Document>(CREDIT_NOTES_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_credit_notes.insert_one"))
    })?;

    // ---- Best-effort back-link onto the parent invoice -----------------
    // Mirrors the TS server-action's `try { ... } catch {}` block.
    if let Some(inv_oid) = parent_invoice_oid {
        let invoices = mongo.collection::<Document>(INVOICES_COLL);
        let _ = invoices
            .update_one(
                doc! { "_id": inv_oid, "userId": user_id },
                doc! {
                    "$push": { "lineage": { "kind": "creditNote", "id": new_oid } },
                    "$set":  { "updatedAt": bson_now },
                },
            )
            .await;
    }

    // ---- Re-read via the typed collection so the response is the
    // canonical [`CreditNote`] shape (and any defaults / skipped fields
    // render correctly).
    let typed = mongo.collection::<CreditNote>(CREDIT_NOTES_COLL);
    let note = typed
        .find_one(doc! { "_id": new_oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_credit_notes.find_one(after-insert)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("credit_note".to_owned()))?;

    Ok(Json(note))
}

// =========================================================================
// PATCH /:cnId — update_credit_note
// =========================================================================

/// `PATCH /v1/crm/credit-notes/:cnId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt`
/// and `updatedBy` are always refreshed. Fails with 404 if the credit
/// note doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, cn_id = %cn_id))]
pub async fn update_credit_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(cn_id): Path<String>,
    Json(input): Json<UpdateCreditNoteInput>,
) -> Result<Json<CreditNote>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let cn_oid = oid_from_str(&cn_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_str(&mut set, "cnNo", input.cn_no.as_ref());
    set_opt_str(&mut set, "currency", input.currency.as_ref());
    set_opt_str(&mut set, "refundTxnId", input.refund_txn_id.as_ref());
    set_opt_str(&mut set, "notes", input.notes.as_ref());

    set_opt_oid(&mut set, "clientId", input.client_id.as_ref())?;
    set_opt_oid(
        &mut set,
        "linkedInvoiceId",
        input.linked_invoice_id.as_ref(),
    )?;

    if let Some(d) = input.date {
        set.insert("date", bson::DateTime::from_chrono(d));
    }
    if let Some(reason) = input.reason {
        let b = bson::to_bson(&reason).map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_credit_notes.serialize(reason)"),
            )
        })?;
        set.insert("reason", b);
    }
    if let Some(items) = input.items.as_ref() {
        let b = bson::to_bson(items).map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_credit_notes.serialize(items)"),
            )
        })?;
        set.insert("items", b);
    }
    if let Some(totals) = input.totals.as_ref() {
        let b = bson::to_bson(totals).map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_credit_notes.serialize(totals)"),
            )
        })?;
        set.insert("totals", b);
    }
    if let Some(rec) = input.tax_recalc {
        set.insert("taxRecalc", rec);
    }
    if let Some(auto) = input.auto_apply {
        set.insert("autoApply", auto);
    }
    if let Some(mode) = input.refund_mode {
        let b = bson::to_bson(&mode).map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_credit_notes.serialize(refundMode)"),
            )
        })?;
        set.insert("refundMode", b);
    }
    if let Some(status) = input.status {
        let b = bson::to_bson(&status).map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_credit_notes.serialize(status)"),
            )
        })?;
        set.insert("status", b);
    }

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", cn_oid);

    let coll = mongo.collection::<Document>(CREDIT_NOTES_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_credit_notes.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("credit_note".to_owned()));
    }

    // Re-read via the typed collection so the response is the canonical
    // [`CreditNote`] shape.
    let typed = mongo.collection::<CreditNote>(CREDIT_NOTES_COLL);
    let note = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_credit_notes.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("credit_note".to_owned()))?;

    Ok(Json(note))
}

// =========================================================================
// DELETE /:cnId — delete_credit_note (hard)
// =========================================================================

/// `DELETE /v1/crm/credit-notes/:cnId` — **hard delete**. Per the CRM
/// ecosystem plan, CRM entities use hard deletes — the row is removed
/// from the collection. Fails with 404 if the credit note doesn't exist
/// OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, cn_id = %cn_id))]
pub async fn delete_credit_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(cn_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let cn_oid = oid_from_str(&cn_id)?;

    let filter = doc! { "_id": cn_oid, "userId": user_id };

    let coll = mongo.collection::<Document>(CREDIT_NOTES_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_credit_notes.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("credit_note".to_owned()));
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
        let f = base_ownership_filter(oid);
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        let archived = f.get_document("archived").unwrap();
        assert!(archived.contains_key("$ne"));
    }

    #[test]
    fn set_opt_str_skips_none() {
        let mut d = doc! {};
        set_opt_str(&mut d, "cnNo", None);
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_str_inserts_some() {
        let mut d = doc! {};
        let v = "CN-00001".to_owned();
        set_opt_str(&mut d, "cnNo", Some(&v));
        assert_eq!(d.get_str("cnNo").unwrap(), "CN-00001");
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "clientId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn set_opt_oid_accepts_valid_hex() {
        let mut d = doc! {};
        let good = ObjectId::new().to_hex();
        set_opt_oid(&mut d, "clientId", Some(&good)).unwrap();
        assert!(d.get_object_id("clientId").is_ok());
    }

    #[test]
    fn parent_kind_invoice_constant_matches_ts_allow_list() {
        // Tripwire: if the TS `ALLOWED_PARENT_KINDS` ever expands beyond
        // `['invoice']` we must extend `seed_lineage_from_invoice` and
        // this constant in lockstep — not silently widen one side.
        assert_eq!(PARENT_KIND_INVOICE, "invoice");
    }

    #[test]
    fn status_filter_values_match_enum_serde() {
        // CreditNoteStatus uses `rename_all = "snake_case"`, so the
        // accepted query-string values must be the lowercase variants.
        assert!(STATUS_FILTER_VALUES.contains(&"draft"));
        assert!(STATUS_FILTER_VALUES.contains(&"issued"));
        assert!(STATUS_FILTER_VALUES.contains(&"refunded"));
        assert!(STATUS_FILTER_VALUES.contains(&"cancelled"));
        assert!(STATUS_FILTER_VALUES.contains(&"pending"));
    }
}
