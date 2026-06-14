//! The Stasis event loop: connect to the ARI websocket, receive events, and
//! drive inbound calls through their routed application.
//!
//! P1 scope: answer the call, resolve the routed application, and either bridge
//! a `dial` application to its target or play the application/default greeting,
//! then write a CDR. The full programmable-verb runtime (gather, record,
//! conference, multi-step IVR, live duration tracking) lands in P3/P4.

use std::time::Duration;

use futures_util::StreamExt;
use serde_json::Value;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

use crate::ari::AriChannel;
use crate::cdr::{self, CdrInput};
use crate::flow::{self, CallContext};
use crate::routing;
use crate::state::AppState;
use crate::verbs::{self, Verb};

/// Run the Stasis loop forever, reconnecting on disconnect.
pub async fn run(state: AppState) {
    loop {
        if let Err(e) = run_once(&state).await {
            tracing::warn!(error = %e, "stasis loop ended; reconnecting in 3s");
        }
        tokio::time::sleep(Duration::from_secs(3)).await;
    }
}

async fn run_once(state: &AppState) -> anyhow::Result<()> {
    let cfg = &state.cfg;
    let url = format!(
        "{}/ari/events?api_key={}:{}&app={}&subscribeAll=true",
        cfg.ari_ws_url.trim_end_matches('/'),
        urlencoding::encode(&cfg.ari_username),
        urlencoding::encode(&cfg.ari_password),
        urlencoding::encode(&cfg.ari_app),
    );
    tracing::info!(app = %cfg.ari_app, "connecting to ARI events websocket");
    let (mut ws, _resp) = connect_async(url.as_str()).await?;
    tracing::info!("ARI websocket connected");

    while let Some(msg) = ws.next().await {
        match msg? {
            Message::Text(txt) => {
                if let Ok(ev) = serde_json::from_str::<Value>(txt.as_str()) {
                    let st = state.clone();
                    tokio::spawn(async move {
                        dispatch(&st, ev).await;
                    });
                }
            }
            Message::Ping(_) | Message::Pong(_) => {}
            Message::Close(_) => {
                tracing::info!("ARI websocket closed by server");
                break;
            }
            _ => {}
        }
    }
    Ok(())
}

async fn dispatch(state: &AppState, ev: Value) {
    let kind = ev.get("type").and_then(Value::as_str).unwrap_or("");
    match kind {
        "StasisStart" => {
            if let Some(ch) = ev
                .get("channel")
                .and_then(|c| serde_json::from_value::<AriChannel>(c.clone()).ok())
            {
                if let Err(e) = handle_inbound(state, ch).await {
                    tracing::warn!(error = %e, "inbound handling failed");
                }
            }
        }
        "ChannelDtmfReceived" => {
            let channel_id = ev
                .get("channel")
                .and_then(|c| c.get("id"))
                .and_then(Value::as_str);
            let digit = ev.get("digit").and_then(Value::as_str);
            if let (Some(cid), Some(d)) = (channel_id, digit) {
                state.push_dtmf(cid, d);
            }
        }
        "StasisEnd" => {
            // Full lifecycle/duration tracking lands in P4.
        }
        _ => {}
    }
}

async fn handle_inbound(state: &AppState, ch: AriChannel) -> anyhow::Result<()> {
    let dialed = ch.dialed_exten();
    let caller = ch.caller_number();
    tracing::info!(channel = %ch.id, %dialed, %caller, "StasisStart (inbound)");

    let decision = routing::resolve(&state.db, &dialed).await;

    let Some(decision) = decision else {
        tracing::info!(%dialed, "no route for number; hanging up");
        let _ = state.ari.hangup(&ch.id).await;
        return Ok(());
    };

    state.ari.answer(&ch.id).await?;

    // Build the verb flow for this call: webhook (programmable) → in-app dial →
    // default greeting.
    let flow: Vec<Verb> = match decision.app.as_ref() {
        Some(app) => {
            let webhook = app.webhook_url.as_deref().filter(|s| !s.is_empty());
            if let Some(url) = webhook {
                let ctx = CallContext {
                    call_id: ch.id.clone(),
                    from: caller.clone(),
                    to: dialed.clone(),
                    direction: "inbound",
                };
                flow::fetch_webhook_flow(state, url, &ctx).await
            } else if app.app_type == "dial" {
                match app.dial_target.as_deref().filter(|s| !s.is_empty()) {
                    Some(target) => vec![Verb::Dial { target: target.to_owned() }],
                    None => flow::default_flow(),
                }
            } else {
                flow::default_flow()
            }
        }
        None => flow::default_flow(),
    };

    let result = verbs::execute_flow(state, &ch.id, &flow).await;
    tracing::info!(channel = %ch.id, digits = %result.digits, "flow complete");

    cdr::write(
        &state.db,
        CdrInput {
            tenant: decision.tenant,
            from_number: caller,
            to_number: dialed,
            direction: "inbound",
            status: "completed".to_owned(),
            duration_secs: 0,
            did_id: decision.did_id,
            provider_call_sid: Some(ch.id.clone()),
        },
    )
    .await;

    Ok(())
}
