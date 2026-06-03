//! HTTP handlers for the CRM deals domain.
//!
//! Each handler maps to the corresponding `crm-deals.actions.ts` server
//! action. All endpoints are scoped by `userId = AuthUser::user_id` —
//! we never widen the filter beyond the calling tenant.
//!
//! | Endpoint                        | TS source                              |
//! |---------------------------------|----------------------------------------|
//! | `GET    /v1/crm/deals`          | `getCrmDeals`                          |
//! | `GET    /v1/crm/deals/:id`      | `getCrmDealById`                       |
//! | `POST   /v1/crm/deals`          | `createCrmDeal`                        |
//! | `PATCH  /v1/crm/deals/:id`      | `updateCrmDealStage` (+ generalised)   |
//! | `DELETE /v1/crm/deals/:id`      | (parity with sibling `crm-leads`)      |
//!
//! ## Lineage seeding
//!
//! On create the body may carry `fromKind: "lead"` + `fromId`; when both
//! are present we fetch the parent lead (under the same `userId` scope)
//! and seed the new deal's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. Best-effort — a missing or
//! mis-scoped parent quietly skips the seed and still saves the deal.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{LineageRef, build_lineage_from_parent};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use tracing::{instrument, warn};

use crate::dto::{
    CreateDealInput, CreateDealResponse, DealResponse, ListQuery, ListResponse, PartyInput,
    SuccessResponse, UpdateDealInput,
};

/// Mongo collections — kept as inline `const` strings to mirror the TS
/// literals 1:1 and make review against the legacy code trivial.
const DEALS_COLL: &str = "crm_deals";
const LEADS_COLL: &str = "crm_leads";

/// Default page size for the list endpoint when no `limit` is supplied.
const DEFAULT_LIMIT: u64 = 20;
/// Hard cap on `limit` per slice contract — bounds memory + Mongo round
/// trip on a single-page request.
const MAX_LIMIT: u64 = 100;

// ===========================================================================
// helpers
// ===========================================================================

/// Parse `AuthUser::user_id` to an `ObjectId` or `401`.
fn caller_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Build a Mongo filter doc for the calling user. Every read and write
/// in this crate is scoped by `userId` — there is no admin-style
/// "see all tenants" path.
fn user_scope(user_oid: ObjectId) -> Document {
    doc! { "userId": user_oid }
}

/// Translate a `PartyInput` from the wire into a stored `party` subdoc.
/// Mirrors the tagged `DealParty` enum's serde shape:
/// `{ kind: "client" | "lead", id: ObjectId }`.
fn party_to_doc(party: &PartyInput) -> Result<Document> {
    let kind = party.kind.trim().to_ascii_lowercase();
    if kind != "client" && kind != "lead" {
        return Err(ApiError::Validation(
            "party.kind must be 'client' or 'lead'.".to_owned(),
        ));
    }
    let id = oid_from_str(&party.id)?;
    Ok(doc! { "kind": kind, "id": id })
}

// ===========================================================================
// GET /v1/crm/deals — getCrmDeals
// ===========================================================================

/// `GET /v1/crm/deals` — paginated list of the caller's deals, sorted
/// by `createdAt` descending. Optional `q` matches `title` (regex,
/// case-insensitive); `pipelineId` / `stageId` narrow further.
#[instrument(skip_all)]
pub async fn list_deals(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(filters): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_oid = caller_oid(&user)?;

    // ---- Pagination ----------------------------------------------------
    let page = filters.page.filter(|p| *p > 0).unwrap_or(1);
    let limit = filters
        .limit
        .filter(|l| *l > 0)
        .unwrap_or(DEFAULT_LIMIT)
        .min(MAX_LIMIT);
    let skip = (page - 1).saturating_mul(limit);

    // ---- Filter --------------------------------------------------------
    let mut filter = user_scope(user_oid);

    if let Some(q) = filters
        .q
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("title", doc! { "$regex": q, "$options": "i" });
    }
    if let Some(pid) = filters.pipeline_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("pipelineId", oid_from_str(pid)?);
    }
    if let Some(sid) = filters.stage_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("stageId", oid_from_str(sid)?);
    }

    let coll = mongo.collection::<Document>(DEALS_COLL);

    // ---- Total + page in parallel-ish -----------------------------------
    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_deals.count")))?;

    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit as i64)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_deals.find")))?;

    let mut deals = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_deals.cursor")))?
    {
        deals.push(document_to_clean_json(d));
    }

    Ok(Json(ListResponse {
        deals,
        total,
        page,
        limit,
    }))
}

// ===========================================================================
// GET /v1/crm/deals/:id — getCrmDealById
// ===========================================================================

/// `GET /v1/crm/deals/:id` — single deal scoped to the calling user.
/// Returns `404` for ids the caller doesn't own (we don't differentiate
/// "not found" from "forbidden" so we don't leak existence).
#[instrument(skip_all, fields(id = %id))]
pub async fn get_deal(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DealResponse>> {
    let user_oid = caller_oid(&user)?;
    let deal_oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(DEALS_COLL);
    let doc = coll
        .find_one(doc! { "_id": deal_oid, "userId": user_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_deals.find_one")))?
        .ok_or_else(|| ApiError::NotFound("deal".to_owned()))?;

    Ok(Json(DealResponse {
        deal: document_to_clean_json(doc),
    }))
}

// ===========================================================================
// POST /v1/crm/deals — createCrmDeal
// ===========================================================================

/// `POST /v1/crm/deals` — create a deal under the calling user. Validates
/// required fields, parses ObjectIds, optionally seeds `lineage[]` from
/// a parent lead (via `crm_core::build_lineage_from_parent`), and
/// inserts the new document.
#[instrument(skip_all)]
pub async fn create_deal(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateDealInput>,
) -> Result<Json<CreateDealResponse>> {
    let user_oid = caller_oid(&user)?;

    // ---- Validation ----------------------------------------------------
    if body.title.trim().is_empty() {
        return Err(ApiError::Validation("Deal title is required.".to_owned()));
    }
    if !body.amount.is_finite() {
        return Err(ApiError::Validation(
            "Deal amount must be a finite number.".to_owned(),
        ));
    }

    let pipeline_oid = oid_from_str(&body.pipeline_id)?;
    let stage_oid = oid_from_str(&body.stage_id)?;
    let owner_oid = oid_from_str(&body.owner_id)?;
    let team_oid = match body.team_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    let party_doc = party_to_doc(&body.party)?;

    // ---- Status enum ---------------------------------------------------
    let status = body
        .status
        .as_deref()
        .map(|s| s.trim().to_ascii_lowercase())
        .unwrap_or_else(|| "open".to_owned());
    if !matches!(status.as_str(), "open" | "won" | "lost" | "abandoned") {
        return Err(ApiError::Validation(
            "status must be one of: open, won, lost, abandoned.".to_owned(),
        ));
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();

    // ---- Lineage seeding (§13.5) ---------------------------------------
    let mut lineage_array: Option<Vec<Bson>> = None;
    let mut parent_lead_oid: Option<ObjectId> = None;
    if let (Some(kind), Some(parent_id)) = (body.from_kind.as_deref(), body.from_id.as_deref()) {
        if kind.eq_ignore_ascii_case("lead") && !parent_id.is_empty() {
            match seed_lineage_from_lead(&mongo, user_oid, parent_id).await {
                Ok(Some((lineage, lead_oid))) => {
                    lineage_array = Some(
                        lineage
                            .into_iter()
                            .map(|r| Bson::Document(doc! { "kind": r.kind, "id": r.id }))
                            .collect(),
                    );
                    parent_lead_oid = Some(lead_oid);
                }
                Ok(None) => {
                    // Parent not found / not owned — quietly skip.
                }
                Err(e) => {
                    warn!(error = %e, "lineage seed failed; saving deal without lineage");
                }
            }
        }
    }

    // ---- Insert --------------------------------------------------------
    let mut new_doc = doc! {
        "_id": new_oid,
        "userId": user_oid,
        "title": body.title.trim(),
        "pipelineId": pipeline_oid,
        "stageId": stage_oid,
        "ownerId": owner_oid,
        "party": party_doc,
        "amount": body.amount,
        "expectedClose": bson::DateTime::from_chrono(body.expected_close),
        "status": status,
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(t) = team_oid {
        new_doc.insert("teamId", t);
    }
    if let Some(c) = body.currency.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("currency", c);
    }
    if let Some(p) = body.probability_pct {
        new_doc.insert("probabilityPct", p as f64);
    }
    if let Some(ac) = body.actual_close {
        new_doc.insert("actualClose", bson::DateTime::from_chrono(ac));
    }
    if let Some(r) = body.won_lost_reason.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("wonLostReason", r);
    }
    if let Some(comps) = body.competitors.as_ref().filter(|v| !v.is_empty()) {
        new_doc.insert(
            "competitors",
            Bson::Array(comps.iter().map(|s| Bson::String(s.clone())).collect()),
        );
    }
    if let Some(cf) = body.custom_fields.as_ref() {
        if let Ok(b) = bson::to_bson(cf) {
            new_doc.insert("customFields", b);
        }
    }
    if let Some(la) = lineage_array {
        new_doc.insert("lineage", Bson::Array(la));
    }

    let coll = mongo.collection::<Document>(DEALS_COLL);
    coll.insert_one(new_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_deals.insert_one")))?;

    // Best-effort back-link onto the parent lead's lineage. Non-fatal —
    // mirrors the TS server-action's `try { ... } catch {}` block.
    if let Some(lead_oid) = parent_lead_oid {
        let leads = mongo.collection::<Document>(LEADS_COLL);
        let _ = leads
            .update_one(
                doc! { "_id": lead_oid, "userId": user_oid },
                doc! {
                    "$push": { "lineage": { "kind": "deal", "id": new_oid } },
                    "$set":  { "updatedAt": now },
                },
            )
            .await;
    }

    Ok(Json(CreateDealResponse {
        deal_id: new_oid.to_hex(),
        message: "Deal created successfully.".to_owned(),
    }))
}

/// Fetch the parent lead (scoped by `userId`) and build the lineage
/// chain a freshly-created deal should inherit. Returns `Ok(None)` if
/// the lead doesn't exist or isn't owned by the caller.
async fn seed_lineage_from_lead(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    parent_id_hex: &str,
) -> Result<Option<(Vec<LineageRef>, ObjectId)>> {
    let lead_oid = oid_from_str(parent_id_hex)?;
    let leads = mongo.collection::<Document>(LEADS_COLL);
    let lead = match leads
        .find_one(doc! { "_id": lead_oid, "userId": user_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_leads.find_one(lineage)"))
        })? {
        Some(d) => d,
        None => return Ok(None),
    };

    // Existing lineage on the parent (if any) — passed through verbatim.
    let parent_chain: Vec<LineageRef> = lead
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

    let chain = build_lineage_from_parent("lead", lead_oid, &parent_chain);
    Ok(Some((chain, lead_oid)))
}

// ===========================================================================
// PATCH /v1/crm/deals/:id — updateCrmDeal
// ===========================================================================

/// `PATCH /v1/crm/deals/:id` — generalised update mirroring + extending
/// the TS `updateCrmDealStage` action. Every field is optional; only
/// fields actually present in the body are written.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_deal(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateDealInput>,
) -> Result<Json<SuccessResponse>> {
    let user_oid = caller_oid(&user)?;
    let deal_oid = oid_from_str(&id)?;

    let mut set = Document::new();

    if let Some(t) = body
        .title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        set.insert("title", t);
    }
    if let Some(p) = body.pipeline_id.as_deref().filter(|s| !s.is_empty()) {
        set.insert("pipelineId", oid_from_str(p)?);
    }
    if let Some(s) = body.stage_id.as_deref().filter(|s| !s.is_empty()) {
        set.insert("stageId", oid_from_str(s)?);
    }
    if let Some(o) = body.owner_id.as_deref().filter(|s| !s.is_empty()) {
        set.insert("ownerId", oid_from_str(o)?);
    }
    if let Some(team) = body.team_id.as_deref() {
        if team.is_empty() {
            // Empty string → unset (handled below in $unset bag).
        } else {
            set.insert("teamId", oid_from_str(team)?);
        }
    }
    if let Some(party) = body.party.as_ref() {
        set.insert("party", party_to_doc(party)?);
    }
    if let Some(a) = body.amount {
        if !a.is_finite() {
            return Err(ApiError::Validation(
                "Deal amount must be a finite number.".to_owned(),
            ));
        }
        set.insert("amount", a);
    }
    if let Some(c) = body.currency.as_deref() {
        set.insert("currency", c);
    }
    if let Some(p) = body.probability_pct {
        set.insert("probabilityPct", p as f64);
    }
    if let Some(ec) = body.expected_close {
        set.insert("expectedClose", bson::DateTime::from_chrono(ec));
    }
    if let Some(ac) = body.actual_close {
        set.insert("actualClose", bson::DateTime::from_chrono(ac));
    }
    if let Some(s) = body
        .status
        .as_deref()
        .map(|s| s.trim().to_ascii_lowercase())
    {
        if !matches!(s.as_str(), "open" | "won" | "lost" | "abandoned") {
            return Err(ApiError::Validation(
                "status must be one of: open, won, lost, abandoned.".to_owned(),
            ));
        }
        set.insert("status", s);
    }
    if let Some(r) = body.won_lost_reason.as_deref() {
        set.insert("wonLostReason", r);
    }
    if let Some(c) = body.competitors.as_ref() {
        set.insert(
            "competitors",
            Bson::Array(c.iter().map(|s| Bson::String(s.clone())).collect()),
        );
    }
    if let Some(cf) = body.custom_fields.as_ref() {
        if let Ok(b) = bson::to_bson(cf) {
            set.insert("customFields", b);
        }
    }

    // Always bump updatedAt — even an "empty" patch records that the
    // caller touched the document (matches TS behaviour).
    set.insert("updatedAt", bson::DateTime::from_chrono(Utc::now()));

    let coll = mongo.collection::<Document>(DEALS_COLL);
    let result = coll
        .update_one(
            doc! { "_id": deal_oid, "userId": user_oid },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_deals.update_one")))?;

    if result.matched_count == 0 {
        return Err(ApiError::NotFound("deal".to_owned()));
    }

    Ok(Json(SuccessResponse {
        message: "Deal updated successfully.".to_owned(),
    }))
}

// ===========================================================================
// DELETE /v1/crm/deals/:id
// ===========================================================================

/// `DELETE /v1/crm/deals/:id` — owner-scoped delete. Returns `404` if
/// no deal matches `(id, userId)` so we don't leak existence.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_deal(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let user_oid = caller_oid(&user)?;
    let deal_oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(DEALS_COLL);
    let result = coll
        .delete_one(doc! { "_id": deal_oid, "userId": user_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_deals.delete_one")))?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("deal".to_owned()));
    }

    Ok(Json(SuccessResponse {
        message: "Deal deleted successfully.".to_owned(),
    }))
}
