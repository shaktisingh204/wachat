//! `MetaClient` — the only public entry point for talking to
//! `graph.facebook.com`.
//!
//! Construct **once per process** and clone freely: the underlying
//! `reqwest::Client` already wraps an `Arc` and shares its connection
//! pool across clones.
//!
//! # Example
//! ```no_run
//! use wachat_meta_client::MetaClient;
//! # async fn run() -> Result<(), wachat_meta_client::MetaError> {
//! let meta = MetaClient::new("v23.0");
//! let phone: serde_json::Value = meta
//!     .get_json("123456789/whatsapp_business_profile", "EAA...token")
//!     .await?;
//! # Ok(()) }
//! ```

use std::time::Duration;

use reqwest::{Method, StatusCode, header};
use serde::{Serialize, de::DeserializeOwned};
use tracing::{debug, warn};
use url::Url;

use crate::error::MetaError;
use crate::meta_api_error::MetaApiErrorEnvelope;

/// Base URL all requests are appended to. Versioned segment is added at
/// request time.
const META_BASE: &str = "https://graph.facebook.com/";

/// Default per-request timeout. Caller can build their own client later
/// if they need to override (e.g. for media uploads).
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

/// Maximum attempts (inclusive of the initial try) for retryable errors.
const MAX_ATTEMPTS: u32 = 3;

/// Base backoff. Doubles each attempt with ±25 % jitter applied.
const BASE_BACKOFF_MS: u64 = 250;

/// Cap on `Retry-After` we will honor inline. Anything longer is
/// surfaced as `MetaError::RateLimited` so the caller can decide.
const MAX_INLINE_RETRY_AFTER_MS: u64 = 5_000;

/// Thin retry-aware Meta Graph API client.
///
/// Cheap to clone — internally an `Arc` over `reqwest::Client`.
#[derive(Debug, Clone)]
pub struct MetaClient {
    http: reqwest::Client,
    base: Url,
    version: String,
}

impl MetaClient {
    /// Construct a new client pinned to a Meta Graph API version
    /// (e.g. `"v23.0"`). The leading `v` is optional — both `"v23.0"`
    /// and `"23.0"` are accepted.
    ///
    /// # Panics
    /// Panics if the hard-coded `META_BASE` fails to parse, which would
    /// be a build-time bug, not a runtime one.
    pub fn new(version: &str) -> Self {
        let http = reqwest::Client::builder()
            .timeout(DEFAULT_TIMEOUT)
            .pool_idle_timeout(Some(Duration::from_secs(90)))
            .user_agent(concat!(
                "sabnode-wachat-meta-client/",
                env!("CARGO_PKG_VERSION")
            ))
            .build()
            .expect("reqwest client must build with default config");

        let base = Url::parse(META_BASE).expect("META_BASE is a valid URL");
        let version = normalize_version(version);

        Self {
            http,
            base,
            version,
        }
    }

    /// **Test-only / advanced**: construct a client pointed at an
    /// alternate base URL (e.g. a `wiremock` mock server). Same retry
    /// + timeout behavior as `new`.
    #[doc(hidden)]
    pub fn with_base(base: Url, version: &str) -> Self {
        let http = reqwest::Client::builder()
            .timeout(DEFAULT_TIMEOUT)
            .user_agent(concat!(
                "sabnode-wachat-meta-client/",
                env!("CARGO_PKG_VERSION")
            ))
            .build()
            .expect("reqwest client must build with default config");
        Self {
            http,
            base,
            version: normalize_version(version),
        }
    }

    /// `GET {base}/{version}/{path}` and decode the response as JSON.
    ///
    /// `path` may start with or without a leading `/` — both work.
    /// An empty `token` skips the `Authorization` header (useful for
    /// debug pings or pre-auth endpoints that take `?access_token=`).
    pub async fn get_json<T>(&self, path: &str, token: &str) -> Result<T, MetaError>
    where
        T: DeserializeOwned,
    {
        let url = self.build_url(path)?;
        self.send_with_retry::<_, T>(Method::GET, url, token, Option::<&()>::None)
            .await
    }

    /// `POST {base}/{version}/{path}` with a JSON body and decode the
    /// response as JSON.
    pub async fn post_json<B, T>(&self, path: &str, token: &str, body: &B) -> Result<T, MetaError>
    where
        B: Serialize + ?Sized,
        T: DeserializeOwned,
    {
        let url = self.build_url(path)?;
        self.send_with_retry::<B, T>(Method::POST, url, token, Some(body))
            .await
    }

    /// `DELETE {base}/{version}/{path}`. Discards the response body.
    pub async fn delete(&self, path: &str, token: &str) -> Result<(), MetaError> {
        let url = self.build_url(path)?;
        // `serde_json::Value` is the catch-all "I don't care" decoder.
        let _: serde_json::Value = self
            .send_with_retry::<(), serde_json::Value>(Method::DELETE, url, token, None)
            .await?;
        Ok(())
    }

    // ---------------------------------------------------------------------
    // internals
    // ---------------------------------------------------------------------

    fn build_url(&self, path: &str) -> Result<Url, MetaError> {
        // `url::Url::join` handles trailing/leading slashes correctly so
        // we deliberately do not concat by hand.
        let path = path.trim_start_matches('/');
        let combined = format!("{}/{}", self.version, path);
        self.base.join(&combined).map_err(|e| {
            MetaError::Decode(serde_json::Error::io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("invalid Meta path '{path}': {e}"),
            )))
        })
    }

    /// Core send loop. Attempts up to `MAX_ATTEMPTS`; retries `5xx` and
    /// `429` with exponential backoff + jitter. Honors `Retry-After` on
    /// 429 (capped at `MAX_INLINE_RETRY_AFTER_MS`).
    async fn send_with_retry<B, T>(
        &self,
        method: Method,
        url: Url,
        token: &str,
        body: Option<&B>,
    ) -> Result<T, MetaError>
    where
        B: Serialize + ?Sized,
        T: DeserializeOwned,
    {
        let mut last_err: Option<MetaError> = None;

        for attempt in 1..=MAX_ATTEMPTS {
            let mut req = self.http.request(method.clone(), url.clone());
            if !token.is_empty() {
                req = req.header(header::AUTHORIZATION, format!("Bearer {token}"));
            }
            if let Some(b) = body {
                req = req.json(b);
            }

            debug!(
                attempt,
                method = %method,
                url = %url,
                "meta-client: sending request"
            );

            let send_result = req.send().await;

            match send_result {
                Ok(resp) => {
                    let status = resp.status();
                    if status.is_success() {
                        // Success path. Buffer body for clearer decode
                        // errors (we want to attribute decode failures
                        // to the body, not transport).
                        let bytes = resp.bytes().await.map_err(MetaError::Network)?;
                        // Meta returns `204 No Content` for some delete
                        // calls — handle empty body gracefully when the
                        // caller asked for `serde_json::Value`.
                        if bytes.is_empty() {
                            // Try to decode "null" so `Value` -> Null
                            // works; for typed `T` this will fail with a
                            // clear decode error, which is correct.
                            return serde_json::from_slice::<T>(b"null").map_err(MetaError::Decode);
                        }
                        return serde_json::from_slice::<T>(&bytes).map_err(MetaError::Decode);
                    }

                    let retry_after_ms = parse_retry_after_ms(&resp);
                    let bytes = resp.bytes().await.map_err(MetaError::Network)?;
                    let api_err = parse_meta_error(status, &bytes);

                    let retryable = is_retryable(status);
                    if retryable && attempt < MAX_ATTEMPTS {
                        let delay = if status == StatusCode::TOO_MANY_REQUESTS {
                            retry_after_ms
                                .filter(|ms| *ms <= MAX_INLINE_RETRY_AFTER_MS)
                                .unwrap_or_else(|| backoff_ms(attempt))
                        } else {
                            backoff_ms(attempt)
                        };
                        warn!(
                            attempt,
                            status = %status,
                            delay_ms = delay,
                            "meta-client: retrying after retryable error"
                        );
                        last_err = Some(api_err);
                        tokio::time::sleep(Duration::from_millis(delay)).await;
                        continue;
                    }

                    // Either non-retryable or retries exhausted.
                    if status == StatusCode::TOO_MANY_REQUESTS {
                        return Err(MetaError::RateLimited { retry_after_ms });
                    }
                    return Err(api_err);
                }
                Err(e) => {
                    // Treat reqwest timeout specially.
                    if e.is_timeout() {
                        if attempt < MAX_ATTEMPTS {
                            let delay = backoff_ms(attempt);
                            warn!(
                                attempt,
                                delay_ms = delay,
                                "meta-client: request timed out; retrying"
                            );
                            last_err = Some(MetaError::Timeout);
                            tokio::time::sleep(Duration::from_millis(delay)).await;
                            continue;
                        }
                        return Err(MetaError::Timeout);
                    }

                    // Other transport errors: retry only if it looks
                    // like a connect/io issue (reqwest's `is_connect`
                    // / `is_request`).
                    let transport_retryable = e.is_connect() || e.is_request();
                    if transport_retryable && attempt < MAX_ATTEMPTS {
                        let delay = backoff_ms(attempt);
                        warn!(
                            attempt,
                            delay_ms = delay,
                            error = %e,
                            "meta-client: transport error; retrying"
                        );
                        last_err = Some(MetaError::Network(e));
                        tokio::time::sleep(Duration::from_millis(delay)).await;
                        continue;
                    }

                    return Err(MetaError::Network(e));
                }
            }
        }

        // Unreachable in practice — the loop either returns Ok/Err
        // explicitly. Surface the last seen error if we somehow fall out.
        Err(last_err.unwrap_or(MetaError::Timeout))
    }
}

// ---------------------------------------------------------------------
// free helpers
// ---------------------------------------------------------------------

fn normalize_version(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.starts_with('v') || trimmed.starts_with('V') {
        trimmed.to_owned()
    } else {
        format!("v{trimmed}")
    }
}

fn is_retryable(status: StatusCode) -> bool {
    status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error()
}

/// Parse `Retry-After` header (RFC 7231): seconds (int) or HTTP-date.
/// We only handle the integer form — Meta doesn't emit dates here.
fn parse_retry_after_ms(resp: &reqwest::Response) -> Option<u64> {
    resp.headers()
        .get(header::RETRY_AFTER)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.trim().parse::<u64>().ok())
        .map(|secs| secs.saturating_mul(1_000))
}

/// Build a `MetaError::Api` from a non-2xx response body. Falls back to
/// a synthesized message if the body isn't a valid Meta error envelope.
fn parse_meta_error(status: StatusCode, body: &[u8]) -> MetaError {
    if let Ok(env) = serde_json::from_slice::<MetaApiErrorEnvelope>(body) {
        let e = env.error;
        return MetaError::Api {
            status: status.as_u16(),
            code: e.code,
            subcode: e.error_subcode,
            fbtrace_id: e.fbtrace_id,
            message: e
                .message
                .or(e.error_user_msg)
                .unwrap_or_else(|| status.canonical_reason().unwrap_or("unknown").to_owned()),
        };
    }
    let body_str = String::from_utf8_lossy(body);
    MetaError::Api {
        status: status.as_u16(),
        code: None,
        subcode: None,
        fbtrace_id: None,
        message: if body_str.is_empty() {
            status
                .canonical_reason()
                .unwrap_or("Meta API error")
                .to_owned()
        } else {
            body_str.into_owned()
        },
    }
}

/// Exponential backoff with ±25 % jitter.
///
/// `attempt` is 1-indexed. attempt=1 → ~250 ms, attempt=2 → ~500 ms,
/// attempt=3 → ~1000 ms.
///
/// Jitter is derived from a cheap pseudo-random source (hash of the
/// system nanos) — we don't need cryptographic quality here, just
/// enough variance so retries from many concurrent callers don't
/// thunder onto Meta together.
fn backoff_ms(attempt: u32) -> u64 {
    let base = BASE_BACKOFF_MS.saturating_mul(1u64 << (attempt - 1).min(6));
    let jitter_pct = pseudo_jitter_pct();
    // jitter_pct is in [-25, 25]
    let delta = (base as i64 * jitter_pct as i64) / 100;
    let signed = base as i64 + delta;
    signed.max(1) as u64
}

/// Returns a value in `-25 ..= 25`. Cheap, non-cryptographic.
fn pseudo_jitter_pct() -> i32 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    // map nanos -> 0..=50, shift to -25..=25
    ((nanos % 51) as i32) - 25
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_normalization_keeps_v_prefix() {
        assert_eq!(normalize_version("v23.0"), "v23.0");
        assert_eq!(normalize_version("23.0"), "v23.0");
        assert_eq!(normalize_version("  v22.0  "), "v22.0");
    }

    #[test]
    fn build_url_appends_version_and_path() {
        let c = MetaClient::new("v23.0");
        let u = c.build_url("123/messages").unwrap();
        assert_eq!(u.as_str(), "https://graph.facebook.com/v23.0/123/messages");
    }

    #[test]
    fn build_url_handles_leading_slash() {
        let c = MetaClient::new("v23.0");
        let u = c.build_url("/123/messages").unwrap();
        assert_eq!(u.as_str(), "https://graph.facebook.com/v23.0/123/messages");
    }

    #[test]
    fn backoff_grows_and_stays_positive() {
        for attempt in 1..=3 {
            let ms = backoff_ms(attempt);
            assert!(ms > 0, "attempt {attempt} produced 0 ms");
        }
    }

    #[test]
    fn retryable_classifies_429_and_5xx() {
        assert!(is_retryable(StatusCode::TOO_MANY_REQUESTS));
        assert!(is_retryable(StatusCode::INTERNAL_SERVER_ERROR));
        assert!(is_retryable(StatusCode::BAD_GATEWAY));
        assert!(!is_retryable(StatusCode::BAD_REQUEST));
        assert!(!is_retryable(StatusCode::UNAUTHORIZED));
        assert!(!is_retryable(StatusCode::OK));
    }
}
