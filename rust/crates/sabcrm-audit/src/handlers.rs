//! HTTP handlers for the SabCRM audit domain.
//!
//! Append / list over the `sabcrm_audit` Mongo collection.
//!
//! | Endpoint                          | Operation        |
//! |-----------------------------------|------------------|
//! | `GET    /v1/sabcrm/audit`         | list entries     |
//! | `POST   /v1/sabcrm/audit`         | append an entry  |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId }`. The `actorId` recorded
//! on a write is the caller from the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor — never a request body. `createdAt` is server-set.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::chain::{self, GENESIS_PREV_HASH};
use crate::dto::{
    AppendAuditInput, ChainBreak, EntryResponse, ListQuery, ListResponse, VerifyQuery,
    VerifyResponse,
};

/// The Mongo collection backing the change/audit log.
const AUDIT_COLL: &str = "sabcrm_audit";

/// Default page size when `limit` is omitted.
const DEFAULT_LIMIT: i64 = 100;
/// Hard cap on `limit` regardless of the requested value.
const MAX_LIMIT: i64 = 500;

// ===========================================================================
// helpers
// ===========================================================================

/// Reject an empty `projectId` early — every filter leads with it.
fn require_project(project_id: &str) -> Result<&str> {
    let p = project_id.trim();
    if p.is_empty() {
        return Err(ApiError::Validation("projectId is required.".to_owned()));
    }
    Ok(p)
}

/// Parse an RFC3339 date-range bound and normalize it to a canonical UTC
/// RFC3339 string.
///
/// Stored `createdAt` values are `Utc::now().to_rfc3339()` (UTC, fixed
/// width), and the list filter compares the bound lexicographically via
/// `$gte` / `$lte`. Converting the parsed instant back through
/// `Utc::to_rfc3339()` guarantees both sides share the exact same format, so
/// the string comparison matches chronological order regardless of the
/// caller's input offset (e.g. a `+05:30` bound becomes its UTC equivalent).
fn parse_rfc3339(value: &str, field: &str) -> Result<String> {
    let parsed = chrono::DateTime::parse_from_rfc3339(value).map_err(|_| {
        ApiError::Validation(format!("{field} must be a valid RFC3339 timestamp."))
    })?;
    Ok(parsed.with_timezone(&Utc).to_rfc3339())
}

/// Clean a stored document into the wire JSON, renaming `_id` → `id` (hex).
fn record_to_wire(doc: Document) -> Value {
    let mut json = document_to_clean_json(doc);
    if let Value::Object(map) = &mut json {
        if let Some(id) = map.remove("_id") {
            map.insert("id".to_owned(), id);
        }
    }
    json
}

// ===========================================================================
// GET / — list audit entries
// ===========================================================================

/// `GET /v1/sabcrm/audit` — list a project's audit entries, newest first
/// (`createdAt` desc).
///
/// Twenty-parity query depth: the append-only log can be narrowed by acting
/// `actorId`, `action`, target `object` + `recordId`, and a `[from, to]`
/// `createdAt` date range, then paginated. `page` is 1-based and defaults to
/// 1; `limit` defaults to 100 and is capped at 500. The response carries the
/// resolved `page` / `limit` and the `total` count of matching entries across
/// all pages.
///
/// `createdAt` is stored as a fixed-width RFC3339 UTC string, so the range
/// bounds (`from` / `to`) are validated as RFC3339 and applied as
/// lexicographic `$gte` / `$lte` — which orders identically to chronological
/// order for that format.
#[instrument(skip_all)]
pub async fn list_audit(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    // ---- Pagination ----------------------------------------------------
    let page = query.page.filter(|p| *p > 0).unwrap_or(1);
    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let limit_u = limit as u64;
    let skip = (page - 1).saturating_mul(limit_u);

    // ---- Filter --------------------------------------------------------
    let mut filter = doc! { "projectId": project_id };
    if let Some(actor_id) = query.actor_id.as_deref().map(str::trim) {
        if !actor_id.is_empty() {
            filter.insert("actorId", actor_id);
        }
    }
    if let Some(action) = query.action.as_deref().map(str::trim) {
        if !action.is_empty() {
            filter.insert("action", action);
        }
    }
    if let Some(object) = query.object.as_deref().map(str::trim) {
        if !object.is_empty() {
            filter.insert("object", object);
        }
    }
    if let Some(record_id) = query.record_id.as_deref().map(str::trim) {
        if !record_id.is_empty() {
            filter.insert("recordId", record_id);
        }
    }

    // ---- Date range over the RFC3339 `createdAt` string ----------------
    let mut created_range = Document::new();
    if let Some(from) = query.from.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        created_range.insert("$gte", parse_rfc3339(from, "from")?);
    }
    if let Some(to) = query.to.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        created_range.insert("$lte", parse_rfc3339(to, "to")?);
    }
    if !created_range.is_empty() {
        filter.insert("createdAt", created_range);
    }

    let coll = mongo.collection::<Document>(AUDIT_COLL);

    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_audit.count")))?;

    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_audit.find")))?;

    let mut entries = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_audit.cursor")))?
    {
        entries.push(record_to_wire(d));
    }

    Ok(Json(ListResponse {
        entries,
        total,
        page,
        limit: limit_u,
    }))
}

// ===========================================================================
// POST / — append an audit entry
// ===========================================================================

/// `POST /v1/sabcrm/audit` — append an audit entry for the caller. The
/// `actorId` is the caller (from `AuthUser`) and `createdAt` is server-set.
#[instrument(skip_all)]
pub async fn append_audit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<AppendAuditInput>,
) -> Result<Json<EntryResponse>> {
    let project_id = require_project(&body.project_id)?;
    let action = body.action.trim();
    if action.is_empty() {
        return Err(ApiError::Validation("action is required.".to_owned()));
    }

    let mut entry = doc! {
        "_id": ObjectId::new(),
        "projectId": project_id,
        "actorId": &user.user_id,
        "action": action,
        "createdAt": Utc::now().to_rfc3339(),
    };

    if let Some(object) = body.object.as_deref().map(str::trim) {
        if !object.is_empty() {
            entry.insert("object", object);
        }
    }
    if let Some(record_id) = body.record_id.as_deref().map(str::trim) {
        if !record_id.is_empty() {
            entry.insert("recordId", record_id);
        }
    }
    if let Some(summary) = body.summary.as_deref().map(str::trim) {
        if !summary.is_empty() {
            entry.insert("summary", summary);
        }
    }
    if let Some(meta) = body.meta.as_ref() {
        let bson = bson::to_bson(meta).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_audit.meta.to_bson"))
        })?;
        if !matches!(bson, Bson::Null) {
            entry.insert("meta", bson);
        }
    }

    let coll = mongo.collection::<Document>(AUDIT_COLL);

    // ---- Hash-chain tamper-evidence ------------------------------------
    // Link this event onto the project's chain: `prevHash` is the hash of the
    // current chain tip (the most-recently inserted entry for this project),
    // or the genesis sentinel for the first ever entry. `hash` folds the
    // canonical content together with `prevHash`, so editing/deleting any
    // historical entry later breaks this link on verification.
    let prev_hash = chain_tip_hash(&coll, project_id).await?;
    entry.insert("prevHash", &prev_hash);
    let hash = chain::chain_hash(&entry, &prev_hash);
    entry.insert("hash", &hash);

    coll.insert_one(&entry)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_audit.insert_one"))
        })?;

    Ok(Json(EntryResponse {
        entry: record_to_wire(entry),
    }))
}

/// Read the `hash` of a project's chain tip — the most-recently inserted
/// entry for `project_id` — or [`GENESIS_PREV_HASH`] when the chain is empty.
///
/// "Most recent" is by `_id` descending: ObjectIds are monotonic in creation
/// order, so this is the true insertion order even when two events share a
/// (second-granularity) `createdAt` string.
async fn chain_tip_hash(
    coll: &mongodb::Collection<Document>,
    project_id: &str,
) -> Result<String> {
    let tip = coll
        .find_one(doc! { "projectId": project_id })
        .sort(doc! { "_id": -1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_audit.chain_tip"))
        })?;

    Ok(tip
        .and_then(|d| d.get_str("hash").ok().map(str::to_owned))
        .unwrap_or_else(|| GENESIS_PREV_HASH.to_owned()))
}

// ===========================================================================
// GET /verify — verify the audit hash-chain
// ===========================================================================

/// `GET /v1/sabcrm/audit/verify` — walk a project's audit hash-chain and
/// report the first broken link.
///
/// Mongo is append-only by convention only; the hash-chain makes any edit,
/// deletion, or reorder of a historical entry *detectable*. The chain is
/// walked in insertion order (`_id` ascending). For each entry the handler:
///
/// 1. checks `prevHash` equals the previous entry's stored `hash` (the
///    genesis sentinel for the first entry); and
/// 2. recomputes `sha256(canonical(entry) || prevHash)` and checks it equals
///    the entry's stored `hash`.
///
/// The first entry that fails either check is reported as the
/// [`break_at`](crate::dto::VerifyResponse::break_at) — the earliest point
/// where the log no longer self-verifies. A chain with no entries is
/// trivially intact.
#[instrument(skip_all)]
pub async fn verify_chain(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<VerifyQuery>,
) -> Result<Json<VerifyResponse>> {
    let project_id = require_project(&query.project_id)?;

    let coll = mongo.collection::<Document>(AUDIT_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project_id })
        .sort(doc! { "_id": 1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_audit.verify.find"))
        })?;

    let mut expected_prev = GENESIS_PREV_HASH.to_owned();
    let mut checked: u64 = 0;

    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_audit.verify.cursor"))
    })? {
        let index = checked;
        checked += 1;

        let entry_id = d
            .get_object_id("_id")
            .map(|o| o.to_hex())
            .unwrap_or_default();
        let created_at = d.get_str("createdAt").ok().map(str::to_owned);
        let stored_hash = d.get_str("hash").unwrap_or("").to_owned();
        let stored_prev = d.get_str("prevHash").unwrap_or("").to_owned();

        // (1) Link continuity: this entry's prevHash must equal the running
        //     expected predecessor hash.
        if stored_prev != expected_prev {
            return Ok(Json(VerifyResponse {
                project_id: project_id.to_owned(),
                intact: false,
                checked,
                break_at: Some(ChainBreak {
                    entry_id,
                    index,
                    created_at,
                    reason: format!(
                        "prevHash mismatch: expected predecessor hash {expected_prev}, \
                         entry stores {stored_prev} (a prior entry was altered, \
                         removed, or reordered)"
                    ),
                    stored_hash,
                    computed_hash: expected_prev,
                }),
            }));
        }

        // (2) Content integrity: recompute the hash over the entry's content
        //     plus its stored prevHash; it must equal the stored hash.
        let computed = chain::chain_hash(&d, &stored_prev);
        if computed != stored_hash {
            return Ok(Json(VerifyResponse {
                project_id: project_id.to_owned(),
                intact: false,
                checked,
                break_at: Some(ChainBreak {
                    entry_id,
                    index,
                    created_at,
                    reason:
                        "hash mismatch: recomputed content hash does not match the stored \
                         hash (this entry's content was altered)"
                            .to_owned(),
                    stored_hash,
                    computed_hash: computed,
                }),
            }));
        }

        expected_prev = stored_hash;
    }

    Ok(Json(VerifyResponse {
        project_id: project_id.to_owned(),
        intact: true,
        checked,
        break_at: None,
    }))
}
