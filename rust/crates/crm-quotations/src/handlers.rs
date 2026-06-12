//! HTTP handlers for the §1.2 Quotation entity.
//!
//! Mirrors the existing TS server actions for `crm_quotations` — read-only
//! research reference; the TS file stays in production until the API host
//! crate routes traffic here. Five handlers:
//!
//! | Method   | Path                  | Function              |
//! |----------|-----------------------|-----------------------|
//! | `GET`    | `/`                   | [`list_quotations`]   |
//! | `GET`    | `/:quotationId`       | [`get_quotation`]     |
//! | `POST`   | `/`                   | [`create_quotation`]  |
//! | `PATCH`  | `/:quotationId`       | [`update_quotation`]  |
//! | `DELETE` | `/:quotationId`       | [`delete_quotation`]  |
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the
//! router constructors in [`crate::router`]):
//!
//! - `/v1/crm/quotations` (legacy) — `userId == AuthUser.user_id`, the
//!   CRM tenant root from `crm-core::Identity`. Unchanged behaviour.
//! - `/v1/sabcrm/finance/quotations` (SabCRM Finance suite) —
//!   `projectId == ?projectId` / body `projectId`, required per-request
//!   (4xx when absent). Membership is validated by the Next.js action
//!   gate before the request reaches Rust.
//!
//! ## Lineage seeding (mirrors `crm-deals`)
//!
//! On create the body may carry `fromKind: "lead" | "deal"` + `fromId`;
//! when both are present the handler fetches the parent under the same
//! tenant scope and seeds the new quotation's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. A best-effort back-link is
//! also pushed onto the parent's `lineage[]`. Failures are non-fatal —
//! the quotation still saves.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{
    LineageRef, ScopeMode, TenantScope, build_lineage_from_parent, sabcrm_project_oid,
};
use crm_sales_types::Quotation;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::{instrument, warn};

use crate::dto::{
    CreateQuotationInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, ScopeQuery, UpdateQuotationInput,
};

/// Mongo collection name. Must match the existing TS `CrmQuotation`
/// shape so the Rust BFF and the legacy Next.js action share the same
/// backing collection during the migration window.
const QUOTATIONS_COLL: &str = "crm_quotations";
/// Parent collections consulted when the create body carries lineage
/// hooks. Match the literals used by `crm-leads` / `crm-deals`.
const LEADS_COLL: &str = "crm_leads";
const DEALS_COLL: &str = "crm_deals";

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
/// - `ScopeMode::User` (legacy `/v1/crm/quotations`) — scope by the
///   verified JWT subject. Identical to the historical behaviour.
/// - `ScopeMode::Project` (`/v1/sabcrm/finance/quotations`) — scope by
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
/// `{ <userId|projectId>, archived: { $ne: true } }`. Soft-deleted rows
/// (`archived = true`) are excluded by default; callers that want to
/// surface them must build their own filter.
fn base_ownership_filter(scope: &TenantScope) -> Document {
    let mut f = scope.filter();
    f.insert("archived", doc! { "$ne": true });
    f
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

/// Optional-`ObjectId`-like update helper. Parses a 24-char hex string
/// when present and stores the OID; rejects malformed input with
/// `BadRequest`.
fn set_opt_oid(set: &mut Document, key: &str, val: Option<&String>) -> Result<()> {
    if let Some(v) = val {
        let oid = oid_from_str(v)?;
        set.insert(key, oid);
    }
    Ok(())
}

/// Map a parent `kind` string to the Mongo collection that holds it.
/// Returns `None` for unsupported kinds — the caller treats this the
/// same as a missing parent (silently skip lineage seeding).
fn parent_coll_for(kind: &str) -> Option<&'static str> {
    match kind.trim().to_ascii_lowercase().as_str() {
        "lead" => Some(LEADS_COLL),
        "deal" => Some(DEALS_COLL),
        _ => None,
    }
}

/// Fetch the parent document (under the same tenant scope as the new
/// quotation) and build the lineage chain a freshly-created quotation
/// should inherit. Returns `Ok(None)` if the parent doesn't exist or
/// isn't owned by the caller's scope.
async fn seed_lineage_from_parent(
    mongo: &MongoHandle,
    scope: &TenantScope,
    parent_kind: &str,
    parent_id_hex: &str,
) -> Result<Option<(Vec<LineageRef>, ObjectId, &'static str)>> {
    let coll_name = match parent_coll_for(parent_kind) {
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_quotations.parent.find_one"))
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

    let normalized_kind = parent_kind.trim().to_ascii_lowercase();
    let chain = build_lineage_from_parent(normalized_kind, parent_oid, &parent_chain);
    Ok(Some((chain, parent_oid, coll_name)))
}

// =========================================================================
// GET / — list_quotations
// =========================================================================

/// `GET /v1/crm/quotations` — paginated list scoped to the authenticated
/// user's quotations. The `q` query param does a case-insensitive
/// substring search across `quotationNo`, `subject`, and `referenceNo`.
/// Sorted by `createdAt` desc to match the TS action.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_quotations(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Quotation>>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;

    let mut filter = base_ownership_filter(&scope);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "quotationNo": regex.clone() }),
                Bson::Document(doc! { "subject": regex.clone() }),
                Bson::Document(doc! { "referenceNo": regex }),
            ]),
        );
    }
    if let Some(client) = q.client_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("clientId", oid_from_str(client)?);
    }
    if let Some(status) = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("status", status.to_ascii_lowercase());
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<Quotation>(QUOTATIONS_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_quotations.find"))
        })?;
    let quotations: Vec<Quotation> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_quotations.collect")))?;

    Ok(Json(quotations))
}

// =========================================================================
// GET /:quotationId — get_quotation
// =========================================================================

/// `GET /v1/crm/quotations/:quotationId` — fetch a single quotation.
/// Returns 404 if the quotation doesn't exist OR isn't owned by the
/// caller (we deliberately collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, quotation_id = %quotation_id))]
pub async fn get_quotation(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(quotation_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<Quotation>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let quote_oid = oid_from_str(&quotation_id)?;

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", quote_oid);

    let coll = mongo.collection::<Quotation>(QUOTATIONS_COLL);
    let quote = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_quotations.find_one")))?
        .ok_or_else(|| ApiError::NotFound("quotation".to_owned()))?;

    Ok(Json(quote))
}

// =========================================================================
// POST / — create_quotation
// =========================================================================

/// `POST /v1/crm/quotations` — insert a new quotation.
///
/// Validates the curated [`CreateQuotationInput`], stamps `Identity` +
/// `Audit`, optionally seeds `lineage[]` from a parent lead/deal, and
/// persists the new document.
///
/// **Lineage:** when `fromKind` ∈ {`"lead"`, `"deal"`} and `fromId` is a
/// valid `ObjectId` of a parent owned by the same user, the new
/// quotation's `lineage[]` is seeded via
/// [`crm_core::build_lineage_from_parent`] and a best-effort back-link
/// is pushed onto the parent's lineage. Mismatched / unscoped parents
/// quietly skip the seed (the quotation still saves).
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_quotation(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateQuotationInput>,
) -> Result<Json<Quotation>> {
    if input.quotation_no.trim().is_empty() {
        return Err(ApiError::Validation("quotationNo is required.".to_owned()));
    }
    if input.client_id.trim().is_empty() {
        return Err(ApiError::Validation("clientId is required.".to_owned()));
    }
    if input.currency.trim().is_empty() {
        return Err(ApiError::Validation("currency is required.".to_owned()));
    }
    if input.items.is_empty() {
        return Err(ApiError::Validation(
            "at least one line item is required.".to_owned(),
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
            // Match the legacy TS behaviour: stamp a freshly-minted id
            // when the caller doesn't pass one. Production callers
            // SHOULD send the real projectId.
            None => ObjectId::new(),
        },
    };
    let client_oid = oid_from_str(input.client_id.trim())?;

    // ---- Lineage seeding (mirrors crm-deals) ---------------------------
    let mut lineage_array: Option<Vec<Bson>> = None;
    let mut parent_back_link: Option<(&'static str, ObjectId)> = None;
    if let (Some(kind), Some(parent_id)) = (input.from_kind.as_deref(), input.from_id.as_deref()) {
        if !kind.is_empty() && !parent_id.is_empty() {
            match seed_lineage_from_parent(&mongo, &scope, kind, parent_id).await {
                Ok(Some((lineage, parent_oid, coll_name))) => {
                    lineage_array = Some(
                        lineage
                            .into_iter()
                            .map(|r| Bson::Document(doc! { "kind": r.kind, "id": r.id }))
                            .collect(),
                    );
                    parent_back_link = Some((coll_name, parent_oid));
                }
                Ok(None) => {
                    // Parent not found / not owned / unsupported kind —
                    // quietly skip seeding. The quotation still saves.
                }
                Err(e) => {
                    warn!(error = %e, "lineage seed failed; saving quotation without lineage");
                }
            }
        }
    }

    let new_oid = ObjectId::new();
    let now = bson::DateTime::from_chrono(Utc::now());

    // Build the document by hand so we can persist nested fragments
    // (`identity`, `audit`, …) flattened to the document root the same
    // way the canonical [`Quotation`] struct serialises. We avoid
    // round-tripping through `bson::to_document(&Quotation { … })`
    // because `Quotation` doesn't impl `Default`, and constructing every
    // optional field manually adds zero value over the explicit doc.
    let mut new_doc = doc! {
        // identity (flattened)
        "_id": new_oid,
        "userId": user_id,
        "projectId": project_id,
        // audit (flattened)
        "createdAt": now,
        "updatedAt": now,
        "createdBy": user_id,
        "updatedBy": user_id,
        // doc identity
        "quotationNo": input.quotation_no.trim(),
        "date": bson::DateTime::from_chrono(input.date),
        "validUntil": bson::DateTime::from_chrono(input.valid_until),
        // party
        "clientId": client_oid,
        // money
        "currency": input.currency.trim(),
        // line items + totals (Default::default())
        "items": bson::to_bson(&input.items)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("quotation.items.bson")))?,
        "totals": bson::to_bson(&crm_sales_types::Totals::default())
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("quotation.totals.bson")))?,
        // workflow defaults — match the lowercase serde representations
        // of `QuotationStatus::Draft` and `PdfStatus::None` so the
        // typed re-read after insert deserialises cleanly.
        "status": "draft",
        "pdfStatus": "none",
        "archived": false,
    };
    if let Some(s) = input.subject.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("subject", s);
    }
    if let Some(t) = input
        .terms_and_conditions
        .as_deref()
        .filter(|s| !s.is_empty())
    {
        new_doc.insert("termsAndConditions", t);
    }
    if let Some(n) = input.notes.as_deref().filter(|s| !s.is_empty()) {
        // Stored under the canonical field name on the document so the
        // [`Quotation`] struct round-trips cleanly via the typed reads.
        new_doc.insert("customerNotes", n);
    }
    if let Some(p) = input.place_of_supply.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("placeOfSupply", p);
    }
    if let Some(la) = lineage_array {
        new_doc.insert("lineage", Bson::Array(la));
    }
    if let Some(v) = input.design_metadata {
        if let Ok(doc) = bson::to_document(&v) {
            new_doc.insert("designMetadata", doc);
        }
    }

    let docs = mongo.collection::<Document>(QUOTATIONS_COLL);
    docs.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_quotations.insert_one"))
    })?;

    // Best-effort back-link onto the parent's lineage (non-fatal,
    // mirrors the TS `try { ... } catch {}` block in `crm-deals`).
    if let Some((parent_coll, parent_oid)) = parent_back_link {
        let parents = mongo.collection::<Document>(parent_coll);
        let mut parent_filter = scope.filter();
        parent_filter.insert("_id", parent_oid);
        let _ = parents
            .update_one(
                parent_filter,
                doc! {
                    "$push": { "lineage": { "kind": "quotation", "id": new_oid } },
                    "$set":  { "updatedAt": now },
                },
            )
            .await;
    }

    // Re-read via the typed collection so the response is the canonical
    // [`Quotation`] shape (mirrors the `update_quotation` round-trip and
    // sidesteps the fact that `Quotation` has no `Default` impl, which
    // would force every optional field to be wired by hand at construct
    // time).
    let typed = mongo.collection::<Quotation>(QUOTATIONS_COLL);
    let mut reread_filter = scope.filter();
    reread_filter.insert("_id", new_oid);
    let quote = typed
        .find_one(reread_filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_quotations.find_one(after-insert)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("quotation".to_owned()))?;

    Ok(Json(quote))
}

// =========================================================================
// PATCH /:quotationId — update_quotation
// =========================================================================

/// `PATCH /v1/crm/quotations/:quotationId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt` and
/// `updatedBy` are always refreshed. Fails with 404 if the quotation
/// doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, quotation_id = %quotation_id))]
pub async fn update_quotation(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(quotation_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(input): Json<UpdateQuotationInput>,
) -> Result<Json<Quotation>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }
    if let Some(items) = input.items.as_ref() {
        if items.is_empty() {
            return Err(ApiError::Validation(
                "items[] cannot be empty when provided.".to_owned(),
            ));
        }
    }

    let user_id = user_oid(&user)?;
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let quote_oid = oid_from_str(&quotation_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_str(&mut set, "quotationNo", input.quotation_no.as_ref());
    set_opt_str(&mut set, "currency", input.currency.as_ref());
    set_opt_str(&mut set, "placeOfSupply", input.place_of_supply.as_ref());
    set_opt_str(&mut set, "subject", input.subject.as_ref());
    set_opt_str(
        &mut set,
        "termsAndConditions",
        input.terms_and_conditions.as_ref(),
    );
    set_opt_str(&mut set, "customerNotes", input.notes.as_ref());
    set_opt_oid(&mut set, "clientId", input.client_id.as_ref())?;

    if let Some(when) = input.date {
        set.insert("date", bson::DateTime::from_chrono(when));
    }
    if let Some(when) = input.valid_until {
        set.insert("validUntil", bson::DateTime::from_chrono(when));
    }
    if let Some(status) = input
        .status
        .as_deref()
        .map(|s| s.trim().to_ascii_lowercase())
    {
        if !matches!(
            status.as_str(),
            "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted"
        ) {
            return Err(ApiError::Validation(
                "status must be one of: draft, sent, accepted, rejected, expired, converted."
                    .to_owned(),
            ));
        }
        set.insert("status", status);
    }
    if let Some(items) = input.items.as_ref() {
        let bson_items = bson::to_bson(items).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("quotation.items.bson"))
        })?;
        set.insert("items", bson_items);
    }
    if let Some(v) = input.design_metadata {
        if let Ok(doc) = bson::to_document(&v) {
            set.insert("designMetadata", doc);
        }
    }

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", quote_oid);

    let coll = mongo.collection::<Document>(QUOTATIONS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_quotations.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("quotation".to_owned()));
    }

    // Re-read via the typed collection so the response is the canonical
    // [`Quotation`] shape (and any defaults / skipped fields render
    // correctly).
    let typed = mongo.collection::<Quotation>(QUOTATIONS_COLL);
    let quote = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_quotations.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("quotation".to_owned()))?;

    Ok(Json(quote))
}

// =========================================================================
// DELETE /:quotationId — delete_quotation (hard)
// =========================================================================

/// `DELETE /v1/crm/quotations/:quotationId` — **hard delete**. Per the
/// CRM ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities
/// use hard deletes — the row is removed from the collection. Fails
/// with 404 if the quotation doesn't exist OR isn't owned by the
/// caller.
#[instrument(skip_all, fields(user_id = %user.user_id, quotation_id = %quotation_id))]
pub async fn delete_quotation(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(quotation_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let quote_oid = oid_from_str(&quotation_id)?;

    let mut filter = scope.filter();
    filter.insert("_id", quote_oid);

    let coll = mongo.collection::<Document>(QUOTATIONS_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_quotations.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("quotation".to_owned()));
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
        set_opt_str(&mut d, "subject", None);
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_str_inserts_some() {
        let mut d = doc! {};
        let v = "Q3 hosting".to_owned();
        set_opt_str(&mut d, "subject", Some(&v));
        assert_eq!(d.get_str("subject").unwrap(), "Q3 hosting");
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "clientId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn parent_coll_for_maps_lead_and_deal_only() {
        assert_eq!(parent_coll_for("lead"), Some(LEADS_COLL));
        assert_eq!(parent_coll_for("LEAD"), Some(LEADS_COLL));
        assert_eq!(parent_coll_for("deal"), Some(DEALS_COLL));
        assert_eq!(parent_coll_for("Deal"), Some(DEALS_COLL));
        assert_eq!(parent_coll_for("invoice"), None);
        assert_eq!(parent_coll_for(""), None);
    }
}
