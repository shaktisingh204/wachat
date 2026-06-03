//! Generic Meta Graph proxy.
//!
//! Mirrors the legacy TS `graph(...)` helper: build a request to
//! `https://graph.facebook.com/{ver}/{path}`, attach `access_token`
//! either via query string (GET/DELETE) or merged into the JSON body
//! (POST), parse the response, surface `error.message` from Graph's
//! error envelope as a friendly string. Handles two token kinds:
//!
//! - `adManager` — pulled from `users.adManagerAccessToken` (the
//!   default for campaign/ad-set/ad CRUD + insights).
//! - `metaSuite` — pulled from `users.metaSuiteAccessToken` (used by
//!   FB Pages / IG / promotable_posts / canvases / etc).
//!
//! Multipart uploads (`uploadAdImage`, `uploadAdVideo`) get their own
//! handler because they take a binary body.

use bson::{Document, doc, oid::ObjectId};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::state::AdManagerState;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TokenKind {
    AdManager,
    MetaSuite,
}

impl Default for TokenKind {
    fn default() -> Self {
        Self::AdManager
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphProxyBody {
    /// Graph path without leading `/`. Example: `act_123/campaigns`.
    pub path: String,
    /// `GET`, `POST`, or `DELETE`. Defaults to GET.
    #[serde(default = "default_method")]
    pub method: String,
    /// Query-string parameters. Always merged with `access_token`.
    #[serde(default)]
    pub params: Map<String, Value>,
    /// Body parameters. For POST these are sent as the JSON body
    /// (alongside `access_token`). For GET/DELETE this is silently
    /// ignored — matches axios behavior.
    #[serde(default)]
    pub body: Option<Map<String, Value>>,
    #[serde(default)]
    pub token_kind: TokenKind,
}

fn default_method() -> String {
    "GET".to_owned()
}

/// Wire shape returned to TS. Mirrors the legacy `ActionResult<T>`:
/// either `{data: ...}` or `{error: "..."}`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphProxyResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn fetch_token(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    kind: TokenKind,
) -> Result<Option<String>> {
    let users = mongo.collection::<Document>("users");
    let user = users
        .find_one(doc! { "_id": user_oid })
        .projection(doc! { "adManagerAccessToken": 1, "metaSuiteAccessToken": 1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let Some(u) = user else { return Ok(None) };
    let key = match kind {
        TokenKind::AdManager => "adManagerAccessToken",
        TokenKind::MetaSuite => "metaSuiteAccessToken",
    };
    Ok(u.get_str(key)
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned))
}

pub fn missing_token_error(kind: TokenKind) -> &'static str {
    match kind {
        TokenKind::AdManager => "Ad Manager account not connected.",
        TokenKind::MetaSuite => "Facebook account not connected.",
    }
}

/// Run a request against graph.facebook.com using the resolved token.
pub async fn proxy(
    s: &AdManagerState,
    user_oid: ObjectId,
    body: GraphProxyBody,
) -> Result<GraphProxyResult> {
    let token = match fetch_token(&s.mongo, user_oid, body.token_kind).await? {
        Some(t) => t,
        None => {
            return Ok(GraphProxyResult {
                data: None,
                error: Some(missing_token_error(body.token_kind).to_owned()),
            });
        }
    };

    let url = format!(
        "https://graph.facebook.com/{}/{}",
        s.graph_version,
        body.path.trim_start_matches('/')
    );

    let method = body.method.to_uppercase();

    let mut req = match method.as_str() {
        "GET" => s.http.get(&url),
        "POST" => s.http.post(&url),
        "DELETE" => s.http.delete(&url),
        other => {
            return Ok(GraphProxyResult {
                data: None,
                error: Some(format!("Unsupported method: {other}")),
            });
        }
    };

    // Build query-string. `params` may include serde_json values; coerce
    // anything non-string to its string representation. Nested objects /
    // arrays get JSON-encoded — Graph's form-API expects complex types as
    // serialized JSON strings (e.g. `targeting_spec=%7B...%7D`). This
    // mirrors what the legacy TS code did with `JSON.stringify(...)` at
    // every call site.
    let mut query: Vec<(String, String)> = body
        .params
        .iter()
        .map(|(k, v)| (k.clone(), value_to_form_string(v)))
        .collect();
    query.push(("access_token".to_owned(), token.clone()));
    req = req.query(&query);

    // For POST / DELETE bodies: stringify nested values then send as JSON.
    // Graph accepts both form-encoded and JSON for primitives, but expects
    // any structured field to arrive as a JSON-encoded string regardless
    // of the outer encoding.
    let attach_body = matches!(method.as_str(), "POST" | "DELETE");
    if attach_body {
        if let Some(body_map) = body.body.as_ref() {
            let mut full: Map<String, Value> = body_map
                .iter()
                .map(|(k, v)| (k.clone(), stringify_complex(v)))
                .collect();
            full.insert("access_token".to_owned(), Value::String(token));
            req = req.json(&Value::Object(full));
        }
    }

    let res = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            return Ok(GraphProxyResult {
                data: None,
                error: Some(friendly_graph_error_message(&e.to_string())),
            });
        }
    };
    let status = res.status();
    let json: Value = match res.json().await {
        Ok(v) => v,
        Err(e) => {
            return Ok(GraphProxyResult {
                data: None,
                error: Some(format!("graph response was not JSON: {e}")),
            });
        }
    };

    if !status.is_success() {
        return Ok(GraphProxyResult {
            data: None,
            error: Some(extract_graph_error(&json)),
        });
    }
    // Graph occasionally returns 200 with `{"error": ...}` for batch ops.
    if let Some(err) = json.get("error") {
        return Ok(GraphProxyResult {
            data: None,
            error: Some(extract_graph_error(err)),
        });
    }

    Ok(GraphProxyResult {
        data: Some(json),
        error: None,
    })
}

fn value_to_form_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        // Nested object / array: JSON-encode (Graph form-API contract).
        Value::Object(_) | Value::Array(_) => v.to_string(),
        other => other.to_string(),
    }
}

/// For body fields: return a `Value::String(json)` for any nested
/// object/array, leaving primitives (string/number/bool/null) untouched.
/// Graph treats body-side complex types the same way query-string ones
/// are treated — they must be pre-serialised JSON strings.
fn stringify_complex(v: &Value) -> Value {
    match v {
        Value::Object(_) | Value::Array(_) => Value::String(v.to_string()),
        other => other.clone(),
    }
}

fn extract_graph_error(json: &Value) -> String {
    if let Some(msg) = json
        .pointer("/error/message")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
    {
        return msg.to_owned();
    }
    if let Some(msg) = json.get("message").and_then(Value::as_str) {
        return msg.to_owned();
    }
    if let Some(s) = json.as_str() {
        return s.to_owned();
    }
    json.to_string()
}

fn friendly_graph_error_message(s: &str) -> String {
    // Matches the spirit of `friendlyGraphError` — strip the noisy
    // axios prefix and keep the user-facing remainder.
    if s.starts_with("error sending request") {
        return "Network error reaching Meta Graph.".to_owned();
    }
    s.to_owned()
}
