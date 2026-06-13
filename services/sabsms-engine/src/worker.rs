use std::sync::Arc;

use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId};

use crate::{
    campaigns, compliance, creds, credits, db, delayed, errors_map,
    events::{self, EngineEvent},
    providers::{self, registry, DltParams, ProviderCreds, SendOptions, SendRequest},
    queue, routing,
    state::AppState,
    types::{Channel, CreditFinaliseRequest, CreditReserveRequest, MessageStatus, ProviderId},
};

/// Maximum send attempts before a retryable failure becomes terminal.
const MAX_ATTEMPTS: i32 = 3;

/// Backoff schedule (seconds) indexed by the attempt count at failure
/// time: 1st retry after 5s, 2nd after 30s, 3rd after 120s.
pub fn backoff_secs(attempts: i32) -> u64 {
    const BACKOFF: [u64; 3] = [5, 30, 120];
    BACKOFF[attempts.clamp(0, 2) as usize]
}

/// Long-running worker loop. Blocks on Redis BRPOP and processes one
/// message at a time per task; concurrency is achieved by spawning N
/// of these.
pub async fn run(state: Arc<AppState>) -> anyhow::Result<()> {
    let n = state.cfg.worker_concurrency.max(1);
    tracing::info!(concurrency = n, "spawning send workers");

    let mut handles = Vec::with_capacity(n);
    for worker_id in 0..n {
        let s = state.clone();
        handles.push(tokio::spawn(async move {
            run_one(worker_id, s).await;
        }));
    }
    for h in handles {
        let _ = h.await;
    }
    Ok(())
}

async fn run_one(worker_id: usize, state: Arc<AppState>) {
    loop {
        let mut redis = state.redis.clone();
        let popped = match queue::dequeue_send(&mut redis, 5.0).await {
            Ok(Some(id)) => id,
            Ok(None) => continue,
            Err(e) => {
                tracing::warn!(worker = worker_id, ?e, "queue dequeue error; backing off 1s");
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                continue;
            }
        };

        if let Err(e) = process_one(&state, &popped).await {
            tracing::error!(worker = worker_id, msg_id = %popped, ?e, "send failed");
        }
    }
}

/// Pick the provider for a message doc. `SABSMS_PROVIDER_MOCK=true`
/// forces the mock adapter regardless of the doc's provider field. A
/// provider is selectable iff the registry has a live adapter for it.
fn select_provider(doc_provider: &str) -> Option<ProviderId> {
    if std::env::var("SABSMS_PROVIDER_MOCK").unwrap_or_default() == "true" {
        return Some(ProviderId::Mock);
    }
    ProviderId::parse(doc_provider).filter(|p| registry::provider(*p).is_some())
}

/// Build per-send options from message-doc fields: resolved MMS URLs
/// (`mediaUrls`) and India DLT params (`dltEntityId` / `dltTemplateId` /
/// `senderId` as the registered header).
fn send_options_from_doc(doc: &mongodb::bson::Document) -> SendOptions {
    let media_urls: Vec<String> = doc
        .get_array("mediaUrls")
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default();

    let entity_id = doc.get_str("dltEntityId").ok().filter(|s| !s.is_empty());
    let template_id = doc.get_str("dltTemplateId").ok().filter(|s| !s.is_empty());
    let header = doc.get_str("senderId").ok().filter(|s| !s.is_empty());
    let dlt = if entity_id.is_some() || template_id.is_some() || header.is_some() {
        Some(DltParams {
            entity_id: entity_id.map(|s| s.to_string()),
            template_id: template_id.map(|s| s.to_string()),
            header: header.map(|s| s.to_string()),
        })
    } else {
        None
    };

    SendOptions {
        media_urls,
        dlt,
        callback_url: None,
        rcs: None,
    }
}

/// V2.11 — outcome of the `rcs_preferred` channel-selection check.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RcsDecision {
    /// Plain send — RCS was not requested (or no payload was attached).
    NotRequested,
    /// Recipient is RCS-capable (fresh cache entry) — attempt RCS.
    SendRcs,
    /// Requested but incapable / unknown / stale — send SMS with the
    /// payload's fallback text and record `rcs_fallback`.
    SmsFallback,
}

/// Pure channel-selection matrix (unit-tested):
///   - not `rcs_preferred` or no payload      → NotRequested
///   - identity says capable AND fresh (<7d)  → SendRcs
///   - incapable / unknown / stale            → SmsFallback
///
/// `capability` is `Some((capable, fresh))` from the identity graph, or
/// `None` when no identity doc / `rcsCapable` entry exists.
pub fn rcs_decision(
    channel_requested: Option<&str>,
    has_payload: bool,
    capability: Option<(bool, bool)>,
) -> RcsDecision {
    if channel_requested != Some("rcs_preferred") || !has_payload {
        return RcsDecision::NotRequested;
    }
    match capability {
        Some((true, true)) => RcsDecision::SendRcs,
        _ => RcsDecision::SmsFallback,
    }
}

/// Direct Mongo read of the identity graph's `rcsCapable` entry — no
/// HTTP hop (the capability ENDPOINT refreshes the cache; the worker
/// only consumes it). Returns `(capable, fresh)`; `None` when the
/// identity (or its `rcsCapable` sub-doc) doesn't exist.
async fn identity_rcs_capability(
    state: &Arc<AppState>,
    workspace_id: &str,
    to_e164: &str,
) -> Option<(bool, bool)> {
    let phone_hash = compliance::hash_phone(to_e164);
    let identities = state
        .mongo
        .collection::<mongodb::bson::Document>(db::COL_IDENTITIES);
    let doc = identities
        .find_one(doc! { "workspaceId": workspace_id, "phoneHash": &phone_hash })
        .await
        .ok()??;
    let rcs = doc.get_document("rcsCapable").ok()?;
    let capable = rcs.get_bool("capable").unwrap_or(false);
    let checked_ms = rcs
        .get_datetime("checkedAt")
        .map(|d| d.timestamp_millis())
        .unwrap_or(0);
    let fresh =
        crate::handlers::rcs::cache_fresh(checked_ms, Utc::now().timestamp_millis());
    Some((capable, fresh))
}

/// V2.8 conservative DLT auto-attach: when an IN-bound doc carries no
/// DLT params but the workspace registry contains EXACTLY ONE active
/// template whose scrub passes for the body, attach it. The sender
/// header is attached only when it is registered (and bound, when the
/// template lists bindings); an unregistered sender header aborts the
/// auto-attach entirely — attaching would turn the kernel's
/// missing-template warning into a header block.
async fn auto_attach_dlt(
    state: &Arc<AppState>,
    workspace_id: &str,
    body: &str,
    sender_header: Option<&str>,
) -> Option<DltParams> {
    let registry = compliance::dlt_store::load_registry(state, workspace_id).await;
    if registry.templates.is_empty() {
        return None;
    }
    let mut matches = registry
        .templates
        .iter()
        .filter(|t| compliance::dlt::scrub(&t.body, body) == compliance::dlt::ScrubResult::Pass);
    let first = matches.next()?;
    if matches.next().is_some() {
        // More than one template matches — ambiguous, stay out.
        return None;
    }
    let header_param = match sender_header {
        Some(h) => match registry.find_header(h) {
            Some(reg)
                if first.header_ids.is_empty()
                    || first.header_ids.iter().any(|id| id == &reg.header_id) =>
            {
                Some(reg.header.clone())
            }
            _ => return None,
        },
        None => None,
    };
    Some(DltParams {
        entity_id: Some(first.pe_id.clone()).filter(|s| !s.is_empty()),
        template_id: Some(first.template_id.clone()),
        header: header_param,
    })
}

/// Suppress a destination after a permanent carrier failure (normalized
/// `suppress = true`: invalid number, landline, recipient STOP). Upsert —
/// duplicates are fine.
async fn suppress_destination(
    state: &Arc<AppState>,
    workspace_id: &str,
    to_e164: &str,
    normalized_code: &str,
) {
    let phone_hash = compliance::hash_phone(to_e164);
    let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
    let suppressions = state
        .mongo
        .collection::<mongodb::bson::Document>(db::COL_SUPPRESSIONS);
    let res = suppressions
        .update_one(
            doc! { "workspaceId": workspace_id, "phoneHash": &phone_hash },
            doc! { "$setOnInsert": {
                "workspaceId": workspace_id,
                "phoneHash": &phone_hash,
                "reason": normalized_code,
                "source": "carrier_block",
                "createdAt": now,
            }},
        )
        .upsert(true)
        .await;
    match res {
        Ok(_) => {}
        Err(e) if db::is_duplicate_key_error(&e) => {}
        Err(e) => {
            tracing::warn!(?e, workspace = %workspace_id, "failed to add carrier suppression");
        }
    }
}

/// Append one failed attempt to the doc's `routingAttempts` audit array.
async fn record_routing_attempt(
    messages: &mongodb::Collection<mongodb::bson::Document>,
    oid: &ObjectId,
    account_label: &str,
    error: &str,
) {
    let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
    let res = messages
        .update_one(
            doc! { "_id": oid },
            doc! { "$push": { "routingAttempts": {
                "accountId": account_label,
                "error": error,
                "at": now,
            }}},
        )
        .await;
    if let Err(e) = res {
        tracing::warn!(?e, "failed to record routing attempt");
    }
}

async fn process_one(state: &Arc<AppState>, msg_id: &str) -> anyhow::Result<()> {
    let oid = ObjectId::parse_str(msg_id)?;
    let messages = state.mongo.collection::<mongodb::bson::Document>(db::COL_MESSAGES);

    let doc = match messages.find_one(doc! { "_id": &oid }).await? {
        Some(d) => d,
        None => return Ok(()),
    };

    let workspace_id = doc.get_str("workspaceId").unwrap_or("").to_string();
    let to = doc.get_str("to").unwrap_or("").to_string();
    let from = doc.get_str("from").unwrap_or("").to_string();
    let body = doc.get_str("body").unwrap_or("").to_string();
    let doc_provider = doc.get_str("provider").unwrap_or("").to_string();
    let doc_channel = doc.get_str("channel").unwrap_or("sms").to_string();
    let provider_account_id = doc
        .get_str("providerAccountId")
        .ok()
        .map(|s| s.to_string());
    let campaign_id = doc.get_str("campaignId").ok().map(|s| s.to_string());
    let attempts = doc
        .get_i32("attempts")
        .ok()
        .or_else(|| doc.get_i64("attempts").ok().map(|n| n as i32))
        .unwrap_or(0);
    let segments = doc
        .get_i32("segmentsCount")
        .ok()
        .map(|n| n as u32)
        .unwrap_or_else(|| providers::estimate_segments(&body));
    let category_str = doc
        .get_str("category")
        .unwrap_or("transactional")
        .to_string();
    let category = serde_json::from_str(&format!("\"{category_str}\""))
        .unwrap_or(crate::types::MessageCategory::Transactional);

    // Provider parse — doc field, with SABSMS_PROVIDER_MOCK override.
    // `None` (unknown / adapterless provider) no longer fails the send
    // immediately: a routing-policy rule can still produce candidates.
    let doc_provider_id = select_provider(&doc_provider);

    // Full compliance kernel BEFORE reserving credits — campaigns will
    // enqueue straight to the queue, so the API-side check is not
    // enough; and because no credit hold exists yet, a Reschedule
    // verdict never needs a release.
    let country = routing::country_of(&to);

    // V2.8 — India DLT auto-attach runs BEFORE the kernel so the scrub
    // validates the attached template.
    let sender_header: Option<String> = doc
        .get_str("senderId")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| doc.get_str("from").ok().filter(|s| !s.is_empty()))
        .map(|s| s.to_string());
    let doc_dlt_template = doc
        .get_str("dltTemplateId")
        .ok()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let doc_dlt_entity = doc
        .get_str("dltEntityId")
        .ok()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let auto_attached: Option<DltParams> =
        if country == "IN" && doc_dlt_template.is_none() && doc_dlt_entity.is_none() {
            auto_attach_dlt(state, &workspace_id, &body, sender_header.as_deref()).await
        } else {
            None
        };
    let effective_dlt_template: Option<String> = doc_dlt_template
        .clone()
        .or_else(|| auto_attached.as_ref().and_then(|p| p.template_id.clone()));

    let ctx = compliance::MessageContext {
        workspace_id: &workspace_id,
        to_e164: &to,
        country: &country,
        category,
        // 10DLC gating keys on the doc's own provider (pre-routing).
        provider: doc_provider_id.unwrap_or(ProviderId::Twilio),
        provider_account_id: provider_account_id.as_deref(),
        opt_out_confirmation: doc.get_bool("optOutConfirmation").unwrap_or(false),
        body: &body,
        sender_header: sender_header.as_deref(),
        dlt_template_id: effective_dlt_template.as_deref(),
    };
    let (verdict, mut trace) = compliance::pre_send_checks(state, &ctx).await?;
    if let Some(params) = auto_attached.as_ref() {
        trace.push(compliance::TraceEntry::new(
            "dlt_auto_attached",
            "allow",
            Some(format!(
                "single matching registry template {} auto-attached",
                params.template_id.as_deref().unwrap_or("?")
            )),
        ));
        // Persist the attachment for audit + DLR reconciliation.
        let mut set = mongodb::bson::Document::new();
        if let Some(tid) = params.template_id.as_deref() {
            set.insert("dltTemplateId", tid);
        }
        if let Some(eid) = params.entity_id.as_deref() {
            set.insert("dltEntityId", eid);
        }
        if !set.is_empty() {
            let _ = messages
                .update_one(doc! { "_id": &oid }, doc! { "$set": set })
                .await;
        }
    }
    // The trace is persisted regardless of the outcome.
    let trace_bson = mongodb::bson::to_bson(&trace)
        .unwrap_or_else(|_| mongodb::bson::Bson::Array(Vec::new()));
    match verdict {
        compliance::Verdict::Allow => {
            let _ = messages
                .update_one(
                    doc! { "_id": &oid },
                    doc! { "$set": { "complianceTrace": trace_bson } },
                )
                .await;
        }
        compliance::Verdict::Block { code, reason } => {
            let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
            let status = if code == "suppressed" {
                MessageStatus::Suppressed
            } else {
                MessageStatus::Rejected
            };
            messages
                .update_one(
                    doc! { "_id": &oid },
                    doc! { "$set": {
                        "status": status.as_str(),
                        "errorCode": &code,
                        "errorMessage": &reason,
                        "complianceTrace": trace_bson,
                        "updatedAt": now,
                    }},
                )
                .await?;
            if let Some(cid) = campaign_id.as_deref() {
                campaigns::bump_stats(state, cid, Some("queued"), "failed").await;
            }
            let mut redis = state.redis.clone();
            events::emit(
                &mut redis,
                &EngineEvent::ComplianceBlocked {
                    workspace_id: workspace_id.clone(),
                    message_id: msg_id.to_string(),
                    code,
                },
            )
            .await;
            return Ok(());
        }
        compliance::Verdict::Reschedule {
            until_epoch_secs,
            code,
        } => {
            let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
            messages
                .update_one(
                    doc! { "_id": &oid },
                    doc! { "$set": {
                        // Status stays queued — the delayed ticker re-enqueues it.
                        "status": MessageStatus::Queued.as_str(),
                        "complianceTrace": trace_bson,
                        "rescheduledUntil": mongodb::bson::DateTime::from_millis(
                            until_epoch_secs.saturating_mul(1000),
                        ),
                        "rescheduleCode": &code,
                        "updatedAt": now,
                    }},
                )
                .await?;
            let mut redis = state.redis.clone();
            if let Err(e) =
                delayed::schedule(&mut redis, msg_id, until_epoch_secs.max(0) as u64).await
            {
                tracing::error!(?e, msg_id, "failed to schedule compliance reschedule");
            }
            events::emit(
                &mut redis,
                &EngineEvent::ComplianceRescheduled {
                    workspace_id: workspace_id.clone(),
                    message_id: msg_id.to_string(),
                    until_epoch: until_epoch_secs,
                },
            )
            .await;
            return Ok(());
        }
    }

    // V2.6 routing — ordered failover candidates: sticky front, then
    // the first matching policy rule's weighted routes, then the doc's
    // own provider/account as the always-present fallback.
    let route_ctx = routing::RoutingContext {
        workspace_id: &workspace_id,
        to_e164: &to,
        country: &country,
        category: &category_str,
        channel: &doc_channel,
        doc_provider: doc_provider_id,
        doc_provider_account_id: provider_account_id.as_deref(),
    };
    let candidates = routing::select(state, &route_ctx).await;
    if candidates.is_empty() {
        // No policy rule matched AND the doc's provider has no adapter.
        fail_and_emit(
            state,
            &messages,
            &oid,
            msg_id,
            &workspace_id,
            campaign_id.as_deref(),
            "unsupported_provider",
            &format!("provider '{doc_provider}' has no engine adapter and no routing rule matched"),
        )
        .await?;
        return Ok(());
    }

    // V2.11 — channel selection for `rcs_preferred` sends: a fresh
    // identity-graph entry saying "capable" attempts RCS; everything
    // else (incapable / unknown / stale) falls back to SMS with the
    // payload's fallback text, recorded as `rcs_fallback`.
    let channel_requested = doc
        .get_str("channelRequested")
        .ok()
        .map(|s| s.to_string());
    let rcs_payload: Option<providers::RcsPayload> = doc
        .get_document("rcs")
        .ok()
        .and_then(|d| mongodb::bson::from_document(d.clone()).ok());
    let rcs_requested =
        channel_requested.as_deref() == Some("rcs_preferred") && rcs_payload.is_some();
    let mut rcs_active = false;
    let mut body_to_send = body.clone();
    if rcs_requested {
        let capability = identity_rcs_capability(state, &workspace_id, &to).await;
        match rcs_decision(channel_requested.as_deref(), true, capability) {
            RcsDecision::SendRcs => rcs_active = true,
            _ => {
                if let Some(p) = &rcs_payload {
                    if !p.fallback_text.is_empty() {
                        body_to_send = p.fallback_text.clone();
                    }
                }
                record_routing_attempt(
                    &messages,
                    &oid,
                    "channel_select",
                    "rcs_fallback: recipient not RCS-capable (or capability unknown/stale)",
                )
                .await;
            }
        }
    }

    // Reserve credits.
    let reserve_req = CreditReserveRequest {
        workspace_id: workspace_id.clone(),
        message_id: msg_id.to_string(),
        segments,
        estimated_cost: 0,
        category,
        destination_country: country.clone(),
        // RCS is priced flat per message; everything else keeps the
        // doc's own channel (sms/mms per-segment rates).
        channel: Some(if rcs_active {
            "rcs".to_string()
        } else {
            doc_channel.clone()
        }),
    };
    let reservation = match credits::reserve(state, &reserve_req).await {
        Ok(r) if r.approved => r,
        Ok(r) => {
            let reason = r.reason.unwrap_or_else(|| "rejected".into());
            fail_and_emit(
                state,
                &messages,
                &oid,
                msg_id,
                &workspace_id,
                campaign_id.as_deref(),
                "credit_rejected",
                &reason,
            )
            .await?;
            return Ok(());
        }
        Err(e) => {
            tracing::warn!(?e, "credit reserve failed; marking message failed");
            fail_and_emit(
                state,
                &messages,
                &oid,
                msg_id,
                &workspace_id,
                campaign_id.as_deref(),
                "credit_callback_error",
                &e.to_string(),
            )
            .await?;
            return Ok(());
        }
    };
    let release = |token: String| CreditFinaliseRequest {
        workspace_id: workspace_id.clone(),
        message_id: msg_id.to_string(),
        reservation_token: token,
        actual_cost: 0,
        charge: false,
    };

    // Base sender — from on the doc, else the registered sender id
    // (alphanumeric routes), else env default. Candidates may override
    // it (sticky `from` / pool number).
    let doc_sender_id = doc
        .get_str("senderId")
        .ok()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let env_default_from = std::env::var("SABSMS_TWILIO_DEFAULT_FROM").unwrap_or_default();
    let base_from: Option<String> = if !from.is_empty() {
        Some(from)
    } else if let Some(sid) = doc_sender_id {
        Some(sid)
    } else if !env_default_from.is_empty() {
        Some(env_default_from)
    } else {
        None
    };

    // -----------------------------------------------------------------
    // Candidate loop. Failover happens ONLY on synchronous provider
    // rejection (Rejected / InvalidCredentials / BadRequest / Decode) —
    // NEVER on Network/Throttled: a timed-out request may still have
    // been accepted by the provider, so switching accounts there risks
    // a double send. Those keep the pre-V2.6 delayed-retry path.
    // -----------------------------------------------------------------
    let mut redis = state.redis.clone();
    let mut last_code = "all_routes_failed".to_string();
    let mut last_msg = "no route candidate could send".to_string();
    let mut last_normalized: Option<&'static str> = None;
    // (account label, reason) of the candidate we advanced past —
    // drives the RouteFailover event on the next attempt.
    let mut advance_from: Option<(String, String)> = None;

    // Index loop (not `for`) so a V2.11 RCS adapter rejection can retry
    // the SAME candidate as plain SMS without burning it.
    let mut cand_idx = 0usize;
    while cand_idx < candidates.len() {
        let cand = &candidates[cand_idx];
        let acct_label = cand
            .provider_account_id
            .clone()
            .unwrap_or_else(|| "default".to_string());

        // Circuit gate — open circuits are skipped; half-open ones let
        // one probe through per 10s.
        if let Some(acct) = cand.provider_account_id.as_deref() {
            match routing::circuit::gate(&mut redis, acct, &country).await {
                routing::circuit::Gate::Skip => {
                    advance_from = Some((acct_label, "circuit_open".to_string()));
                    last_code = "circuit_open".to_string();
                    last_msg = format!("account {acct} circuit open for {country}");
                    last_normalized = None;
                    cand_idx += 1;
                    continue;
                }
                routing::circuit::Gate::Allow | routing::circuit::Gate::Probe => {}
            }
        }

        let Some(adapter) = registry::provider(cand.provider) else {
            last_code = "unsupported_provider".to_string();
            last_msg = format!("provider '{}' has no engine adapter", cand.provider.as_str());
            last_normalized = None;
            advance_from = Some((acct_label, last_code.clone()));
            cand_idx += 1;
            continue;
        };

        // Provider creds — resolved for THIS candidate's account. The
        // mock adapter ignores creds entirely, so it skips resolution.
        let resolved_creds = if cand.provider == ProviderId::Mock {
            None
        } else {
            match creds::resolve(
                state,
                &workspace_id,
                cand.provider,
                cand.provider_account_id.as_deref(),
            )
            .await
            {
                Ok(r) => Some(r),
                Err(e) => {
                    tracing::warn!(?e, workspace = %workspace_id, account = %acct_label, "credential resolution failed");
                    record_routing_attempt(
                        &messages,
                        &oid,
                        &acct_label,
                        &format!("no_credentials: {e}"),
                    )
                    .await;
                    last_code = "no_credentials".to_string();
                    last_msg = e.to_string();
                    last_normalized = None;
                    advance_from = Some((acct_label, last_code.clone()));
                    cand_idx += 1;
                    continue;
                }
            }
        };
        let empty_creds = ProviderCreds {
            blob: serde_json::json!({}),
        };
        let provider_creds = resolved_creds
            .as_ref()
            .map(|r| &r.creds)
            .unwrap_or(&empty_creds);

        // Sender for this candidate.
        let resolved_from = match cand.from_override.clone().or_else(|| base_from.clone()) {
            Some(f) if !f.is_empty() => f,
            _ => {
                record_routing_attempt(&messages, &oid, &acct_label, "no_sender").await;
                last_code = "no_sender".to_string();
                last_msg = "no sender configured".to_string();
                last_normalized = None;
                advance_from = Some((acct_label, last_code.clone()));
                cand_idx += 1;
                continue;
            }
        };

        // We are committing to an attempt on this candidate — if a
        // previous candidate was skipped or rejected, that's a failover.
        if let Some((from_account, reason)) = advance_from.take() {
            events::emit(
                &mut redis,
                &EngineEvent::RouteFailover {
                    workspace_id: workspace_id.clone(),
                    message_id: msg_id.to_string(),
                    from_account,
                    to_account: acct_label.clone(),
                    reason,
                },
            )
            .await;
        }

        let send_req = SendRequest {
            from: &resolved_from,
            to: &to,
            body: &body_to_send,
            channel: if rcs_active { Channel::Rcs } else { Channel::Sms },
            category,
        };
        let mut send_opts = send_options_from_doc(&doc);
        // V2.11 — attach the RCS payload only while the RCS attempt is
        // live; an SMS fallback clears it.
        if rcs_active {
            send_opts.rcs = rcs_payload.clone();
        }
        // V2.8 — thread the auto-attached DLT params into the adapter
        // (the doc's own header wins when both carry one).
        if let Some(params) = auto_attached.as_ref() {
            let header = send_opts
                .dlt
                .as_ref()
                .and_then(|d| d.header.clone())
                .or_else(|| params.header.clone());
            send_opts.dlt = Some(DltParams {
                entity_id: params.entity_id.clone(),
                template_id: params.template_id.clone(),
                header,
            });
        }
        // Per-message DLR callback: when the engine's public URL is known and
        // the account carries a webhook secret, point the provider straight at
        // the generic per-account DLR route (no provider-console config needed).
        if send_opts.callback_url.is_none() {
            if let (Ok(base), Some(rc)) = (
                std::env::var("SABSMS_ENGINE_PUBLIC_URL"),
                resolved_creds.as_ref(),
            ) {
                if let (Some(account_id), Some(secret)) =
                    (rc.account_id.as_deref(), rc.webhook_secret.as_deref())
                {
                    if !base.trim().is_empty() {
                        send_opts.callback_url = Some(format!(
                            "{}/webhook/{}/{}/dlr?secret={}",
                            base.trim_end_matches('/'),
                            cand.provider.as_str(),
                            account_id,
                            secret
                        ));
                    }
                }
            }
        }

        let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
        match adapter.send(send_req, &send_opts, provider_creds).await {
            Ok(r) => {
                // The account that actually carried the message — the
                // candidate's explicit id, or whatever default account
                // creds resolution landed on.
                let sent_account = resolved_creds
                    .as_ref()
                    .and_then(|rc| rc.account_id.clone())
                    .or_else(|| cand.provider_account_id.clone());

                let mut set = doc! {
                    "status": r.status.as_str(),
                    "provider": cand.provider.as_str(),
                    "providerMessageId": r.provider_message_id,
                    "from": &resolved_from,
                    "sentAt": now,
                    "updatedAt": now,
                    "cost": r.cost.unwrap_or(0),
                    "segmentsCount": r.segments as i32,
                    // V2.11 — channel that actually carried the message.
                    "channelUsed": if rcs_active { "rcs" } else { "sms" },
                };
                if rcs_requested {
                    set.insert("rcsFallback", !rcs_active);
                }
                if let Some(account_id) = sent_account.clone() {
                    set.insert("providerAccountId", account_id);
                }
                let _ = messages
                    .update_one(doc! { "_id": &oid }, doc! { "$set": set })
                    .await?;
                // Campaign stats: queued → sent (delivered/failed move again
                // on the DLR path in `handlers/webhook.rs`).
                if let Some(cid) = campaign_id.as_deref() {
                    campaigns::bump_stats(state, cid, Some("queued"), "sent").await;
                }
                let _ = credits::finalise(
                    state,
                    &CreditFinaliseRequest {
                        workspace_id: workspace_id.clone(),
                        message_id: msg_id.to_string(),
                        reservation_token: reservation.reservation_token.clone(),
                        actual_cost: r.cost.unwrap_or(0),
                        charge: true,
                    },
                )
                .await;
                if let Some(acct) = sent_account.as_deref() {
                    routing::note_send_success(&mut redis, acct, &country).await;
                    // Sticky pin (30d) — next sends to this contact keep
                    // the same account + sender.
                    if cand.sticky_sender {
                        routing::write_sticky(
                            &mut redis,
                            &workspace_id,
                            &to,
                            acct,
                            &resolved_from,
                        )
                        .await;
                    }
                }
                events::emit(
                    &mut redis,
                    &EngineEvent::MessageSent {
                        workspace_id: workspace_id.clone(),
                        message_id: msg_id.to_string(),
                        provider: cand.provider.as_str().to_string(),
                        segments: r.segments,
                        rcs_fallback: rcs_requested && !rcs_active,
                    },
                )
                .await;
                return Ok(());
            }
            Err(e) if e.is_retryable() => {
                // Throttled / Network — transport-ambiguous. Do NOT fail
                // over to another account here (the provider may have
                // accepted the timed-out request → double-send risk);
                // bump attempts and schedule a delayed retry of the
                // whole message instead.
                if attempts < MAX_ATTEMPTS {
                    messages
                        .update_one(
                            doc! { "_id": &oid },
                            doc! { "$set": {
                                "attempts": attempts + 1,
                                "lastError": e.to_string(),
                                "updatedAt": now,
                            }},
                        )
                        .await?;
                    let run_at = Utc::now().timestamp().max(0) as u64 + backoff_secs(attempts);
                    if let Err(sched_err) = delayed::schedule(&mut redis, msg_id, run_at).await {
                        tracing::error!(?sched_err, msg_id, "failed to schedule retry");
                    }
                } else {
                    fail_and_emit(
                        state,
                        &messages,
                        &oid,
                        msg_id,
                        &workspace_id,
                        campaign_id.as_deref(),
                        "max_retries",
                        &e.to_string(),
                    )
                    .await?;
                }
                let _ = credits::finalise(state, &release(reservation.reservation_token.clone())).await;
                return Ok(());
            }
            Err(e) => {
                // V2.11 — an adapter rejecting the RCS attempt (e.g.
                // "rcs_not_supported", or an RBM-side error) is NOT a
                // route failure: retry the SAME candidate as plain SMS
                // with the payload's fallback text.
                if rcs_active {
                    record_routing_attempt(
                        &messages,
                        &oid,
                        &acct_label,
                        &format!("rcs_fallback: {e}"),
                    )
                    .await;
                    rcs_active = false;
                    if let Some(p) = &rcs_payload {
                        if !p.fallback_text.is_empty() {
                            body_to_send = p.fallback_text.clone();
                        }
                    }
                    continue; // same cand_idx — SMS retry
                }

                // Synchronous rejection — safe to fail over.
                let raw_code = e.provider_code().map(|s| s.to_string());
                let normalized = raw_code
                    .as_deref()
                    .map(|raw| errors_map::normalize_error(cand.provider, raw));

                let failed_account = resolved_creds
                    .as_ref()
                    .and_then(|rc| rc.account_id.clone())
                    .or_else(|| cand.provider_account_id.clone());
                if let Some(acct) = failed_account.as_deref() {
                    routing::note_failure(&mut redis, acct, &country).await;
                }
                record_routing_attempt(&messages, &oid, &acct_label, &e.to_string()).await;

                let code = raw_code
                    .clone()
                    .unwrap_or_else(|| "provider_error".to_string());

                // Permanent destination failures (invalid number,
                // landline, recipient STOP) can't be rescued by another
                // provider — terminate instead of burning candidates.
                if let Some(nm) = normalized {
                    if nm.suppress {
                        fail_and_emit_normalized(
                            state,
                            &messages,
                            &oid,
                            msg_id,
                            &workspace_id,
                            campaign_id.as_deref(),
                            &code,
                            &e.to_string(),
                            Some(nm.code),
                        )
                        .await?;
                        suppress_destination(state, &workspace_id, &to, nm.code).await;
                        let _ = credits::finalise(state, &release(reservation.reservation_token.clone()))
                            .await;
                        return Ok(());
                    }
                }

                last_code = code;
                last_msg = e.to_string();
                last_normalized = normalized.map(|nm| nm.code);
                advance_from = Some((
                    acct_label,
                    last_normalized
                        .map(|c| c.to_string())
                        .unwrap_or_else(|| last_code.clone()),
                ));
                cand_idx += 1;
                continue;
            }
        }
    }

    // Every candidate was skipped or rejected.
    let detail = format!("[{last_code}] {last_msg}");
    fail_and_emit_normalized(
        state,
        &messages,
        &oid,
        msg_id,
        &workspace_id,
        campaign_id.as_deref(),
        "all_routes_failed",
        &detail,
        last_normalized,
    )
    .await?;
    let _ = credits::finalise(state, &release(reservation.reservation_token)).await;
    Ok(())
}

/// Terminal failure: mark the doc failed, emit `MessageFailed` to the
/// event stream (best-effort), and — for campaign messages — move the
/// recipient from the `queued` to the `failed` stat bucket.
#[allow(clippy::too_many_arguments)]
async fn fail_and_emit(
    state: &Arc<AppState>,
    messages: &mongodb::Collection<mongodb::bson::Document>,
    oid: &ObjectId,
    msg_id: &str,
    workspace_id: &str,
    campaign_id: Option<&str>,
    code: &str,
    message: &str,
) -> anyhow::Result<()> {
    fail_and_emit_normalized(
        state,
        messages,
        oid,
        msg_id,
        workspace_id,
        campaign_id,
        code,
        message,
        None,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
async fn fail_and_emit_normalized(
    state: &Arc<AppState>,
    messages: &mongodb::Collection<mongodb::bson::Document>,
    oid: &ObjectId,
    msg_id: &str,
    workspace_id: &str,
    campaign_id: Option<&str>,
    code: &str,
    message: &str,
    normalized_code: Option<&str>,
) -> anyhow::Result<()> {
    mark_failed(messages, oid, code, message, normalized_code).await?;
    if let Some(cid) = campaign_id {
        campaigns::bump_stats(state, cid, Some("queued"), "failed").await;
    }
    let mut redis = state.redis.clone();
    events::emit(
        &mut redis,
        &EngineEvent::MessageFailed {
            workspace_id: workspace_id.to_string(),
            message_id: msg_id.to_string(),
            error_code: normalized_code.unwrap_or(code).to_string(),
        },
    )
    .await;
    Ok(())
}

async fn mark_failed(
    messages: &mongodb::Collection<mongodb::bson::Document>,
    oid: &ObjectId,
    code: &str,
    message: &str,
    normalized_code: Option<&str>,
) -> anyhow::Result<()> {
    let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
    let mut set = doc! {
        "status": MessageStatus::Failed.as_str(),
        "errorCode": code,
        "errorMessage": message,
        "failedAt": now,
        "updatedAt": now,
    };
    if let Some(nc) = normalized_code {
        set.insert("normalizedCode", nc);
    }
    messages
        .update_one(doc! { "_id": oid }, doc! { "$set": set })
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_schedule_matches_spec() {
        assert_eq!(backoff_secs(0), 5);
        assert_eq!(backoff_secs(1), 30);
        assert_eq!(backoff_secs(2), 120);
    }

    #[test]
    fn backoff_clamps_out_of_range_attempts() {
        assert_eq!(backoff_secs(-1), 5);
        assert_eq!(backoff_secs(3), 120);
        assert_eq!(backoff_secs(100), 120);
    }

    #[test]
    fn select_provider_uses_registry() {
        // All registry-backed providers are selectable...
        assert_eq!(select_provider("twilio"), Some(ProviderId::Twilio));
        assert_eq!(select_provider("telnyx"), Some(ProviderId::Telnyx));
        assert_eq!(select_provider("msg91"), Some(ProviderId::Msg91));
        assert_eq!(select_provider("gupshup"), Some(ProviderId::Gupshup));
        // ...providers without an adapter are not.
        assert_eq!(select_provider("vonage"), None);
        assert_eq!(select_provider("nonsense"), None);
    }

    #[test]
    fn send_options_built_from_doc_fields() {
        let doc = doc! {
            "mediaUrls": ["https://r2.example.com/a.jpg", "https://r2.example.com/b.png"],
            "dltEntityId": "PE1",
            "dltTemplateId": "TE1",
            "senderId": "SABNDE",
        };
        let opts = send_options_from_doc(&doc);
        assert_eq!(opts.media_urls.len(), 2);
        let dlt = opts.dlt.expect("dlt params");
        assert_eq!(dlt.entity_id.as_deref(), Some("PE1"));
        assert_eq!(dlt.template_id.as_deref(), Some("TE1"));
        assert_eq!(dlt.header.as_deref(), Some("SABNDE"));
    }

    #[test]
    fn send_options_default_when_doc_has_no_fields() {
        let doc = doc! { "to": "+15551234567" };
        let opts = send_options_from_doc(&doc);
        assert!(opts.media_urls.is_empty());
        assert!(opts.dlt.is_none());
        assert!(opts.callback_url.is_none());
        assert!(opts.rcs.is_none());
    }

    // ── V2.11 — channel-selection matrix ────────────────────────────────

    #[test]
    fn rcs_decision_capable_and_fresh_sends_rcs() {
        assert_eq!(
            rcs_decision(Some("rcs_preferred"), true, Some((true, true))),
            RcsDecision::SendRcs
        );
    }

    #[test]
    fn rcs_decision_incapable_falls_back() {
        assert_eq!(
            rcs_decision(Some("rcs_preferred"), true, Some((false, true))),
            RcsDecision::SmsFallback
        );
    }

    #[test]
    fn rcs_decision_unknown_identity_falls_back() {
        assert_eq!(
            rcs_decision(Some("rcs_preferred"), true, None),
            RcsDecision::SmsFallback
        );
    }

    #[test]
    fn rcs_decision_stale_capability_falls_back() {
        // Even a "capable" entry falls back when stale (>7d) — the
        // capability endpoint is the refresh path.
        assert_eq!(
            rcs_decision(Some("rcs_preferred"), true, Some((true, false))),
            RcsDecision::SmsFallback
        );
        assert_eq!(
            rcs_decision(Some("rcs_preferred"), true, Some((false, false))),
            RcsDecision::SmsFallback
        );
    }

    #[test]
    fn rcs_decision_not_requested_is_plain_send() {
        assert_eq!(
            rcs_decision(None, true, Some((true, true))),
            RcsDecision::NotRequested
        );
        assert_eq!(
            rcs_decision(Some("sms"), true, Some((true, true))),
            RcsDecision::NotRequested
        );
        // Requested but without a payload → nothing to send richly.
        assert_eq!(
            rcs_decision(Some("rcs_preferred"), false, Some((true, true))),
            RcsDecision::NotRequested
        );
    }

    #[test]
    fn rcs_payload_deserializes_from_message_doc_bson() {
        // The worker reads the payload back from the Mongo doc exactly
        // as `handlers/send.rs` wrote it (camelCase bson).
        let doc = doc! {
            "rcs": {
                "card": { "title": "T", "description": "D", "mediaUrl": "https://x/i.jpg" },
                "suggestions": [
                    { "kind": "reply", "text": "Yes", "postbackData": "yes" },
                ],
                "fallbackText": "plain fallback",
            }
        };
        let parsed: providers::RcsPayload = mongodb::bson::from_document(
            doc.get_document("rcs").unwrap().clone(),
        )
        .unwrap();
        assert_eq!(parsed.fallback_text, "plain fallback");
        assert_eq!(parsed.card.as_ref().unwrap().title, "T");
        assert_eq!(parsed.suggestions.len(), 1);
    }
}
