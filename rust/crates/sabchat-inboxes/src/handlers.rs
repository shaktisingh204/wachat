//! HTTP handlers for the SabChat **inboxes** domain.
//!
//! Each handler maps 1:1 to one mounted route under
//! `/v1/sabchat/inboxes`. The crate persists into two collections:
//!
//! - `sabchat_inboxes`     — the inbox registry (`SabChatInbox`).
//! - `sabchat_audit_log`   — append-only paper trail
//!   ([`SabChatAuditEvent`](sabchat_types::SabChatAuditEvent)).
//!
//! ## Tenancy
//!
//! Every read and write filters on `tenant_id = ObjectId(auth.tenant_id)`.
//! A malformed JWT subject yields
//! [`ApiError::Unauthorized`](sabnode_common::ApiError::Unauthorized); no
//! cross-tenant access is possible.
//!
//! ## Soft delete
//!
//! `delete_inbox` flips `enabled=false` and prepends `"(deleted) "` to
//! `name`. The document itself is preserved so conversations / messages
//! that point at this inbox by id keep their referential integrity.
//!
//! ## Audit failures
//!
//! Audit writes happen *after* the primary mutation succeeds. A failure
//! to append to `sabchat_audit_log` is logged at `error` level but is
//! **not** propagated — losing a paper-trail row should not turn a
//! successful business operation into a 5xx.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    AddAgentBody, CreateInboxBody, InboxResponse, ListInboxesQuery, ListInboxesResponse,
    SuccessResponse, UpdateInboxBody,
};
use crate::state::SabChatInboxesState;

/// Mongo collection names — kept inline so each handler's I/O target
/// is greppable.
const INBOXES_COLL: &str = "sabchat_inboxes";
const AUDIT_COLL: &str = "sabchat_audit_log";

/// Whitelist of accepted `channelType` discriminants. Mirrors the
/// snake-case `ChannelType` variants in `sabchat_types::inbox`; kept
/// as a slice (not a `HashSet`) because the list is tiny and matched
/// once per request.
const VALID_CHANNEL_TYPES: &[&str] = &[
    "website",
    "whatsapp_cloud",
    "whatsapp_personal",
    "instagram",
    "facebook",
    "telegram",
    "email",
    "sms",
    "voice",
    "in_app",
    "apple_business_chat",
    "google_business_messages",
    "line",
    "viber",
    "x_dm",
];

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse the JWT tenant claim into an `ObjectId`. A malformed claim
/// yields `401 Unauthorized` — the token is structurally invalid, not
/// the caller's request.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

/// Same shape as [`tenant_oid`] but for the user / actor id on the
/// JWT. Used when writing audit rows.
fn actor_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Validate a `channelType` string against [`VALID_CHANNEL_TYPES`].
/// Empty / unknown values get a 400 with the offending value echoed.
fn validate_channel_type(value: &str) -> Result<()> {
    if VALID_CHANNEL_TYPES.contains(&value) {
        Ok(())
    } else {
        Err(ApiError::BadRequest(format!(
            "invalid channelType `{value}`; expected one of: {}",
            VALID_CHANNEL_TYPES.join(", "),
        )))
    }
}

/// Validate the per-window shape of a [`BusinessHours`] config:
///
/// - `day` must be 0..=6.
/// - `open` / `close` must match `HH:MM` 24-hour notation.
///
/// We don't enforce `open < close` — overnight windows
/// (`open=22:00`, `close=02:00`) are a legitimate shape that callers
/// may need to express across midnight, and the routing layer is
/// where that ordering is interpreted.
fn validate_business_hours(bh: &sabchat_types::BusinessHours) -> Result<()> {
    for (idx, w) in bh.windows.iter().enumerate() {
        if w.day > 6 {
            return Err(ApiError::BadRequest(format!(
                "businessHours.windows[{idx}].day must be in 0..=6, got {}",
                w.day
            )));
        }
        if !is_hhmm(&w.open) {
            return Err(ApiError::BadRequest(format!(
                "businessHours.windows[{idx}].open must be HH:MM (24h), got `{}`",
                w.open
            )));
        }
        if !is_hhmm(&w.close) {
            return Err(ApiError::BadRequest(format!(
                "businessHours.windows[{idx}].close must be HH:MM (24h), got `{}`",
                w.close
            )));
        }
    }
    Ok(())
}

/// Manual `HH:MM` validator — cheaper than spinning up a regex engine
/// for a five-character string and easier to read in review.
fn is_hhmm(s: &str) -> bool {
    let bytes = s.as_bytes();
    if bytes.len() != 5 || bytes[2] != b':' {
        return false;
    }
    let parse2 = |a: u8, b: u8| -> Option<u8> {
        if !a.is_ascii_digit() || !b.is_ascii_digit() {
            return None;
        }
        Some((a - b'0') * 10 + (b - b'0'))
    };
    match (parse2(bytes[0], bytes[1]), parse2(bytes[3], bytes[4])) {
        (Some(hh), Some(mm)) => hh <= 23 && mm <= 59,
        _ => false,
    }
}

/// Convert a `serde_json::Value` to `bson::Bson` with a null fallback.
/// Mirrors the helper used by the wachat-contacts crate so the two
/// inbox bodies (`channelConfig`, `businessHours`) round-trip without
/// re-implementing the conversion.
fn value_to_bson(v: &Value) -> Bson {
    Bson::try_from(v.clone()).unwrap_or(Bson::Null)
}

/// Convert any `T: Serialize` into a `bson::Document`. Returns
/// `ApiError::Internal` on serde failure because callers only ever
/// feed in domain types from `sabchat_types`, which are guaranteed to
/// be round-trippable.
fn to_bson_doc<T: serde::Serialize>(label: &'static str, value: &T) -> Result<Document> {
    let bson = bson::to_bson(value).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context(format!("serialize {label}")))
    })?;
    match bson {
        Bson::Document(d) => Ok(d),
        other => Err(ApiError::Internal(anyhow::anyhow!(
            "expected {label} to serialize as a BSON document, got {:?}",
            other.element_type()
        ))),
    }
}

/// Best-effort audit-log write. A failure here is logged but never
/// fails the caller — audit rows are observability, not a correctness
/// gate.
async fn write_audit(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    inbox_id: ObjectId,
    actor_id: ObjectId,
    action: &str,
    before: Value,
    after: Value,
) {
    let event = doc! {
        "_id": ObjectId::new(),
        "tenantId": tenant_id,
        "inboxId": inbox_id,
        "action": action,
        "actorType": "agent",
        "actorId": actor_id,
        "before": value_to_bson(&before),
        "after": value_to_bson(&after),
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    };
    if let Err(e) = mongo.collection::<Document>(AUDIT_COLL).insert_one(event).await {
        tracing::error!(error = %e, action = action, "failed to write sabchat audit row");
    }
}

// ===========================================================================
// POST /v1/sabchat/inboxes — create_inbox
// ===========================================================================

/// `POST /v1/sabchat/inboxes` — register a new inbox under the
/// caller's tenant.
///
/// Validates `channelType`, the optional `businessHours` windows, and
/// any hex-string ids the caller supplies. On success appends an
/// `inbox_created` row to `sabchat_audit_log`.
#[instrument(skip_all, fields(channel_type = %body.channel_type))]
pub async fn create_inbox(
    user: AuthUser,
    State(state): State<SabChatInboxesState>,
    Json(body): Json<CreateInboxBody>,
) -> Result<Json<InboxResponse>> {
    if body.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    validate_channel_type(&body.channel_type)?;

    if let Some(bh) = body.business_hours.as_ref() {
        validate_business_hours(bh)?;
    }

    let tenant_id = tenant_oid(&user)?;
    let actor_id = actor_oid(&user)?;

    let agent_oids: Vec<ObjectId> = body
        .agent_ids
        .iter()
        .map(|s| s.as_str())
        .filter(|s| !s.is_empty())
        .map(oid_from_str)
        .collect::<Result<Vec<_>>>()?;

    let team_id_bson: Bson = match body.team_id.as_deref().filter(|s| !s.is_empty()) {
        Some(t) => Bson::ObjectId(oid_from_str(t)?),
        None => Bson::Null,
    };

    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();

    // `channelConfig` and `businessHours` are domain types; serialize
    // through serde so the camelCase / inner-type renames defined on
    // `ChannelConfig` + `BusinessHours` are honoured.
    let channel_config_doc = match body.channel_config.as_ref() {
        Some(cc) => to_bson_doc("channelConfig", cc)?,
        None => doc! { "settings": Bson::Null },
    };
    let business_hours_doc = match body.business_hours.as_ref() {
        Some(bh) => to_bson_doc("businessHours", bh)?,
        None => doc! {
            "enabled": false,
            "timezone": "",
            "windows": Bson::Array(Vec::new()),
        },
    };

    let inbox_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant_id,
        "name": &body.name,
        "channelType": &body.channel_type,
        "channelConfig": channel_config_doc,
        "agentIds": Bson::Array(agent_oids.into_iter().map(Bson::ObjectId).collect()),
        "teamId": team_id_bson,
        "businessHours": business_hours_doc,
        "enabled": true,
        "createdAt": now,
        "updatedAt": now,
    };

    let coll = state.mongo.collection::<Document>(INBOXES_COLL);
    coll.insert_one(inbox_doc.clone()).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.insert_one"))
    })?;

    let after = document_to_clean_json(inbox_doc.clone());
    write_audit(
        &state.mongo,
        tenant_id,
        new_oid,
        actor_id,
        "inbox_created",
        Value::Null,
        after.clone(),
    )
    .await;

    Ok(Json(InboxResponse { inbox: after }))
}

// ===========================================================================
// GET /v1/sabchat/inboxes — list_inboxes
// ===========================================================================

/// `GET /v1/sabchat/inboxes` — list every inbox the calling tenant
/// owns, sorted by `createdAt` descending.
///
/// Both query filters compose:
///   * `channelType` — validated against [`VALID_CHANNEL_TYPES`].
///   * `enabled`     — boolean; omit to return both states.
///
/// Soft-deleted inboxes (`enabled=false` + `(deleted)` name prefix)
/// are returned only when `enabled=false` is explicitly requested.
#[instrument(skip_all)]
pub async fn list_inboxes(
    user: AuthUser,
    State(state): State<SabChatInboxesState>,
    Query(query): Query<ListInboxesQuery>,
) -> Result<Json<ListInboxesResponse>> {
    let tenant_id = tenant_oid(&user)?;

    let mut filter = doc! { "tenantId": tenant_id };

    if let Some(ct) = query.channel_type.as_deref().filter(|s| !s.is_empty()) {
        validate_channel_type(ct)?;
        filter.insert("channelType", ct);
    }
    if let Some(en) = query.enabled {
        filter.insert("enabled", en);
    }

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .build();

    let coll = state.mongo.collection::<Document>(INBOXES_COLL);
    let cursor = coll
        .find(filter.clone())
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find")))?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.collect"))
    })?;

    let total = coll
        .count_documents(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.count")))?;

    let inboxes: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListInboxesResponse { inboxes, total }))
}

// ===========================================================================
// GET /v1/sabchat/inboxes/{id} — get_inbox
// ===========================================================================

/// `GET /v1/sabchat/inboxes/{id}` — fetch a single inbox by id, scoped
/// to the caller's tenant.
#[instrument(skip_all, fields(inbox_id = %id))]
pub async fn get_inbox(
    user: AuthUser,
    State(state): State<SabChatInboxesState>,
    Path(id): Path<String>,
) -> Result<Json<InboxResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let inbox_oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>(INBOXES_COLL);
    let inbox = coll
        .find_one(doc! { "_id": inbox_oid, "tenantId": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("inbox not found".to_owned()))?;

    Ok(Json(InboxResponse {
        inbox: document_to_clean_json(inbox),
    }))
}

// ===========================================================================
// PATCH /v1/sabchat/inboxes/{id} — update_inbox
// ===========================================================================

/// `PATCH /v1/sabchat/inboxes/{id}` — partial update of name /
/// channelConfig / businessHours / enabled / teamId.
///
/// Reads the pre-image, applies the `$set` mutation, then writes one
/// `inbox_updated` audit row with `before` + `after` snapshots so the
/// audit trail tells the full story.
#[instrument(skip_all, fields(inbox_id = %id))]
pub async fn update_inbox(
    user: AuthUser,
    State(state): State<SabChatInboxesState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateInboxBody>,
) -> Result<Json<InboxResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let actor_id = actor_oid(&user)?;
    let inbox_oid = oid_from_str(&id)?;

    if let Some(bh) = body.business_hours.as_ref() {
        validate_business_hours(bh)?;
    }

    let coll = state.mongo.collection::<Document>(INBOXES_COLL);

    // ---- Load the pre-image (also enforces tenant scope) -----------
    let before_doc = coll
        .find_one(doc! { "_id": inbox_oid, "tenantId": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one(update)"))
        })?
        .ok_or_else(|| ApiError::NotFound("inbox not found".to_owned()))?;

    // ---- Build $set ------------------------------------------------
    let mut set_doc = doc! { "updatedAt": bson::DateTime::from_chrono(Utc::now()) };

    if let Some(name) = body.name.as_deref().filter(|s| !s.is_empty()) {
        set_doc.insert("name", name);
    }
    if let Some(cc) = body.channel_config.as_ref() {
        set_doc.insert("channelConfig", to_bson_doc("channelConfig", cc)?);
    }
    if let Some(bh) = body.business_hours.as_ref() {
        set_doc.insert("businessHours", to_bson_doc("businessHours", bh)?);
    }
    if let Some(enabled) = body.enabled {
        set_doc.insert("enabled", enabled);
    }
    if let Some(team) = body.team_id.as_ref() {
        if team.is_empty() {
            set_doc.insert("teamId", Bson::Null);
        } else {
            set_doc.insert("teamId", Bson::ObjectId(oid_from_str(team)?));
        }
    }

    coll.update_one(
        doc! { "_id": inbox_oid, "tenantId": tenant_id },
        doc! { "$set": set_doc },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.update_one"))
    })?;

    // ---- Re-read for the response + audit `after` snapshot ---------
    let after_doc = coll
        .find_one(doc! { "_id": inbox_oid, "tenantId": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_inboxes.find_one(post-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("inbox not found".to_owned()))?;

    let before_json = document_to_clean_json(before_doc);
    let after_json = document_to_clean_json(after_doc);

    write_audit(
        &state.mongo,
        tenant_id,
        inbox_oid,
        actor_id,
        "inbox_updated",
        before_json,
        after_json.clone(),
    )
    .await;

    Ok(Json(InboxResponse { inbox: after_json }))
}

// ===========================================================================
// POST /v1/sabchat/inboxes/{id}/agents — add_agent
// ===========================================================================

/// `POST /v1/sabchat/inboxes/{id}/agents` — append an agent to the
/// inbox's allowed list via `$addToSet` (re-adding is a no-op).
#[instrument(skip_all, fields(inbox_id = %id))]
pub async fn add_agent(
    user: AuthUser,
    State(state): State<SabChatInboxesState>,
    Path(id): Path<String>,
    Json(body): Json<AddAgentBody>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let inbox_oid = oid_from_str(&id)?;
    let agent_oid = oid_from_str(&body.agent_id)?;

    let coll = state.mongo.collection::<Document>(INBOXES_COLL);
    let res = coll
        .update_one(
            doc! { "_id": inbox_oid, "tenantId": tenant_id },
            doc! {
                "$addToSet": { "agentIds": agent_oid },
                "$set": { "updatedAt": bson::DateTime::from_chrono(Utc::now()) },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_inboxes.update_one(add_agent)"),
            )
        })?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("inbox not found".to_owned()));
    }

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/sabchat/inboxes/{id}/agents/{agentId} — remove_agent
// ===========================================================================

/// `DELETE /v1/sabchat/inboxes/{id}/agents/{agentId}` — drop a single
/// agent from the inbox via `$pull`. Removing an agent that was not
/// in the array is a no-op.
#[instrument(skip_all, fields(inbox_id = %id, agent_id = %agent_id))]
pub async fn remove_agent(
    user: AuthUser,
    State(state): State<SabChatInboxesState>,
    Path((id, agent_id)): Path<(String, String)>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let inbox_oid = oid_from_str(&id)?;
    let agent_oid = oid_from_str(&agent_id)?;

    let coll = state.mongo.collection::<Document>(INBOXES_COLL);
    let res = coll
        .update_one(
            doc! { "_id": inbox_oid, "tenantId": tenant_id },
            doc! {
                "$pull": { "agentIds": agent_oid },
                "$set": { "updatedAt": bson::DateTime::from_chrono(Utc::now()) },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_inboxes.update_one(remove_agent)"),
            )
        })?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("inbox not found".to_owned()));
    }

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/sabchat/inboxes/{id} — delete_inbox (SOFT)
// ===========================================================================

/// `DELETE /v1/sabchat/inboxes/{id}` — **soft delete** the inbox.
///
/// Flips `enabled=false` and prepends `"(deleted) "` to `name` (idem-
/// potent: if the prefix is already there we leave the name alone).
/// The document is never removed so conversation / message rows that
/// point at the inbox by id keep their FK targets.
#[instrument(skip_all, fields(inbox_id = %id))]
pub async fn delete_inbox(
    user: AuthUser,
    State(state): State<SabChatInboxesState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let actor_id = actor_oid(&user)?;
    let inbox_oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>(INBOXES_COLL);

    // ---- Load the pre-image (enforces tenant scope) ----------------
    let before_doc = coll
        .find_one(doc! { "_id": inbox_oid, "tenantId": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one(delete)"))
        })?
        .ok_or_else(|| ApiError::NotFound("inbox not found".to_owned()))?;

    let current_name = before_doc.get_str("name").unwrap_or_default();
    let new_name = if current_name.starts_with("(deleted) ") {
        current_name.to_owned()
    } else {
        format!("(deleted) {current_name}")
    };

    coll.update_one(
        doc! { "_id": inbox_oid, "tenantId": tenant_id },
        doc! {
            "$set": {
                "enabled": false,
                "name": &new_name,
                "updatedAt": bson::DateTime::from_chrono(Utc::now()),
            },
        },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_inboxes.update_one(soft_delete)"),
        )
    })?;

    let after_doc = coll
        .find_one(doc! { "_id": inbox_oid, "tenantId": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_inboxes.find_one(post-delete)"),
            )
        })?
        .unwrap_or_default();

    write_audit(
        &state.mongo,
        tenant_id,
        inbox_oid,
        actor_id,
        "inbox_deleted",
        document_to_clean_json(before_doc),
        document_to_clean_json(after_doc),
    )
    .await;

    Ok(Json(SuccessResponse::ok()))
}

