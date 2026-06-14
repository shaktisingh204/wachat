//! LLM adapter (optional HTTP provider) for the AI voice agent (autopilot).
//!
//! POST `{system, prompt}` to `SABCALL_LLM_URL` → `{text}`. The Next.js side can
//! expose its canonical `generateSabcrmText` gateway behind this shim, so the
//! engine never holds model keys. Returns `None` when no provider is configured.

use crate::state::AppState;

pub async fn complete(state: &AppState, system: &str, prompt: &str) -> Option<String> {
    let url = state.cfg.llm_url.as_deref()?;
    let resp = state
        .http
        .post(url)
        .json(&serde_json::json!({ "system": system, "prompt": prompt }))
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        tracing::warn!(status = %resp.status(), "llm provider error");
        return None;
    }
    let v: serde_json::Value = resp.json().await.ok()?;
    v.get("text").and_then(|t| t.as_str()).map(str::to_owned)
}
