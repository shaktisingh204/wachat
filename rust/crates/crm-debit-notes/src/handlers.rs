//! HTTP handlers for the §2.4 Debit Note entity.
//!
//! Mirrors `src/app/actions/crm-debit-notes.actions.ts` — read-only
//! research reference; the TS file stays in production until the API
//! host crate routes traffic here. Five handlers:
//!
//! | Method  | Path                | Function              |
//! |---------|---------------------|-----------------------|
//! | `GET`   | `/`                 | [`list_debit_notes`]  |
//! | `GET`   | `/:debitNoteId`     | [`get_debit_note`]    |
//! | `POST`  | `/`                 | [`create_debit_note`] |
//! | `PATCH` | `/:debitNoteId`     | [`update_debit_note`] |
//! | `DELETE`| `/:debitNoteId`     | [`delete_debit_note`] |
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the
//! router constructors in [`crate::router`]):
//!
//! - `/v1/crm/debit-notes` (legacy) — `userId == AuthUser.user_id`, the
//!   CRM tenant root from [`crm_core::Identity`]. Unchanged behaviour.
//! - `/v1/sabcrm/finance/debit-notes` (SabCRM Finance suite) —
//!   `projectId == ?projectId` / body `projectId`, required per-request
//!   (4xx when absent). Membership is validated by the Next.js action
//!   gate before the request reaches Rust.
//!
//! ## Lineage parents
//!
//! On create, only `fromKind ∈ {"bill", "purchaseOrder"}` is honoured.
//! Bills live on the `crm_expenses` collection (the legacy TS naming —
//! see `src/lib/definitions.ts`), purchase orders on
//! `crm_purchase_orders`. Anything outside the allow-list silently
//! skips the lineage seed and the debit note still saves — matches the
//! `try { ... } catch {}` block in the TS action.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{
    LineageRef, ScopeMode, TenantScope, append_lineage, build_lineage_from_parent,
    sabcrm_project_oid,
};
use crm_purchases_types::DebitNote;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::{instrument, warn};

use crate::dto::{
    CreateDebitNoteInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, ScopeQuery, UpdateDebitNoteInput,
};

/// Mongo collection name. Must match the §2.4 spec (and the TS literal
/// in `src/lib/definitions.ts`) so the Rust BFF and the legacy Next.js
/// action share the same backing collection during the migration window.
const DEBIT_NOTES_COLL: &str = "crm_debit_notes";

/// Bills live on `crm_expenses` (legacy TS naming — kept verbatim for
/// the migration window). Used for lineage parent lookup when
/// `fromKind == "bill"`.
const BILLS_COLL: &str = "crm_expenses";

/// Purchase orders. Used for lineage parent lookup when
/// `fromKind == "purchaseOrder"`.
const PURCHASE_ORDERS_COLL: &str = "crm_purchase_orders";

/// Allow-list of lineage parent kinds the create endpoint will honour.
/// Mirrors the `ALLOWED_PARENT_KINDS` array in
/// `crm-debit-notes.actions.ts`.
const ALLOWED_PARENT_KINDS: &[&str] = &["bill", "purchaseOrder"];

/// Allow-list of `refundMode` values. Compared lowercase against the
/// `RefundMode` enum's serde representation
/// (`#[serde(rename_all = "lowercase")]` on the source enum).
const ALLOWED_REFUND_MODES: &[&str] = &["cash", "credit", "replacement"];

/// Allow-list of `reason` values. Compared lowercase + `_`-joined
/// against `DebitNoteReason`'s serde representation
/// (`#[serde(rename_all = "snake_case")]` on the source enum).
const ALLOWED_REASONS: &[&str] = &["return", "discount", "price_adjust", "cancel", "other"];

/// Allow-list of `status` values. Compared lowercase against
/// `DebitNoteStatus`'s serde representation
/// (`#[serde(rename_all = "snake_case")]`).
const ALLOWED_STATUSES: &[&str] = &["draft", "issued", "refunded", "cancelled"];

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
/// - `ScopeMode::User` (legacy `/v1/crm/debit-notes`) — scope by the
///   verified JWT subject. Identical to the historical behaviour.
/// - `ScopeMode::Project` (`/v1/sabcrm/finance/debit-notes`) — scope by
///   the caller-supplied `projectId`, 4xx when absent/invalid. The
///   Next.js action gate has already validated project membership
///   before the request reaches Rust.
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

/// Validate-and-normalize an enum-ish input string against an
/// allow-list. Returns the lowercased value on success, `Validation`
/// error otherwise. We compare lowercase so callers can send
/// `"Return"` / `"RETURN"` and still hit the canonical `"return"`.
fn normalize_enum(field: &str, value: &str, allowed: &[&str]) -> Result<String> {
    let lower = value.trim().to_ascii_lowercase();
    if !allowed.iter().any(|v| *v == lower) {
        return Err(ApiError::Validation(format!(
            "{field} must be one of: {}.",
            allowed.join(", ")
        )));
    }
    Ok(lower)
}

/// Convert a `serde_json::Value` payload into a `bson::Bson` for direct
/// embedding into the insert / `$set` document. Wraps the conversion
/// error into `ApiError::BadRequest` so a malformed `items` / `totals`
/// payload renders as 400 instead of 500.
fn json_to_bson(field: &str, value: &serde_json::Value) -> Result<Bson> {
    bson::to_bson(value)
        .map_err(|e| ApiError::BadRequest(format!("invalid `{field}` payload: {e}")))
}

// =========================================================================
// GET / — list_debit_notes
// =========================================================================

/// `GET /v1/crm/debit-notes` — paginated list scoped to the
/// authenticated user's debit notes. The `q` query param does a
/// case-insensitive substring search against `dnNo`. Sorted by
/// `createdAt` desc to match the TS action.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_debit_notes(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<DebitNote>>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;

    let mut filter = base_ownership_filter(&scope);

    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("dnNo", doc! { "$regex": needle, "$options": "i" });
    }
    if let Some(vid) = q.vendor_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("vendorId", oid_from_str(vid)?);
    }
    if let Some(status_raw) = q.status.as_deref().filter(|s| !s.is_empty()) {
        let status = normalize_enum("status", status_raw, ALLOWED_STATUSES)?;
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

    let coll = mongo.collection::<DebitNote>(DEBIT_NOTES_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_debit_notes.find"))
        })?;
    let notes: Vec<DebitNote> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_debit_notes.collect"))
    })?;

    Ok(Json(notes))
}

// =========================================================================
// GET /:debitNoteId — get_debit_note
// =========================================================================

/// `GET /v1/crm/debit-notes/:debitNoteId` — fetch a single debit note.
/// Returns 404 if the row doesn't exist OR isn't owned by the caller
/// (we deliberately collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, dn_id = %dn_id))]
pub async fn get_debit_note(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(dn_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<DebitNote>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let dn_oid = oid_from_str(&dn_id)?;

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", dn_oid);

    let coll = mongo.collection::<DebitNote>(DEBIT_NOTES_COLL);
    let dn = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_debit_notes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("debit_note".to_owned()))?;

    Ok(Json(dn))
}

// =========================================================================
// POST / — create_debit_note
// =========================================================================

/// `POST /v1/crm/debit-notes` — insert a new debit note.
///
/// Validates required fields, parses ObjectIds, normalizes the
/// enum-ish `reason` / `refundMode` strings, optionally seeds the
/// §13.5 `lineage[]` chain from a parent bill / purchase order (the
/// G6 pattern), and inserts the document. Returns the freshly inserted
/// row by re-reading via the typed [`DebitNote`] collection so the
/// response shape exactly matches `GET`.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_debit_note(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDebitNoteInput>,
) -> Result<Json<DebitNote>> {
    // ---- Required-field validation -------------------------------------
    if input.dn_no.trim().is_empty() {
        return Err(ApiError::Validation("dnNo is required.".to_owned()));
    }
    if input.currency.trim().is_empty() {
        return Err(ApiError::Validation("currency is required.".to_owned()));
    }

    let reason = normalize_enum("reason", &input.reason, ALLOWED_REASONS)?;
    let refund_mode = normalize_enum("refundMode", &input.refund_mode, ALLOWED_REFUND_MODES)?;

    // `items` MUST be a non-empty JSON array.
    let items_arr = input
        .items
        .as_array()
        .ok_or_else(|| ApiError::Validation("items must be an array.".to_owned()))?;
    if items_arr.is_empty() {
        return Err(ApiError::Validation(
            "items must contain at least one row.".to_owned(),
        ));
    }
    let items_bson = json_to_bson("items", &input.items)?;

    // `totals` MUST be a JSON object (we don't enforce specific subfields
    // here — the canonical Totals struct serializes optional fields
    // sparsely, so an empty `{}` is technically valid).
    if !input.totals.is_object() {
        return Err(ApiError::Validation("totals must be an object.".to_owned()));
    }
    let totals_bson = json_to_bson("totals", &input.totals)?;

    // ---- ObjectIds + dates ---------------------------------------------
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
            // Match the legacy TS behaviour — single-tenant callers omit
            // projectId and pick up a freshly-minted id at insert time.
            None => ObjectId::new(),
        },
    };
    let vendor_oid = oid_from_str(&input.vendor_id)?;
    let linked_bill_oid = match input.linked_bill_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    let now = bson::DateTime::from_chrono(Utc::now());
    let date_bson = bson::DateTime::from_chrono(input.date);
    let new_oid = ObjectId::new();

    // ---- Lineage seeding (G6 pattern) ----------------------------------
    let mut lineage_array: Option<Vec<Bson>> = None;
    let mut parent_back_link: Option<(&'static str, ObjectId)> = None;
    if let (Some(kind), Some(parent_id)) = (input.from_kind.as_deref(), input.from_id.as_deref()) {
        if ALLOWED_PARENT_KINDS.contains(&kind) && !parent_id.is_empty() {
            let coll_name = match kind {
                "bill" => BILLS_COLL,
                "purchaseOrder" => PURCHASE_ORDERS_COLL,
                // Already filtered by ALLOWED_PARENT_KINDS above; keep
                // the wildcard so the match stays exhaustive.
                _ => unreachable!(),
            };
            match seed_lineage_from_parent(&mongo, &scope, parent_id, kind, coll_name).await {
                Ok(Some((chain, parent_oid))) => {
                    lineage_array = Some(
                        chain
                            .into_iter()
                            .map(|r| Bson::Document(doc! { "kind": r.kind, "id": r.id }))
                            .collect(),
                    );
                    parent_back_link = Some(match kind {
                        "bill" => (BILLS_COLL, parent_oid),
                        "purchaseOrder" => (PURCHASE_ORDERS_COLL, parent_oid),
                        _ => unreachable!(),
                    });
                }
                Ok(None) => {
                    // Parent not found / not owned — quietly skip.
                }
                Err(e) => {
                    warn!(error = %e, "lineage seed failed; saving debit note without lineage");
                }
            }
        }
    }

    // ---- Build insert doc ----------------------------------------------
    let mut new_doc = doc! {
        "_id": new_oid,
        // identity (flattened)
        "userId": user_id,
        "projectId": project_id,
        // audit (flattened) — Audit::new() initializes these in the typed
        // Lead path; for the document path we stamp them explicitly.
        "createdAt": now,
        "updatedAt": now,
        "createdBy": user_id,
        // doc number + dates
        "dnNo": input.dn_no.trim(),
        "date": date_bson,
        // parties + refs
        "vendorId": vendor_oid,
        "reason": reason,
        // money settings
        "currency": input.currency.trim(),
        // line items + totals
        "items": items_bson,
        "totals": totals_bson,
        // refund handling
        "refundMode": refund_mode,
        // workflow — fresh debit notes start as `draft`.
        "status": "draft",
        // soft-delete sentinel.
        "archived": false,
    };
    if let Some(lb) = linked_bill_oid {
        new_doc.insert("linkedBillId", lb);
    }
    if let Some(txn) = input.refund_txn_id.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("refundTxnId", txn);
    }
    if let Some(notes) = input.notes.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("notes", notes);
    }
    if let Some(la) = lineage_array {
        new_doc.insert("lineage", Bson::Array(la));
    }

    // ---- Insert --------------------------------------------------------
    let coll_doc = mongo.collection::<Document>(DEBIT_NOTES_COLL);
    coll_doc.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_debit_notes.insert_one"))
    })?;

    // ---- Best-effort back-link onto the parent's lineage[] -------------
    // Mirrors the `try { ... } catch {}` block in the TS action — the
    // debit note is already persisted, so a failed back-link is logged
    // and swallowed.
    if let Some((parent_coll, parent_oid)) = parent_back_link {
        if let Err(e) =
            backlink_parent(&mongo, parent_coll, parent_oid, &scope, new_oid, now).await
        {
            warn!(error = %e, "parent back-link failed; debit note already saved");
        }
    }

    // ---- Re-read via the typed collection so the response is the
    // canonical [`DebitNote`] shape. -------------------------------------
    let typed = mongo.collection::<DebitNote>(DEBIT_NOTES_COLL);
    let mut filter = scope.filter();
    filter.insert("_id", new_oid);
    let dn = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_debit_notes.find_one(after-insert)"),
            )
        })?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("debit note vanished after insert")))?;

    Ok(Json(dn))
}

/// Fetch the parent bill / purchase order (under the same tenant scope
/// as the new debit note) and build the lineage chain a freshly-created
/// debit note should inherit. Returns `Ok(None)` if the parent doesn't
/// exist or isn't owned by the caller's scope.
async fn seed_lineage_from_parent(
    mongo: &MongoHandle,
    scope: &TenantScope,
    parent_id_hex: &str,
    parent_kind: &str,
    parent_collection: &str,
) -> Result<Option<(Vec<LineageRef>, ObjectId)>> {
    let parent_oid = oid_from_str(parent_id_hex)?;
    let coll = mongo.collection::<Document>(parent_collection);
    let mut parent_filter = scope.filter();
    parent_filter.insert("_id", parent_oid);
    let parent = match coll
        .find_one(parent_filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context(format!("{parent_collection}.find_one(lineage)")),
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

    let chain = build_lineage_from_parent(parent_kind.to_owned(), parent_oid, &parent_chain);
    Ok(Some((chain, parent_oid)))
}

/// Push `{ kind: "debitNote", id: <child> }` onto the parent's
/// `lineage[]` so reverse traversal works. Re-reads the parent's
/// existing lineage and re-renders via [`append_lineage`] (which
/// dedupes on `(kind, id)`) so we never double-link a debit note that
/// somehow already references the same parent.
async fn backlink_parent(
    mongo: &MongoHandle,
    parent_collection: &str,
    parent_oid: ObjectId,
    scope: &TenantScope,
    child_oid: ObjectId,
    now: bson::DateTime,
) -> Result<()> {
    let coll = mongo.collection::<Document>(parent_collection);
    let mut parent_filter = scope.filter();
    parent_filter.insert("_id", parent_oid);
    let parent = coll
        .find_one(parent_filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context(format!("{parent_collection}.find_one(backlink)")),
            )
        })?;
    let Some(parent) = parent else {
        // Parent vanished between the seed and the back-link. Nothing
        // to do — caller already swallowed missing parents at the seed
        // step.
        return Ok(());
    };

    let existing: Vec<LineageRef> = parent
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
    let updated = append_lineage(&existing, LineageRef::new("debitNote", child_oid));
    let updated_arr: Vec<Bson> = updated
        .into_iter()
        .map(|r| Bson::Document(doc! { "kind": r.kind, "id": r.id }))
        .collect();

    coll.update_one(
        parent_filter,
        doc! {
            "$set": {
                "lineage": Bson::Array(updated_arr),
                "updatedAt": now,
            },
        },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context(format!("{parent_collection}.update_one(backlink)")),
        )
    })?;
    Ok(())
}

// =========================================================================
// PATCH /:debitNoteId — update_debit_note
// =========================================================================

/// `PATCH /v1/crm/debit-notes/:debitNoteId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt`
/// and `updatedBy` are always refreshed. Fails with 404 if the row
/// doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, dn_id = %dn_id))]
pub async fn update_debit_note(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(dn_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(input): Json<UpdateDebitNoteInput>,
) -> Result<Json<DebitNote>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let dn_oid = oid_from_str(&dn_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_str(&mut set, "dnNo", input.dn_no.as_ref());
    set_opt_str(&mut set, "currency", input.currency.as_ref());
    set_opt_str(&mut set, "refundTxnId", input.refund_txn_id.as_ref());
    set_opt_str(&mut set, "notes", input.notes.as_ref());

    set_opt_oid(&mut set, "vendorId", input.vendor_id.as_ref())?;
    set_opt_oid(&mut set, "linkedBillId", input.linked_bill_id.as_ref())?;

    if let Some(when) = input.date {
        set.insert("date", bson::DateTime::from_chrono(when));
    }
    if let Some(reason_raw) = input.reason.as_deref() {
        set.insert(
            "reason",
            normalize_enum("reason", reason_raw, ALLOWED_REASONS)?,
        );
    }
    if let Some(rm_raw) = input.refund_mode.as_deref() {
        set.insert(
            "refundMode",
            normalize_enum("refundMode", rm_raw, ALLOWED_REFUND_MODES)?,
        );
    }
    if let Some(status_raw) = input.status.as_deref() {
        set.insert(
            "status",
            normalize_enum("status", status_raw, ALLOWED_STATUSES)?,
        );
    }
    if let Some(items) = input.items.as_ref() {
        let arr = items
            .as_array()
            .ok_or_else(|| ApiError::Validation("items must be an array.".to_owned()))?;
        if arr.is_empty() {
            return Err(ApiError::Validation(
                "items must contain at least one row.".to_owned(),
            ));
        }
        set.insert("items", json_to_bson("items", items)?);
    }
    if let Some(totals) = input.totals.as_ref() {
        if !totals.is_object() {
            return Err(ApiError::Validation("totals must be an object.".to_owned()));
        }
        set.insert("totals", json_to_bson("totals", totals)?);
    }

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", dn_oid);

    let coll = mongo.collection::<Document>(DEBIT_NOTES_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_debit_notes.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("debit_note".to_owned()));
    }

    // Re-read via the typed collection so the response is the canonical
    // [`DebitNote`] shape (and any defaults / skipped fields render
    // correctly).
    let typed = mongo.collection::<DebitNote>(DEBIT_NOTES_COLL);
    let dn = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_debit_notes.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("debit_note".to_owned()))?;

    Ok(Json(dn))
}

// =========================================================================
// DELETE /:debitNoteId — delete_debit_note (hard)
// =========================================================================

/// `DELETE /v1/crm/debit-notes/:debitNoteId` — **hard delete**. Per the
/// CRM ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities
/// use hard deletes — the row is removed from the collection. Mirrors
/// `crm_leads::delete_lead`. Fails with 404 if the row doesn't exist OR
/// isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, dn_id = %dn_id))]
pub async fn delete_debit_note(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(dn_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let dn_oid = oid_from_str(&dn_id)?;

    let mut filter = scope.filter();
    filter.insert("_id", dn_oid);

    let coll = mongo.collection::<Document>(DEBIT_NOTES_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_debit_notes.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("debit_note".to_owned()));
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
        set_opt_str(&mut d, "name", None);
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_str_inserts_some() {
        let mut d = doc! {};
        let v = "DN-001".to_owned();
        set_opt_str(&mut d, "dnNo", Some(&v));
        assert_eq!(d.get_str("dnNo").unwrap(), "DN-001");
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "vendorId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn set_opt_oid_inserts_valid() {
        let mut d = doc! {};
        let v = "507f1f77bcf86cd799439011".to_owned();
        set_opt_oid(&mut d, "vendorId", Some(&v)).unwrap();
        assert!(d.get_object_id("vendorId").is_ok());
    }

    #[test]
    fn normalize_enum_lowercases_and_validates() {
        assert_eq!(
            normalize_enum("reason", "RETURN", ALLOWED_REASONS).unwrap(),
            "return"
        );
        assert_eq!(
            normalize_enum("refundMode", "Replacement", ALLOWED_REFUND_MODES).unwrap(),
            "replacement"
        );
    }

    #[test]
    fn normalize_enum_rejects_unknown() {
        let err = normalize_enum("status", "shipped", ALLOWED_STATUSES).expect_err("must reject");
        assert!(matches!(err, ApiError::Validation(_)));
    }

    #[test]
    fn allowed_parent_kinds_match_g6_pattern() {
        // G6 in the TS action allows exactly these two parent kinds.
        assert_eq!(ALLOWED_PARENT_KINDS, &["bill", "purchaseOrder"]);
    }

    #[test]
    fn json_to_bson_round_trips_an_array() {
        let v = serde_json::json!([{"qty": 2.0, "rate": 100.0, "total": 200.0}]);
        let b = json_to_bson("items", &v).unwrap();
        assert!(matches!(b, Bson::Array(_)));
    }
}
