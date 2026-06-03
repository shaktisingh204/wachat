//! HTTP handlers for the SabChat compliance domain.
//!
//! Every endpoint scopes its Mongo I/O to the caller's tenant
//! (`auth.tenant_id`). The tenant id is taken from the verified JWT,
//! never from the request body or path — a malformed `tid` claim is
//! treated as `401 Unauthorized`.
//!
//! | Endpoint                                       | Description                                  |
//! |------------------------------------------------|----------------------------------------------|
//! | `POST   /v1/sabchat/compliance/dsr`            | enqueue a pending DSR                        |
//! | `GET    /v1/sabchat/compliance/dsr`            | paginated list                               |
//! | `GET    /v1/sabchat/compliance/dsr/{id}`       | fetch one DSR by id                          |
//! | `POST   /v1/sabchat/compliance/dsr/{id}/run`   | execute the DSR (export or delete)           |
//! | `POST   /v1/sabchat/compliance/retention`      | create a retention rule                      |
//! | `GET    /v1/sabchat/compliance/retention`      | list all rules for the tenant                |
//! | `PATCH  /v1/sabchat/compliance/retention/{id}` | partial update                               |
//! | `DELETE /v1/sabchat/compliance/retention/{id}` | delete a rule                                |
//! | `POST   /v1/sabchat/compliance/retention/sweep`| run active rules now                         |
//! | `POST   /v1/sabchat/compliance/redact-text`    | mask PII in a string                         |

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabchat_types::ContentBlock;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateDsrBody, CreateDsrResponse, CreateRetentionRuleBody, DEFAULT_LIMIT, ListDsrQuery,
    ListDsrResponse, ListRetentionRulesResponse, MAX_LIMIT, RedactTextBody, RedactTextResponse,
    RetentionRuleResponse, RunDsrResponse, SuccessResponse, SweepEntry, UpdateRetentionRuleBody,
};
use crate::redact::redact_pii;
use crate::state::SabChatComplianceState;
use crate::{
    AUDIT_LOG_COLL, CONTACTS_COLL, CONVERSATIONS_COLL, DSR_EXPORTS_COLL, DSR_REQUESTS_COLL,
    EVENTS_COLL, MESSAGES_COLL, RETENTION_RULES_COLL,
};

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse the caller's tenant id from the JWT into an `ObjectId`. The
/// tenant id is required on every endpoint — there is no global
/// compliance surface.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

/// Validate the DSR `kind` discriminator. Anything outside the two
/// accepted verbs is `422 Unprocessable Entity` so callers can't sneak
/// unknown actions into the queue.
fn validate_dsr_kind(kind: &str) -> Result<&'static str> {
    match kind {
        "export" => Ok("export"),
        "delete" => Ok("delete"),
        other => Err(ApiError::Validation(format!(
            "kind must be \"export\" or \"delete\", got \"{other}\""
        ))),
    }
}

/// Validate a retention rule target. Restricting the set up front
/// keeps the sweep job from accidentally `delete_many`-ing the wrong
/// collection.
fn validate_retention_target(target: &str) -> Result<&'static str> {
    match target {
        "messages" => Ok(MESSAGES_COLL),
        "conversations" => Ok(CONVERSATIONS_COLL),
        "events" => Ok(EVENTS_COLL),
        "audit_log" => Ok(AUDIT_LOG_COLL),
        other => Err(ApiError::Validation(format!(
            "target must be one of messages|conversations|events|audit_log, got \"{other}\""
        ))),
    }
}

/// Stash a `bson::DateTime` for `now` in one place — the DSR run path
/// stamps multiple timestamps in the same wall-clock instant and we'd
/// rather they all match exactly.
fn now_bson() -> bson::DateTime {
    bson::DateTime::from_chrono(Utc::now())
}

// ===========================================================================
// POST /v1/sabchat/compliance/dsr — create_dsr
// ===========================================================================

/// `POST /dsr` — record a pending data subject request. Execution
/// (`POST /dsr/{id}/run`) is a separate call so a long export job
/// doesn't tie up the request thread.
#[instrument(skip_all, fields(tenant = %user.tenant_id, kind = %body.kind))]
pub async fn create_dsr(
    user: AuthUser,
    State(state): State<SabChatComplianceState>,
    Json(body): Json<CreateDsrBody>,
) -> Result<Json<CreateDsrResponse>> {
    let tenant = tenant_oid(&user)?;
    let contact_oid = oid_from_str(&body.contact_id)?;
    let kind = validate_dsr_kind(&body.kind)?;

    // Take the explicit `requestedBy` if provided, else fall back to
    // the JWT subject so we always have a non-empty actor on the row.
    let requested_by = body
        .requested_by
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| user.user_id.clone());

    let new_oid = ObjectId::new();
    let now = now_bson();
    let doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "contactId": contact_oid,
        "kind": kind,
        "status": "pending",
        "requestedBy": &requested_by,
        "createdAt": now,
    };

    state
        .mongo
        .collection::<Document>(DSR_REQUESTS_COLL)
        .insert_one(doc)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_dsr_requests.insert_one"))
        })?;

    Ok(Json(CreateDsrResponse {
        id: new_oid.to_hex(),
        status: "pending".to_owned(),
    }))
}

// ===========================================================================
// GET /v1/sabchat/compliance/dsr — list_dsr
// ===========================================================================

/// `GET /dsr` — paginated list of DSR rows for the caller's tenant.
/// Cursor pagination on `_id`, newest first (Mongo ObjectIds are
/// monotonic with insert time).
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_dsr(
    user: AuthUser,
    State(state): State<SabChatComplianceState>,
    Query(query): Query<ListDsrQuery>,
) -> Result<Json<ListDsrResponse>> {
    let tenant = tenant_oid(&user)?;

    let mut filter = doc! { "tenantId": tenant };
    if let Some(status) = query.status.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("status", status);
    }
    if let Some(raw) = query.cursor.as_deref().filter(|s| !s.is_empty()) {
        let cursor_oid = oid_from_str(raw)?;
        filter.insert("_id", doc! { "$lt": cursor_oid });
    }

    // Clamp the page size — guard against `limit = 0` (default fallback)
    // and silly upper bounds in one place.
    let limit = if query.limit <= 0 {
        DEFAULT_LIMIT
    } else {
        query.limit
    };
    let limit = limit.clamp(1, MAX_LIMIT);

    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<Document>(DSR_REQUESTS_COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_dsr_requests.find"))
    })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_dsr_requests.collect"))
    })?;

    // Compute the cursor BEFORE the docs move through the json
    // conversion. Short pages signal "end of feed".
    let next_cursor = if (docs.len() as i64) < limit {
        None
    } else {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|oid| oid.to_hex())
    };

    let requests: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListDsrResponse {
        requests,
        next_cursor,
    }))
}

// ===========================================================================
// GET /v1/sabchat/compliance/dsr/{id} — get_dsr
// ===========================================================================

/// `GET /dsr/{id}` — fetch a single DSR row scoped to the tenant.
#[instrument(skip_all, fields(tenant = %user.tenant_id, dsr_id = %id))]
pub async fn get_dsr(
    user: AuthUser,
    State(state): State<SabChatComplianceState>,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let dsr_oid = oid_from_str(&id)?;

    let doc = state
        .mongo
        .collection::<Document>(DSR_REQUESTS_COLL)
        .find_one(doc! { "_id": dsr_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_dsr_requests.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("DSR not found.".to_owned()))?;

    Ok(Json(document_to_clean_json(doc)))
}

// ===========================================================================
// POST /v1/sabchat/compliance/dsr/{id}/run — run_dsr
// ===========================================================================

/// `POST /dsr/{id}/run` — execute the DSR. Dispatches based on `kind`:
///
/// - `"export"` aggregates the contact + all conversations + all
///   messages into a single payload document, writes it to
///   `sabchat_dsr_exports`, and stamps the request with `payloadId`.
/// - `"delete"` redacts the contact's PII fields and rewrites every
///   related message's `content` to a redacted
///   [`ContentBlock::System`].
///
/// On success the request flips to `status = "done"` with
/// `completed_at`. On failure (e.g. a Mongo I/O error during the
/// aggregation) the row is stamped `status = "failed"` with the error
/// message captured so an operator can retry.
#[instrument(skip_all, fields(tenant = %user.tenant_id, dsr_id = %id))]
pub async fn run_dsr(
    user: AuthUser,
    State(state): State<SabChatComplianceState>,
    Path(id): Path<String>,
) -> Result<Json<RunDsrResponse>> {
    let tenant = tenant_oid(&user)?;
    let dsr_oid = oid_from_str(&id)?;

    let requests = state.mongo.collection::<Document>(DSR_REQUESTS_COLL);

    // Load + tenant check up front — we want a clean 404 (rather than a
    // silent no-op) when an operator runs the wrong id.
    let dsr = requests
        .find_one(doc! { "_id": dsr_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_dsr_requests.find_one(run)"))
        })?
        .ok_or_else(|| ApiError::NotFound("DSR not found.".to_owned()))?;

    let kind = dsr
        .get_str("kind")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("dsr row missing `kind` field")))?
        .to_owned();
    let contact_oid = dsr
        .get_object_id("contactId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("dsr row missing `contactId`")))?;

    // Mark as running so concurrent operators see the in-flight state.
    // We don't take a distributed lock here — the dashboard prevents
    // double-clicks and a duplicate run is idempotent (the second one
    // would just re-redact / re-export the same data).
    let started_at = now_bson();
    requests
        .update_one(
            doc! { "_id": dsr_oid, "tenantId": tenant },
            doc! { "$set": { "status": "running", "startedAt": started_at } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_dsr_requests.mark_running"))
        })?;

    // Dispatch + catch errors so we can stamp `failed` instead of
    // bubbling a 500 (the row is the operator's view of progress).
    let outcome = match kind.as_str() {
        "export" => run_export(&state.mongo, tenant, contact_oid).await,
        "delete" => run_delete(&state.mongo, tenant, contact_oid).await,
        other => Err(ApiError::Validation(format!(
            "DSR row has unknown kind \"{other}\""
        ))),
    };

    let completed_at = now_bson();
    match outcome {
        Ok(payload_id) => {
            let mut set_doc = doc! {
                "status": "done",
                "completedAt": completed_at,
            };
            if let Some(pid) = payload_id.as_ref() {
                set_doc.insert("resultUrl", pid);
            }
            requests
                .update_one(
                    doc! { "_id": dsr_oid, "tenantId": tenant },
                    doc! { "$set": set_doc },
                )
                .await
                .map_err(|e| {
                    ApiError::Internal(
                        anyhow::Error::new(e).context("sabchat_dsr_requests.mark_done"),
                    )
                })?;

            Ok(Json(RunDsrResponse {
                id: dsr_oid.to_hex(),
                status: "done".to_owned(),
                payload_id,
            }))
        }
        Err(err) => {
            // Render the error chain into the row before bubbling. We
            // intentionally surface the original error (not a wrapped
            // one) so the caller's response still matches what they'd
            // get without the row update.
            let detail = match &err {
                ApiError::Internal(e) => format!("{e:#}"),
                other => other.to_string(),
            };
            let _ = requests
                .update_one(
                    doc! { "_id": dsr_oid, "tenantId": tenant },
                    doc! {
                        "$set": {
                            "status": "failed",
                            "completedAt": completed_at,
                            "error": detail,
                        }
                    },
                )
                .await;
            Err(err)
        }
    }
}

/// Build the export payload for `contact_oid` under `tenant` and write
/// it to `sabchat_dsr_exports`. Returns the new export row's id as a
/// hex string (stored as `resultUrl` on the request row — the name is
/// preserved for forward compatibility with a future SabFiles-backed
/// signed URL).
async fn run_export(
    mongo: &MongoHandle,
    tenant: ObjectId,
    contact_oid: ObjectId,
) -> Result<Option<String>> {
    // ---- Aggregate the three logical sources -------------------------
    let contact = mongo
        .collection::<Document>(CONTACTS_COLL)
        .find_one(doc! { "_id": contact_oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one")))?;

    let conversations = collect_tenant_scoped(
        mongo,
        CONVERSATIONS_COLL,
        doc! { "tenantId": tenant, "contactId": contact_oid },
    )
    .await?;

    let messages = collect_tenant_scoped(
        mongo,
        MESSAGES_COLL,
        doc! { "tenantId": tenant, "contactId": contact_oid },
    )
    .await?;

    // ---- Build + persist the payload ---------------------------------
    let payload_oid = ObjectId::new();
    let generated_at = now_bson();
    let payload = doc! {
        "_id": payload_oid,
        "tenantId": tenant,
        "contactId": contact_oid,
        "generatedAt": generated_at,
        "payload": {
            "contact": contact.map(Bson::Document).unwrap_or(Bson::Null),
            "conversations": Bson::Array(conversations.into_iter().map(Bson::Document).collect()),
            "messages": Bson::Array(messages.into_iter().map(Bson::Document).collect()),
        },
    };

    mongo
        .collection::<Document>(DSR_EXPORTS_COLL)
        .insert_one(payload)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_dsr_exports.insert_one"))
        })?;

    Ok(Some(payload_oid.to_hex()))
}

/// Helper: load every document matching `filter` from `coll` as a
/// `Vec<Document>`. Used by the export aggregation.
async fn collect_tenant_scoped(
    mongo: &MongoHandle,
    coll: &str,
    filter: Document,
) -> Result<Vec<Document>> {
    let cursor = mongo
        .collection::<Document>(coll)
        .find(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context(format!("{coll}.find"))))?;
    cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context(format!("{coll}.collect"))))
}

/// Redact PII for `contact_oid` under `tenant`:
///
/// - On the contact: `emails → ["redacted@example.com"]`,
///   `phones → ["0000000000"]`, `socialIds → []`, `name → "[redacted]"`.
/// - On every related message: `content` → `ContentBlock::System {
///   text: "[redacted]" }` (serialised to BSON so it round-trips to
///   the same shape `sabchat-types` expects on read).
///
/// Returns `Ok(None)` — delete runs do not produce a payload row.
async fn run_delete(
    mongo: &MongoHandle,
    tenant: ObjectId,
    contact_oid: ObjectId,
) -> Result<Option<String>> {
    // ---- Redact the contact ------------------------------------------
    //
    // Emails are scrubbed to a single sentinel address; phones to a
    // single all-zero placeholder. We replace the arrays in their
    // entirety rather than mapping each element so the contact row
    // stays compact after the run.
    let now = now_bson();
    mongo
        .collection::<Document>(CONTACTS_COLL)
        .update_one(
            doc! { "_id": contact_oid, "tenantId": tenant },
            doc! {
                "$set": {
                    "name": "[redacted]",
                    "emails": ["redacted@example.com"],
                    "phones": ["0000000000"],
                    "socialIds": [],
                    "updatedAt": now,
                }
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.update_one")))?;

    // ---- Redact every related message --------------------------------
    //
    // The stored `content` field is a tagged enum — serialise the
    // sentinel block via `serde_json` → `bson::Bson` so it round-trips
    // identically to a normal write from the messages crate.
    let redacted_block = ContentBlock::System {
        text: "[redacted]".to_owned(),
    };
    let block_value = serde_json::to_value(&redacted_block).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("encode redacted ContentBlock"))
    })?;
    let block_bson = Bson::try_from(block_value).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("encode redacted ContentBlock to bson"))
    })?;

    mongo
        .collection::<Document>(MESSAGES_COLL)
        .update_many(
            doc! { "tenantId": tenant, "contactId": contact_oid },
            doc! {
                "$set": {
                    "content": block_bson,
                    "attachments": [],
                }
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("messages.update_many")))?;

    Ok(None)
}

// ===========================================================================
// POST /v1/sabchat/compliance/retention — create_retention_rule
// ===========================================================================

/// `POST /retention` — create a retention rule.
#[instrument(skip_all, fields(tenant = %user.tenant_id, target = %body.target))]
pub async fn create_retention_rule(
    user: AuthUser,
    State(state): State<SabChatComplianceState>,
    Json(body): Json<CreateRetentionRuleBody>,
) -> Result<Json<RetentionRuleResponse>> {
    let tenant = tenant_oid(&user)?;
    // Validate but discard — we store the wire-format target string so
    // a future `target` value can be added without a Mongo migration.
    let _ = validate_retention_target(&body.target)?;
    if body.older_than_days <= 0 {
        return Err(ApiError::Validation("olderThanDays must be > 0".to_owned()));
    }

    let new_oid = ObjectId::new();
    let now = now_bson();
    let doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "target": &body.target,
        "olderThanDays": body.older_than_days,
        "active": body.active,
        "createdAt": now,
        "updatedAt": now,
    };
    state
        .mongo
        .collection::<Document>(RETENTION_RULES_COLL)
        .insert_one(doc.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_retention_rules.insert_one"))
        })?;

    Ok(Json(RetentionRuleResponse {
        rule: document_to_clean_json(doc),
    }))
}

// ===========================================================================
// GET /v1/sabchat/compliance/retention — list_retention_rules
// ===========================================================================

/// `GET /retention` — list every retention rule for the tenant.
/// Returns all rows; tenants typically have one rule per target.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_retention_rules(
    user: AuthUser,
    State(state): State<SabChatComplianceState>,
) -> Result<Json<ListRetentionRulesResponse>> {
    let tenant = tenant_oid(&user)?;
    let opts = FindOptions::builder().sort(doc! { "_id": -1 }).build();
    let cursor = state
        .mongo
        .collection::<Document>(RETENTION_RULES_COLL)
        .find(doc! { "tenantId": tenant })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_retention_rules.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_retention_rules.collect"))
    })?;
    let rules: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListRetentionRulesResponse { rules }))
}

// ===========================================================================
// PATCH /v1/sabchat/compliance/retention/{id} — update_retention_rule
// ===========================================================================

/// `PATCH /retention/{id}` — partial update. Only fields present in the
/// body are `$set`; `updatedAt` is always refreshed.
#[instrument(skip_all, fields(tenant = %user.tenant_id, rule_id = %id))]
pub async fn update_retention_rule(
    user: AuthUser,
    State(state): State<SabChatComplianceState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateRetentionRuleBody>,
) -> Result<Json<RetentionRuleResponse>> {
    let tenant = tenant_oid(&user)?;
    let rule_oid = oid_from_str(&id)?;

    let mut set_doc = doc! { "updatedAt": now_bson() };
    if let Some(target) = body.target.as_deref() {
        let _ = validate_retention_target(target)?;
        set_doc.insert("target", target);
    }
    if let Some(days) = body.older_than_days {
        if days <= 0 {
            return Err(ApiError::Validation("olderThanDays must be > 0".to_owned()));
        }
        set_doc.insert("olderThanDays", days);
    }
    if let Some(active) = body.active {
        set_doc.insert("active", active);
    }

    let coll = state.mongo.collection::<Document>(RETENTION_RULES_COLL);
    let res = coll
        .update_one(
            doc! { "_id": rule_oid, "tenantId": tenant },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_retention_rules.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Retention rule not found.".to_owned()));
    }

    let doc = coll
        .find_one(doc! { "_id": rule_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_retention_rules.find_one(after_update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Retention rule not found.".to_owned()))?;
    Ok(Json(RetentionRuleResponse {
        rule: document_to_clean_json(doc),
    }))
}

// ===========================================================================
// DELETE /v1/sabchat/compliance/retention/{id} — delete_retention_rule
// ===========================================================================

/// `DELETE /retention/{id}` — remove a rule. Tenant-scoped delete; we
/// surface a `404` (rather than a silent `0` count) when the id doesn't
/// match anything the tenant owns.
#[instrument(skip_all, fields(tenant = %user.tenant_id, rule_id = %id))]
pub async fn delete_retention_rule(
    user: AuthUser,
    State(state): State<SabChatComplianceState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&user)?;
    let rule_oid = oid_from_str(&id)?;

    let res = state
        .mongo
        .collection::<Document>(RETENTION_RULES_COLL)
        .delete_one(doc! { "_id": rule_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_retention_rules.delete_one"))
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Retention rule not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /v1/sabchat/compliance/retention/sweep — sweep_retention
// ===========================================================================

/// `POST /retention/sweep` — run every **active** rule for the tenant.
///
/// For each rule, computes a cutoff `Utc::now() - older_than_days` and
/// runs a tenant-scoped `delete_many` against the rule's target
/// collection. The `last_run_at` timestamp on the rule is stamped on
/// every iteration regardless of how many rows the delete moved (so
/// operators can see "the sweep did run, it just had nothing to do").
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn sweep_retention(
    user: AuthUser,
    State(state): State<SabChatComplianceState>,
) -> Result<Json<Vec<SweepEntry>>> {
    let tenant = tenant_oid(&user)?;

    let rules_coll = state.mongo.collection::<Document>(RETENTION_RULES_COLL);
    let cursor = rules_coll
        .find(doc! { "tenantId": tenant, "active": true })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_retention_rules.find(sweep)"))
        })?;
    let rules: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_retention_rules.collect(sweep)"))
    })?;

    let mut out: Vec<SweepEntry> = Vec::with_capacity(rules.len());
    for rule in rules {
        let rule_id = rule
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("rule missing _id")))?;
        let target = rule
            .get_str("target")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("rule missing target")))?;
        let days = rule.get_i64("olderThanDays").or_else(|_| {
            // Mongo doesn't normalise numeric width — accept i32 too,
            // which is what the driver hands back for small ints.
            rule.get_i32("olderThanDays").map(i64::from)
        });
        let days = match days {
            Ok(d) if d > 0 => d,
            _ => continue, // Skip malformed rules rather than aborting the whole sweep.
        };
        let coll_name = match validate_retention_target(target) {
            Ok(name) => name,
            Err(_) => continue, // Unknown target — skip it instead of erroring out the sweep.
        };

        let cutoff = Utc::now() - Duration::days(days);
        let cutoff_bson = bson::DateTime::from_chrono(cutoff);

        // The retention filter is on `createdAt` — every SabChat
        // collection stamps that field on write. Tenant scope is
        // preserved so a misconfigured rule can never spill across
        // tenants.
        let res = state
            .mongo
            .collection::<Document>(coll_name)
            .delete_many(doc! {
                "tenantId": tenant,
                "createdAt": { "$lt": cutoff_bson },
            })
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context(format!("{coll_name}.delete_many(sweep)")),
                )
            })?;

        // Stamp `lastRunAt` regardless of how many rows we moved. Best
        // effort — if this fails the sweep continues; the operator can
        // see the failure in logs.
        let _ = rules_coll
            .update_one(
                doc! { "_id": rule_id },
                doc! { "$set": { "lastRunAt": now_bson() } },
            )
            .await;

        out.push(SweepEntry {
            rule_id: rule_id.to_hex(),
            deleted: res.deleted_count,
        });
    }

    Ok(Json(out))
}

// ===========================================================================
// POST /v1/sabchat/compliance/redact-text — redact_text
// ===========================================================================

/// `POST /redact-text` — apply [`redact_pii`] to a single string. The
/// endpoint is auth-guarded (so we can rate-limit it via the standard
/// JWT middleware) but otherwise has no side effects.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn redact_text(
    user: AuthUser,
    State(_state): State<SabChatComplianceState>,
    Json(body): Json<RedactTextBody>,
) -> Result<Json<RedactTextResponse>> {
    // Touch the tenant so the JWT extractor's failure surfaces as a
    // proper `401` rather than a silently-ignored claim.
    let _ = tenant_oid(&user)?;
    Ok(Json(RedactTextResponse {
        redacted: redact_pii(&body.text),
    }))
}
