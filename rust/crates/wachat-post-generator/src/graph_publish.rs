//! EXTERNAL SEAM — Meta Graph publish, isolated.
//!
//! This is the *only* module in the crate that performs network I/O. It
//! publishes a text post to a Facebook Page feed via
//! `POST https://graph.facebook.com/{version}/{page-id}/feed` using the
//! page access token already stored on the tenant's `projects` row.
//!
//! ## Degradation contract
//!
//! * The token/page-id are resolved by the caller (handlers). If the token
//!   is missing/empty, the caller never reaches this module — it persists a
//!   `publish_log` row with `status="failed", reason="no FB token"` and
//!   returns `ApiError::BadRequest` instead.
//! * Every fallible step here is mapped to a typed [`PublishError`]; nothing
//!   panics and no network result is `unwrap`ped. Transport failures, Graph
//!   error envelopes, and a missing post id all surface as `Err`.
//! * With no live creds the crate still compiles and routes — the client is
//!   built lazily and a real call is only made when a token is present.

use serde_json::Value;

/// Pinned Meta Graph API version. Mirrors the `v23.0` strings used across
/// the sibling `wachat-facebook-*` crates.
pub const META_API_VERSION: &str = "v23.0";

const GRAPH_BASE: &str = "https://graph.facebook.com";

/// Typed failure surface for a Graph publish. Deliberately does NOT carry an
/// `ApiError` so this module stays free of HTTP-status concerns — the
/// handler maps these into `ApiError` and into the `publish_log` row.
#[derive(Debug)]
pub enum PublishError {
    /// reqwest could not be constructed or the request never completed
    /// (DNS, TLS, timeout, connection reset, …).
    Transport(String),
    /// Graph returned a non-2xx status and/or an `{ "error": { … } }` body.
    Graph(String),
    /// 2xx but the response had no usable `id` field.
    MissingId,
}

impl PublishError {
    /// Short, log-safe reason string for the `publish_log` row.
    pub fn reason(&self) -> String {
        match self {
            PublishError::Transport(e) => format!("transport: {e}"),
            PublishError::Graph(e) => format!("graph: {e}"),
            PublishError::MissingId => "graph returned no post id".to_owned(),
        }
    }
}

/// Publish a text message to a Page feed. Returns the new Graph post id.
///
/// `page_id` and `access_token` are taken verbatim from the tenant's
/// `projects` row. The caller guarantees `access_token` is non-empty before
/// invoking this (empty-token degradation happens upstream).
pub async fn publish_text_to_feed(
    page_id: &str,
    access_token: &str,
    message: &str,
) -> Result<String, PublishError> {
    // Build a client lazily so the crate compiles + routes with no creds and
    // never opens a socket on a code path that doesn't publish.
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| PublishError::Transport(e.to_string()))?;

    let url = format!("{GRAPH_BASE}/{META_API_VERSION}/{page_id}/feed");

    // Token goes in the body form, matching the legacy TS publish path.
    let resp = client
        .post(&url)
        .form(&[("message", message), ("access_token", access_token)])
        .send()
        .await
        .map_err(|e| PublishError::Transport(e.to_string()))?;

    let status = resp.status();

    // Read the body as JSON; never unwrap the network read.
    let body: Value = resp
        .json()
        .await
        .map_err(|e| PublishError::Transport(e.to_string()))?;

    if !status.is_success() {
        let msg = body
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(Value::as_str)
            .map(str::to_owned)
            .unwrap_or_else(|| format!("HTTP {status}"));
        return Err(PublishError::Graph(msg));
    }

    // Some error envelopes still come back with a 2xx in practice.
    if let Some(err) = body.get("error") {
        let msg = err
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("unknown graph error")
            .to_owned();
        return Err(PublishError::Graph(msg));
    }

    body.get("id")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or(PublishError::MissingId)
}
