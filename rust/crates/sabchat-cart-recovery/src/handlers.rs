//! Agent / admin HTTP handlers for the SabChat cart-recovery domain.
//!
//! Every handler in this module consumes the
//! [`AuthUser`](sabnode_auth::AuthUser) extractor and scopes its Mongo
//! I/O to `tenantId == ObjectId(auth.tenant_id)`. Cross-tenant lookups
//! are not possible: the tenant filter is baked into every read and
//! write, and a malformed `tid` claim is treated as `401 Unauthorized`
//! (mirroring the convention used by `sabchat-audit`).
//!
//! ## Surface
//!
//! | Endpoint                                    | Handler             |
//! |---------------------------------------------|---------------------|
//! | `POST   /v1/sabchat/cart-recovery/rules`    | `create_rule`       |
//! | `GET    /v1/sabchat/cart-recovery/rules`    | `list_rules`        |
//! | `GET    /v1/sabchat/cart-recovery/rules/{id}` | `get_rule`        |
//! | `PATCH  /v1/sabchat/cart-recovery/rules/{id}` | `update_rule`     |
//! | `DELETE /v1/sabchat/cart-recovery/rules/{id}` | `delete_rule`     |
//! | `GET    /v1/sabchat/cart-recovery/carts`    | `list_carts`        |
//! | `GET    /v1/sabchat/cart-recovery/carts/{id}` | `get_cart`        |
//! | `POST   /v1/sabchat/cart-recovery/sweep`    | `sweep`             |
//! | `GET    /v1/sabchat/cart-recovery/triggers` | `list_triggers`     |
//!
//! ## Sweep semantics
//!
//! `POST /sweep` scans `sabchat_carts` for the tenant where
//! `status == "active"` and, for each cart, picks the most aggressive
//! active rule whose `idleMinutes` window has elapsed (and whose
//! `minTotalMinor` threshold — if set — is met). It then:
//!
//! 1. Appends a row to `sabchat_cart_recovery_triggers` carrying the
//!    cart id, rule id, action, and (for `send_coupon`) the coupon
//!    code.
//! 2. Marks the cart `status = "abandoned"` so subsequent sweeps don't
//!    re-fire on the same row.
//!
//! The handler **does not actually post a chat message** in this MVP —
//! the legacy spec calls that out explicitly. The widget polls
//! `/triggers` and surfaces `open_widget` and `send_coupon` actions to
//! the visitor in-browser; `send_message` is logged as intent.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateRuleBody, ListCartsQuery, ListCartsResponse, ListRulesResponse, ListTriggersQuery,
    ListTriggersResponse, MAX_LIMIT, OkResponse, RuleResponse, SweepBody, SweepResponse,
    UpdateRuleBody,
};
use crate::state::SabChatCartRecoveryState;
use crate::{CARTS_COLL, RULES_COLL, TRIGGERS_COLL};

// ===========================================================================
// Helpers
// ===========================================================================

/// Allowed action discriminator values. Kept centrally so create/update
/// share one source of truth and the sweep can match on the exact same
/// strings.
const ACTION_SEND_MESSAGE: &str = "send_message";
const ACTION_OPEN_WIDGET: &str = "open_widget";
const ACTION_SEND_COUPON: &str = "send_coupon";

fn is_valid_action(action: &str) -> bool {
    matches!(
        action,
        ACTION_SEND_MESSAGE | ACTION_OPEN_WIDGET | ACTION_SEND_COUPON
    )
}

/// Parse the caller's tenant id from the JWT into an `ObjectId`.
/// Mirrors `sabchat-audit::tenant_oid`.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

// ===========================================================================
// POST /rules — create_rule
// ===========================================================================

/// `POST /rules` — create a recovery rule scoped to the caller's
/// tenant. Validates the `action` discriminator and persists the row,
/// returning the inserted document so the UI can render it without a
/// follow-up GET.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn create_rule(
    user: AuthUser,
    State(state): State<SabChatCartRecoveryState>,
    Json(body): Json<CreateRuleBody>,
) -> Result<Json<RuleResponse>> {
    let tenant = tenant_oid(&user)?;

    // ---- Validate ------------------------------------------------------
    if !is_valid_action(&body.action) {
        return Err(ApiError::Validation(format!(
            "Unknown action `{}`. Expected one of: send_message, open_widget, send_coupon.",
            body.action
        )));
    }
    if body.idle_minutes == 0 {
        return Err(ApiError::Validation(
            "idleMinutes must be greater than zero.".to_owned(),
        ));
    }
    if body.action == ACTION_SEND_COUPON
        && body
            .coupon_code
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .is_empty()
    {
        return Err(ApiError::Validation(
            "couponCode is required when action is send_coupon.".to_owned(),
        ));
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();

    let mut doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "idleMinutes": body.idle_minutes as i64,
        "action": &body.action,
        "active": body.active,
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(min) = body.min_total_minor {
        doc.insert("minTotalMinor", min);
    }
    if let Some(tpl) = body.message_template.as_deref().filter(|s| !s.is_empty()) {
        doc.insert("messageTemplate", tpl);
    }
    if let Some(code) = body.coupon_code.as_deref().filter(|s| !s.is_empty()) {
        doc.insert("couponCode", code);
    }

    let coll = state.mongo.collection::<Document>(RULES_COLL);
    coll.insert_one(&doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_cart_recovery_rules.insert"))
    })?;

    Ok(Json(RuleResponse {
        rule: document_to_clean_json(doc),
    }))
}

// ===========================================================================
// GET /rules — list_rules
// ===========================================================================

/// `GET /rules` — list every recovery rule for the caller's tenant.
/// Unpaginated (tenants have a handful of rules at most); sorted by
/// `idleMinutes` ascending so the most aggressive rules surface first.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_rules(
    user: AuthUser,
    State(state): State<SabChatCartRecoveryState>,
) -> Result<Json<ListRulesResponse>> {
    let tenant = tenant_oid(&user)?;

    let opts = FindOptions::builder()
        .sort(doc! { "idleMinutes": 1, "_id": 1 })
        .build();
    let coll = state.mongo.collection::<Document>(RULES_COLL);
    let cursor = coll
        .find(doc! { "tenantId": tenant })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_cart_recovery_rules.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_cart_recovery_rules.collect"))
    })?;

    let rules: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListRulesResponse { rules }))
}

// ===========================================================================
// GET /rules/{id} — get_rule
// ===========================================================================

/// `GET /rules/{id}` — fetch a single rule, scoped to the caller's
/// tenant. Returns `404` for unknown ids or ids belonging to other
/// tenants (the tenant filter is part of the lookup, so cross-tenant
/// existence is never leaked).
#[instrument(skip_all, fields(tenant = %user.tenant_id, rule_id = %id))]
pub async fn get_rule(
    user: AuthUser,
    State(state): State<SabChatCartRecoveryState>,
    Path(id): Path<String>,
) -> Result<Json<RuleResponse>> {
    let tenant = tenant_oid(&user)?;
    let rule_oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>(RULES_COLL);
    let doc = coll
        .find_one(doc! { "_id": rule_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_cart_recovery_rules.find_one"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Rule not found.".to_owned()))?;

    Ok(Json(RuleResponse {
        rule: document_to_clean_json(doc),
    }))
}

// ===========================================================================
// PATCH /rules/{id} — update_rule
// ===========================================================================

/// `PATCH /rules/{id}` — partial rule update. Only the fields present
/// in the body are `$set`. Validates the `action` discriminator when
/// supplied. Returns `404` if the rule does not belong to the caller's
/// tenant.
#[instrument(skip_all, fields(tenant = %user.tenant_id, rule_id = %id))]
pub async fn update_rule(
    user: AuthUser,
    State(state): State<SabChatCartRecoveryState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateRuleBody>,
) -> Result<Json<RuleResponse>> {
    let tenant = tenant_oid(&user)?;
    let rule_oid = oid_from_str(&id)?;

    if let Some(action) = body.action.as_deref() {
        if !is_valid_action(action) {
            return Err(ApiError::Validation(format!(
                "Unknown action `{action}`. Expected one of: send_message, open_widget, send_coupon."
            )));
        }
    }
    if let Some(0) = body.idle_minutes {
        return Err(ApiError::Validation(
            "idleMinutes must be greater than zero.".to_owned(),
        ));
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    let mut set_doc = doc! { "updatedAt": now };
    if let Some(v) = body.idle_minutes {
        set_doc.insert("idleMinutes", v as i64);
    }
    if let Some(v) = body.min_total_minor {
        set_doc.insert("minTotalMinor", v);
    }
    if let Some(v) = body.action.as_deref() {
        set_doc.insert("action", v);
    }
    if let Some(v) = body.message_template.as_deref() {
        set_doc.insert("messageTemplate", v);
    }
    if let Some(v) = body.coupon_code.as_deref() {
        set_doc.insert("couponCode", v);
    }
    if let Some(v) = body.active {
        set_doc.insert("active", v);
    }

    let coll = state.mongo.collection::<Document>(RULES_COLL);
    let res = coll
        .update_one(
            doc! { "_id": rule_oid, "tenantId": tenant },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_cart_recovery_rules.update_one"),
            )
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Rule not found.".to_owned()));
    }

    // Re-read so the response reflects the persisted state — same
    // pattern the sibling SabChat surfaces use.
    let doc = coll
        .find_one(doc! { "_id": rule_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_cart_recovery_rules.find_one(after-patch)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Rule not found.".to_owned()))?;

    Ok(Json(RuleResponse {
        rule: document_to_clean_json(doc),
    }))
}

// ===========================================================================
// DELETE /rules/{id} — delete_rule
// ===========================================================================

/// `DELETE /rules/{id}` — remove a rule. Tenant-scoped; deletes that
/// don't match a row return `404` so the UI doesn't silently swallow
/// stale ids.
#[instrument(skip_all, fields(tenant = %user.tenant_id, rule_id = %id))]
pub async fn delete_rule(
    user: AuthUser,
    State(state): State<SabChatCartRecoveryState>,
    Path(id): Path<String>,
) -> Result<Json<OkResponse>> {
    let tenant = tenant_oid(&user)?;
    let rule_oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>(RULES_COLL);
    let res = coll
        .delete_one(doc! { "_id": rule_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_cart_recovery_rules.delete_one"),
            )
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Rule not found.".to_owned()));
    }

    Ok(Json(OkResponse::yes()))
}

// ===========================================================================
// GET /carts — list_carts
// ===========================================================================

/// `GET /carts` — paginated cart list for the caller's tenant.
/// Cursor-style pagination on `_id` (newest first). Optional filters
/// scope by status and inbox.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_carts(
    user: AuthUser,
    State(state): State<SabChatCartRecoveryState>,
    Query(query): Query<ListCartsQuery>,
) -> Result<Json<ListCartsResponse>> {
    let tenant = tenant_oid(&user)?;

    // ---- Build filter --------------------------------------------------
    let mut filter = doc! { "tenantId": tenant };
    if let Some(status) = query.status.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("status", status);
    }
    if let Some(id) = query.inbox_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("inboxId", oid_from_str(id)?);
    }
    if let Some(raw) = query.cursor.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("_id", doc! { "$lt": oid_from_str(raw)? });
    }

    let limit = query.limit.clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<Document>(CARTS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_carts.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_carts.collect")))?;

    let next_cursor = if (docs.len() as i64) < limit {
        None
    } else {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|oid| oid.to_hex())
    };

    let carts: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListCartsResponse { carts, next_cursor }))
}

// ===========================================================================
// GET /carts/{id} — get_cart
// ===========================================================================

/// `GET /carts/{id}` — fetch a single cart, scoped to the caller's
/// tenant.
#[instrument(skip_all, fields(tenant = %user.tenant_id, cart_id = %id))]
pub async fn get_cart(
    user: AuthUser,
    State(state): State<SabChatCartRecoveryState>,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let cart_oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>(CARTS_COLL);
    let doc = coll
        .find_one(doc! { "_id": cart_oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_carts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("Cart not found.".to_owned()))?;

    Ok(Json(document_to_clean_json(doc)))
}

// ===========================================================================
// POST /sweep — sweep
// ===========================================================================

/// `POST /sweep` — fire recovery triggers for every idle active cart
/// in the caller's tenant that matches an active rule.
///
/// Algorithm:
///
/// 1. Load every active rule for the tenant, sorted by `idleMinutes`
///    ascending — the smallest-window rule wins when multiple rules
///    qualify, on the theory that the operator's most aggressive
///    nudge is also the most specific.
/// 2. Iterate active carts (newest first).
/// 3. For each cart, find the first rule where
///    `now - lastEventAt >= idleMinutes` and (if `minTotalMinor` is
///    set) `totalMinor >= minTotalMinor`.
/// 4. Append a `sabchat_cart_recovery_triggers` row carrying the cart
///    id, rule id, action, and optional `couponCode`. Then `$set` the
///    cart `status = "abandoned"` so subsequent sweeps skip it.
///
/// Returns `{ scanned, fired }` where `scanned` is the number of
/// active carts considered and `fired` is the number that actually
/// produced a trigger row.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn sweep(
    user: AuthUser,
    State(state): State<SabChatCartRecoveryState>,
    Json(_body): Json<SweepBody>,
) -> Result<Json<SweepResponse>> {
    let tenant = tenant_oid(&user)?;
    let mongo = &state.mongo;

    // ---- Load active rules for this tenant -----------------------------
    let rules_coll = mongo.collection::<Document>(RULES_COLL);
    let rule_opts = FindOptions::builder()
        .sort(doc! { "idleMinutes": 1, "_id": 1 })
        .build();
    let rules_cursor = rules_coll
        .find(doc! { "tenantId": tenant, "active": true })
        .with_options(rule_opts)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_cart_recovery_rules.find(sweep)"),
            )
        })?;
    let rules: Vec<Document> = rules_cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_cart_recovery_rules.collect(sweep)"),
        )
    })?;

    // No active rules → nothing to do. We still scan so the caller can
    // confirm the sweep ran end-to-end.
    let carts_coll = mongo.collection::<Document>(CARTS_COLL);
    let cart_cursor = carts_coll
        .find(doc! { "tenantId": tenant, "status": "active" })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_carts.find(sweep)"))
        })?;
    let carts: Vec<Document> = cart_cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_carts.collect(sweep)"))
    })?;

    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);
    let triggers_coll = mongo.collection::<Document>(TRIGGERS_COLL);

    let mut scanned: u64 = 0;
    let mut fired: u64 = 0;

    for cart in carts {
        scanned += 1;

        // ---- Extract the fields we need from the cart row --------------
        let cart_id = match cart.get_object_id("_id") {
            Ok(id) => id,
            Err(_) => continue,
        };
        let last_event_at = match cart.get_datetime("lastEventAt") {
            Ok(dt) => dt.to_chrono(),
            Err(_) => continue,
        };
        let cart_total = cart.get_i64("totalMinor").unwrap_or(0);
        let inbox_id = cart.get_object_id("inboxId").ok();
        let visitor_token = cart.get_str("visitorToken").ok().map(str::to_owned);
        let contact_id = cart.get_object_id("contactId").ok();

        // ---- Find the first qualifying rule ----------------------------
        let matched: Option<&Document> = rules.iter().find(|r| {
            let idle_minutes = r.get_i64("idleMinutes").unwrap_or(0);
            if idle_minutes <= 0 {
                return false;
            }
            // `now - lastEventAt >= idleMinutes` — we use chrono's
            // `Duration::minutes` so the comparison handles tz / DST
            // correctly. Mongo stores millisecond precision, so the
            // round-trip is lossless.
            let elapsed = now.signed_duration_since(last_event_at);
            if elapsed < Duration::minutes(idle_minutes) {
                return false;
            }
            // Optional minimum-total guard.
            if let Ok(min) = r.get_i64("minTotalMinor") {
                if cart_total < min {
                    return false;
                }
            }
            true
        });

        let rule = match matched {
            Some(r) => r,
            None => continue,
        };

        // ---- Append the trigger row -----------------------------------
        let rule_id = match rule.get_object_id("_id") {
            Ok(id) => id,
            Err(_) => continue,
        };
        let action = rule.get_str("action").unwrap_or("send_message").to_owned();
        let coupon_code = rule.get_str("couponCode").ok().map(str::to_owned);
        let message_template = rule.get_str("messageTemplate").ok().map(str::to_owned);

        let mut trigger = doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant,
            "cartId": cart_id,
            "ruleId": rule_id,
            "action": &action,
            "firedAt": now_bson,
            "createdAt": now_bson,
        };
        if let Some(id) = inbox_id {
            trigger.insert("inboxId", id);
        }
        if let Some(token) = visitor_token {
            trigger.insert("visitorToken", token);
        }
        if let Some(id) = contact_id {
            trigger.insert("contactId", id);
        }
        if let Some(code) = coupon_code {
            trigger.insert("couponCode", code);
        }
        if let Some(tpl) = message_template {
            trigger.insert("messageTemplate", tpl);
        }

        triggers_coll.insert_one(trigger).await.map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_cart_recovery_triggers.insert"),
            )
        })?;

        // ---- Mark the cart abandoned so we don't re-fire ---------------
        carts_coll
            .update_one(
                doc! { "_id": cart_id, "tenantId": tenant },
                doc! {
                    "$set": {
                        "status": "abandoned",
                        "updatedAt": now_bson,
                    },
                },
            )
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("sabchat_carts.update_one(abandoned)"),
                )
            })?;

        fired += 1;
    }

    Ok(Json(SweepResponse { scanned, fired }))
}

// ===========================================================================
// GET /triggers — list_triggers
// ===========================================================================

/// `GET /triggers` — paginated trigger log for the caller's tenant.
/// Same cursor-style pagination contract as `/carts` (newest-first by
/// `_id`).
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_triggers(
    user: AuthUser,
    State(state): State<SabChatCartRecoveryState>,
    Query(query): Query<ListTriggersQuery>,
) -> Result<Json<ListTriggersResponse>> {
    let tenant = tenant_oid(&user)?;

    // ---- Build filter --------------------------------------------------
    let mut filter = doc! { "tenantId": tenant };
    if let Some(id) = query.cart_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("cartId", oid_from_str(id)?);
    }
    if let Some(raw) = query.cursor.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("_id", doc! { "$lt": oid_from_str(raw)? });
    }

    let limit = query.limit.clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<Document>(TRIGGERS_COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_cart_recovery_triggers.find"))
    })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_cart_recovery_triggers.collect"))
    })?;

    let next_cursor = if (docs.len() as i64) < limit {
        None
    } else {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|oid| oid.to_hex())
    };

    let triggers: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListTriggersResponse {
        triggers,
        next_cursor,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_valid_action_accepts_known_kinds() {
        assert!(is_valid_action("send_message"));
        assert!(is_valid_action("open_widget"));
        assert!(is_valid_action("send_coupon"));
    }

    #[test]
    fn is_valid_action_rejects_unknown() {
        assert!(!is_valid_action(""));
        assert!(!is_valid_action("SEND_MESSAGE"));
        assert!(!is_valid_action("nuke"));
    }
}
