//! HTTP handlers for the §12.1 Subscription entity.
//!
//! Six handlers — five canonical CRUD plus a dedicated lifecycle
//! transition for `pause`:
//!
//! | Method  | Path             | Function                  |
//! |---------|------------------|---------------------------|
//! | `GET`   | `/`              | [`list_subscriptions`]    |
//! | `GET`   | `/:id`           | [`get_subscription`]      |
//! | `POST`  | `/`              | [`create_subscription`]   |
//! | `PATCH` | `/:id`           | [`update_subscription`]   |
//! | `DELETE`| `/:id`           | [`delete_subscription`]   |
//! | `POST`  | `/:id/pause`     | [`pause_subscription`]    |
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! — the CRM tenant root from `crm-core::Identity`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{Audit, Identity};
use crm_extras_types::subscription::{
    BillingFrequency, DunningStep, RenewalMode, Subscription, SubscriptionEvent, SubscriptionItem,
    SubscriptionStatus,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateSubscriptionInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, PauseSubscriptionInput,
    UpdateSubscriptionInput,
};

/// Mongo collection name. Matches the `crm_subscriptions` literal called
/// out in the §12.1 spec.
const SUBS_COLL: &str = "crm_subscriptions";

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
/// Soft-deleted rows (`archived = true`) are excluded by default.
fn base_ownership_filter(user: ObjectId) -> Document {
    doc! {
        "userId": user,
        "archived": { "$ne": true },
    }
}

/// Serialize a `BillingFrequency` to its on-the-wire string form so we
/// can stuff it into a `$set` document.
fn frequency_str(f: BillingFrequency) -> &'static str {
    match f {
        BillingFrequency::Daily => "daily",
        BillingFrequency::Weekly => "weekly",
        BillingFrequency::Monthly => "monthly",
        BillingFrequency::Quarterly => "quarterly",
        BillingFrequency::Yearly => "yearly",
        BillingFrequency::Custom => "custom",
    }
}

/// Serialize a `RenewalMode` to its on-the-wire string form.
fn renewal_str(r: RenewalMode) -> &'static str {
    match r {
        RenewalMode::Auto => "auto",
        RenewalMode::Manual => "manual",
    }
}

/// Serialize a `SubscriptionStatus` to its on-the-wire string form.
fn status_str(s: SubscriptionStatus) -> &'static str {
    match s {
        SubscriptionStatus::Trial => "trial",
        SubscriptionStatus::Active => "active",
        SubscriptionStatus::PastDue => "past_due",
        SubscriptionStatus::Paused => "paused",
        SubscriptionStatus::Cancelled => "cancelled",
        SubscriptionStatus::Expired => "expired",
    }
}

/// Convert a `SubscriptionItem` to a BSON document for `$set`.
fn item_to_doc(it: &SubscriptionItem) -> Document {
    doc! {
        "itemId": it.item_id,
        "qty": it.qty,
        "rate": it.rate,
        "currency": &it.currency,
    }
}

/// Convert a `DunningStep` to a BSON document for `$set`.
fn dunning_to_doc(s: &DunningStep) -> Document {
    let mut d = doc! {
        "dayOffset": s.day_offset,
        "action": &s.action,
    };
    if let Some(t) = s.template_id {
        d.insert("templateId", t);
    }
    d
}

// =========================================================================
// GET / — list_subscriptions
// =========================================================================

/// `GET /v1/crm/subscriptions` — paginated list scoped to the
/// authenticated user. `customerId` and `status` filter exactly;
/// `q` does a case-insensitive substring search across the first
/// item currency (best-effort — operators usually filter by customer
/// or status).
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_subscriptions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Subscription>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);

    if let Some(cust) = q.customer_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("customerId", oid_from_str(cust)?);
    }
    if let Some(status) = q.status {
        filter.insert("status", status_str(status));
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![Bson::Document(doc! { "items.currency": regex })]),
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

    let coll = mongo.collection::<Subscription>(SUBS_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_subscriptions.find"))
        })?;
    let subs: Vec<Subscription> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_subscriptions.collect"))
    })?;

    Ok(Json(subs))
}

// =========================================================================
// GET /:id — get_subscription
// =========================================================================

/// `GET /v1/crm/subscriptions/:id` — fetch a single subscription.
/// Returns 404 if the document doesn't exist OR isn't owned by the
/// caller (we collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, sub_id = %sub_id))]
pub async fn get_subscription(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(sub_id): Path<String>,
) -> Result<Json<Subscription>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&sub_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", oid);

    let coll = mongo.collection::<Subscription>(SUBS_COLL);
    let sub = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_subscriptions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("subscription".to_owned()))?;

    Ok(Json(sub))
}

// =========================================================================
// POST / — create_subscription
// =========================================================================

/// `POST /v1/crm/subscriptions` — insert a new subscription.
///
/// Builds a [`Subscription`] from the curated [`CreateSubscriptionInput`],
/// stamps `Identity` + `Audit`, decides the initial lifecycle status
/// (`Trial` if `trialUntil` is in the future, otherwise `Active`),
/// persists, and returns the full document.
///
/// **Status & history are server-managed.** Callers cannot seed
/// `status` or `history[]`; the create handler emits a single
/// `"created"` event so the audit timeline starts cleanly.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_subscription(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSubscriptionInput>,
) -> Result<Json<Subscription>> {
    if input.customer_id.trim().is_empty() {
        return Err(ApiError::Validation("customerId is required.".to_owned()));
    }
    if input.items.is_empty() {
        return Err(ApiError::Validation(
            "items[] must contain at least one line.".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        None => ObjectId::new(),
    };
    let customer_oid = oid_from_str(&input.customer_id)?;
    let plan_oid = match input.plan_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    // Initial lifecycle: `Trial` while `trialUntil` is in the future,
    // else `Active`. The collections worker will flip Trial → Active
    // automatically on the first post-trial cycle.
    let now = Utc::now();
    let initial_status = match input.trial_until {
        Some(end) if end > now => SubscriptionStatus::Trial,
        _ => SubscriptionStatus::Active,
    };

    let sub = Subscription {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        plan_id: plan_oid,
        customer_id: customer_oid,
        frequency: input.frequency,
        trial_until: input.trial_until,
        renewal_mode: input.renewal_mode,
        items: input.items,
        proration_enabled: input.proration_enabled.unwrap_or(false),
        dunning_ladder: input.dunning_ladder.unwrap_or_default(),
        status: initial_status,
        started_at: input.started_at,
        next_billing_at: input.next_billing_at,
        paused_until: None,
        cancelled_at: None,
        history: vec![SubscriptionEvent {
            at: now,
            kind: "created".to_owned(),
            by: Some(user_id),
            note: None,
        }],
    };

    let coll = mongo.collection::<Subscription>(SUBS_COLL);
    coll.insert_one(&sub).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_subscriptions.insert_one"))
    })?;

    Ok(Json(sub))
}

// =========================================================================
// PATCH /:id — update_subscription
// =========================================================================

/// `PATCH /v1/crm/subscriptions/:id` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt`
/// and `updatedBy` are always refreshed. Lifecycle transitions
/// (`status`, `pausedUntil`, `cancelledAt`, `history[]`) are NOT
/// editable here — they belong to dedicated endpoints (e.g.
/// `POST /:id/pause`).
///
/// Fails with 404 if the document doesn't exist OR isn't owned by the
/// caller.
#[instrument(skip_all, fields(user_id = %user.user_id, sub_id = %sub_id))]
pub async fn update_subscription(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(sub_id): Path<String>,
    Json(input): Json<UpdateSubscriptionInput>,
) -> Result<Json<Subscription>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&sub_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    if let Some(plan) = input.plan_id.as_deref() {
        if plan.is_empty() {
            // Empty string = caller wants to detach the plan.
            set.insert("planId", Bson::Null);
        } else {
            set.insert("planId", oid_from_str(plan)?);
        }
    }
    if let Some(freq) = input.frequency {
        set.insert("frequency", frequency_str(freq));
    }
    if let Some(rm) = input.renewal_mode {
        set.insert("renewalMode", renewal_str(rm));
    }
    if let Some(when) = input.trial_until {
        set.insert("trialUntil", bson::DateTime::from_chrono(when));
    }
    if let Some(when) = input.next_billing_at {
        set.insert("nextBillingAt", bson::DateTime::from_chrono(when));
    }
    if let Some(items) = input.items.as_ref() {
        let docs: Vec<Bson> = items
            .iter()
            .map(|i| Bson::Document(item_to_doc(i)))
            .collect();
        set.insert("items", Bson::Array(docs));
    }
    if let Some(pr) = input.proration_enabled {
        set.insert("prorationEnabled", pr);
    }
    if let Some(ladder) = input.dunning_ladder.as_ref() {
        let docs: Vec<Bson> = ladder
            .iter()
            .map(|s| Bson::Document(dunning_to_doc(s)))
            .collect();
        set.insert("dunningLadder", Bson::Array(docs));
    }

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", oid);

    let coll = mongo.collection::<Document>(SUBS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_subscriptions.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("subscription".to_owned()));
    }

    // Re-read via the typed collection so the response is the canonical
    // [`Subscription`] shape.
    let typed = mongo.collection::<Subscription>(SUBS_COLL);
    let sub = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_subscriptions.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("subscription".to_owned()))?;

    Ok(Json(sub))
}

// =========================================================================
// DELETE /:id — delete_subscription (hard)
// =========================================================================

/// `DELETE /v1/crm/subscriptions/:id` — **hard delete**. Per the CRM
/// ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities use
/// hard deletes — the row is removed from the collection. Fails with
/// 404 if the document doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, sub_id = %sub_id))]
pub async fn delete_subscription(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(sub_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&sub_id)?;

    let filter = doc! { "_id": oid, "userId": user_id };

    let coll = mongo.collection::<Document>(SUBS_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_subscriptions.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("subscription".to_owned()));
    }

    Ok(Json(serde_json::json!({ "ok": true, "deleted": true })))
}

// =========================================================================
// POST /:id/pause — pause_subscription
// =========================================================================

/// `POST /v1/crm/subscriptions/:id/pause` — flip lifecycle status to
/// `paused` and stamp the optional `pausedUntil` resume timestamp. The
/// collections worker reads `pausedUntil` and auto-resumes when
/// `now >= pausedUntil`; absent it the pause is indefinite.
///
/// A new [`SubscriptionEvent`] with `kind = "paused"` is appended to
/// `history[]` so the timeline is auditable. The handler does NOT
/// guard against re-pausing an already-paused subscription — that's an
/// idempotent no-op from the caller's perspective and the duplicate
/// event is informational.
///
/// Fails with 404 if the document doesn't exist OR isn't owned by the
/// caller.
#[instrument(skip_all, fields(user_id = %user.user_id, sub_id = %sub_id))]
pub async fn pause_subscription(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(sub_id): Path<String>,
    Json(input): Json<PauseSubscriptionInput>,
) -> Result<Json<Subscription>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&sub_id)?;

    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);

    let event_doc = {
        let mut d = doc! {
            "at": now_bson,
            "kind": "paused",
            "by": user_id,
        };
        if let Some(note) = input.note.as_deref().filter(|s| !s.is_empty()) {
            d.insert("note", note);
        }
        d
    };

    let mut set = doc! {
        "status": status_str(SubscriptionStatus::Paused),
        "updatedAt": now_bson,
        "updatedBy": user_id,
    };
    if let Some(when) = input.paused_until {
        set.insert("pausedUntil", bson::DateTime::from_chrono(when));
    } else {
        // Indefinite pause — clear any previous resume schedule.
        set.insert("pausedUntil", Bson::Null);
    }

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", oid);

    let update = doc! {
        "$set": set,
        "$push": { "history": event_doc },
    };

    let coll = mongo.collection::<Document>(SUBS_COLL);
    let res = coll.update_one(filter.clone(), update).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_subscriptions.pause"))
    })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("subscription".to_owned()));
    }

    let typed = mongo.collection::<Subscription>(SUBS_COLL);
    let sub = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_subscriptions.find_one(after-pause)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("subscription".to_owned()))?;

    Ok(Json(sub))
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
    fn frequency_serializes_as_lowercase() {
        assert_eq!(frequency_str(BillingFrequency::Monthly), "monthly");
        assert_eq!(frequency_str(BillingFrequency::Quarterly), "quarterly");
        assert_eq!(frequency_str(BillingFrequency::Custom), "custom");
    }

    #[test]
    fn status_serializes_with_snake_case_for_multi_word() {
        assert_eq!(status_str(SubscriptionStatus::PastDue), "past_due");
        assert_eq!(status_str(SubscriptionStatus::Trial), "trial");
        assert_eq!(status_str(SubscriptionStatus::Cancelled), "cancelled");
    }

    #[test]
    fn renewal_mode_serializes_as_lowercase() {
        assert_eq!(renewal_str(RenewalMode::Auto), "auto");
        assert_eq!(renewal_str(RenewalMode::Manual), "manual");
    }

    #[test]
    fn item_to_doc_emits_camel_case_keys() {
        let it = SubscriptionItem {
            item_id: ObjectId::new(),
            qty: 2.5,
            rate: 49.0,
            currency: "USD".into(),
        };
        let d = item_to_doc(&it);
        assert!(d.contains_key("itemId"));
        assert!(d.contains_key("qty"));
        assert!(d.contains_key("rate"));
        assert_eq!(d.get_str("currency").unwrap(), "USD");
    }

    #[test]
    fn dunning_to_doc_omits_template_when_absent() {
        let s = DunningStep {
            day_offset: 3,
            action: "email".into(),
            template_id: None,
        };
        let d = dunning_to_doc(&s);
        assert_eq!(d.get_i32("dayOffset").unwrap(), 3);
        assert_eq!(d.get_str("action").unwrap(), "email");
        assert!(!d.contains_key("templateId"));
    }

    #[test]
    fn dunning_to_doc_includes_template_when_present() {
        let tid = ObjectId::new();
        let s = DunningStep {
            day_offset: 7,
            action: "whatsapp".into(),
            template_id: Some(tid),
        };
        let d = dunning_to_doc(&s);
        assert_eq!(d.get_object_id("templateId").unwrap(), tid);
    }
}
