//! HTTP handlers for the SabChat routing domain.
//!
//! Three endpoints:
//!
//! | Endpoint                                            | Purpose                              |
//! |-----------------------------------------------------|--------------------------------------|
//! | `POST /v1/sabchat/routing/assign/{conversationId}`  | apply an assignment strategy         |
//! | `POST /v1/sabchat/routing/sla/sweep`                | recompute `sla.breached` (admin/cron)|
//! | `GET  /v1/sabchat/routing/load`                     | per-agent capacity report            |
//!
//! ## Tenancy
//!
//! Every endpoint scopes every read and write by
//! `ObjectId::parse_str(&auth.tenant_id)` — the JWT extractor is the only
//! source of truth for tenant id. RBAC beyond that (e.g. admin-only sweep)
//! is enforced by the orchestrator's middleware; this crate stays role-
//! agnostic so it can be reused inside SabFlow nodes without re-checking.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::bson_helpers::oid_from_str;
use serde::Deserialize;
use std::collections::HashMap;
use tracing::instrument;

use crate::dto::{AgentLoadRow, AssignReq, AssignResp, AssignStrategy, SlaSweepResp};
use crate::state::SabChatRoutingState;
use crate::strategy::{load_inbox_agents, pick_round_robin, pick_sticky};

// ---------------------------------------------------------------------------
// Collection names — kept inline (not in a separate `consts` module) so
// matching them 1:1 against the `sabchat_*` literals from `sabchat-types` is
// trivial during review. Re-exported `pub(crate)` so `strategy.rs` can share
// them without redeclaring.
// ---------------------------------------------------------------------------

pub(crate) const INBOXES_COLL: &str = "sabchat_inboxes";
pub(crate) const CONVERSATIONS_COLL: &str = "sabchat_conversations";
pub(crate) const ASSIGNMENTS_COLL: &str = "sabchat_assignments";
pub(crate) const AUDIT_COLL: &str = "sabchat_audit_log";

// ---------------------------------------------------------------------------
// Tenant + actor helpers
// ---------------------------------------------------------------------------

/// Parse `auth.tenant_id` (claim is a string) into an `ObjectId`. Surfaces a
/// 401 if the JWT carried a malformed tenant id — that's an upstream bug,
/// never a client request bug.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

/// Parse `auth.user_id` (claim is a string) into an `ObjectId`. Same
/// failure mode as [`tenant_oid`].
fn actor_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

// ===========================================================================
// POST /assign/{conversationId} — assign
// ===========================================================================

/// `POST /v1/sabchat/routing/assign/{conversationId}` — apply an assignment
/// strategy to one conversation.
///
/// Resolves the conversation's inbox, picks a target agent using the
/// requested strategy, then atomically:
///   1. updates `sabchat_conversations` (`assignee_id`, `updated_at`),
///   2. appends a history row to `sabchat_assignments`,
///   3. writes a `conversation_assigned` event to `sabchat_audit_log`.
#[instrument(skip_all, fields(conversation_id = %conversation_id))]
pub async fn assign(
    user: AuthUser,
    State(state): State<SabChatRoutingState>,
    Path(conversation_id): Path<String>,
    Json(body): Json<AssignReq>,
) -> Result<Json<AssignResp>> {
    let tenant = tenant_oid(&user)?;
    let actor = actor_oid(&user).ok();
    let conversation_oid = oid_from_str(&conversation_id)
        .map_err(|_| ApiError::BadRequest("Invalid conversation ID.".to_owned()))?;

    // ---- Load the conversation (scoped by tenant) ----------------------
    let convos = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let convo = convos
        .find_one(doc! { "_id": conversation_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Conversation not found.".to_owned()))?;

    let inbox_oid = convo
        .get_object_id("inboxId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing inboxId")))?;
    let contact_oid = convo
        .get_object_id("contactId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing contactId")))?;
    let prev_assignee = convo.get_object_id("assigneeId").ok();

    // ---- Resolve the new assignee via the chosen strategy --------------
    //
    // `unassign` short-circuits the inbox lookup since it doesn't need the
    // candidate list. Every other strategy needs the inbox's `agent_ids`.
    let new_assignee: Option<ObjectId> = match body.strategy {
        AssignStrategy::Unassign => None,

        AssignStrategy::Manual => {
            let agent_hex = body
                .agent_id
                .as_deref()
                .filter(|s| !s.is_empty())
                .ok_or_else(|| {
                    ApiError::Validation("agentId is required for manual assignment.".to_owned())
                })?;
            let agent = oid_from_str(agent_hex)
                .map_err(|_| ApiError::BadRequest("Invalid agentId.".to_owned()))?;
            let agents = load_inbox_agents(&state.mongo, tenant, inbox_oid).await?;
            if !agents.contains(&agent) {
                return Err(ApiError::Forbidden(
                    "Agent is not a member of this inbox.".to_owned(),
                ));
            }
            Some(agent)
        }

        AssignStrategy::RoundRobin => {
            let agents = load_inbox_agents(&state.mongo, tenant, inbox_oid).await?;
            pick_round_robin(&state.mongo, tenant, inbox_oid, &agents).await?
        }

        AssignStrategy::Sticky => {
            let agents = load_inbox_agents(&state.mongo, tenant, inbox_oid).await?;
            // Sticky tries the prior assignee first, then falls back to
            // round-robin on the same candidate set.
            match pick_sticky(&state.mongo, tenant, contact_oid, &agents).await? {
                Some(id) => Some(id),
                None => pick_round_robin(&state.mongo, tenant, inbox_oid, &agents).await?,
            }
        }
    };

    // ---- 1) Update the conversation ------------------------------------
    let now = bson::DateTime::from_chrono(Utc::now());
    let assignee_bson: Bson = match new_assignee {
        Some(id) => Bson::ObjectId(id),
        None => Bson::Null,
    };
    convos
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant },
            doc! {
                "$set": {
                    "assigneeId": assignee_bson,
                    "updatedAt": now,
                },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.update_one"))
        })?;

    // ---- 2) Append assignment history row ------------------------------
    let reason = body
        .reason
        .clone()
        .unwrap_or_else(|| strategy_wire_name(body.strategy).to_owned());
    let history_row = doc! {
        "_id": ObjectId::new(),
        "tenantId": tenant,
        "conversationId": conversation_oid,
        "prevAssigneeId": prev_assignee.map(Bson::ObjectId).unwrap_or(Bson::Null),
        "newAssigneeId": new_assignee.map(Bson::ObjectId).unwrap_or(Bson::Null),
        "reason": &reason,
        "actorId": actor.map(Bson::ObjectId).unwrap_or(Bson::Null),
        "at": now,
    };
    state
        .mongo
        .collection::<Document>(ASSIGNMENTS_COLL)
        .insert_one(history_row)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_assignments.insert_one"))
        })?;

    // ---- 3) Audit event ------------------------------------------------
    //
    // `before` and `after` capture only the changed slice so audit rows
    // stay compact. The frontend's diff viewer reads exactly these keys.
    let before = serde_json::json!({
        "assigneeId": prev_assignee.map(|o| o.to_hex()),
    });
    let after = serde_json::json!({
        "assigneeId": new_assignee.map(|o| o.to_hex()),
    });
    let audit = doc! {
        "_id": ObjectId::new(),
        "tenantId": tenant,
        "conversationId": conversation_oid,
        "action": "conversation_assigned",
        "actorType": if actor.is_some() { "agent" } else { "system" },
        "actorId": actor.map(Bson::ObjectId).unwrap_or(Bson::Null),
        "before": Bson::try_from(before).unwrap_or(Bson::Null),
        "after": Bson::try_from(after).unwrap_or(Bson::Null),
        "createdAt": now,
    };
    state
        .mongo
        .collection::<Document>(AUDIT_COLL)
        .insert_one(audit)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_audit_log.insert_one"))
        })?;

    Ok(Json(AssignResp {
        conversation_id: conversation_oid.to_hex(),
        strategy: body.strategy,
        assignee_id: new_assignee.map(|o| o.to_hex()),
        previous_assignee_id: prev_assignee.map(|o| o.to_hex()),
    }))
}

/// Stable wire spelling for the assignment strategy — written into
/// `sabchat_assignments.reason` when the caller didn't supply their own.
fn strategy_wire_name(s: AssignStrategy) -> &'static str {
    match s {
        AssignStrategy::RoundRobin => "round_robin",
        AssignStrategy::Manual => "manual",
        AssignStrategy::Sticky => "sticky",
        AssignStrategy::Unassign => "unassigned",
    }
}

// ===========================================================================
// POST /sla/sweep — sla_sweep
// ===========================================================================

/// `POST /v1/sabchat/routing/sla/sweep` — recompute `sla.breached` for
/// every open conversation in the tenant.
///
/// Intended for an admin / cron caller. The orchestrator wires the
/// role-check; this handler trusts the JWT's `tenant_id` claim and scopes
/// every operation to it.
///
/// A conversation is considered breached if `now > any due-at` set on its
/// `sla` policy (`firstResponseDueAt`, `nextResponseDueAt`,
/// `resolutionDueAt`). Conversations whose cached flag already matches the
/// recomputed value are left untouched (returned under `unchanged`) to
/// keep this safe to re-run on the minute boundary.
#[instrument(skip_all)]
pub async fn sla_sweep(
    user: AuthUser,
    State(state): State<SabChatRoutingState>,
) -> Result<Json<SlaSweepResp>> {
    let tenant = tenant_oid(&user)?;
    let now_chrono = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now_chrono);

    let convos = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let cursor = convos
        .find(doc! { "tenantId": tenant, "status": "open" })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find(sweep)"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.collect(sweep)"))
    })?;

    let mut scanned: u64 = 0;
    let mut newly_breached: u64 = 0;
    let mut cleared: u64 = 0;
    let mut unchanged: u64 = 0;

    for d in &docs {
        scanned += 1;
        let Ok(id) = d.get_object_id("_id") else {
            continue;
        };
        let sla = d.get_document("sla").ok();
        let cached_breach = sla
            .and_then(|s| s.get_bool("breached").ok())
            .unwrap_or(false);

        // A conversation is breached if any non-null due-at is in the past.
        let any_due_passed = sla
            .map(|s| {
                ["firstResponseDueAt", "nextResponseDueAt", "resolutionDueAt"]
                    .iter()
                    .filter_map(|k| s.get_datetime(*k).ok())
                    .any(|dt| dt.to_chrono() < now_chrono)
            })
            .unwrap_or(false);

        if any_due_passed == cached_breach {
            unchanged += 1;
            continue;
        }

        convos
            .update_one(
                doc! { "_id": id, "tenantId": tenant },
                doc! {
                    "$set": {
                        "sla.breached": any_due_passed,
                        "updatedAt": now_bson,
                    },
                },
            )
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("sabchat_conversations.update_one(sweep)"),
                )
            })?;

        if any_due_passed {
            newly_breached += 1;
        } else {
            cleared += 1;
        }
    }

    Ok(Json(SlaSweepResp {
        scanned,
        newly_breached,
        cleared,
        unchanged,
    }))
}

// ===========================================================================
// GET /load — agent_load
// ===========================================================================

/// Query string for `GET /v1/sabchat/routing/load`. Currently no filters;
/// kept as a struct so future additions (`inboxId`, `teamId`) don't break
/// the wire shape.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentLoadQuery {}

/// `GET /v1/sabchat/routing/load` — per-agent capacity report.
///
/// Returns one [`AgentLoadRow`] for every agent that appears on at least
/// one inbox in this tenant. Used by the inbox UI to colour-code agent
/// avatars by current load.
///
/// The computation:
///   1. Collect the union of `agent_ids` across every `sabchat_inboxes`
///      doc for the tenant.
///   2. Stream every `open` conversation in the tenant once; bucket by
///      `assigneeId` to derive `openCount`, `urgentCount` and `oldest_at`.
///   3. Emit rows in stable hex-id order so test snapshots stay stable.
#[instrument(skip_all)]
pub async fn agent_load(
    user: AuthUser,
    State(state): State<SabChatRoutingState>,
    Query(_query): Query<AgentLoadQuery>,
) -> Result<Json<Vec<AgentLoadRow>>> {
    let tenant = tenant_oid(&user)?;

    // ---- 1) Union of inbox agent_ids -----------------------------------
    let inboxes = state.mongo.collection::<Document>(INBOXES_COLL);
    let cursor = inboxes
        .find(doc! { "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find(load)"))
        })?;
    let inbox_docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.collect(load)"))
    })?;

    let mut agent_set: HashMap<ObjectId, ()> = HashMap::new();
    for d in &inbox_docs {
        if let Ok(arr) = d.get_array("agentIds") {
            for b in arr {
                if let Some(oid) = b.as_object_id() {
                    agent_set.insert(oid, ());
                }
            }
        }
    }

    // ---- 2) Stream open conversations once + bucket --------------------
    let convos = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let cursor = convos
        .find(doc! { "tenantId": tenant, "status": "open" })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find(load)"))
        })?;
    let convo_docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.collect(load)"))
    })?;

    /// Per-agent accumulator.
    struct Bucket {
        open_count: u64,
        urgent_count: u64,
        /// Oldest `createdAt` seen so far (lowest unix-ms timestamp). `None`
        /// until the first assigned conversation lands in this bucket.
        oldest_ms: Option<i64>,
    }
    let mut buckets: HashMap<ObjectId, Bucket> = HashMap::new();
    // Seed buckets for every known agent so agents with zero load still
    // appear in the response with `openCount: 0`.
    for agent in agent_set.keys() {
        buckets.insert(
            *agent,
            Bucket {
                open_count: 0,
                urgent_count: 0,
                oldest_ms: None,
            },
        );
    }

    for d in &convo_docs {
        let Ok(assignee) = d.get_object_id("assigneeId") else {
            continue;
        };
        let bucket = buckets.entry(assignee).or_insert(Bucket {
            open_count: 0,
            urgent_count: 0,
            oldest_ms: None,
        });
        bucket.open_count += 1;
        if matches!(d.get_str("priority"), Ok("urgent")) {
            bucket.urgent_count += 1;
        }
        if let Ok(created) = d.get_datetime("createdAt") {
            let ms = created.timestamp_millis();
            bucket.oldest_ms = Some(match bucket.oldest_ms {
                Some(cur) => cur.min(ms),
                None => ms,
            });
        }
    }

    // ---- 3) Emit rows in stable hex order ------------------------------
    let now_ms = Utc::now().timestamp_millis();
    let mut rows: Vec<AgentLoadRow> = buckets
        .into_iter()
        .map(|(agent, b)| AgentLoadRow {
            agent_id: agent.to_hex(),
            open_count: b.open_count,
            urgent_count: b.urgent_count,
            oldest_minutes: b.oldest_ms.map(|ms| (now_ms - ms).max(0) / 60_000),
        })
        .collect();
    rows.sort_by(|a, b| a.agent_id.cmp(&b.agent_id));

    Ok(Json(rows))
}
