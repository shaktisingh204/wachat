//! Best-effort call-event callbacks to the Next.js app.
//!
//! The engine never holds S3/R2 creds; instead it POSTs events (recording
//! ready, call ended, transcript) to `SABCALL_EVENTS_URL` and the app persists
//! recordings to SabFiles/R2 and enriches the CDR. Failures are logged, never
//! fatal — losing an event must not break call handling.

use serde_json::Value;

use crate::state::AppState;

pub async fn emit(state: &AppState, event: Value) {
    let Some(url) = state.cfg.events_url.as_deref() else {
        return;
    };
    let mut req = state.http.post(url).json(&event);
    if let Some(tok) = state.cfg.engine_token.as_deref() {
        req = req.bearer_auth(tok);
    }
    if let Err(e) = req.send().await {
        tracing::warn!(error = %e, "call-event emit failed");
    }
}
