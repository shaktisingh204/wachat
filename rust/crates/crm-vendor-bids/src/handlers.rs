//! HTTP handlers for the §12.3 Vendor Bid entity.
//!
//! Five handlers — same shape as the sister `crm-purchase-orders` /
//! `crm-leads` crates:
//!
//! | Method  | Path             | Function                |
//! |---------|------------------|-------------------------|
//! | `GET`   | `/`              | [`list_vendor_bids`]    |
//! | `GET`   | `/:bidId`        | [`get_vendor_bid`]      |
//! | `POST`  | `/`              | [`create_vendor_bid`]   |
//! | `PATCH` | `/:bidId`        | [`update_vendor_bid`]   |
//! | `DELETE`| `/:bidId`        | [`delete_vendor_bid`]   |
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! — the CRM tenant root from `crm-core::Identity`.
//!
//! ## Lineage seeding (§13.5)
//!
//! Unlike Purchase Orders, a Vendor Bid has exactly one lineage parent
//! kind — the RFQ it was submitted against. The create handler resolves
//! the RFQ under the same `userId` scope and seeds `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. A back-link is pushed onto
//! the parent RFQ's `lineage[]` so the RFQ detail page can list its
//! bids without a reverse query.
//!
//! A missing or mis-scoped parent FAILS the create — every bid MUST be
//! attached to an existing, owned RFQ. This differs from the PO
//! crate's silent-skip policy because RFQ is a hard requirement here,
//! not an optional convenience.
//!
//! ## Award cascade
//!
//! When a PATCH flips `status` to `"awarded"`, we also `update_one` the
//! parent RFQ's `status` to `"awarded"`. Best-effort — failure is
//! logged but does NOT roll back the bid update; the bid is the
//! authoritative record.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{Audit, Identity, LineageRef, build_lineage_from_parent};
use crm_extras_types::VendorBid;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::{instrument, warn};

use crate::dto::{
    ALLOWED_STATUSES, CreateVendorBidInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT,
    UpdateVendorBidInput,
};

/// Mongo collection name. Must match the §12.3 spec literal so the
/// Rust BFF and any Next.js action share the same backing collection.
const VENDOR_BIDS_COLL: &str = "crm_vendor_bids";

/// Lineage parent collection — RFQs (Request-For-Quote broadcasts).
/// Every bid has exactly one RFQ parent.
const RFQS_COLL: &str = "crm_rfqs";

/// Lineage `kind` token for back-links onto the parent RFQ. Mirrors the
/// §13.5 dictionary in `src/lib/lineage.ts`.
const BID_LINEAGE_KIND: &str = "vendorBid";

/// Lineage `kind` token used when seeding a fresh bid's `lineage[]`
/// from its parent RFQ. Stays in sync with the §13.5 dictionary.
const RFQ_LINEAGE_KIND: &str = "rfq";

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

/// Optional-string update helper. PATCH semantics — absent ≠ `null`.
fn set_opt_str(set: &mut Document, key: &str, val: Option<&String>) {
    if let Some(v) = val {
        set.insert(key, v.as_str());
    }
}

/// Convert a `serde_json::Value` into a `Bson` for `$set`. Rejects
/// payloads that can't round-trip into BSON (NaN floats, etc.).
fn json_to_bson(v: &serde_json::Value, ctx: &'static str) -> Result<Bson> {
    bson::to_bson(v)
        .map_err(|e| ApiError::Validation(format!("{ctx} did not serialise to BSON: {e}")))
}

/// Fetch the parent RFQ (scoped by `userId`) and build the lineage
/// chain a freshly-created bid should inherit. Returns the inherited
/// chain plus the parent OID for the back-link push that follows.
///
/// **Strict** — unlike the PO crate, a missing/mis-scoped parent here
/// is fatal: the bid simply cannot exist without an RFQ. Returns
/// `NotFound("rfq")` so the UI can surface "the RFQ was deleted /
/// belongs to another user".
async fn resolve_rfq_parent(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    rfq_oid: ObjectId,
) -> Result<(Vec<LineageRef>, ObjectId)> {
    let coll = mongo.collection::<Document>(RFQS_COLL);
    let parent = coll
        .find_one(doc! { "_id": rfq_oid, "userId": user_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_rfqs.find_one(lineage)"))
        })?
        .ok_or_else(|| ApiError::NotFound("rfq".to_owned()))?;

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

    let chain = build_lineage_from_parent(RFQ_LINEAGE_KIND, rfq_oid, &parent_chain);
    Ok((chain, rfq_oid))
}

// =========================================================================
// GET / — list_vendor_bids
// =========================================================================

/// `GET /v1/crm/vendor-bids` — paginated list scoped to the
/// authenticated user's bids. The `q` query param does a
/// case-insensitive substring search across `vendorName` and `terms`.
/// `rfqId`, `vendorId`, and `status` narrow further. Sorted by
/// `createdAt` desc.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_vendor_bids(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<VendorBid>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "vendorName": regex.clone() }),
                Bson::Document(doc! { "terms": regex }),
            ]),
        );
    }
    if let Some(rid) = q.rfq_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("rfqId", oid_from_str(rid)?);
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

    let coll = mongo.collection::<VendorBid>(VENDOR_BIDS_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_vendor_bids.find"))
        })?;
    let bids: Vec<VendorBid> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_vendor_bids.collect"))
    })?;

    Ok(Json(bids))
}

// =========================================================================
// GET /:bidId — get_vendor_bid
// =========================================================================

/// `GET /v1/crm/vendor-bids/:bidId` — fetch a single bid. Returns 404
/// if the bid doesn't exist OR isn't owned by the caller (we
/// deliberately collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, bid_id = %bid_id))]
pub async fn get_vendor_bid(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(bid_id): Path<String>,
) -> Result<Json<VendorBid>> {
    let user_id = user_oid(&user)?;
    let bid_oid = oid_from_str(&bid_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", bid_oid);

    let coll = mongo.collection::<VendorBid>(VENDOR_BIDS_COLL);
    let bid = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_vendor_bids.find_one")))?
        .ok_or_else(|| ApiError::NotFound("vendorBid".to_owned()))?;

    Ok(Json(bid))
}

// =========================================================================
// POST / — create_vendor_bid
// =========================================================================

/// `POST /v1/crm/vendor-bids` — insert a new bid.
///
/// Builds the document directly (rather than going through the typed
/// [`VendorBid`] struct) so the curated input shape doesn't drag in
/// `crm-extras-types::BidLineItem` / `Totals` as a hard dep — `items[]`
/// and `totals` are passed through verbatim from the wire JSON. The
/// handler stamps `Identity` + `Audit`, resolves the parent RFQ to
/// seed lineage, persists the bid, then best-effort back-links the
/// bid id onto the parent RFQ's `lineage[]`. Status defaults to
/// `submitted`; `submittedAt` is stamped at insert time.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_vendor_bid(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateVendorBidInput>,
) -> Result<Json<VendorBid>> {
    // ---- Required-field validation -----------------------------------
    if input.rfq_id.trim().is_empty() {
        return Err(ApiError::Validation("rfqId is required.".to_owned()));
    }
    if input.vendor_id.trim().is_empty() {
        return Err(ApiError::Validation("vendorId is required.".to_owned()));
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
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        // The §12.3 spec requires a project scope, but we mint a fresh
        // OID for legacy single-tenant callers that omit it. The UI is
        // expected to supply a real projectId in production.
        None => ObjectId::new(),
    };
    let rfq_oid = oid_from_str(&input.rfq_id)?;
    let vendor_oid = oid_from_str(&input.vendor_id)?;

    // ---- Lineage seeding (§13.5) — strict, NOT best-effort -----------
    // Every bid MUST attach to an existing, owned RFQ.
    let (lineage, parent_oid) = resolve_rfq_parent(&mongo, user_id, rfq_oid).await?;
    let lineage_array: Vec<Bson> = lineage
        .into_iter()
        .map(|r| Bson::Document(doc! { "kind": r.kind, "id": r.id }))
        .collect();

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

    let items_bson = json_to_bson(&serde_json::Value::Array(input.items.clone()), "items")?;
    let totals_bson = match input.totals.as_ref() {
        Some(v) => json_to_bson(v, "totals")?,
        None => Bson::Document(Document::new()),
    };

    let mut new_doc = Document::new();
    new_doc.extend(identity_doc);
    new_doc.extend(audit_doc);
    new_doc.insert("rfqId", rfq_oid);
    new_doc.insert("vendorId", vendor_oid);
    new_doc.insert("items", items_bson);
    new_doc.insert("totals", totals_bson);
    new_doc.insert("currency", input.currency.trim());
    if let Some(t) = input.terms.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("terms", t);
    }
    if let Some(atts) = input.attachments.as_ref() {
        new_doc.insert(
            "attachments",
            json_to_bson(&serde_json::Value::Array(atts.clone()), "attachments")?,
        );
    }
    if let Some(name) = input.vendor_name.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("vendorName", name);
    }
    new_doc.insert("status", "submitted");
    new_doc.insert("submittedAt", now);
    new_doc.insert("lineage", Bson::Array(lineage_array));

    // The `Identity` serialization above stamps `_id: ObjectId`
    // already (see `crm_core::Identity` — `id` is renamed to `_id`).
    // Sanity-check by overwriting with the freshly minted oid so an
    // upstream change to `Identity` doesn't silently break us.
    new_doc.insert("_id", new_oid);

    let raw_coll = mongo.collection::<Document>(VENDOR_BIDS_COLL);
    raw_coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_vendor_bids.insert_one"))
    })?;

    // ---- Best-effort back-link onto the parent RFQ -------------------
    // Mirrors the pattern in `crm-purchase-orders::create_purchase_order`.
    // Failure is non-fatal — a missing back-link surfaces as a UI lag,
    // not a data corruption.
    let rfq_coll = mongo.collection::<Document>(RFQS_COLL);
    if let Err(e) = rfq_coll
        .update_one(
            doc! { "_id": parent_oid, "userId": user_id },
            doc! {
                "$push": { "lineage": { "kind": BID_LINEAGE_KIND, "id": new_oid } },
                "$set":  { "updatedAt": now },
            },
        )
        .await
    {
        warn!(
            error = %e,
            rfq_id = %parent_oid,
            bid_id = %new_oid,
            "back-link push onto parent RFQ failed; bid still saved",
        );
    }

    // Re-read via the typed collection so the response shape is stable.
    let typed = mongo.collection::<VendorBid>(VENDOR_BIDS_COLL);
    let bid = typed
        .find_one(doc! { "_id": new_oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_vendor_bids.find_one(after-insert)"),
            )
        })?
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!(
                "freshly-inserted vendor bid disappeared during re-read"
            ))
        })?;

    Ok(Json(bid))
}

// =========================================================================
// PATCH /:bidId — update_vendor_bid
// =========================================================================

/// `PATCH /v1/crm/vendor-bids/:bidId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt`
/// and `updatedBy` are always refreshed. Fails with 404 if the bid
/// doesn't exist OR isn't owned by the caller.
///
/// `rfqId`, `vendorId`, `lineage`, and `submittedAt` are intentionally
/// NOT updatable here — see the [`UpdateVendorBidInput`] doc comment.
///
/// **Award cascade:** when `status` flips to `"awarded"`, the parent
/// RFQ's status is best-effort cascaded to `"awarded"` as well. The
/// cascade fires AFTER the bid update succeeds — a cascade failure is
/// logged but does NOT roll back the bid update.
#[instrument(skip_all, fields(user_id = %user.user_id, bid_id = %bid_id))]
pub async fn update_vendor_bid(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(bid_id): Path<String>,
    Json(input): Json<UpdateVendorBidInput>,
) -> Result<Json<VendorBid>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let bid_oid = oid_from_str(&bid_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_str(&mut set, "currency", input.currency.as_ref());
    set_opt_str(&mut set, "terms", input.terms.as_ref());
    set_opt_str(&mut set, "vendorName", input.vendor_name.as_ref());

    if let Some(items) = input.items.as_ref() {
        set.insert(
            "items",
            json_to_bson(&serde_json::Value::Array(items.clone()), "items")?,
        );
    }
    if let Some(totals) = input.totals.as_ref() {
        set.insert("totals", json_to_bson(totals, "totals")?);
    }
    if let Some(atts) = input.attachments.as_ref() {
        set.insert(
            "attachments",
            json_to_bson(&serde_json::Value::Array(atts.clone()), "attachments")?,
        );
    }

    let mut new_status: Option<&str> = None;
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
        new_status = Some(status);
    }

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", bid_oid);

    let coll = mongo.collection::<Document>(VENDOR_BIDS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_vendor_bids.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("vendorBid".to_owned()));
    }

    // ---- Award cascade — fire-and-forget on status flip --------------
    // The bid is the source of truth; if the cascade can't reach the
    // parent RFQ (e.g. RFQ archived during the same request) we log
    // and continue. The next read of the RFQ will reconcile.
    if matches!(new_status, Some("awarded")) {
        cascade_rfq_award(&mongo, user_id, bid_oid).await;
    }

    // Re-read via the typed collection so the response shape is stable.
    let typed = mongo.collection::<VendorBid>(VENDOR_BIDS_COLL);
    let bid = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_vendor_bids.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("vendorBid".to_owned()))?;

    Ok(Json(bid))
}

/// Fire-and-forget cascade — flip the parent RFQ to `"awarded"` after
/// the bid status flips to `"awarded"`. Reads the bid's `rfqId` (we
/// don't trust the request body to identify the parent), then issues a
/// single `update_one` scoped to the same `userId`.
///
/// Errors are logged but never returned — the bid is the authoritative
/// record and partial-state UI is acceptable here. A reconcile job can
/// sweep stale RFQs offline.
async fn cascade_rfq_award(mongo: &MongoHandle, user_id: ObjectId, bid_oid: ObjectId) {
    let bid_coll = mongo.collection::<Document>(VENDOR_BIDS_COLL);
    let bid_doc = match bid_coll
        .find_one(doc! { "_id": bid_oid, "userId": user_id })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => {
            warn!(
                bid_id = %bid_oid,
                "cascade_rfq_award: bid disappeared between PATCH and re-read",
            );
            return;
        }
        Err(e) => {
            warn!(error = %e, bid_id = %bid_oid, "cascade_rfq_award: re-read failed");
            return;
        }
    };
    let rfq_oid = match bid_doc.get_object_id("rfqId") {
        Ok(o) => o,
        Err(e) => {
            warn!(error = %e, bid_id = %bid_oid, "cascade_rfq_award: missing rfqId");
            return;
        }
    };

    let now = bson::DateTime::from_chrono(Utc::now());
    let rfq_coll = mongo.collection::<Document>(RFQS_COLL);
    if let Err(e) = rfq_coll
        .update_one(
            doc! { "_id": rfq_oid, "userId": user_id },
            doc! {
                "$set": {
                    "status": "awarded",
                    "updatedAt": now,
                    "updatedBy": user_id,
                },
            },
        )
        .await
    {
        warn!(
            error = %e,
            rfq_id = %rfq_oid,
            bid_id = %bid_oid,
            "cascade_rfq_award: parent RFQ update failed",
        );
    }
}

// =========================================================================
// DELETE /:bidId — delete_vendor_bid
// =========================================================================

/// `DELETE /v1/crm/vendor-bids/:bidId` — **hard delete**. Per the CRM
/// ecosystem plan, CRM entities use hard deletes — the row is removed
/// from the collection. Mirrors the `crm-leads` crate. Fails with 404
/// if the bid doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, bid_id = %bid_id))]
pub async fn delete_vendor_bid(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(bid_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let bid_oid = oid_from_str(&bid_id)?;

    let filter = doc! { "_id": bid_oid, "userId": user_id };

    let coll = mongo.collection::<Document>(VENDOR_BIDS_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_vendor_bids.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("vendorBid".to_owned()));
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
    fn json_to_bson_accepts_object() {
        let v = serde_json::json!({ "subTotal": 100.0, "total": 118.0 });
        assert!(json_to_bson(&v, "totals").is_ok());
    }

    #[test]
    fn json_to_bson_accepts_array() {
        let v = serde_json::json!([
            { "qty": 2.0, "rate": 100.0 },
            { "qty": 5.0, "rate": 50.0 },
        ]);
        assert!(json_to_bson(&v, "items").is_ok());
    }

    #[test]
    fn lineage_kinds_match_dictionary() {
        // Sentinel values — keep in sync with `src/lib/lineage.ts` and
        // the §13.5 lineage dictionary. A typo here would silently
        // detach bids from their RFQs in cross-module reports.
        assert_eq!(BID_LINEAGE_KIND, "vendorBid");
        assert_eq!(RFQ_LINEAGE_KIND, "rfq");
    }

    #[test]
    fn collection_constants_match_spec() {
        // The Rust BFF and any TS server actions MUST share the same
        // backing collection — these literals are the contract.
        assert_eq!(VENDOR_BIDS_COLL, "crm_vendor_bids");
        assert_eq!(RFQS_COLL, "crm_rfqs");
    }
}
