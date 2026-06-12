use std::sync::Arc;

use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId};

use crate::{
    compliance, creds, credits, db, delayed,
    providers::{self, ProviderCreds, SendRequest},
    queue,
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
/// forces the mock adapter regardless of the doc's provider field.
fn select_provider(doc_provider: &str) -> Option<ProviderId> {
    if std::env::var("SABSMS_PROVIDER_MOCK").unwrap_or_default() == "true" {
        return Some(ProviderId::Mock);
    }
    match ProviderId::parse(doc_provider) {
        Some(p @ (ProviderId::Twilio | ProviderId::Mock)) => Some(p),
        _ => None,
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
    let provider_account_id = doc
        .get_str("providerAccountId")
        .ok()
        .map(|s| s.to_string());
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
    let category = serde_json::from_str(
        &format!("\"{}\"", doc.get_str("category").unwrap_or("transactional")),
    )
    .unwrap_or(crate::types::MessageCategory::Transactional);

    // Provider selection — doc field, with SABSMS_PROVIDER_MOCK override.
    let provider = match select_provider(&doc_provider) {
        Some(p) => p,
        None => {
            mark_failed(
                &messages,
                &oid,
                "unsupported_provider",
                &format!("provider '{doc_provider}' has no engine adapter"),
            )
            .await?;
            return Ok(());
        }
    };

    // Compliance re-check BEFORE reserving credits — campaigns will
    // enqueue straight to the queue, so the API-side check is not enough.
    match compliance::pre_send_checks(state, &workspace_id, &to).await? {
        compliance::Verdict::Allow => {}
        compliance::Verdict::Block { code, reason } => {
            let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
            messages
                .update_one(
                    doc! { "_id": &oid },
                    doc! { "$set": {
                        "status": MessageStatus::Suppressed.as_str(),
                        "errorCode": &code,
                        "errorMessage": &reason,
                        "updatedAt": now,
                    }},
                )
                .await?;
            return Ok(());
        }
    }

    // Reserve credits.
    let reserve_req = CreditReserveRequest {
        workspace_id: workspace_id.clone(),
        message_id: msg_id.to_string(),
        segments,
        estimated_cost: 0,
        category,
        destination_country: country_of(&to),
    };
    let reservation = match credits::reserve(state, &reserve_req).await {
        Ok(r) if r.approved => r,
        Ok(r) => {
            let reason = r.reason.unwrap_or_else(|| "rejected".into());
            mark_failed(&messages, &oid, "credit_rejected", &reason).await?;
            return Ok(());
        }
        Err(e) => {
            tracing::warn!(?e, "credit reserve failed; marking message failed");
            mark_failed(&messages, &oid, "credit_callback_error", &e.to_string()).await?;
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

    // Sender resolution — from on the doc, else env default.
    let resolved_from = if from.is_empty() {
        std::env::var("SABSMS_TWILIO_DEFAULT_FROM").unwrap_or_default()
    } else {
        from
    };
    if resolved_from.is_empty() {
        mark_failed(&messages, &oid, "no_sender", "no sender configured").await?;
        let _ = credits::finalise(state, &release(reservation.reservation_token)).await;
        return Ok(());
    }

    // Provider creds — resolved per workspace/account. The mock adapter
    // ignores creds entirely, so it skips resolution.
    let resolved_creds = if provider == ProviderId::Mock {
        None
    } else {
        match creds::resolve(state, &workspace_id, provider, provider_account_id.as_deref()).await
        {
            Ok(r) => Some(r),
            Err(e) => {
                tracing::warn!(?e, workspace = %workspace_id, "credential resolution failed");
                mark_failed(&messages, &oid, "no_credentials", &e.to_string()).await?;
                let _ = credits::finalise(state, &release(reservation.reservation_token)).await;
                return Ok(());
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

    let adapter = match providers::adapter_for(provider, state.http.clone()) {
        Some(a) => a,
        None => {
            mark_failed(&messages, &oid, "unsupported_provider", provider.as_str()).await?;
            let _ = credits::finalise(state, &release(reservation.reservation_token)).await;
            return Ok(());
        }
    };

    let send_req = SendRequest {
        from: &resolved_from,
        to: &to,
        body: &body,
        channel: Channel::Sms,
        category,
    };

    let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
    match adapter.send(send_req, provider_creds).await {
        Ok(r) => {
            let mut set = doc! {
                "status": r.status.as_str(),
                "provider": provider.as_str(),
                "providerMessageId": r.provider_message_id,
                "sentAt": now,
                "updatedAt": now,
                "cost": r.cost.unwrap_or(0),
                "segmentsCount": r.segments as i32,
            };
            if let Some(account_id) = resolved_creds.as_ref().and_then(|r| r.account_id.clone()) {
                set.insert("providerAccountId", account_id);
            }
            let _ = messages
                .update_one(doc! { "_id": &oid }, doc! { "$set": set })
                .await?;
            let _ = credits::finalise(
                state,
                &CreditFinaliseRequest {
                    workspace_id,
                    message_id: msg_id.to_string(),
                    reservation_token: reservation.reservation_token,
                    actual_cost: r.cost.unwrap_or(0),
                    charge: true,
                },
            )
            .await;
        }
        Err(e) if e.is_retryable() && attempts < MAX_ATTEMPTS => {
            // Transient failure → bump attempts, keep status queued, and
            // schedule a delayed retry.
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
            let mut redis = state.redis.clone();
            if let Err(sched_err) = delayed::schedule(&mut redis, msg_id, run_at).await {
                tracing::error!(?sched_err, msg_id, "failed to schedule retry");
            }
            let _ = credits::finalise(state, &release(reservation.reservation_token)).await;
        }
        Err(e) => {
            let code = if e.is_retryable() {
                "max_retries"
            } else {
                "provider_error"
            };
            mark_failed(&messages, &oid, code, &e.to_string()).await?;
            let _ = credits::finalise(state, &release(reservation.reservation_token)).await;
        }
    }
    Ok(())
}

async fn mark_failed(
    messages: &mongodb::Collection<mongodb::bson::Document>,
    oid: &ObjectId,
    code: &str,
    message: &str,
) -> anyhow::Result<()> {
    let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
    messages
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": {
                "status": MessageStatus::Failed.as_str(),
                "errorCode": code,
                "errorMessage": message,
                "failedAt": now,
                "updatedAt": now,
            }},
        )
        .await?;
    Ok(())
}

/// Best-effort ISO-3166 country guess from an E.164 number. Phase 1
/// uses libphonenumber for the real lookup; here we return a stub when
/// the parse fails so we don't block the send.
fn country_of(e164: &str) -> String {
    use phonenumber::country;
    match phonenumber::parse(Some(country::Id::US), e164) {
        Ok(p) => p
            .country()
            .id()
            .map(|c| format!("{:?}", c))
            .unwrap_or_else(|| "UNK".into()),
        Err(_) => "UNK".into(),
    }
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
}
