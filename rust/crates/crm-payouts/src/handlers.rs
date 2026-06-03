//! HTTP handlers for the §2.5 PayoutReceipt entity.
//!
//! Mirrors `src/app/actions/crm-payouts.actions.ts` — read-only research
//! reference; the TS file stays in production until the API host crate
//! routes traffic here. Five handlers:
//!
//! | Method  | Path                | Function           |
//! |---------|---------------------|--------------------|
//! | `GET`   | `/`                 | [`list_payouts`]   |
//! | `GET`   | `/:payoutId`        | [`get_payout`]     |
//! | `POST`  | `/`                 | [`create_payout`]  |
//! | `PATCH` | `/:payoutId`        | [`update_payout`]  |
//! | `DELETE`| `/:payoutId`        | [`delete_payout`]  |
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! — the CRM tenant root from `crm-core::Identity`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{Assignment, Audit, Identity, LineageRef, build_lineage_from_parent};
use crm_purchases_types::{PayoutReceipt, PayoutStatus};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::{instrument, warn};

use crate::dto::{CreatePayoutInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, UpdatePayoutInput};

/// Mongo collection name. Must match the TS `crm-payouts.actions.ts`
/// literal so the Rust BFF and the legacy Next.js action share the
/// same backing collection during the migration window.
const PAYOUTS_COLL: &str = "crm_payouts";

/// Parent-bill collection used for lineage seeding. Bills currently live
/// in `crm_bills` (per the §2.3 spec); the legacy TS action still reads
/// from `crm_expenses` during the migration window. We point at the new
/// canonical collection here — production rollout pairs this crate with
/// the bills migration.
const BILLS_COLL: &str = "crm_bills";

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

/// Validate the workflow status string against the [`PayoutStatus`]
/// enum. Returns `Ok(None)` when `raw` is `None` or empty so callers can
/// pipe straight into a query without an extra branch.
fn parse_status(raw: Option<&String>) -> Result<Option<PayoutStatus>> {
    let Some(s) = raw.map(|s| s.trim()).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    let lower = s.to_ascii_lowercase();
    match lower.as_str() {
        "sent" => Ok(Some(PayoutStatus::Sent)),
        "cleared" => Ok(Some(PayoutStatus::Cleared)),
        "failed" => Ok(Some(PayoutStatus::Failed)),
        _ => Err(ApiError::Validation(
            "status must be one of: sent, cleared, failed.".to_owned(),
        )),
    }
}

/// Serialize a [`PayoutStatus`] back to its lower-case wire form.
/// `serde_json::to_value` would also work but pulls in heavier
/// machinery for a 1-of-3 enum.
fn status_str(s: PayoutStatus) -> &'static str {
    match s {
        PayoutStatus::Sent => "sent",
        PayoutStatus::Cleared => "cleared",
        PayoutStatus::Failed => "failed",
    }
}

/// Fetch the parent bill (scoped by `userId`) and build the lineage
/// chain a freshly-created payout should inherit. Returns `Ok(None)` if
/// the bill doesn't exist or isn't owned by the caller.
async fn seed_lineage_from_bill(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    parent_id_hex: &str,
) -> Result<Option<(Vec<LineageRef>, ObjectId)>> {
    let bill_oid = oid_from_str(parent_id_hex)?;
    let bills = mongo.collection::<Document>(BILLS_COLL);
    let bill = match bills
        .find_one(doc! { "_id": bill_oid, "userId": user_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_bills.find_one(lineage)"))
        })? {
        Some(d) => d,
        None => return Ok(None),
    };

    // Existing lineage on the parent (if any) — passed through verbatim.
    let parent_chain: Vec<LineageRef> = bill
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

    let chain = build_lineage_from_parent("bill", bill_oid, &parent_chain);
    Ok(Some((chain, bill_oid)))
}

// =========================================================================
// GET / — list_payouts
// =========================================================================

/// `GET /v1/crm/payouts` — paginated list scoped to the authenticated
/// user's payouts. The `q` query param does a case-insensitive substring
/// search across `paymentNo`, `txnId`, `chequeNo`, and `reference`.
/// Optional `vendorId` and `status` filters narrow further. Sorted by
/// `date` desc to match the TS action.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_payouts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<PayoutReceipt>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);

    if let Some(vid) = q.vendor_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("vendorId", oid_from_str(vid)?);
    }
    if let Some(status) = parse_status(q.status.as_ref())? {
        filter.insert("status", status_str(status));
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "paymentNo": regex.clone() }),
                Bson::Document(doc! { "txnId": regex.clone() }),
                Bson::Document(doc! { "chequeNo": regex.clone() }),
                Bson::Document(doc! { "reference": regex }),
            ]),
        );
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "date": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<PayoutReceipt>(PAYOUTS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payouts.find")))?;
    let payouts: Vec<PayoutReceipt> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payouts.collect")))?;

    Ok(Json(payouts))
}

// =========================================================================
// GET /:payoutId — get_payout
// =========================================================================

/// `GET /v1/crm/payouts/:payoutId` — fetch a single payout. Returns 404
/// if the payout doesn't exist OR isn't owned by the caller (we
/// deliberately collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, payout_id = %payout_id))]
pub async fn get_payout(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(payout_id): Path<String>,
) -> Result<Json<PayoutReceipt>> {
    let user_id = user_oid(&user)?;
    let payout_oid = oid_from_str(&payout_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", payout_oid);

    let coll = mongo.collection::<PayoutReceipt>(PAYOUTS_COLL);
    let payout = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payouts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("payout".to_owned()))?;

    Ok(Json(payout))
}

// =========================================================================
// POST / — create_payout
// =========================================================================

/// `POST /v1/crm/payouts` — insert a new payout.
///
/// Builds a [`PayoutReceipt`] from the curated [`CreatePayoutInput`],
/// stamps `Identity` + `Audit`, optionally seeds `lineage[]` from a
/// parent bill, persists it, and returns the full document.
///
/// **Lineage seeding (mirrors §G7):**
///
/// 1. If `fromKind == "bill"` and `fromId` is set, seed from that bill.
/// 2. Else if `applyTo[]` is non-empty, seed from `applyTo[0].billId`.
/// 3. Else no lineage — payout is a standalone advance / pre-payment.
///
/// A best-effort back-link is also pushed onto the parent bill's
/// `lineage[]`. Failures are non-fatal — the payout still saves.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_payout(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePayoutInput>,
) -> Result<Json<PayoutReceipt>> {
    if input.payment_no.trim().is_empty() {
        return Err(ApiError::Validation("paymentNo is required.".to_owned()));
    }
    if input.currency.trim().is_empty() {
        return Err(ApiError::Validation("currency is required.".to_owned()));
    }
    if !input.amount.is_finite() {
        return Err(ApiError::Validation(
            "amount must be a finite number.".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        // Match the legacy single-tenant behaviour — mint a fresh OID so
        // existing UI keeps working during the migration window.
        None => ObjectId::new(),
    };

    let vendor_oid = oid_from_str(&input.vendor_id)?;
    let bank_account_oid = oid_from_str(&input.bank_account_id)?;

    // ---- Lineage seeding (§G7) ---------------------------------------
    //
    // Resolve the primary parent bill in priority order:
    //   1. explicit `fromKind="bill"` + `fromId`
    //   2. fallback: first id in `applyTo[]`
    let resolved_parent: Option<String> = match (
        input.from_kind.as_deref(),
        input.from_id.as_deref().filter(|s| !s.is_empty()),
    ) {
        (Some(kind), Some(parent_id)) if kind.eq_ignore_ascii_case("bill") => {
            Some(parent_id.to_owned())
        }
        _ if !input.apply_to.is_empty() => Some(input.apply_to[0].bill_id.to_hex()),
        _ => None,
    };

    let mut lineage_chain: Vec<LineageRef> = Vec::new();
    let mut parent_bill_oid: Option<ObjectId> = None;
    if let Some(parent_id_hex) = resolved_parent.as_deref() {
        match seed_lineage_from_bill(&mongo, user_id, parent_id_hex).await {
            Ok(Some((chain, bill_oid))) => {
                lineage_chain = chain;
                parent_bill_oid = Some(bill_oid);
            }
            Ok(None) => {
                // Parent not found / not owned — quietly skip.
            }
            Err(e) => {
                warn!(error = %e, "lineage seed failed; saving payout without lineage");
            }
        }
    }

    // Forward-compat: warn on unrecognised `fromKind` so future callers
    // don't silently drift past the allowed set.
    if let Some(kind) = input.from_kind.as_deref() {
        if !kind.eq_ignore_ascii_case("bill") {
            warn!(
                from_kind = kind,
                "create_payout: unrecognised fromKind; only 'bill' is honoured"
            );
        }
    }

    let new_oid = ObjectId::new();
    let payout = PayoutReceipt {
        identity: Identity {
            id: new_oid,
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        assignment: Assignment::default(),
        payment_no: input.payment_no.trim().to_owned(),
        date: input.date,
        vendor_id: vendor_oid,
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
        notes: input.notes.clone(),
        attachments: Vec::new(),
        status: PayoutStatus::default(),
        lineage: lineage_chain,
    };

    let coll = mongo.collection::<PayoutReceipt>(PAYOUTS_COLL);
    coll.insert_one(&payout)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payouts.insert_one")))?;

    // Best-effort back-link onto the parent bill's lineage. Non-fatal —
    // mirrors the TS server-action's `try { ... } catch {}` block.
    if let Some(bill_oid) = parent_bill_oid {
        let bills = mongo.collection::<Document>(BILLS_COLL);
        let now = bson::DateTime::from_chrono(Utc::now());
        let _ = bills
            .update_one(
                doc! { "_id": bill_oid, "userId": user_id },
                doc! {
                    "$push": { "lineage": { "kind": "payout", "id": new_oid } },
                    "$set":  { "updatedAt": now },
                },
            )
            .await;
    }

    Ok(Json(payout))
}

// =========================================================================
// PATCH /:payoutId — update_payout
// =========================================================================

/// `PATCH /v1/crm/payouts/:payoutId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt` and
/// `updatedBy` are always refreshed. Fails with 404 if the payout
/// doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, payout_id = %payout_id))]
pub async fn update_payout(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(payout_id): Path<String>,
    Json(input): Json<UpdatePayoutInput>,
) -> Result<Json<PayoutReceipt>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }
    if let Some(amt) = input.amount {
        if !amt.is_finite() {
            return Err(ApiError::Validation(
                "amount must be a finite number.".to_owned(),
            ));
        }
    }

    let user_id = user_oid(&user)?;
    let payout_oid = oid_from_str(&payout_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_str(&mut set, "paymentNo", input.payment_no.as_ref());
    set_opt_str(&mut set, "chequeNo", input.cheque_no.as_ref());
    set_opt_str(&mut set, "txnId", input.txn_id.as_ref());
    set_opt_str(&mut set, "reference", input.reference.as_ref());
    set_opt_str(&mut set, "currency", input.currency.as_ref());
    set_opt_str(&mut set, "notes", input.notes.as_ref());
    set_opt_oid(&mut set, "vendorId", input.vendor_id.as_ref())?;
    set_opt_oid(&mut set, "bankAccountId", input.bank_account_id.as_ref())?;

    if let Some(d) = input.date {
        set.insert("date", bson::DateTime::from_chrono(d));
    }
    if let Some(d) = input.cheque_date {
        set.insert("chequeDate", bson::DateTime::from_chrono(d));
    }
    if let Some(amt) = input.amount {
        set.insert("amount", amt);
    }
    if let Some(mode) = input.mode {
        // Re-serialize via bson so the wire form matches the stored
        // representation (lower-case enum string).
        set.insert(
            "mode",
            bson::to_bson(&mode).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("payout.mode.bson"))
            })?,
        );
    }
    if let Some(excess) = input.excess_as_advance {
        set.insert("excessAsAdvance", excess);
    }
    if let Some(tds) = input.tds_deducted {
        set.insert("tdsDeducted", tds);
    }
    if let Some(applies) = input.apply_to.as_ref() {
        let arr: Vec<Bson> = applies
            .iter()
            .map(|a| {
                Bson::Document(doc! {
                    "billId": a.bill_id,
                    "amount": a.amount,
                })
            })
            .collect();
        set.insert("applyTo", Bson::Array(arr));
    }
    if let Some(s) = input.status {
        set.insert("status", status_str(s));
    }

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", payout_oid);

    let coll = mongo.collection::<Document>(PAYOUTS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payouts.update_one")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("payout".to_owned()));
    }

    // Re-read via the typed collection so the response is the canonical
    // [`PayoutReceipt`] shape.
    let typed = mongo.collection::<PayoutReceipt>(PAYOUTS_COLL);
    let payout = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payouts.find_one(after-update)"))
        })?
        .ok_or_else(|| ApiError::NotFound("payout".to_owned()))?;

    Ok(Json(payout))
}

// =========================================================================
// DELETE /:payoutId — delete_payout
// =========================================================================

/// `DELETE /v1/crm/payouts/:payoutId` — **hard delete**. Per the CRM
/// ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities use
/// hard deletes — the row is removed from the collection. Fails with
/// 404 if the payout doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, payout_id = %payout_id))]
pub async fn delete_payout(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(payout_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let payout_oid = oid_from_str(&payout_id)?;

    let filter = doc! { "_id": payout_oid, "userId": user_id };

    let coll = mongo.collection::<Document>(PAYOUTS_COLL);
    let res = coll
        .delete_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payouts.delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("payout".to_owned()));
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
        set_opt_str(&mut d, "paymentNo", None);
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_str_inserts_some() {
        let mut d = doc! {};
        let v = "PAY-1".to_owned();
        set_opt_str(&mut d, "paymentNo", Some(&v));
        assert_eq!(d.get_str("paymentNo").unwrap(), "PAY-1");
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "vendorId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn parse_status_accepts_known_variants() {
        let s = "Cleared".to_owned();
        let parsed = parse_status(Some(&s)).unwrap();
        assert!(matches!(parsed, Some(PayoutStatus::Cleared)));
    }

    #[test]
    fn parse_status_rejects_unknown() {
        let s = "bogus".to_owned();
        let err = parse_status(Some(&s)).unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
    }

    #[test]
    fn parse_status_returns_none_for_empty() {
        assert!(parse_status(None).unwrap().is_none());
        let blank = "  ".to_owned();
        assert!(parse_status(Some(&blank)).unwrap().is_none());
    }

    #[test]
    fn status_str_round_trips() {
        assert_eq!(status_str(PayoutStatus::Sent), "sent");
        assert_eq!(status_str(PayoutStatus::Cleared), "cleared");
        assert_eq!(status_str(PayoutStatus::Failed), "failed");
    }
}
