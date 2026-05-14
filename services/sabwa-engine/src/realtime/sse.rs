//! Server-Sent Events transport for SabWa real-time events.
//!
//! Mirrors [`crate::realtime::ws`] but speaks the EventSource protocol,
//! which is the primary transport described in `SABWA_PLAN.md` §5
//! (`/api/sabwa/stream?sessionId=...`). SSE is preferred on flaky mobile
//! networks because the browser will auto-reconnect; WebSocket is offered
//! as a fallback for environments that need bidirectional channels.

use std::{convert::Infallible, time::Duration};

use axum::{
    extract::{Path, State},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
    routing::get,
    Router,
};
use futures::{stream, Stream, StreamExt};

use super::{events::SabwaEvent, pubsub};
use crate::state::AppState;

/// Build the router that mounts the SSE handler at `/sse/:session_id`.
#[must_use]
pub fn router() -> Router<AppState> {
    Router::new().route("/sse/:session_id", get(sse_handler))
}

/// Axum handler that returns an SSE response streaming [`SabwaEvent`]s for
/// the given session.
///
/// On subscribe failure we return a single `error` SSE event and close
/// the stream — the EventSource client will surface this to the caller and
/// can decide whether to retry.
pub async fn sse_handler(
    Path(session_id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    tracing::info!(
        target: "sabwa::realtime::sse",
        session_id = %session_id,
        "sse client connected"
    );

    let stream: std::pin::Pin<
        Box<dyn Stream<Item = Result<Event, Infallible>> + Send>,
    > = match pubsub::subscribe(&state.redis, &session_id).await {
        Ok(events) => {
            let session_for_log = session_id.clone();
            Box::pin(events.map(move |event| {
                tracing::debug!(
                    target: "sabwa::realtime::sse",
                    session_id = %session_for_log,
                    kind = event_kind(&event),
                    "forwarded event"
                );
                Ok::<Event, Infallible>(encode_event(&event))
            }))
        }
        Err(err) => {
            tracing::warn!(
                target: "sabwa::realtime::sse",
                session_id = %session_id,
                error = %err,
                "failed to subscribe to Redis; emitting error event"
            );
            let err_event = Event::default()
                .event("error")
                .data(format!("{{\"error\":\"{err}\"}}"));
            Box::pin(stream::iter([Ok::<Event, Infallible>(err_event)]))
        }
    };

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(20))
            .text("keep-alive"),
    )
}

/// Encode a [`SabwaEvent`] as an SSE `Event`.
///
/// We set `event:` to the variant's `kind` so JS consumers can do:
///
/// ```js
/// es.addEventListener("message", …);
/// es.addEventListener("qr", …);
/// ```
///
/// and fall back to `onmessage` for unknown variants.
fn encode_event(event: &SabwaEvent) -> Event {
    let kind = event_kind(event);
    let data = serde_json::to_string(event).unwrap_or_else(|err| {
        tracing::warn!(
            target: "sabwa::realtime::sse",
            error = %err,
            "failed to serialise SabwaEvent; sending empty payload"
        );
        "{}".to_string()
    });
    Event::default().event(kind).data(data)
}

/// Short string label for SSE `event:` lines and log lines.
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
