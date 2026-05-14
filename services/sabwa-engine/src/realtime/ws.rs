//! WebSocket transport for SabWa real-time events.
//!
//! Each accepted socket subscribes to the session's Redis pub/sub channel
//! (see [`crate::realtime::pubsub`]) and forwards every [`SabwaEvent`] as a
//! text frame containing the same JSON the SSE handler emits. The handler
//! also services client-originated ping/pong/close frames so browsers can
//! detect dead connections.
//!
//! Drop semantics: when the client disconnects (or the server task is
//! cancelled), the subscription stream is dropped, which closes the
//! underlying Redis pub/sub connection — no per-session bookkeeping
//! required in [`crate::state::AppState`].

use std::convert::Infallible;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures::{SinkExt, StreamExt};

use super::{events::SabwaEvent, pubsub};
use crate::state::AppState;

/// Build the router that mounts the WebSocket handler at `/ws/:session_id`.
///
/// The caller is expected to nest this under `/realtime` (see the TODO in
/// [`crate::realtime`]).
#[must_use]
pub fn router() -> Router<AppState> {
    Router::new().route("/ws/:session_id", get(ws_handler))
}

/// Axum upgrade handler — accepts the WebSocket and hands the open socket
/// off to [`handle_socket`].
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(session_id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    tracing::info!(
        target: "sabwa::realtime::ws",
        session_id = %session_id,
        "accepting websocket upgrade"
    );
    ws.on_upgrade(move |socket| handle_socket(socket, session_id, state))
}

/// Bidirectional pump that bridges Redis pub/sub ⇄ a single WebSocket.
///
/// Loop semantics:
/// - **Inbound from Redis** → JSON-encode → `Message::Text`.
/// - **Inbound from client** → handle ping (auto-replied by Axum), pong,
///   text/binary (ignored — clients have no API surface today) and close.
///
/// The first error on either side ends the loop and closes the socket.
async fn handle_socket(socket: WebSocket, session_id: String, state: AppState) {
    tracing::info!(
        target: "sabwa::realtime::ws",
        session_id = %session_id,
        "websocket connected"
    );

    let mut events = match pubsub::subscribe(&state.redis, &session_id).await {
        Ok(stream) => Box::pin(stream),
        Err(err) => {
            tracing::warn!(
                target: "sabwa::realtime::ws",
                session_id = %session_id,
                error = %err,
                "failed to subscribe to Redis; closing socket"
            );
            // Best-effort close; we don't care about the result.
            let _ = close_socket(socket).await;
            return;
        }
    };

    let (mut sink, mut stream) = socket.split();

    loop {
        tokio::select! {
            // ── Redis → client ────────────────────────────────────────
            maybe_event = events.next() => {
                let Some(event) = maybe_event else {
                    tracing::debug!(
                        target: "sabwa::realtime::ws",
                        session_id = %session_id,
                        "redis stream ended; closing socket"
                    );
                    break;
                };

                let payload = match serde_json::to_string(&event) {
                    Ok(s) => s,
                    Err(err) => {
                        tracing::warn!(
                            target: "sabwa::realtime::ws",
                            session_id = %session_id,
                            error = %err,
                            "failed to serialise event; skipping"
                        );
                        continue;
                    }
                };

                if let Err(err) = sink.send(Message::Text(payload)).await {
                    tracing::debug!(
                        target: "sabwa::realtime::ws",
                        session_id = %session_id,
                        error = %err,
                        "client disconnected during send"
                    );
                    break;
                }

                tracing::debug!(
                    target: "sabwa::realtime::ws",
                    session_id = %session_id,
                    kind = event_kind(&event),
                    "forwarded event"
                );
            }

            // ── Client → server ───────────────────────────────────────
            maybe_msg = stream.next() => {
                let Some(msg) = maybe_msg else {
                    tracing::debug!(
                        target: "sabwa::realtime::ws",
                        session_id = %session_id,
                        "client closed the stream"
                    );
                    break;
                };

                match msg {
                    Ok(Message::Close(frame)) => {
                        tracing::info!(
                            target: "sabwa::realtime::ws",
                            session_id = %session_id,
                            code = frame.as_ref().map(|f| f.code),
                            "client sent close frame"
                        );
                        break;
                    }
                    Ok(Message::Ping(payload)) => {
                        // Axum auto-responds to pings, but if the client
                        // expects an explicit Pong we handle it ourselves
                        // in case auto-pong is ever disabled upstream.
                        if let Err(err) = sink.send(Message::Pong(payload)).await {
                            tracing::debug!(
                                target: "sabwa::realtime::ws",
                                session_id = %session_id,
                                error = %err,
                                "failed to send pong; closing"
                            );
                            break;
                        }
                    }
                    Ok(Message::Pong(_)) => {
                        // Keep-alive ack from the client — nothing to do.
                    }
                    Ok(Message::Text(_) | Message::Binary(_)) => {
                        // Clients have no upstream API on this socket today.
                        // Silently ignore until a use-case ships.
                    }
                    Err(err) => {
                        tracing::debug!(
                            target: "sabwa::realtime::ws",
                            session_id = %session_id,
                            error = %err,
                            "websocket recv error"
                        );
                        break;
                    }
                }
            }
        }
    }

    // Reunite the halves so we can issue a clean close frame.
    if let Ok(socket) = sink.reunite(stream) {
        let _ = close_socket(socket).await;
    }

    tracing::info!(
        target: "sabwa::realtime::ws",
        session_id = %session_id,
        "websocket disconnected"
    );
}

/// Send a polite close frame, ignoring errors (the peer may already be gone).
async fn close_socket(mut socket: WebSocket) -> Result<(), Infallible> {
    let _ = socket.send(Message::Close(None)).await;
    let _ = socket.close().await;
    Ok(())
}

/// Short string label for log lines.
fn event_kind(event: &SabwaEvent) -> &'static str {
    match event {
        SabwaEvent::Message(_) => "message",
        SabwaEvent::MessageStatus(_) => "message_status",
        SabwaEvent::Chat(_) => "chat",
        SabwaEvent::Presence(_) => "presence",
        SabwaEvent::Typing(_) => "typing",
        SabwaEvent::Qr(_) => "qr",
        SabwaEvent::PairCode(_) => "pair_code",
        SabwaEvent::Status(_) => "status",
    }
}
