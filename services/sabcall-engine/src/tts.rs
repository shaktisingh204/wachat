//! Text-to-speech adapter (optional HTTP provider).
//!
//! When `SABCALL_TTS_URL` is set, `synthesize` POSTs `{text, format}` to it,
//! expects audio bytes back, caches them under `ASTERISK_SOUNDS_DIR`, and
//! returns a `sound:<id>` media URI Asterisk can play. When unset it returns
//! `None` and the caller falls back to the default greeting. Provider-agnostic
//! so any TTS (ElevenLabs/Google/Polly/local) can sit behind one HTTP shim.

use std::path::Path;

use crate::state::AppState;

/// Stable FNV-1a id so identical prompts reuse the same cached clip (no deps).
fn stable_id(text: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in text.as_bytes() {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{h:016x}")
}

/// Synthesize `text` → playable Asterisk media URI, or `None` if no provider.
pub async fn synthesize(state: &AppState, text: &str) -> Option<String> {
    let url = state.cfg.tts_url.as_deref()?;
    let filename = format!("sabcall-tts-{}", stable_id(text));
    let path = Path::new(&state.cfg.sounds_dir).join(format!("{filename}.wav"));

    if !path.exists() {
        let resp = state
            .http
            .post(url)
            .json(&serde_json::json!({ "text": text, "format": "wav" }))
            .send()
            .await
            .ok()?;
        if !resp.status().is_success() {
            tracing::warn!(status = %resp.status(), "tts provider error");
            return None;
        }
        let bytes = resp.bytes().await.ok()?;
        if let Some(parent) = path.parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }
        if let Err(e) = tokio::fs::write(&path, &bytes).await {
            tracing::warn!(error = %e, "tts write failed");
            return None;
        }
    }
    Some(format!("sound:{filename}"))
}
