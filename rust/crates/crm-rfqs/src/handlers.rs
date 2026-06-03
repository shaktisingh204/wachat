//! HTTP handlers for the §12.3 RFQ entity.
//!
//! Mirrors the existing TS surface for `crm_rfqs` — read-only research
//! reference; the TS file stays in production until the API host crate
//! routes traffic here. Five handlers:
//!
//! | Method   | Path             | Function       |
//! |----------|------------------|----------------|
//! | `GET`    | `/`              | [`list_rfqs`]  |
//! | `GET`    | `/:rfqId`        | [`get_rfq`]    |
//! | `POST`   | `/`              | [`create_rfq`] |
//! | `PATCH`  | `/:rfqId`        | [`update_rfq`] |
//! | `DELETE` | `/:rfqId`        | [`delete_rfq`] |
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! — the CRM tenant root from `crm-core::Identity`.
//!
//! ## Lineage seeding (mirrors `crm-quotations`)
//!
//! On create the body may carry `fromKind: "lead" | "deal"` + `fromId`;
//! when both are present the handler fetches the parent under the same
//! `userId` scope and seeds the new RFQ's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. A best-effort back-link is
//! also pushed onto the parent's `lineage[]`. Failures are non-fatal —
//! the RFQ still saves.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{Audit, Identity, LineageRef, build_lineage_from_parent};
use crm_extras_types::{Rfq, RfqStatus};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::{instrument, warn};

use crate::dto::{CreateRfqInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, UpdateRfqInput};

/// Mongo collection name. Must match the canonical collection literal in
/// `crm-extras-types::rfq` so the Rust BFF and the legacy Next.js action
/// share the same backing collection during the migration window.
const RFQS_COLL: &str = "crm_rfqs";
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

/// Validate an RFQ workflow status string. Mirrors the lowercase serde
/// representation of [`RfqStatus`] so the document round-trips cleanly.
fn validate_status(status: &str) -> Result<String> {
    let normalized = status.trim().to_ascii_lowercase();
    if !matches!(
        normalized.as_str(),
        "draft" | "open" | "closed" | "awarded" | "cancelled"
    ) {
        return Err(ApiError::Validation(
            "status must be one of: draft, open, closed, awarded, cancelled.".to_owned(),
        ));
    }
    Ok(normalized)
}

/// Parse a vector of hex-encoded `ObjectId`s, rejecting any malformed
/// entry with `BadRequest`. Empty strings are skipped (same convention
/// as the sibling crates).
fn parse_oid_vec(ids: &[String]) -> Result<Vec<ObjectId>> {
    ids.iter()
        .filter(|s| !s.is_empty())
        .map(|s| oid_from_str(s.as_str()))
        .collect()
}

/// Fetch the parent document (scoped by `userId`) and build the lineage
/// chain a freshly-created RFQ should inherit. Returns `Ok(None)` if the
/// parent doesn't exist or isn't owned by the caller.
async fn seed_lineage_from_parent(
    mongo: &MongoHandle,
    user_oid_v: ObjectId,
    parent_kind: &str,
    parent_id_hex: &str,
) -> Result<Option<(Vec<LineageRef>, ObjectId, &'static str)>> {
    let coll_name = match parent_coll_for(parent_kind) {
        Some(c) => c,
        None => return Ok(None),
    };
    let parent_oid = oid_from_str(parent_id_hex)?;
    let parents = mongo.collection::<Document>(coll_name);
    let parent = match parents
        .find_one(doc! { "_id": parent_oid, "userId": user_oid_v })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_rfqs.parent.find_one"))
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
// GET / — list_rfqs
// =========================================================================

/// `GET /v1/crm/rfqs` — paginated list scoped to the authenticated
/// user's RFQs. The `q` query param does a case-insensitive substring
/// search across `title` and `terms`. Sorted by `createdAt` desc.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_rfqs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Rfq>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "title": regex.clone() }),
                Bson::Document(doc! { "terms": regex }),
            ]),
        );
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

    let coll = mongo.collection::<Rfq>(RFQS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_rfqs.find")))?;
    let rfqs: Vec<Rfq> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_rfqs.collect")))?;

    Ok(Json(rfqs))
}

// =========================================================================
// GET /:rfqId — get_rfq
// =========================================================================

/// `GET /v1/crm/rfqs/:rfqId` — fetch a single RFQ. Returns 404 if the
/// RFQ doesn't exist OR isn't owned by the caller (we deliberately
/// collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, rfq_id = %rfq_id))]
pub async fn get_rfq(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(rfq_id): Path<String>,
) -> Result<Json<Rfq>> {
    let user_id = user_oid(&user)?;
    let rfq_oid = oid_from_str(&rfq_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", rfq_oid);

    let coll = mongo.collection::<Rfq>(RFQS_COLL);
    let rfq = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_rfqs.find_one")))?
        .ok_or_else(|| ApiError::NotFound("rfq".to_owned()))?;

    Ok(Json(rfq))
}

// =========================================================================
// POST / — create_rfq
// =========================================================================

/// `POST /v1/crm/rfqs` — insert a new RFQ.
///
/// Validates the curated [`CreateRfqInput`], stamps `Identity` +
/// `Audit`, optionally seeds `lineage[]` from a parent lead/deal, and
/// persists the new document.
///
/// **Lineage:** when `fromKind` ∈ {`"lead"`, `"deal"`} and `fromId` is a
/// valid `ObjectId` of a parent owned by the same user, the new RFQ's
/// `lineage[]` is seeded via [`crm_core::build_lineage_from_parent`] and
/// a best-effort back-link is pushed onto the parent's lineage.
/// Mismatched / unscoped parents quietly skip the seed (the RFQ still
/// saves).
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_rfq(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRfqInput>,
) -> Result<Json<Rfq>> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required.".to_owned()));
    }
    if input.items.is_empty() {
        return Err(ApiError::Validation(
            "at least one line item is required.".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        // Match the legacy TS behaviour: stamp a freshly-minted id when
        // the caller doesn't pass one. Production callers SHOULD send
        // the real projectId.
        None => ObjectId::new(),
    };

    let vendors_invited = parse_oid_vec(&input.vendors_invited)?;

    // ---- Lineage seeding (mirrors crm-quotations) ----------------------
    let mut lineage_chain: Vec<LineageRef> = Vec::new();
    let mut parent_back_link: Option<(&'static str, ObjectId)> = None;
    if let (Some(kind), Some(parent_id)) = (input.from_kind.as_deref(), input.from_id.as_deref()) {
        if !kind.is_empty() && !parent_id.is_empty() {
            match seed_lineage_from_parent(&mongo, user_id, kind, parent_id).await {
                Ok(Some((chain, parent_oid, coll_name))) => {
                    lineage_chain = chain;
                    parent_back_link = Some((coll_name, parent_oid));
                }
                Ok(None) => {
                    // Parent not found / not owned / unsupported kind —
                    // quietly skip seeding. The RFQ still saves.
                }
                Err(e) => {
                    warn!(error = %e, "lineage seed failed; saving rfq without lineage");
                }
            }
        }
    }

    let new_oid = ObjectId::new();
    let now = Utc::now();

    let rfq = Rfq {
        identity: Identity {
            id: new_oid,
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        title: input.title.trim().to_owned(),
        items: input.items.clone(),
        required_by: input.required_by,
        vendors_invited,
        terms: input
            .terms
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(ToOwned::to_owned),
        deadline: input.deadline,
        status: RfqStatus::default(),
        attachments: input.attachments.clone(),
        lineage: lineage_chain,
    };

    let coll = mongo.collection::<Rfq>(RFQS_COLL);
    coll.insert_one(&rfq)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_rfqs.insert_one")))?;

    // Best-effort back-link onto the parent's lineage (non-fatal).
    if let Some((parent_coll, parent_oid)) = parent_back_link {
        let parents = mongo.collection::<Document>(parent_coll);
        let _ = parents
            .update_one(
                doc! { "_id": parent_oid, "userId": user_id },
                doc! {
                    "$push": { "lineage": { "kind": "rfq", "id": new_oid } },
                    "$set":  { "updatedAt": bson::DateTime::from_chrono(now) },
                },
            )
            .await;
    }

    Ok(Json(rfq))
}

// =========================================================================
// PATCH /:rfqId — update_rfq
// =========================================================================

/// `PATCH /v1/crm/rfqs/:rfqId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt` and
/// `updatedBy` are always refreshed. Fails with 404 if the RFQ doesn't
/// exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, rfq_id = %rfq_id))]
pub async fn update_rfq(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(rfq_id): Path<String>,
    Json(input): Json<UpdateRfqInput>,
) -> Result<Json<Rfq>> {
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
    let rfq_oid = oid_from_str(&rfq_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    if let Some(t) = input
        .title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        set.insert("title", t);
    }
    if let Some(items) = input.items.as_ref() {
        let bson_items = bson::to_bson(items)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("rfq.items.bson")))?;
        set.insert("items", bson_items);
    }
    if let Some(when) = input.required_by {
        set.insert("requiredBy", bson::DateTime::from_chrono(when));
    }
    if let Some(ids) = input.vendors_invited.as_ref() {
        let oids = parse_oid_vec(ids)?;
        set.insert(
            "vendorsInvited",
            Bson::Array(oids.into_iter().map(Bson::ObjectId).collect()),
        );
    }
    if let Some(t) = input.terms.as_ref() {
        set.insert("terms", t.as_str());
    }
    if let Some(when) = input.deadline {
        set.insert("deadline", bson::DateTime::from_chrono(when));
    }
    if let Some(status) = input.status.as_deref() {
        let normalized = validate_status(status)?;
        set.insert("status", normalized);
    }
    if let Some(att) = input.attachments.as_ref() {
        let bson_att = bson::to_bson(att).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("rfq.attachments.bson"))
        })?;
        set.insert("attachments", bson_att);
    }

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", rfq_oid);

    let coll = mongo.collection::<Document>(RFQS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_rfqs.update_one")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("rfq".to_owned()));
    }

    // Re-read via the typed collection so the response is the canonical
    // [`Rfq`] shape (and any defaults / skipped fields render correctly).
    let typed = mongo.collection::<Rfq>(RFQS_COLL);
    let rfq = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_rfqs.find_one(after-update)"))
        })?
        .ok_or_else(|| ApiError::NotFound("rfq".to_owned()))?;

    Ok(Json(rfq))
}

// =========================================================================
// DELETE /:rfqId — delete_rfq (hard)
// =========================================================================

/// `DELETE /v1/crm/rfqs/:rfqId` — **hard delete**. Per the CRM
/// ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities use
/// hard deletes — the row is removed from the collection. Fails with
/// 404 if the RFQ doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, rfq_id = %rfq_id))]
pub async fn delete_rfq(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(rfq_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let rfq_oid = oid_from_str(&rfq_id)?;

    let filter = doc! { "_id": rfq_oid, "userId": user_id };

    let coll = mongo.collection::<Document>(RFQS_COLL);
    let res = coll
        .delete_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_rfqs.delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("rfq".to_owned()));
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
    fn parent_coll_for_maps_lead_and_deal_only() {
        assert_eq!(parent_coll_for("lead"), Some(LEADS_COLL));
        assert_eq!(parent_coll_for("LEAD"), Some(LEADS_COLL));
        assert_eq!(parent_coll_for("deal"), Some(DEALS_COLL));
        assert_eq!(parent_coll_for("Deal"), Some(DEALS_COLL));
        assert_eq!(parent_coll_for("quotation"), None);
        assert_eq!(parent_coll_for(""), None);
    }

    #[test]
    fn validate_status_accepts_known_values() {
        assert_eq!(validate_status("draft").unwrap(), "draft");
        assert_eq!(validate_status("OPEN").unwrap(), "open");
        assert_eq!(validate_status(" Closed ").unwrap(), "closed");
        assert_eq!(validate_status("awarded").unwrap(), "awarded");
        assert_eq!(validate_status("cancelled").unwrap(), "cancelled");
    }

    #[test]
    fn validate_status_rejects_unknown() {
        let err = validate_status("approved").unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
    }

    #[test]
    fn parse_oid_vec_skips_empty_entries() {
        let raw = vec![
            "507f1f77bcf86cd799439011".to_owned(),
            "".to_owned(),
            "507f1f77bcf86cd799439022".to_owned(),
        ];
        let oids = parse_oid_vec(&raw).unwrap();
        assert_eq!(oids.len(), 2);
    }

    #[test]
    fn parse_oid_vec_rejects_garbage() {
        let raw = vec!["not-an-oid".to_owned()];
        let err = parse_oid_vec(&raw).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }
}
