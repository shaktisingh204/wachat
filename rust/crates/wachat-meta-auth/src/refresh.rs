//! Token introspection / refresh helpers.
//!
//! Wraps Meta's `/v23.0/debug_token` endpoint — the same endpoint used by
//! `inspectToken` in `src/app/actions/meta-token.actions.ts`. Callers must
//! pass an `app_token` of the form `"{app_id}|{app_secret}"` (Meta's required
//! shape for app-level tokens), built from `META_APP_ID` and
//! `META_APP_SECRET` environment variables.

use chrono::{DateTime, Utc};
use sabnode_common::ApiError;
use serde::Deserialize;
use tracing::debug;

use crate::error::MetaAuthError;
use crate::types::mask;

/// Graph API version used by the legacy TS code (`meta-token.actions.ts`,
/// `const API_VERSION = 'v23.0'`). Centralized here so a future bump only
/// touches one place.
pub const GRAPH_API_VERSION: &str = "v23.0";

/// Result of a `debug_token` call — narrowed to the fields callers care about.
#[derive(Debug, Clone)]
pub struct TokenIntrospection {
    /// Whether Meta considers the token valid right now.
    pub valid: bool,
    /// When the token expires (if Meta returned a non-zero `expires_at`).
    /// `None` for non-expiring system-user tokens.
    pub expires_at: Option<DateTime<Utc>>,
    /// Granted permission scopes.
    pub scopes: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct DebugTokenEnvelope {
    data: Option<DebugTokenData>,
    error: Option<MetaErrorBody>,
}

#[derive(Debug, Deserialize)]
struct DebugTokenData {
    #[serde(default)]
    is_valid: bool,
    #[serde(default)]
    expires_at: i64,
    #[serde(default)]
    scopes: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct MetaErrorBody {
    message: String,
    #[serde(default)]
    code: i64,
    #[serde(default, rename = "type")]
    err_type: String,
}

/// Call `GET https://graph.facebook.com/{ver}/debug_token` and return a
/// narrowed [`TokenIntrospection`].
///
/// `token` is the token to inspect (never logged in plaintext — only masked).
/// `app_token` is the Meta app-level token, formatted `"{app_id}|{app_secret}"`
/// — callers typically build this from `META_APP_ID` / `META_APP_SECRET` env
/// vars.
pub async fn debug_token(
    token: &str,
    app_token: &str,
    http: &reqwest::Client,
) -> Result<TokenIntrospection, ApiError> {
    let url = format!("https://graph.facebook.com/{GRAPH_API_VERSION}/debug_token");

    debug!(input_token = %mask(token), "calling meta debug_token");

    let envelope: DebugTokenEnvelope = http
        .get(&url)
        .query(&[("input_token", token), ("access_token", app_token)])
        .send()
        .await
        .map_err(MetaAuthError::from)?
        .error_for_status()
        .map_err(MetaAuthError::from)?
        .json()
        .await
        .map_err(MetaAuthError::from)?;

    if let Some(err) = envelope.error {
        return Err(MetaAuthError::UnexpectedResponse(format!(
            "meta error code={} type={} message={}",
            err.code, err.err_type, err.message
        ))
        .into());
    }

    let data = envelope.data.ok_or_else(|| {
        MetaAuthError::UnexpectedResponse("debug_token response missing `data`".to_owned())
    })?;

    let expires_at = if data.expires_at > 0 {
        DateTime::<Utc>::from_timestamp(data.expires_at, 0)
    } else {
        None
    };

    Ok(TokenIntrospection {
        valid: data.is_valid,
        expires_at,
        scopes: data.scopes,
    })
}

/// Build the Meta app-token string used as `access_token` in app-level Graph
/// calls (`{app_id}|{app_secret}`). Pure helper — does not touch env.
pub fn build_app_token(app_id: &str, app_secret: &str) -> String {
    format!("{app_id}|{app_secret}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_token_format() {
        assert_eq!(build_app_token("123", "abc"), "123|abc");
    }
}
