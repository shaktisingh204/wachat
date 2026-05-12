//! HTTP handlers for the §5.1 Lead entity.
//!
//! Mirrors `src/app/actions/crm-leads.actions.ts` — read-only research
//! reference; the TS file stays in production until the API host
//! crate routes traffic here. Five handlers:
//!
//! | Method  | Path             | Function           |
//! |---------|------------------|--------------------|
//! | `GET`   | `/`              | [`list_leads`]     |
//! | `GET`   | `/:leadId`       | [`get_lead`]       |
//! | `POST`  | `/`              | [`create_lead`]    |
//! | `PATCH` | `/:leadId`       | [`update_lead`]    |
//! | `DELETE`| `/:leadId`       | [`delete_lead`]    |
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! — the CRM tenant root from `crm-core::Identity`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{Assignment, Attribution, Audit, Identity, Status};
use crm_sales_crm_types::Lead;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{CreateLeadInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, UpdateLeadInput};

/// Mongo collection name. Must match the TS `crm_leads.actions.ts`
/// literal so the Rust BFF and the legacy Next.js action share the
/// same backing collection during the migration window.
const LEADS_COLL: &str = "crm_leads";

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

/// Materialize the base ownership filter: `{ userId, archived: { $ne: true } }`.
/// Soft-deleted rows (`archived = true`) are excluded by default; callers
/// that want to surface them must build their own filter.
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

// =========================================================================
// GET / — list_leads
// =========================================================================

/// `GET /v1/crm/leads` — paginated list scoped to the authenticated
/// user's leads. The `q` query param does a case-insensitive substring
/// search across `firstName`, `lastName`, `email`, `company`, and
/// `title`. Sorted by `createdAt` desc to match the TS action.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_leads(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Lead>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "firstName": regex.clone() }),
                Bson::Document(doc! { "lastName": regex.clone() }),
                Bson::Document(doc! { "email": regex.clone() }),
                Bson::Document(doc! { "company": regex.clone() }),
                Bson::Document(doc! { "title": regex }),
            ]),
        );
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<Lead>(LEADS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_leads.find")))?;
    let leads: Vec<Lead> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_leads.collect")))?;

    Ok(Json(leads))
}

// =========================================================================
// GET /:leadId — get_lead
// =========================================================================

/// `GET /v1/crm/leads/:leadId` — fetch a single lead. Returns 404 if
/// the lead doesn't exist OR isn't owned by the caller (we deliberately
/// collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, lead_id = %lead_id))]
pub async fn get_lead(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(lead_id): Path<String>,
) -> Result<Json<Lead>> {
    let user_id = user_oid(&user)?;
    let lead_oid = oid_from_str(&lead_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", lead_oid);

    let coll = mongo.collection::<Lead>(LEADS_COLL);
    let lead = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_leads.find_one")))?
        .ok_or_else(|| ApiError::NotFound("lead".to_owned()))?;

    Ok(Json(lead))
}

// =========================================================================
// POST / — create_lead
// =========================================================================

/// `POST /v1/crm/leads` — insert a new lead.
///
/// Builds a [`Lead`] from the curated [`CreateLeadInput`], stamps
/// `Identity` + `Audit`, persists it, and returns the full document.
///
/// **Lineage:** the input accepts `fromKind` + `fromId` for
/// forward-compatibility, but the lead document itself does not yet
/// carry a `lineage[]` field (see `crm-sales-crm-types::lead`). When
/// the Deal-from-Lead converter lands and we settle on whether the
/// chain lives on the lead, the deal, or both, this handler will be
/// updated to seed it via [`crm_core::build_lineage_from_parent`]. For
/// now the fields are accepted but ignored — log a warn so the
/// integration test catches us if a caller starts depending on it.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_lead(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateLeadInput>,
) -> Result<Json<Lead>> {
    if input.first_name.trim().is_empty() || input.last_name.trim().is_empty() {
        return Err(ApiError::Validation(
            "firstName and lastName are required.".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        // The §5.1 spec requires a project scope, but the legacy TS
        // action did not — single-tenant callers omit it and pick up a
        // freshly-minted id at insert time. Match the legacy behaviour
        // so existing UI keeps working during the migration window.
        None => ObjectId::new(),
    };

    let owner = match input.owner_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let assigned = match input.assigned_to.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    // Lineage: forward-compat only — see the function-level comment.
    if input.from_kind.is_some() || input.from_id.is_some() {
        tracing::warn!(
            from_kind = ?input.from_kind,
            from_id = ?input.from_id,
            "create_lead received fromKind/fromId; lineage on Lead is not yet persisted",
        );
    }

    let lead = Lead {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        attribution: Attribution {
            source: input.source.clone(),
            ..Default::default()
        },
        assignment: Assignment {
            assigned_to: assigned,
            ..Default::default()
        },
        first_name: input.first_name.trim().to_owned(),
        last_name: input.last_name.trim().to_owned(),
        email: input.email.clone(),
        phone: input.phone.clone(),
        company: input.company.clone(),
        title: input.title.clone(),
        sub_source: input.sub_source.clone(),
        status: input.status.as_deref().map(Status::new),
        lead_score: input.lead_score,
        owner_id: owner,
        estimated_value: input.estimated_value,
        currency: input
            .currency
            .clone()
            // Match the TS default at `crm-leads.actions.ts:113`
            // (`validatedFields.data.currency || 'INR'`).
            .or_else(|| Some("INR".to_owned())),
        probability_pct: input.probability_pct,
        expected_close: input.expected_close,
        address: None,
        industry: input.industry.clone(),
        consent: Default::default(),
        tags: Default::default(),
        custom_fields: Default::default(),
        attachments: Vec::new(),
        notes: Vec::new(),
        activity_log: Vec::new(),
    };

    let coll = mongo.collection::<Lead>(LEADS_COLL);
    coll.insert_one(&lead)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_leads.insert_one")))?;

    Ok(Json(lead))
}

// =========================================================================
// PATCH /:leadId — update_lead
// =========================================================================

/// `PATCH /v1/crm/leads/:leadId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt` and
/// `updatedBy` are always refreshed. Fails with 404 if the lead doesn't
/// exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, lead_id = %lead_id))]
pub async fn update_lead(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(lead_id): Path<String>,
    Json(input): Json<UpdateLeadInput>,
) -> Result<Json<Lead>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let lead_oid = oid_from_str(&lead_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_str(&mut set, "firstName", input.first_name.as_ref());
    set_opt_str(&mut set, "lastName", input.last_name.as_ref());
    set_opt_str(&mut set, "email", input.email.as_ref());
    set_opt_str(&mut set, "phone", input.phone.as_ref());
    set_opt_str(&mut set, "company", input.company.as_ref());
    set_opt_str(&mut set, "title", input.title.as_ref());
    set_opt_str(&mut set, "source", input.source.as_ref());
    set_opt_str(&mut set, "subSource", input.sub_source.as_ref());
    set_opt_str(&mut set, "status", input.status.as_ref());
    set_opt_str(&mut set, "currency", input.currency.as_ref());
    set_opt_str(&mut set, "industry", input.industry.as_ref());
    set_opt_oid(&mut set, "ownerId", input.owner_id.as_ref())?;
    set_opt_oid(&mut set, "assignedTo", input.assigned_to.as_ref())?;
    if let Some(score) = input.lead_score {
        set.insert("leadScore", score);
    }
    if let Some(value) = input.estimated_value {
        set.insert("estimatedValue", value);
    }
    if let Some(pct) = input.probability_pct {
        set.insert("probabilityPct", pct as f64);
    }
    if let Some(when) = input.expected_close {
        set.insert("expectedClose", bson::DateTime::from_chrono(when));
    }

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", lead_oid);

    let coll = mongo.collection::<Document>(LEADS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_leads.update_one")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("lead".to_owned()));
    }

    // Re-read via the typed collection so the response is the canonical
    // [`Lead`] shape (and any defaults / skipped fields render correctly).
    let typed = mongo.collection::<Lead>(LEADS_COLL);
    let lead = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_leads.find_one(after-update)"))
        })?
        .ok_or_else(|| ApiError::NotFound("lead".to_owned()))?;

    Ok(Json(lead))
}

// =========================================================================
// DELETE /:leadId — delete_lead (soft)
// =========================================================================

/// `DELETE /v1/crm/leads/:leadId` — **hard delete**. Per the CRM
/// ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities use
/// hard deletes — the row is removed from the collection. Fails with
/// 404 if the lead doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, lead_id = %lead_id))]
pub async fn delete_lead(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(lead_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let lead_oid = oid_from_str(&lead_id)?;

    let filter = doc! { "_id": lead_oid, "userId": user_id };

    let coll = mongo.collection::<Document>(LEADS_COLL);
    let res = coll
        .delete_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_leads.delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("lead".to_owned()));
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
        let v = "hi".to_owned();
        set_opt_str(&mut d, "name", Some(&v));
        assert_eq!(d.get_str("name").unwrap(), "hi");
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "ownerId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }
}
