//! Speech-to-text adapter (optional HTTP provider).
//!
//! Post-call transcription: POST `{audioUrl}` to `SABCALL_STT_URL`, expect
//! `{text}` back. Returns `None` when no provider is configured. Real-time STT
//! uses `AriClient::external_media` to fork audio to a websocket; that sink can
//! reuse the same provider shim.

use crate::state::AppState;

/// Transcribe the audio at `audio_url`, or `None` if no STT provider.
pub async fn transcribe(state: &AppState, audio_url: &str) -> Option<String> {
    let url = state.cfg.stt_url.as_deref()?;
    let resp = state
        .http
        .post(url)
        .json(&serde_json::json!({ "audioUrl": audio_url }))
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        tracing::warn!(status = %resp.status(), "stt provider error");
        return None;
    }
    let v: serde_json::Value = resp.json().await.ok()?;
    v.get("text").and_then(|t| t.as_str()).map(str::to_owned)
}
