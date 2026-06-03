//! HTTP handler(s) for the SabChat websocket surface.
//!
//! There is exactly one route — `GET /` — which upgrades to a
//! WebSocket. The upgrade requires the
//! [`AuthUser`](sabnode_auth::AuthUser) extractor; if the JWT is
//! missing or invalid axum rejects with `401` before we ever see the
//! request here.
//!
//! ## Connection lifecycle
//!
//! Once the upgrade completes we:
//!
//! 1. Parse the caller's `tenant_id` (hex string on the JWT) into an
//!    `ObjectId` once, so the per-event fan-out filter on the hot path
//!    is a fixed-size compare.
//! 2. Subscribe to the per-process [`WsHub`] broadcast channel.
//! 3. Spawn an "outbound" task that pulls from the broadcast receiver,
//!    drops events whose `tenant_id` doesn't match, and forwards the
//!    rest as JSON text frames.
//! 4. Run an "inbound" loop on the original task that handles agent
//!    frames (`ping`, `presence`, `typing`) and republishes them onto
//!    the same hub so siblings see them too.
//! 5. Cancel the outbound task when the inbound side closes (client
//!    disconnect / IO error).
//!
//! ## Lag handling
//!
//! The broadcast channel uses capacity 1024. If a socket lags far
//! enough that the receiver yields `Err(Lagged)`, we log a warning and
//! drop the connection — the client can reconnect and resync via REST.
//! That's preferable to silently skipping events on a stale socket.

use axum::{
    extract::{
        State,
        ws::{Message, Utf8Bytes, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
};
use bson::oid::ObjectId;
use futures_util::{SinkExt, StreamExt};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde_json::{Value, json};
use tracing::{instrument, warn};

use crate::{Event, state::SabChatWsState};

/// `GET /v1/sabchat/ws` — upgrade to a per-tenant fan-out WebSocket.
///
/// Returns `401` (via [`ApiError::Unauthorized`]) if the JWT's `tid`
/// claim isn't a valid hex ObjectId. Every other failure path lives
/// inside [`run_socket`] after the upgrade has completed.
#[instrument(skip_all, fields(user_id = %user.user_id, tenant_id = %user.tenant_id))]
pub async fn ws_upgrade(
    user: AuthUser,
    State(state): State<SabChatWsState>,
    ws: WebSocketUpgrade,
) -> Result<impl IntoResponse> {
    // Parse the tenant id once on the cold path so the per-event filter
    // inside `run_socket` is a cheap `ObjectId == ObjectId` compare.
    let tenant_oid = ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))?;
    let user_id = user.user_id.clone();

    Ok(ws.on_upgrade(move |socket| run_socket(socket, state, tenant_oid, user_id)))
}

/// Per-connection driver. Runs the outbound fan-out task and the
/// inbound agent-frame loop concurrently; either side closing tears
/// the whole connection down.
async fn run_socket(
    socket: WebSocket,
    state: SabChatWsState,
    tenant_oid: ObjectId,
    user_id: String,
) {
    let (mut sink, mut stream) = socket.split();
    let mut rx = state.hub.subscribe();

    // -----------------------------------------------------------------
    // Outbound: hub -> client. Filtered by tenant_id.
    // -----------------------------------------------------------------
    //
    // We `spawn` rather than `select!`-ing here so the inbound loop can
    // own the `&mut WebSocket` cleanly without holding the sink locked
    // for the whole connection.
    let outbound = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(ev) => {
                    // Per-tenant filter — the whole point of this crate.
                    if ev.tenant_id != tenant_oid {
                        continue;
                    }
                    let body = match serde_json::to_string(&ev) {
                        Ok(s) => s,
                        Err(err) => {
                            warn!(?err, "failed to serialize ws event");
                            continue;
                        }
                    };
                    if sink
                        .send(Message::Text(Utf8Bytes::from(body)))
                        .await
                        .is_err()
                    {
                        // Client gone — bail. The inbound side will
                        // notice on its next read and tear the rest
                        // down.
                        break;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(skipped)) => {
                    warn!(skipped, "ws receiver lagged; closing socket");
                    let _ = sink.close().await;
                    break;
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    // -----------------------------------------------------------------
    // Inbound: client -> server. Handles ping / presence / typing.
    // -----------------------------------------------------------------
    while let Some(frame) = stream.next().await {
        let msg = match frame {
            Ok(m) => m,
            Err(err) => {
                warn!(?err, "ws stream error; closing");
                break;
            }
        };

        match msg {
            Message::Text(text) => {
                handle_text_frame(&state, tenant_oid, &user_id, text.as_str());
            }
            Message::Binary(_) => {
                // We don't speak binary on this surface yet — siblings
                // can add it later if voice / file shards land.
                warn!("ignoring binary ws frame");
            }
            Message::Ping(_) | Message::Pong(_) => {
                // axum auto-replies to pings; nothing to do.
            }
            Message::Close(_) => break,
        }
    }

    // Inbound is done — cancel the outbound forwarder.
    outbound.abort();
}

/// Decode and route a single inbound text frame. We intentionally keep
/// this synchronous: every supported command either replies via the
/// already-spawned outbound task (by publishing onto the hub) or is a
/// pure no-op — neither path needs to `await` here.
fn handle_text_frame(state: &SabChatWsState, tenant_oid: ObjectId, user_id: &str, raw: &str) {
    let v: Value = match serde_json::from_str(raw) {
        Ok(v) => v,
        Err(err) => {
            warn!(?err, "malformed ws frame; dropping");
            return;
        }
    };

    let kind = match v.get("type").and_then(Value::as_str) {
        Some(k) => k,
        None => {
            warn!("ws frame missing `type`; dropping");
            return;
        }
    };

    match kind {
        // -------------------------------------------------------------
        // ping -> pong (via the hub so it goes back through the same
        // outbound path — keeps the protocol uniform). We tag the pong
        // with the calling tenant so only the calling tenant's sockets
        // forward it.
        // -------------------------------------------------------------
        "ping" => {
            state.hub.publish(Event {
                tenant_id: tenant_oid,
                kind: "pong".to_owned(),
                payload: Value::Null,
            });
        }

        // -------------------------------------------------------------
        // presence: agent self-reports status; we rebroadcast tagged
        // with the agent's user_id so other tenant sockets can update
        // their roster.
        // -------------------------------------------------------------
        "presence" => {
            let status = v
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or("online")
                .to_owned();
            // Whitelist the legal statuses — anything else is dropped
            // to keep clients honest about the wire contract.
            if !matches!(status.as_str(), "online" | "away" | "busy" | "offline") {
                warn!(%status, "ignoring presence frame with unknown status");
                return;
            }
            state.hub.publish(Event {
                tenant_id: tenant_oid,
                kind: "presence".to_owned(),
                payload: json!({
                    "agentId": user_id,
                    "status": status,
                }),
            });
        }

        // -------------------------------------------------------------
        // typing: agent indicating they are typing in a conversation.
        // -------------------------------------------------------------
        "typing" => {
            let conversation_id = match v.get("conversationId").and_then(Value::as_str) {
                Some(s) if !s.is_empty() => s.to_owned(),
                _ => {
                    warn!("ignoring typing frame without conversationId");
                    return;
                }
            };
            state.hub.publish(Event {
                tenant_id: tenant_oid,
                kind: "typing".to_owned(),
                payload: json!({
                    "conversationId": conversation_id,
                    "actor": "agent",
                    "actorId": user_id,
                }),
            });
        }

        other => {
            warn!(kind = %other, "unsupported ws frame type; dropping");
        }
    }
}
