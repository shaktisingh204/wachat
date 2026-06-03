//! HTTP handlers for the §12.4 GRN entity.
//!
//! Five handlers — same shape as the sister `crm-leads` /
//! `crm-purchase-orders` crates:
//!
//! | Method  | Path             | Function          |
//! |---------|------------------|-------------------|
//! | `GET`   | `/`              | [`list_grns`]     |
//! | `GET`   | `/:grnId`        | [`get_grn`]       |
//! | `POST`  | `/`              | [`create_grn`]    |
//! | `PATCH` | `/:grnId`        | [`update_grn`]    |
//! | `DELETE`| `/:grnId`        | [`delete_grn`]    |
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! — the CRM tenant root from `crm-core::Identity`.
//!
//! ## Lineage seeding (§13.5)
//!
//! On create, when the body carries `po_id`, we fetch the parent PO
//! (under the same `userId` scope) from `crm_purchase_orders` and seed
//! the new GRN's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`] with parent kind
//! `"purchaseOrder"`. Best-effort — a missing or mis-scoped parent
//! quietly skips the seed and still saves the GRN.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{Audit, Identity, LineageRef, build_lineage_from_parent};
use crm_extras_types::Grn;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::{instrument, warn};

use crate::dto::{
    ALLOWED_STATUSES, CreateGrnInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, UpdateGrnInput,
};

/// Mongo collection name for GRNs. Matches the §12.4 spec literal.
const GRNS_COLL: &str = "crm_grns";

/// Lineage parent collection — Purchase Orders. The only logical
/// parent kind a GRN currently links back to is `"purchaseOrder"`
/// (direct receipts have no parent and skip the seed).
const PURCHASE_ORDERS_COLL: &str = "crm_purchase_orders";

/// Logical lineage kind for the parent PO. Mirrors the literal in
/// `crm-purchase-orders` and the `LineageRef.kind` taxonomy in
/// `src/lib/lineage.ts`.
const PARENT_KIND_PO: &str = "purchaseOrder";

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

/// Optional-OID update helper. Parses a 24-char hex string when present
/// and stores the OID; rejects malformed input with `BadRequest`.
fn set_opt_oid(set: &mut Document, key: &str, val: Option<&String>) -> Result<()> {
    if let Some(v) = val {
        let oid = oid_from_str(v)?;
        set.insert(key, oid);
    }
    Ok(())
}

/// Convert a `serde_json::Value` (or any serde-serializable value) into
/// a `Bson` for `$set`. Rejects payloads that can't round-trip into BSON
/// (NaN floats, etc.).
fn to_bson_or_validation<T: serde::Serialize>(v: &T, ctx: &'static str) -> Result<Bson> {
    bson::to_bson(v)
        .map_err(|e| ApiError::Validation(format!("{ctx} did not serialise to BSON: {e}")))
}

/// Fetch the parent PO (scoped by `userId`) and build the lineage chain
/// a freshly-created GRN should inherit. Returns `Ok(None)` if the PO
/// doesn't exist or isn't owned by the caller.
async fn seed_lineage_from_po(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    parent_id_hex: &str,
) -> Result<Option<(Vec<LineageRef>, ObjectId)>> {
    let parent_oid = oid_from_str(parent_id_hex)?;
    let coll = mongo.collection::<Document>(PURCHASE_ORDERS_COLL);
    let parent = match coll
        .find_one(doc! { "_id": parent_oid, "userId": user_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_purchase_orders.find_one(lineage)"),
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

    let chain = build_lineage_from_parent(PARENT_KIND_PO, parent_oid, &parent_chain);
    Ok(Some((chain, parent_oid)))
}

// =========================================================================
// GET / — list_grns
// =========================================================================

/// `GET /v1/crm/grns` — paginated list scoped to the authenticated
/// user's GRNs. The `q` query param does a case-insensitive substring
/// search across `grnNo`. `po_id`, `vendor_id`, and `status` narrow
/// further. Sorted by `createdAt` desc.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_grns(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Grn>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("grnNo", doc! { "$regex": needle, "$options": "i" });
    }
    if let Some(pid) = q.po_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("poId", oid_from_str(pid)?);
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

    let coll = mongo.collection::<Grn>(GRNS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_grns.find")))?;
    let grns: Vec<Grn> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_grns.collect")))?;

    Ok(Json(grns))
}

// =========================================================================
// GET /:grnId — get_grn
// =========================================================================

/// `GET /v1/crm/grns/:grnId` — fetch a single GRN. Returns 404 if the
/// GRN doesn't exist OR isn't owned by the caller (we deliberately
/// collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, grn_id = %grn_id))]
pub async fn get_grn(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(grn_id): Path<String>,
) -> Result<Json<Grn>> {
    let user_id = user_oid(&user)?;
    let grn_oid = oid_from_str(&grn_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", grn_oid);

    let coll = mongo.collection::<Grn>(GRNS_COLL);
    let grn = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_grns.find_one")))?
        .ok_or_else(|| ApiError::NotFound("grn".to_owned()))?;

    Ok(Json(grn))
}

// =========================================================================
// POST / — create_grn
// =========================================================================

/// `POST /v1/crm/grns` — insert a new GRN.
///
/// Builds the document directly (rather than going through the typed
/// [`Grn`] struct end-to-end) so the curated input shape stays
/// independent of the response shape. The handler stamps `Identity` +
/// `Audit`, defaults `status = draft`, optionally seeds `lineage[]`
/// from the parent PO, and re-reads via the typed collection so the
/// response is the canonical [`Grn`] shape.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_grn(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateGrnInput>,
) -> Result<Json<Grn>> {
    // ---- Required-field validation -----------------------------------
    if input.grn_no.trim().is_empty() {
        return Err(ApiError::Validation("grnNo is required.".to_owned()));
    }
    if input.vendor_id.trim().is_empty() {
        return Err(ApiError::Validation("vendorId is required.".to_owned()));
    }
    if input.warehouse_id.trim().is_empty() {
        return Err(ApiError::Validation("warehouseId is required.".to_owned()));
    }
    if input.items.is_empty() {
        return Err(ApiError::Validation(
            "items must contain at least one line.".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        // Match the legacy single-tenant behaviour — mint a fresh OID
        // when the caller omits projectId so the document is at least
        // syntactically valid.
        None => ObjectId::new(),
    };
    let vendor_oid = oid_from_str(&input.vendor_id)?;
    let warehouse_oid = oid_from_str(&input.warehouse_id)?;
    let inspector_oid = match input.inspector_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    // ---- Lineage seeding (§13.5) -------------------------------------
    // Parent kind for GRN is always `purchaseOrder` — when a `po_id` is
    // supplied we seed lineage from that PO; otherwise the GRN is a
    // direct receipt with no provenance chain.
    let mut lineage_array: Option<Vec<Bson>> = None;
    let mut parent_backlink: Option<ObjectId> = None;
    let mut po_oid_for_doc: Option<ObjectId> = None;
    if let Some(parent_id) = input
        .po_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        match seed_lineage_from_po(&mongo, user_id, parent_id).await {
            Ok(Some((lineage, parent_oid))) => {
                lineage_array = Some(
                    lineage
                        .into_iter()
                        .map(|r| Bson::Document(doc! { "kind": r.kind, "id": r.id }))
                        .collect(),
                );
                parent_backlink = Some(parent_oid);
                po_oid_for_doc = Some(parent_oid);
            }
            Ok(None) => {
                // Parent not found / not owned — still record the poId
                // on the GRN (the user asked for it) but skip the
                // lineage seed so we don't fabricate provenance.
                po_oid_for_doc = Some(oid_from_str(parent_id)?);
            }
            Err(e) => {
                warn!(error = %e, "lineage seed failed; saving GRN without lineage");
                po_oid_for_doc = Some(oid_from_str(parent_id)?);
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

    // Items + attachments round-trip through serde so the wire shape
    // matches the typed Grn struct exactly (camelCase, skip-empty
    // optionals, etc.).
    let items_bson = to_bson_or_validation(&input.items, "items")?;
    let attachments_bson = match input.attachments.as_ref() {
        Some(a) if !a.is_empty() => Some(to_bson_or_validation(a, "attachments")?),
        _ => None,
    };

    let mut new_doc = Document::new();
    new_doc.extend(identity_doc);
    new_doc.extend(audit_doc);
    new_doc.insert("grnNo", input.grn_no.trim());
    new_doc.insert("date", bson::DateTime::from_chrono(input.date));
    if let Some(p) = po_oid_for_doc {
        new_doc.insert("poId", p);
    }
    new_doc.insert("vendorId", vendor_oid);
    new_doc.insert("warehouseId", warehouse_oid);
    new_doc.insert("items", items_bson);
    if let Some(i) = inspector_oid {
        new_doc.insert("inspectorId", i);
    }
    if let Some(a) = attachments_bson {
        new_doc.insert("attachments", a);
    }
    // Status defaults to `draft` (matches GrnStatus::Draft serde value).
    new_doc.insert("status", "draft");
    if let Some(la) = lineage_array {
        new_doc.insert("lineage", Bson::Array(la));
    }

    // The `Identity` serialization above stamps `_id: ObjectId` already
    // (Identity renames `id` to `_id`). Overwrite explicitly with the
    // freshly-minted oid so an upstream change to `Identity` doesn't
    // silently break us.
    new_doc.insert("_id", new_oid);

    let raw_coll = mongo.collection::<Document>(GRNS_COLL);
    raw_coll
        .insert_one(&new_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_grns.insert_one")))?;

    // Best-effort back-link onto the parent PO's lineage (mirrors the
    // crm-purchase-orders create flow). Non-fatal — a failed back-link
    // still returns the freshly-created GRN.
    if let Some(parent_oid) = parent_backlink {
        let parent = mongo.collection::<Document>(PURCHASE_ORDERS_COLL);
        let _ = parent
            .update_one(
                doc! { "_id": parent_oid, "userId": user_id },
                doc! {
                    "$push": { "lineage": { "kind": "grn", "id": new_oid } },
                    "$set":  { "updatedAt": now },
                },
            )
            .await;
    }

    // Re-read via the typed collection so the response shape is stable.
    let typed = mongo.collection::<Grn>(GRNS_COLL);
    let grn = typed
        .find_one(doc! { "_id": new_oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_grns.find_one(after-insert)"))
        })?
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!(
                "freshly-inserted GRN disappeared during re-read"
            ))
        })?;

    Ok(Json(grn))
}

// =========================================================================
// PATCH /:grnId — update_grn
// =========================================================================

/// `PATCH /v1/crm/grns/:grnId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt`
/// and `updatedBy` are always refreshed. Fails with 404 if the GRN
/// doesn't exist OR isn't owned by the caller.
///
/// `grn_no`, `po_id`, `gin_id`, `mrn_id`, and `lineage` are
/// intentionally NOT updatable here — see [`UpdateGrnInput`].
#[instrument(skip_all, fields(user_id = %user.user_id, grn_id = %grn_id))]
pub async fn update_grn(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(grn_id): Path<String>,
    Json(input): Json<UpdateGrnInput>,
) -> Result<Json<Grn>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let grn_oid = oid_from_str(&grn_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    if let Some(d) = input.date {
        set.insert("date", bson::DateTime::from_chrono(d));
    }
    set_opt_oid(&mut set, "vendorId", input.vendor_id.as_ref())?;
    set_opt_oid(&mut set, "warehouseId", input.warehouse_id.as_ref())?;
    set_opt_oid(&mut set, "inspectorId", input.inspector_id.as_ref())?;

    if let Some(items) = input.items.as_ref() {
        set.insert("items", to_bson_or_validation(items, "items")?);
    }
    if let Some(attachments) = input.attachments.as_ref() {
        set.insert(
            "attachments",
            to_bson_or_validation(attachments, "attachments")?,
        );
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

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", grn_oid);

    let coll = mongo.collection::<Document>(GRNS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_grns.update_one")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("grn".to_owned()));
    }

    // Re-read via the typed collection so the response shape is stable.
    let typed = mongo.collection::<Grn>(GRNS_COLL);
    let grn = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_grns.find_one(after-update)"))
        })?
        .ok_or_else(|| ApiError::NotFound("grn".to_owned()))?;

    Ok(Json(grn))
}

// =========================================================================
// DELETE /:grnId — delete_grn
// =========================================================================

/// `DELETE /v1/crm/grns/:grnId` — **hard delete**. Per the CRM
/// ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities use
/// hard deletes — the row is removed from the collection. Fails with
/// 404 if the GRN doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, grn_id = %grn_id))]
pub async fn delete_grn(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(grn_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let grn_oid = oid_from_str(&grn_id)?;

    let filter = doc! { "_id": grn_oid, "userId": user_id };

    let coll = mongo.collection::<Document>(GRNS_COLL);
    let res = coll
        .delete_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_grns.delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("grn".to_owned()));
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
    fn set_opt_oid_skips_none() {
        let mut d = doc! {};
        set_opt_oid(&mut d, "vendorId", None).unwrap();
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_oid_inserts_some_valid() {
        let mut d = doc! {};
        let v = ObjectId::new().to_hex();
        set_opt_oid(&mut d, "vendorId", Some(&v)).unwrap();
        assert!(d.get_object_id("vendorId").is_ok());
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "vendorId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn parent_kind_constant_matches_lineage_taxonomy() {
        // Sanity: the GRN's only lineage parent is the PO. If a future
        // refactor adds another parent kind, this constant must stay
        // the literal the lineage helpers and TS taxonomy expect.
        assert_eq!(PARENT_KIND_PO, "purchaseOrder");
    }

    #[test]
    fn to_bson_or_validation_accepts_array() {
        let v = serde_json::json!([{ "itemId": "abc", "qty": 1 }]);
        assert!(to_bson_or_validation(&v, "items").is_ok());
    }
}
