use std::sync::Arc;

use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId};

use crate::{
    credits, db,
    providers::{self, twilio::TwilioProvider, ProviderCreds, SendRequest, SmsProvider},
    queue,
    state::AppState,
    types::{Channel, CreditFinaliseRequest, CreditReserveRequest, MessageStatus, ProviderId},
};

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
    let twilio = TwilioProvider::new(state.http.clone());
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

        if let Err(e) = process_one(&state, &twilio, &popped).await {
            tracing::error!(worker = worker_id, msg_id = %popped, ?e, "send failed");
        }
    }
}

async fn process_one(
    state: &Arc<AppState>,
    twilio: &TwilioProvider,
    msg_id: &str,
) -> anyhow::Result<()> {
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
    let segments = doc
        .get_i32("segmentsCount")
        .ok()
        .map(|n| n as u32)
        .unwrap_or_else(|| providers::estimate_segments(&body));
    let category = serde_json::from_str(
        &format!("\"{}\"", doc.get_str("category").unwrap_or("transactional")),
    )
    .unwrap_or(crate::types::MessageCategory::Transactional);

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

    // Sender resolution — phase 1: from env if missing on the doc.
    let resolved_from = if from.is_empty() {
        std::env::var("SABSMS_TWILIO_DEFAULT_FROM").unwrap_or_default()
    } else {
        from
    };
    if resolved_from.is_empty() {
        mark_failed(&messages, &oid, "no_sender", "no sender configured").await?;
        let _ = credits::finalise(
            state,
            &CreditFinaliseRequest {
                workspace_id: workspace_id.clone(),
                message_id: msg_id.to_string(),
                reservation_token: reservation.reservation_token,
                actual_cost: 0,
                charge: false,
            },
        )
        .await;
        return Ok(());
    }

    // Provider creds — phase 1: single Twilio account from env.
    let creds = ProviderCreds {
        blob: serde_json::json!({
            "accountSid": std::env::var("SABSMS_TWILIO_ACCOUNT_SID").unwrap_or_default(),
            "authToken":  std::env::var("SABSMS_TWILIO_AUTH_TOKEN").unwrap_or_default(),
        }),
    };

    let send_req = SendRequest {
        from: &resolved_from,
        to: &to,
        body: &body,
        channel: Channel::Sms,
        category,
    };

    let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
    let send_result = twilio.send(send_req, &creds).await;
    match send_result {
        Ok(r) => {
            let _ = messages
                .update_one(
                    doc! { "_id": &oid },
                    doc! { "$set": {
                        "status": r.status.as_str(),
                        "provider": ProviderId::Twilio.as_str(),
                        "providerMessageId": r.provider_message_id,
                        "sentAt": now,
                        "updatedAt": now,
                        "cost": r.cost.unwrap_or(0),
                        "segmentsCount": r.segments as i32,
                    }},
                )
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
        Err(e) => {
            mark_failed(&messages, &oid, "provider_error", &e.to_string()).await?;
            let _ = credits::finalise(
                state,
                &CreditFinaliseRequest {
                    workspace_id,
                    message_id: msg_id.to_string(),
                    reservation_token: reservation.reservation_token,
                    actual_cost: 0,
                    charge: false,
                },
            )
            .await;
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
