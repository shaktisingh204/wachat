//! HTTP handlers for the SabChat SLA policies domain.
//!
//! | Endpoint                                              | Behaviour                                              |
//! |-------------------------------------------------------|--------------------------------------------------------|
//! | `POST   /v1/sabchat/sla/policies`                     | Create a new tenant-scoped policy.                     |
//! | `GET    /v1/sabchat/sla/policies`                     | List policies for the calling tenant.                  |
//! | `GET    /v1/sabchat/sla/policies/{id}`                | Get one policy by id (tenant-scoped).                  |
//! | `PATCH  /v1/sabchat/sla/policies/{id}`                | Partial-update a policy (tenant-scoped).               |
//! | `DELETE /v1/sabchat/sla/policies/{id}`                | Delete a policy (tenant-scoped).                       |
//! | `POST   /v1/sabchat/sla/apply/{conversationId}`       | Pick the most-specific active policy for one          |
//! |                                                       | conversation, compute the three due-at timestamps,    |
//! |                                                       | and `$set` them onto `conversation.sla.*`.            |
//! | `POST   /v1/sabchat/sla/sweep`                        | Walk every open conversation in the tenant and        |
//! |                                                       | recompute the cached `breached` flag against `now`.   |
//!
//! ## Tenancy
//!
//! Every handler resolves the calling tenant via
//! [`tenant_oid`](self::tenant_oid) and uses it as a non-negotiable
//! filter on every Mongo read / write. Cross-tenant access is
//! impossible by construction.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    AppliesTo, CreatePolicyBody, ListPoliciesResponse, SlaPolicyDoc, SuccessResponse,
    SweepResponse, UpdatePolicyBody,
};
use crate::state::SabChatSlaState;
use crate::{CONVERSATIONS_COLL, SLA_POLICIES_COLL, score_policy};

// ===========================================================================
// Shared helpers
// ===========================================================================

/// Parse the calling user's `tenantId` claim into an `ObjectId`. A
/// malformed claim is treated as an auth failure (the JWT was issued
/// by us, so a bad value means a tampered token or a buggy issuer).
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Reject a policy body that ticks no clocks. At least one timer field
/// must be present — a policy with all three set to `None` has no
/// effect and is almost certainly a UI bug.
fn ensure_some_timer(first: Option<u32>, next: Option<u32>, resolution: Option<u32>) -> Result<()> {
    if first.is_none() && next.is_none() && resolution.is_none() {
        return Err(ApiError::Validation(
            "At least one of firstResponseMinutes, nextResponseMinutes, or \
             resolutionMinutes must be provided."
                .to_owned(),
        ));
    }
    Ok(())
}

/// Render an `AppliesTo` block into a BSON sub-document for storage.
/// `None` / empty fields are omitted so the on-disk shape stays clean.
#[allow(dead_code)]
fn applies_to_to_bson(a: &AppliesTo) -> Document {
    let mut out = doc! {};

    if let Some(ids) = &a.inbox_ids {
        // Inbox ids are stored as `ObjectId` so the
        // `appliesTo.inboxIds` filter on the conversation join is
        // index-friendly. Malformed entries fail the request.
        let parsed: Result<Vec<ObjectId>> = ids
            .iter()
            .map(|s| s.as_str())
            .filter(|s| !s.is_empty())
            .map(oid_from_str)
            .collect();
        // Best-effort — the caller-facing handlers run this through
        // their own `?` chain via `try_applies_to_to_bson`. This
        // function is the infallible counterpart used internally to
        // re-render the stored shape.
        if let Ok(oids) = parsed {
            out.insert(
                "inboxIds",
                Bson::Array(oids.into_iter().map(Bson::ObjectId).collect()),
            );
        }
    }

    if let Some(prios) = &a.priorities {
        let arr: Vec<Bson> = prios
            .iter()
            .map(|p| Bson::String(serialize_priority(*p)))
            .collect();
        out.insert("priorities", Bson::Array(arr));
    }

    out
}

/// Fallible variant — surfaces a 400 if any inbox id is malformed. Used
/// by `create_policy` / `update_policy`.
fn try_applies_to_to_bson(a: &AppliesTo) -> Result<Document> {
    let mut out = doc! {};

    if let Some(ids) = &a.inbox_ids {
        let oids: Vec<ObjectId> = ids
            .iter()
            .map(|s| s.as_str())
            .filter(|s| !s.is_empty())
            .map(oid_from_str)
            .collect::<Result<Vec<_>>>()?;
        out.insert(
            "inboxIds",
            Bson::Array(oids.into_iter().map(Bson::ObjectId).collect()),
        );
    }

    if let Some(prios) = &a.priorities {
        let arr: Vec<Bson> = prios
            .iter()
            .map(|p| Bson::String(serialize_priority(*p)))
            .collect();
        out.insert("priorities", Bson::Array(arr));
    }

    Ok(out)
}

/// Serialize a [`sabchat_types::ConversationPriority`] to the canonical
/// snake_case string used on the wire and in storage.
fn serialize_priority(p: sabchat_types::ConversationPriority) -> String {
    use sabchat_types::ConversationPriority::*;
    match p {
        Low => "low",
        Medium => "medium",
        High => "high",
        Urgent => "urgent",
    }
    .to_owned()
}

/// Render a stored policy document into the wire shape returned by GET
/// / POST / PATCH. Missing fields default to safe values so a partially-
/// populated document does not crash the renderer.
fn render_policy(doc: Document) -> Result<SlaPolicyDoc> {
    let id = doc
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("policy missing _id")))?
        .to_hex();
    let tenant_id = doc
        .get_object_id("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("policy missing tenantId")))?
        .to_hex();
    let name = doc
        .get_str("name")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("policy missing name")))?
        .to_owned();

    let applies_to = render_applies_to(doc.get_document("appliesTo").ok());

    let first_response_minutes = read_u32(&doc, "firstResponseMinutes");
    let next_response_minutes = read_u32(&doc, "nextResponseMinutes");
    let resolution_minutes = read_u32(&doc, "resolutionMinutes");

    let active = doc.get_bool("active").unwrap_or(true);

    let created_at = doc
        .get_datetime("createdAt")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("policy missing createdAt")))?
        .to_chrono();
    let updated_at = doc
        .get_datetime("updatedAt")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("policy missing updatedAt")))?
        .to_chrono();

    Ok(SlaPolicyDoc {
        id,
        tenant_id,
        name,
        applies_to,
        first_response_minutes,
        next_response_minutes,
        resolution_minutes,
        active,
        created_at,
        updated_at,
    })
}

/// Reverse the storage shape of `appliesTo` back into the wire shape
/// (hex strings for inbox ids; snake_case priority strings parsed back
/// into the enum).
fn render_applies_to(doc: Option<&Document>) -> AppliesTo {
    let Some(doc) = doc else {
        return AppliesTo::default();
    };

    let inbox_ids = match doc.get("inboxIds") {
        Some(Bson::Array(arr)) => {
            let ids: Vec<String> = arr
                .iter()
                .filter_map(|b| match b {
                    Bson::ObjectId(o) => Some(o.to_hex()),
                    Bson::String(s) => Some(s.clone()),
                    _ => None,
                })
                .collect();
            if ids.is_empty() { None } else { Some(ids) }
        }
        _ => None,
    };

    let priorities = match doc.get("priorities") {
        Some(Bson::Array(arr)) => {
            use sabchat_types::ConversationPriority::*;
            let out: Vec<sabchat_types::ConversationPriority> = arr
                .iter()
                .filter_map(|b| b.as_str())
                .filter_map(|s| match s {
                    "low" => Some(Low),
                    "medium" => Some(Medium),
                    "high" => Some(High),
                    "urgent" => Some(Urgent),
                    _ => None,
                })
                .collect();
            if out.is_empty() { None } else { Some(out) }
        }
        _ => None,
    };

    AppliesTo {
        inbox_ids,
        priorities,
    }
}

/// Read an optional `u32` field that may be stored as `i32` or `i64`
/// (the BSON wire encoding leaves both possibilities open depending on
/// driver / shim).
fn read_u32(doc: &Document, key: &str) -> Option<u32> {
    match doc.get(key) {
        Some(Bson::Int32(v)) if *v >= 0 => Some(*v as u32),
        Some(Bson::Int64(v)) if *v >= 0 => Some(*v as u32),
        _ => None,
    }
}

// ===========================================================================
// POST /policies — create_policy
// ===========================================================================

/// `POST /v1/sabchat/sla/policies` — create a new tenant-scoped policy.
///
/// Validates that at least one timer field is present, parses every
/// inbox id, then inserts. Returns the rendered policy.
#[instrument(skip_all, fields(name = %body.name))]
pub async fn create_policy(
    user: AuthUser,
    State(state): State<SabChatSlaState>,
    Json(body): Json<CreatePolicyBody>,
) -> Result<Json<SlaPolicyDoc>> {
    if body.name.trim().is_empty() {
        return Err(ApiError::Validation("Policy name is required.".to_owned()));
    }
    ensure_some_timer(
        body.first_response_minutes,
        body.next_response_minutes,
        body.resolution_minutes,
    )?;

    let tenant = tenant_oid(&user)?;
    let applies_to_bson = try_applies_to_to_bson(&body.applies_to)?;
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();

    let mut new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "name": body.name.trim(),
        "appliesTo": applies_to_bson,
        "active": body.active,
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(v) = body.first_response_minutes {
        new_doc.insert("firstResponseMinutes", v as i64);
    }
    if let Some(v) = body.next_response_minutes {
        new_doc.insert("nextResponseMinutes", v as i64);
    }
    if let Some(v) = body.resolution_minutes {
        new_doc.insert("resolutionMinutes", v as i64);
    }

    let coll = state.mongo.collection::<Document>(SLA_POLICIES_COLL);
    coll.insert_one(new_doc.clone()).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_sla_policies.insert_one"))
    })?;

    let rendered = render_policy(new_doc)?;
    Ok(Json(rendered))
}

// ===========================================================================
// GET /policies — list_policies
// ===========================================================================

/// `GET /v1/sabchat/sla/policies` — list every policy for the calling
/// tenant. Sorted by `updatedAt` desc so the UI sees the most-recently
/// touched policy first.
#[instrument(skip_all)]
pub async fn list_policies(
    user: AuthUser,
    State(state): State<SabChatSlaState>,
) -> Result<Json<ListPoliciesResponse>> {
    let tenant = tenant_oid(&user)?;
    let coll = state.mongo.collection::<Document>(SLA_POLICIES_COLL);

    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1 })
        .build();
    let cursor = coll
        .find(doc! { "tenantId": tenant })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_sla_policies.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_sla_policies.collect"))
    })?;

    let total = docs.len() as u64;
    let policies: Vec<SlaPolicyDoc> = docs
        .into_iter()
        .map(render_policy)
        .collect::<Result<Vec<_>>>()?;

    Ok(Json(ListPoliciesResponse { policies, total }))
}

// ===========================================================================
// GET /policies/{id} — get_policy
// ===========================================================================

/// `GET /v1/sabchat/sla/policies/{id}` — fetch one policy by id, scoped
/// to the calling tenant. 404 on miss.
#[instrument(skip_all, fields(policy_id = %id))]
pub async fn get_policy(
    user: AuthUser,
    State(state): State<SabChatSlaState>,
    Path(id): Path<String>,
) -> Result<Json<SlaPolicyDoc>> {
    let tenant = tenant_oid(&user)?;
    let policy_oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>(SLA_POLICIES_COLL);
    let doc = coll
        .find_one(doc! { "_id": policy_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_sla_policies.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("SLA policy not found.".to_owned()))?;

    Ok(Json(render_policy(doc)?))
}

// ===========================================================================
// PATCH /policies/{id} — update_policy
// ===========================================================================

/// `PATCH /v1/sabchat/sla/policies/{id}` — partial update. Only the
/// fields present in the body are `$set`; the rest are left untouched.
/// Returns the rendered policy after the update.
#[instrument(skip_all, fields(policy_id = %id))]
pub async fn update_policy(
    user: AuthUser,
    State(state): State<SabChatSlaState>,
    Path(id): Path<String>,
    Json(body): Json<UpdatePolicyBody>,
) -> Result<Json<SlaPolicyDoc>> {
    let tenant = tenant_oid(&user)?;
    let policy_oid = oid_from_str(&id)?;

    let mut update = doc! { "updatedAt": bson::DateTime::from_chrono(Utc::now()) };
    if let Some(name) = body
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        update.insert("name", name);
    }
    if let Some(applies) = &body.applies_to {
        update.insert("appliesTo", try_applies_to_to_bson(applies)?);
    }
    if let Some(v) = body.first_response_minutes {
        update.insert("firstResponseMinutes", v as i64);
    }
    if let Some(v) = body.next_response_minutes {
        update.insert("nextResponseMinutes", v as i64);
    }
    if let Some(v) = body.resolution_minutes {
        update.insert("resolutionMinutes", v as i64);
    }
    if let Some(v) = body.active {
        update.insert("active", v);
    }

    let coll = state.mongo.collection::<Document>(SLA_POLICIES_COLL);
    let res = coll
        .update_one(
            doc! { "_id": policy_oid, "tenantId": tenant },
            doc! { "$set": update },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_sla_policies.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("SLA policy not found.".to_owned()));
    }

    // Re-read so the wire response reflects the merged document.
    let doc = coll
        .find_one(doc! { "_id": policy_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_sla_policies.find_one(post-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("SLA policy not found.".to_owned()))?;

    Ok(Json(render_policy(doc)?))
}

// ===========================================================================
// DELETE /policies/{id} — delete_policy
// ===========================================================================

/// `DELETE /v1/sabchat/sla/policies/{id}` — tenant-scoped delete. 404
/// when no matching policy exists. The TS layer is responsible for
/// confirming with the user before issuing this request.
#[instrument(skip_all, fields(policy_id = %id))]
pub async fn delete_policy(
    user: AuthUser,
    State(state): State<SabChatSlaState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&user)?;
    let policy_oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>(SLA_POLICIES_COLL);
    let res = coll
        .delete_one(doc! { "_id": policy_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_sla_policies.delete_one"))
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("SLA policy not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /apply/{conversationId} — apply_to_conversation
// ===========================================================================

/// `POST /v1/sabchat/sla/apply/{conversationId}` — pick the most-
/// specific active policy for one conversation, compute the three
/// due-at timestamps, and `$set` them onto `conversation.sla.*`.
///
/// Due-at math:
/// * `firstResponseDueAt = (firstResponseAt || createdAt) + firstResponseMinutes`
/// * `nextResponseDueAt  = (lastMessageAt   || createdAt) + nextResponseMinutes`
/// * `resolutionDueAt    = createdAt + resolutionMinutes`
///
/// If the policy does not set a given timer, the corresponding due-at
/// is left as `null`. `breached` is recomputed against `now` and
/// written under the same `$set`.
///
/// Returns the rendered policy that was applied.
#[instrument(skip_all, fields(conversation_id = %conversation_id))]
pub async fn apply_to_conversation(
    user: AuthUser,
    State(state): State<SabChatSlaState>,
    Path(conversation_id): Path<String>,
) -> Result<Json<SlaPolicyDoc>> {
    let tenant = tenant_oid(&user)?;
    let convo_oid = oid_from_str(&conversation_id)?;

    // ---- 1. Load conversation (tenant-scoped). -----------------------------
    let convo_coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let convo = convo_coll
        .find_one(doc! { "_id": convo_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Conversation not found.".to_owned()))?;

    let inbox_id = convo.get_object_id("inboxId").ok();
    let priority = convo
        .get_str("priority")
        .ok()
        .map(str::to_owned)
        .unwrap_or_else(|| "medium".to_owned());

    let created_at = convo.get_datetime("createdAt").ok().copied();
    let last_message_at = convo.get_datetime("lastMessageAt").ok().copied();
    let first_response_at = convo.get_datetime("firstResponseAt").ok().copied();

    // ---- 2. Score every active tenant policy; keep the winner. -------------
    let pol_coll = state.mongo.collection::<Document>(SLA_POLICIES_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1 })
        .build();
    let cursor = pol_coll
        .find(doc! { "tenantId": tenant, "active": true })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_sla_policies.find"))
        })?;
    let candidates: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_sla_policies.collect"))
    })?;

    let mut best: Option<(i32, Document)> = None;
    for policy in candidates {
        if let Some(score) = score_policy(&policy, inbox_id.as_ref(), &priority) {
            if best.as_ref().map_or(true, |(s, _)| score > *s) {
                best = Some((score, policy));
            }
        }
    }
    let policy = best.map(|(_, doc)| doc).ok_or_else(|| {
        ApiError::NotFound("No active SLA policy matches this conversation.".to_owned())
    })?;

    // ---- 3. Compute the three due-at timestamps. ---------------------------
    let now_chrono = Utc::now();

    let first_minutes = read_u32(&policy, "firstResponseMinutes");
    let next_minutes = read_u32(&policy, "nextResponseMinutes");
    let res_minutes = read_u32(&policy, "resolutionMinutes");

    let first_anchor = first_response_at.or(created_at);
    let next_anchor = last_message_at.or(created_at);
    let res_anchor = created_at;

    let first_due = compute_due(first_anchor, first_minutes);
    let next_due = compute_due(next_anchor, next_minutes);
    let res_due = compute_due(res_anchor, res_minutes);

    let now_bson = bson::DateTime::from_chrono(now_chrono);
    let breached = [&first_due, &next_due, &res_due]
        .iter()
        .any(|d| matches!(d, Some(dt) if *dt < now_bson));

    // ---- 4. Persist onto the conversation. --------------------------------
    let mut sla = doc! {
        "firstResponseDueAt": Bson::Null,
        "nextResponseDueAt": Bson::Null,
        "resolutionDueAt": Bson::Null,
        "breached": breached,
    };
    if let Some(d) = first_due {
        sla.insert("firstResponseDueAt", d);
    }
    if let Some(d) = next_due {
        sla.insert("nextResponseDueAt", d);
    }
    if let Some(d) = res_due {
        sla.insert("resolutionDueAt", d);
    }

    convo_coll
        .update_one(
            doc! { "_id": convo_oid, "tenantId": tenant },
            doc! { "$set": {
                "sla": sla,
                "updatedAt": now_bson,
            } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(sla)"),
            )
        })?;

    Ok(Json(render_policy(policy)?))
}

/// Compute one due-at = `anchor + minutes`. Returns `None` if either
/// is missing (the wire shape carries `null` in that slot).
fn compute_due(anchor: Option<bson::DateTime>, minutes: Option<u32>) -> Option<bson::DateTime> {
    let anchor = anchor?;
    let minutes = minutes? as i64;
    let chrono = anchor.to_chrono() + Duration::minutes(minutes);
    Some(bson::DateTime::from_chrono(chrono))
}

// ===========================================================================
// POST /sweep — sweep
// ===========================================================================

/// `POST /v1/sabchat/sla/sweep` — walk every **open** conversation for
/// the tenant and recompute `sla.breached = (now > any due-at)`.
///
/// Cron-callable. Open here means `status == "open"`; `pending`,
/// `snoozed` and `resolved` conversations are skipped — the standard
/// SLA model only pays attention to active queues.
///
/// Returns `{ scanned, breached }`.
#[instrument(skip_all)]
pub async fn sweep(
    user: AuthUser,
    State(state): State<SabChatSlaState>,
) -> Result<Json<SweepResponse>> {
    let tenant = tenant_oid(&user)?;
    let coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);

    let cursor = coll
        .find(doc! { "tenantId": tenant, "status": "open" })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find(sweep)"))
        })?;
    let convos: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.collect(sweep)"))
    })?;

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let mut scanned: u64 = 0;
    let mut breached: u64 = 0;

    for convo in convos {
        scanned += 1;

        let sla = convo.get_document("sla").ok();
        let first = sla.and_then(|s| s.get_datetime("firstResponseDueAt").ok().copied());
        let next = sla.and_then(|s| s.get_datetime("nextResponseDueAt").ok().copied());
        let res = sla.and_then(|s| s.get_datetime("resolutionDueAt").ok().copied());

        let is_breached = [first, next, res]
            .iter()
            .any(|d| matches!(d, Some(dt) if *dt < now_bson));
        if is_breached {
            breached += 1;
        }

        let convo_id = match convo.get_object_id("_id") {
            Ok(o) => o,
            Err(_) => continue, // skip malformed documents rather than abort the sweep
        };

        // Only touch the row when the cached value drifts — keeps
        // `updatedAt` churn proportional to actual state changes.
        let cached = sla
            .and_then(|s| s.get_bool("breached").ok())
            .unwrap_or(false);
        if cached != is_breached {
            // Set just the leaf so we don't clobber the due-at
            // timestamps. `sla.breached` is a dotted path under `$set`.
            //
            // `updatedAt` is left untouched here on purpose — sweep is
            // a background refresh, not a user-driven change.
            update_breached(&state.mongo, convo_id, tenant, is_breached).await?;
        }
    }

    Ok(Json(SweepResponse { scanned, breached }))
}

/// Persist the cached `sla.breached` flag without disturbing the rest
/// of the `sla` sub-document.
async fn update_breached(
    mongo: &MongoHandle,
    conversation_id: ObjectId,
    tenant: ObjectId,
    breached: bool,
) -> Result<()> {
    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.update_one(
        doc! { "_id": conversation_id, "tenantId": tenant },
        doc! { "$set": { "sla.breached": breached } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_conversations.update_one(sla.breached)"),
        )
    })?;
    Ok(())
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn ensure_some_timer_rejects_all_none() {
        assert!(ensure_some_timer(None, None, None).is_err());
    }

    #[test]
    fn ensure_some_timer_accepts_any_set() {
        assert!(ensure_some_timer(Some(5), None, None).is_ok());
        assert!(ensure_some_timer(None, Some(5), None).is_ok());
        assert!(ensure_some_timer(None, None, Some(5)).is_ok());
    }

    #[test]
    fn compute_due_adds_minutes() {
        let anchor =
            bson::DateTime::from_chrono(Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap());
        let out = compute_due(Some(anchor), Some(60)).expect("some");
        assert_eq!(
            out.to_chrono(),
            Utc.with_ymd_and_hms(2026, 1, 1, 1, 0, 0).unwrap()
        );
    }

    #[test]
    fn compute_due_returns_none_when_anchor_missing() {
        assert!(compute_due(None, Some(60)).is_none());
    }

    #[test]
    fn compute_due_returns_none_when_minutes_missing() {
        let anchor =
            bson::DateTime::from_chrono(Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap());
        assert!(compute_due(Some(anchor), None).is_none());
    }

    #[test]
    fn render_applies_to_omits_empty_arrays() {
        let doc = doc! { "inboxIds": Bson::Array(vec![]), "priorities": Bson::Array(vec![]) };
        let rendered = render_applies_to(Some(&doc));
        assert!(rendered.inbox_ids.is_none());
        assert!(rendered.priorities.is_none());
    }

    #[test]
    fn applies_to_to_bson_is_infallible_fallback() {
        // Internal helper drops malformed inbox ids silently; the
        // fallible variant on the request path is what surfaces 400s.
        let bad = AppliesTo {
            inbox_ids: Some(vec!["not-an-objectid".to_owned()]),
            priorities: None,
        };
        let out = applies_to_to_bson(&bad);
        assert!(out.get("inboxIds").is_none());
    }
}
