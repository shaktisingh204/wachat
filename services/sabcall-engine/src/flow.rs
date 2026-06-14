//! Obtain a verb flow for a call — from the application's webhook (the
//! Twilio/Fonoster programmable model) or a built-in default.

use serde::Serialize;
use serde_json::Value;

use crate::state::AppState;
use crate::verbs::Verb;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CallContext {
    pub call_id: String,
    pub from: String,
    pub to: String,
    pub direction: &'static str,
}

/// POST the call context to the application's webhook and parse the returned
/// verb flow. Accepts either a bare `[...]` array or `{ "verbs": [...] }`.
pub async fn fetch_webhook_flow(
    state: &AppState,
    url: &str,
    ctx: &CallContext,
) -> Vec<Verb> {
    let resp = state.http.post(url).json(ctx).send().await;
    let body = match resp {
        Ok(r) => r.json::<Value>().await.unwrap_or(Value::Null),
        Err(e) => {
            tracing::warn!(error = %e, %url, "webhook flow fetch failed");
            return default_flow();
        }
    };
    let arr = match &body {
        Value::Array(_) => body.clone(),
        Value::Object(o) => o.get("verbs").cloned().unwrap_or(Value::Null),
        _ => Value::Null,
    };
    match serde_json::from_value::<Vec<Verb>>(arr) {
        Ok(v) if !v.is_empty() => v,
        _ => {
            tracing::warn!(%url, "webhook returned no usable verbs; using default flow");
            default_flow()
        }
    }
}

/// Greeting-only fallback flow.
pub fn default_flow() -> Vec<Verb> {
    vec![
        Verb::Say {
            text: "Welcome to SabCall.".to_owned(),
        },
        Verb::Pause { ms: 500 },
    ]
}
