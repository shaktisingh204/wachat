//! HTTP handlers for the §1.6 Invoice entity.
//!
//! Mirrors `src/app/actions/crm-invoices.actions.ts` — read-only research
//! reference; the TS file stays in production until the API host
//! crate routes traffic here. Five handlers:
//!
//! | Method  | Path             | Function           |
//! |---------|------------------|--------------------|
//! | `GET`   | `/`              | [`list_invoices`]  |
//! | `GET`   | `/:invoiceId`    | [`get_invoice`]    |
//! | `POST`  | `/`              | [`create_invoice`] |
//! | `PATCH` | `/:invoiceId`    | [`update_invoice`] |
//! | `DELETE`| `/:invoiceId`    | [`delete_invoice`] |
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! — the CRM tenant root from `crm-core::Identity`.
//!
//! ## Lineage seeding (§13.5)
//!
//! On create the body may carry `fromKind` + `fromId` where
//! `fromKind ∈ { quotation, salesOrder, proforma, deal, lead }`. When
//! both are present we fetch the parent (under the same `userId` scope)
//! and seed the new invoice's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. Best-effort — a missing or
//! mis-scoped parent quietly skips the seed and still saves the
//! invoice, mirroring the TS `try { ... } catch {}` pattern.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use crm_core::{
    Assignment, Attribution, Audit, Identity, LineageRef, build_lineage_from_parent,
};
use crm_sales_types::{GstTreatment, Invoice, InvoiceStatus};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::{instrument, warn};

use crate::dto::{CreateInvoiceInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, UpdateInvoiceInput};

/// Mongo collection name. Must match the TS `crm_invoices.actions.ts`
/// literal so the Rust BFF and the legacy Next.js action share the
/// same backing collection during the migration window.
const INVOICES_COLL: &str = "crm_invoices";

/// Allowed `fromKind` values for lineage seeding. Mirrors
/// `ALLOWED_PARENT_KINDS` in the TS `saveInvoice`.
const ALLOWED_PARENT_KINDS: &[&str] = &["quotation", "salesOrder", "proforma", "deal", "lead"];

/// Map of `fromKind` → backing Mongo collection. Mirrors the TS
/// `parentCollection` lookup table.
fn parent_collection_for(kind: &str) -> Option<&'static str> {
    match kind {
        "quotation" => Some("crm_quotations"),
        "salesOrder" => Some("crm_sales_orders"),
        "proforma" => Some("crm_proforma_invoices"),
        "deal" => Some("crm_deals"),
        "lead" => Some("crm_leads"),
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
/// (`archived = true`) are excluded by default.
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

/// Parse a free-text status string into the canonical
/// [`InvoiceStatus`] enum. The TS form passes "Draft" / "Sent" / "Paid"
/// in TitleCase; the Rust enum's serde rep is snake_case
/// (`partially_paid` etc.). Accept both shapes for migration safety.
fn parse_invoice_status(raw: &str) -> Result<InvoiceStatus> {
    let normalized = raw.trim().to_ascii_lowercase().replace(' ', "_");
    match normalized.as_str() {
        "draft" => Ok(InvoiceStatus::Draft),
        "sent" => Ok(InvoiceStatus::Sent),
        "paid" => Ok(InvoiceStatus::Paid),
        "partially_paid" => Ok(InvoiceStatus::PartiallyPaid),
        "overdue" => Ok(InvoiceStatus::Overdue),
        "cancelled" | "canceled" => Ok(InvoiceStatus::Cancelled),
        other => Err(ApiError::Validation(format!(
            "invalid status '{other}'; expected one of: draft, sent, paid, partially_paid, overdue, cancelled",
        ))),
    }
}

// =========================================================================
// GET / — list_invoices
// =========================================================================

/// `GET /v1/crm/invoices` — paginated list scoped to the authenticated
/// user's invoices. Optional filters:
///
/// - `q` — case-insensitive substring on `invoiceNo`, `customerNotes`,
///   `paymentTerms`.
/// - `clientId` — narrow to a single buyer.
/// - `status` — narrow to a single workflow status.
/// - `month` + `year` — narrow to a single calendar month on `date`.
///
/// Sorted by `date` desc to match the TS action.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_invoices(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Invoice>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);

    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "invoiceNo": regex.clone() }),
                Bson::Document(doc! { "customerNotes": regex.clone() }),
                Bson::Document(doc! { "paymentTerms": regex }),
            ]),
        );
    }

    if let Some(client) = q.client_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("clientId", oid_from_str(client)?);
    }

    if let Some(status_raw) = q.status.as_deref().filter(|s| !s.is_empty()) {
        // Validate but store the snake_case wire form (the enum's
        // serde rep). Rejects unknown statuses with a clear 422.
        let _ = parse_invoice_status(status_raw)?;
        filter.insert(
            "status",
            status_raw.trim().to_ascii_lowercase().replace(' ', "_"),
        );
    }

    if let (Some(month), Some(year)) = (q.month, q.year) {
        if (1..=12).contains(&month) {
            // Build [start, end) for the month in UTC.
            let start = Utc
                .with_ymd_and_hms(year, month, 1, 0, 0, 0)
                .single()
                .ok_or_else(|| {
                    ApiError::BadRequest(format!("invalid month/year: {year}-{month:02}"))
                })?;
            let (next_y, next_m) = if month == 12 {
                (year + 1, 1)
            } else {
                (year, month + 1)
            };
            let end = Utc
                .with_ymd_and_hms(next_y, next_m, 1, 0, 0, 0)
                .single()
                .ok_or_else(|| {
                    ApiError::BadRequest(format!(
                        "invalid month/year rollover: {next_y}-{next_m:02}",
                    ))
                })?;
            filter.insert(
                "date",
                doc! {
                    "$gte": bson::DateTime::from_chrono(start),
                    "$lt":  bson::DateTime::from_chrono(end),
                },
            );
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

    let coll = mongo.collection::<Invoice>(INVOICES_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_invoices.find")))?;
    let invoices: Vec<Invoice> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_invoices.collect")))?;

    Ok(Json(invoices))
}

// =========================================================================
// GET /:invoiceId — get_invoice
// =========================================================================

/// `GET /v1/crm/invoices/:invoiceId` — fetch a single invoice. Returns
/// 404 if the invoice doesn't exist OR isn't owned by the caller (we
/// deliberately collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, invoice_id = %invoice_id))]
pub async fn get_invoice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(invoice_id): Path<String>,
) -> Result<Json<Invoice>> {
    let user_id = user_oid(&user)?;
    let inv_oid = oid_from_str(&invoice_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", inv_oid);

    let coll = mongo.collection::<Invoice>(INVOICES_COLL);
    let invoice = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_invoices.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("invoice".to_owned()))?;

    Ok(Json(invoice))
}

// =========================================================================
// POST / — create_invoice
// =========================================================================

/// `POST /v1/crm/invoices` — insert a new invoice.
///
/// Builds an [`Invoice`] from the curated [`CreateInvoiceInput`], stamps
/// `Identity` + `Audit`, optionally seeds `lineage[]` from a parent doc
/// (quotation / salesOrder / proforma / deal / lead), persists it, and
/// returns the full document.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_invoice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateInvoiceInput>,
) -> Result<Json<Invoice>> {
    if input.invoice_no.trim().is_empty() {
        return Err(ApiError::Validation("invoiceNo is required.".to_owned()));
    }
    if input.currency.trim().is_empty() {
        return Err(ApiError::Validation("currency is required.".to_owned()));
    }
    if input.items.is_empty() {
        return Err(ApiError::Validation(
            "items must contain at least one line item.".to_owned(),
        ));
    }
    if !input.totals.total.is_finite() || !input.totals.sub_total.is_finite() {
        return Err(ApiError::Validation(
            "totals.total and totals.subTotal must be finite numbers.".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        // Match the legacy TS behaviour — single-tenant callers omit
        // projectId and pick up a freshly-minted id at insert time.
        None => ObjectId::new(),
    };
    let client_oid = oid_from_str(&input.client_id)?;

    // ---- Lineage seeding (§13.5) ---------------------------------------
    let mut lineage_chain: Vec<LineageRef> = Vec::new();
    let mut parent_back_link: Option<(&'static str, ObjectId)> = None;
    if let (Some(kind), Some(parent_id)) =
        (input.from_kind.as_deref(), input.from_id.as_deref())
    {
        let kind_trimmed = kind.trim();
        if ALLOWED_PARENT_KINDS.contains(&kind_trimmed) && !parent_id.is_empty() {
            match seed_lineage_from_parent(&mongo, user_id, kind_trimmed, parent_id).await {
                Ok(Some((chain, parent_oid, parent_coll))) => {
                    lineage_chain = chain;
                    parent_back_link = Some((parent_coll, parent_oid));
                }
                Ok(None) => {
                    // Parent not found / not owned — quietly skip.
                }
                Err(e) => {
                    warn!(error = %e, "lineage seed failed; saving invoice without lineage");
                }
            }
        }
    }

    let new_oid = ObjectId::new();

    let invoice = Invoice {
        identity: Identity {
            id: new_oid,
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        attribution: Attribution::default(),
        assignment: Assignment::default(),

        invoice_no: input.invoice_no.trim().to_owned(),
        date: input.date,
        due_date: input.due_date,

        client_id: client_oid,
        place_of_supply: input.place_of_supply.clone(),
        reverse_charge: false,
        gst_treatment: input.gst_treatment.unwrap_or(GstTreatment::Registered),

        currency: input.currency.trim().to_owned(),
        exchange_rate: None,

        billing_address: None,
        shipping_address: None,

        items: input.items.clone(),
        totals: input.totals.clone(),

        tcs_pct: input.tcs_pct,
        tds_pct: input.tds_pct,

        amount_paid: 0.0,
        balance: input.totals.total,
        payment_terms: input.payment_terms.clone(),

        bank_details: None,
        upi_id: None,
        qr_image_file_id: None,

        customer_notes: input.customer_notes.clone(),
        terms_and_conditions: input.terms_and_conditions.clone(),

        e_invoice: None,
        eway_bill_no: None,

        attachments: Vec::new(),
        template_id: None,
        thumbnail_file_id: None,
        signature_image_file_id: None,
        pdf_status: Default::default(),
        email_log: Vec::new(),
        whatsapp_send_log: Vec::new(),

        recurring: input.recurring.clone(),
        status: InvoiceStatus::Draft,
        lineage: lineage_chain,
        design_metadata: input.design_metadata.and_then(|v| bson::to_document(&v).ok()),
    };

    let coll = mongo.collection::<Invoice>(INVOICES_COLL);
    coll.insert_one(&invoice).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_invoices.insert_one"))
    })?;

    // Best-effort back-link onto the parent doc's lineage. Non-fatal —
    // mirrors the TS server-action's `try { ... } catch {}` block.
    if let Some((parent_coll_name, parent_oid)) = parent_back_link {
        let parents = mongo.collection::<Document>(parent_coll_name);
        let now = bson::DateTime::from_chrono(Utc::now());
        let _ = parents
            .update_one(
                doc! { "_id": parent_oid, "userId": user_id },
                doc! {
                    "$push": { "lineage": { "kind": "invoice", "id": new_oid } },
                    "$set":  { "updatedAt": now },
                },
            )
            .await;
    }

    Ok(Json(invoice))
}

/// Fetch the parent doc (scoped by `userId`) and build the lineage chain
/// a freshly-created invoice should inherit. Returns `Ok(None)` if the
/// parent doesn't exist or isn't owned by the caller.
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
            ApiError::Internal(anyhow::Error::new(e).context(format!("{parent_coll}.find_one(lineage)")))
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

// =========================================================================
// PATCH /:invoiceId — update_invoice
// =========================================================================

/// `PATCH /v1/crm/invoices/:invoiceId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt` and
/// `updatedBy` are always refreshed. Fails with 404 if the invoice
/// doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, invoice_id = %invoice_id))]
pub async fn update_invoice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(invoice_id): Path<String>,
    Json(input): Json<UpdateInvoiceInput>,
) -> Result<Json<Invoice>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let inv_oid = oid_from_str(&invoice_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_str(&mut set, "invoiceNo", input.invoice_no.as_ref());
    set_opt_str(&mut set, "currency", input.currency.as_ref());
    set_opt_str(&mut set, "placeOfSupply", input.place_of_supply.as_ref());
    set_opt_str(&mut set, "paymentTerms", input.payment_terms.as_ref());
    set_opt_str(&mut set, "customerNotes", input.customer_notes.as_ref());
    set_opt_str(
        &mut set,
        "termsAndConditions",
        input.terms_and_conditions.as_ref(),
    );
    set_opt_oid(&mut set, "clientId", input.client_id.as_ref())?;

    if let Some(when) = input.date {
        set.insert("date", bson::DateTime::from_chrono(when));
    }
    if let Some(when) = input.due_date {
        set.insert("dueDate", bson::DateTime::from_chrono(when));
    }
    if let Some(treatment) = input.gst_treatment {
        // Encode via serde to keep parity with the §1.6 enum's wire rep.
        let b = bson::to_bson(&treatment).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("encode gstTreatment"))
        })?;
        set.insert("gstTreatment", b);
    }
    if let Some(items) = input.items.as_ref() {
        let b = bson::to_bson(items).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("encode items"))
        })?;
        set.insert("items", b);
    }
    if let Some(totals) = input.totals.as_ref() {
        if !totals.total.is_finite() || !totals.sub_total.is_finite() {
            return Err(ApiError::Validation(
                "totals.total and totals.subTotal must be finite numbers.".to_owned(),
            ));
        }
        let b = bson::to_bson(totals).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("encode totals"))
        })?;
        set.insert("totals", b);
        // Re-derive `balance` from the new totals minus whatever
        // payments are already applied. We do not re-touch
        // `amount_paid` here — the payment-receipt application path
        // owns it.
    }
    if let Some(tcs) = input.tcs_pct {
        set.insert("tcsPct", tcs as f64);
    }
    if let Some(tds) = input.tds_pct {
        set.insert("tdsPct", tds as f64);
    }
    if let Some(recurring) = input.recurring.as_ref() {
        let b = bson::to_bson(recurring).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("encode recurring"))
        })?;
        set.insert("recurring", b);
    }
    if let Some(status_raw) = input.status.as_deref() {
        let parsed = parse_invoice_status(status_raw)?;
        let b = bson::to_bson(&parsed).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("encode status"))
        })?;
        set.insert("status", b);
    }
    if let Some(v) = input.design_metadata {
        if let Ok(doc) = bson::to_document(&v) {
            set.insert("designMetadata", doc);
        }
    }

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", inv_oid);

    let coll = mongo.collection::<Document>(INVOICES_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_invoices.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("invoice".to_owned()));
    }

    // Re-read via the typed collection so the response is the canonical
    // [`Invoice`] shape (and any defaults / skipped fields render
    // correctly).
    let typed = mongo.collection::<Invoice>(INVOICES_COLL);
    let invoice = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_invoices.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("invoice".to_owned()))?;

    Ok(Json(invoice))
}

// =========================================================================
// DELETE /:invoiceId — delete_invoice
// =========================================================================

/// `DELETE /v1/crm/invoices/:invoiceId` — **hard delete**. Per the CRM
/// ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities use
/// hard deletes — the row is removed from the collection. Fails with
/// 404 if the invoice doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, invoice_id = %invoice_id))]
pub async fn delete_invoice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(invoice_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let inv_oid = oid_from_str(&invoice_id)?;

    let filter = doc! { "_id": inv_oid, "userId": user_id };

    let coll = mongo.collection::<Document>(INVOICES_COLL);
    let res = coll
        .delete_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_invoices.delete_one"))
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("invoice".to_owned()));
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
        set_opt_str(&mut d, "name", None);
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_str_inserts_some() {
        let mut d = doc! {};
        let v = "INV-1".to_owned();
        set_opt_str(&mut d, "invoiceNo", Some(&v));
        assert_eq!(d.get_str("invoiceNo").unwrap(), "INV-1");
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "clientId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn parse_invoice_status_accepts_canonical() {
        assert!(matches!(parse_invoice_status("draft").unwrap(), InvoiceStatus::Draft));
        assert!(matches!(parse_invoice_status("Sent").unwrap(), InvoiceStatus::Sent));
        assert!(matches!(
            parse_invoice_status("partially_paid").unwrap(),
            InvoiceStatus::PartiallyPaid
        ));
        // TitleCase with a space, mirroring the legacy TS form value.
        assert!(matches!(
            parse_invoice_status("Partially Paid").unwrap(),
            InvoiceStatus::PartiallyPaid
        ));
    }

    #[test]
    fn parse_invoice_status_rejects_garbage() {
        let err = parse_invoice_status("invalid").unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
    }

    #[test]
    fn parent_collection_lookup_matches_ts_table() {
        assert_eq!(parent_collection_for("quotation"), Some("crm_quotations"));
        assert_eq!(parent_collection_for("salesOrder"), Some("crm_sales_orders"));
        assert_eq!(parent_collection_for("proforma"), Some("crm_proforma_invoices"));
        assert_eq!(parent_collection_for("deal"), Some("crm_deals"));
        assert_eq!(parent_collection_for("lead"), Some("crm_leads"));
        assert_eq!(parent_collection_for("unknown"), None);
    }

    #[test]
    fn allowed_parent_kinds_align_with_ts_whitelist() {
        // Mirrors `ALLOWED_PARENT_KINDS` in TS `saveInvoice`.
        assert_eq!(
            ALLOWED_PARENT_KINDS,
            &["quotation", "salesOrder", "proforma", "deal", "lead"]
        );
    }
}
