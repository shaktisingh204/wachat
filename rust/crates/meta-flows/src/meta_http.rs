//! Meta HTTP helpers tailored to Flow CRUD.
//!
//! `wachat_meta_client::MetaClient` covers the common JSON-in/JSON-out
//! shape but Flows have three operations it doesn't model cleanly:
//!
//! 1. `POST /{flow}/assets` is `multipart/form-data` carrying `flow.json`.
//! 2. The assets-list response includes a `download_url` we must `GET`
//!    against an arbitrary host (signed S3-ish URL, no Bearer token).
//! 3. `GET /{waba}/flows` is paginated via `paging.next` — an opaque
//!    fully-qualified URL we follow until exhausted.
//!
//! On non-2xx, every helper here surfaces `validation_errors` from the
//! Meta error envelope so callers can echo them to the UI verbatim. The
//! shared `MetaClient` collapses errors into a single message string and
//! drops the structured `validation_errors` array, which would break the
//! "save draft" UX where inline editor markers depend on those entries.

use std::time::Duration;

use reqwest::{Method, StatusCode};
use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::dto::ValidationError;

const GRAPH_API_VERSION: &str = "v25.0";
const GRAPH_BASE: &str = "https://graph.facebook.com";

/// Error returned by all helpers in this module.
///
/// The `Api` variant carries `validation_errors` so handlers can include
/// them in the JSON response envelope when Meta rejects a draft.
#[derive(Debug)]
pub enum MetaHttpError {
    Network(reqwest::Error),
    Decode(serde_json::Error),
    Api {
        status: u16,
        message: String,
        validation_errors: Vec<ValidationError>,
    },
}

impl std::fmt::Display for MetaHttpError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Network(e) => write!(f, "meta http network: {e}"),
            Self::Decode(e) => write!(f, "meta http decode: {e}"),
            Self::Api {
                status, message, ..
            } => write!(f, "meta http {status}: {message}"),
        }
    }
}

impl std::error::Error for MetaHttpError {}

impl From<reqwest::Error> for MetaHttpError {
    fn from(e: reqwest::Error) -> Self {
        Self::Network(e)
    }
}

impl From<serde_json::Error> for MetaHttpError {
    fn from(e: serde_json::Error) -> Self {
        Self::Decode(e)
    }
}

/// Pretty-print `MetaHttpError` for the `error` slot of `ActionResult`.
///
/// Matches the TS `pickGraphError`: prefer `error.error_user_msg`,
/// fall back to `error.message`, then top-level `message`, finally the
/// generic transport error.
pub fn message_for(err: &MetaHttpError) -> String {
    match err {
        MetaHttpError::Network(e) => e.to_string(),
        MetaHttpError::Decode(e) => e.to_string(),
        MetaHttpError::Api { message, .. } => message.clone(),
    }
}

/// Pull the structured `validation_errors` out of a `MetaHttpError` if
/// it's the API variant. `None` for transport-level errors.
pub fn validation_for(err: &MetaHttpError) -> Option<Vec<ValidationError>> {
    match err {
        MetaHttpError::Api {
            validation_errors, ..
        } if !validation_errors.is_empty() => Some(validation_errors.clone()),
        _ => None,
    }
}

#[derive(Clone, Debug)]
pub struct Client {
    http: reqwest::Client,
}

impl Default for Client {
    fn default() -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .pool_idle_timeout(Some(Duration::from_secs(90)))
                .user_agent(concat!("sabnode-meta-flows/", env!("CARGO_PKG_VERSION")))
                .build()
                .expect("reqwest client must build"),
        }
    }
}

impl Client {
    fn graph_url(path: &str) -> String {
        let path = path.trim_start_matches('/');
        format!("{GRAPH_BASE}/{GRAPH_API_VERSION}/{path}")
    }

    /// `POST /{path}` with a JSON body. Used for `/{waba}/flows`,
    /// `/{flow}` (metadata), `/{flow}/publish`, `/{flow}/deprecate`.
    pub async fn post_json<T: DeserializeOwned>(
        &self,
        path: &str,
        token: &str,
        body: &Value,
    ) -> Result<T, MetaHttpError> {
        let resp = self
            .http
            .post(Self::graph_url(path))
            .bearer_auth(token)
            .json(body)
            .send()
            .await?;
        decode::<T>(resp).await
    }

    /// `GET /{path}` with optional query params.
    pub async fn get_json<T: DeserializeOwned>(
        &self,
        path: &str,
        token: &str,
        query: &[(&str, String)],
    ) -> Result<T, MetaHttpError> {
        let resp = self
            .http
            .get(Self::graph_url(path))
            .bearer_auth(token)
            .query(query)
            .send()
            .await?;
        decode::<T>(resp).await
    }

    /// `DELETE /{path}`.
    pub async fn delete(&self, path: &str, token: &str) -> Result<(), MetaHttpError> {
        let resp = self
            .http
            .delete(Self::graph_url(path))
            .bearer_auth(token)
            .send()
            .await?;
        let _: Value = decode(resp).await?;
        Ok(())
    }

    /// `POST /{flow}/assets` with `multipart/form-data` carrying the
    /// `flow.json` body. Returns the parsed JSON response so the caller
    /// can read `validation_errors` and `success`.
    pub async fn post_assets(
        &self,
        flow_id: &str,
        token: &str,
        flow_json_bytes: Vec<u8>,
    ) -> Result<Value, MetaHttpError> {
        let part = reqwest::multipart::Part::bytes(flow_json_bytes)
            .file_name("flow.json")
            .mime_str("application/json")
            .map_err(|e| MetaHttpError::Network(reqwest::Error::from(e)))?;
        let form = reqwest::multipart::Form::new()
            .part("file", part)
            .text("name", "flow.json")
            .text("asset_type", "FLOW_JSON");

        let resp = self
            .http
            .post(Self::graph_url(&format!("{flow_id}/assets")))
            .bearer_auth(token)
            .multipart(form)
            .send()
            .await?;
        decode(resp).await
    }

    /// `GET` an opaque URL — used for both `paging.next` cursors and the
    /// signed `download_url` returned by `/{flow}/assets`. The asset
    /// download URL doesn't accept Bearer auth, so `attach_token` is the
    /// caller's choice.
    pub async fn get_url(&self, url: &str, token: Option<&str>) -> Result<Value, MetaHttpError> {
        let mut req = self.http.get(url);
        if let Some(t) = token {
            req = req.bearer_auth(t);
        }
        let resp = req.send().await?;
        decode(resp).await
    }

    /// `GET` the raw text body of an opaque URL — Meta's signed asset
    /// download returns the Flow JSON as `text/plain`, not JSON, which
    /// trips reqwest's `.json()` codepath.
    pub async fn get_url_text(&self, url: &str) -> Result<String, MetaHttpError> {
        let resp = self.http.get(url).send().await?;
        let status = resp.status();
        let body = resp.text().await?;
        if !status.is_success() {
            return Err(MetaHttpError::Api {
                status: status.as_u16(),
                message: body,
                validation_errors: vec![],
            });
        }
        Ok(body)
    }
}

/// Common decode + error-envelope handling used by every JSON helper above.
async fn decode<T: DeserializeOwned>(resp: reqwest::Response) -> Result<T, MetaHttpError> {
    let status = resp.status();
    let bytes = resp.bytes().await?;
    if status.is_success() {
        if bytes.is_empty() {
            // Some Meta endpoints respond 200 with no body; let the type
            // decoder decide whether `null` is acceptable.
            return Ok(serde_json::from_slice(b"null")?);
        }
        return Ok(serde_json::from_slice(&bytes)?);
    }
    Err(parse_error(status, &bytes))
}

/// Parse Meta's error envelope, preserving `validation_errors`.
fn parse_error(status: StatusCode, body: &[u8]) -> MetaHttpError {
    #[derive(serde::Deserialize)]
    struct Inner {
        #[serde(default)]
        message: Option<String>,
        #[serde(default)]
        error_user_msg: Option<String>,
    }
    #[derive(serde::Deserialize)]
    struct Env {
        #[serde(default)]
        error: Option<Inner>,
        #[serde(default)]
        message: Option<String>,
        #[serde(default)]
        validation_errors: Option<Vec<ValidationError>>,
    }

    if let Ok(env) = serde_json::from_slice::<Env>(body) {
        let message = env
            .error
            .as_ref()
            .and_then(|e| e.error_user_msg.clone())
            .or_else(|| env.error.as_ref().and_then(|e| e.message.clone()))
            .or(env.message)
            .unwrap_or_else(|| {
                status
                    .canonical_reason()
                    .unwrap_or("Meta API error")
                    .to_owned()
            });
        // The TS code drops `validation_errors` when `error.error_user_msg`
        // is set — we mirror that here so the envelope shape matches.
        let validation_errors = if env
            .error
            .as_ref()
            .and_then(|e| e.error_user_msg.as_ref())
            .is_some()
        {
            vec![]
        } else {
            env.validation_errors.unwrap_or_default()
        };
        return MetaHttpError::Api {
            status: status.as_u16(),
            message,
            validation_errors,
        };
    }
    MetaHttpError::Api {
        status: status.as_u16(),
        message: String::from_utf8_lossy(body).into_owned(),
        validation_errors: vec![],
    }
}

#[allow(dead_code)]
/// Re-export consumed by `Method` users elsewhere — kept to satisfy
/// `dead_code` if the variant set ever shrinks.
const _METHOD_USES: Method = Method::GET;

/// `false` when the Meta error message looks like a "not found" — used by
/// `delete_meta_flow` to tolerate stale local rows.
pub fn is_not_found(message: &str) -> bool {
    let m = message.to_ascii_lowercase();
    m.contains("not found") || m.contains("does not exist")
}
