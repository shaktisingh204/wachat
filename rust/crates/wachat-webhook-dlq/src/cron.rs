//! Cron endpoint that drains the legacy `webhook_logs` "unprocessed" backlog.
//!
//! ## Background
//!
//! In the original Next.js stack, `src/app/api/cron/process-webhooks/route.ts`
//! ran on a schedule and acted as a *safety net*: every now and then it scanned
//! `webhook_logs` for documents that had `processed: false`, then bulk-marked
//! them as processed (with `error: 'marked_by_cleanup_cron'`) since the real
//! processing happens inline via `after()` in the receiver path.
//!
//! This module is the Rust port of that cron. It is intentionally a *cleanup*
//! sweep — it does **not** attempt to replay the payload through the dispatcher
//! (which is the job of a future DLQ-consumer slice). That keeps the surface
//! small, idempotent, and side-effect-light.
//!
//! ## Auth
//!
//! No tenant gate. The endpoint is authenticated by a shared `CRON_SECRET`
//! presented in either `x-cron-secret: <secret>` or
//! `Authorization: Bearer <secret>`. Comparison is constant-time so a wrong
//! secret cannot be timed-out byte-by-byte. Missing/empty `CRON_SECRET` env
//! refuses the request with `503` rather than `200`-ing on an open
//! configuration — fail closed.
//!
//! ## Route
//!
//! `POST /v1/wachat/webhook/cron/drain-dlq` — returns
//! `{ "ok": true, "pending": <n>, "modified": <n>, "message": "..." }`.

use axum::{
    Json, Router,
    extract::{FromRef, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::post,
};
use bson::{Document, doc};
use sabnode_common::ApiError;
use sabnode_db::mongo::MongoHandle;
use serde::Serialize;
use tracing::{info, warn};

use crate::WEBHOOK_LOGS_COLLECTION;

/// Path the `api` crate exposes this handler at. Mounted absolute so the
/// router can be merged at the root rather than nested under a tenant scope.
pub const DRAIN_DLQ_PATH: &str = "/v1/wachat/webhook/cron/drain-dlq";

/// Env var holding the shared cron secret. Vercel cron jobs send it as
/// `Authorization: Bearer $CRON_SECRET`; we additionally accept the explicit
/// `x-cron-secret` header so internal callers (the Next.js proxy, ops scripts)
/// can use a less-overloaded slot.
const CRON_SECRET_ENV: &str = "CRON_SECRET";

/// Response envelope for the drain handler. Mirrors the legacy TS shape so a
/// thin Next.js proxy can forward it byte-for-byte.
#[derive(Debug, Serialize)]
pub struct DrainResp {
    pub ok: bool,
    pub pending: u64,
    pub modified: u64,
    pub message: String,
}

/// Build a router for the cron drain endpoint.
///
/// `S` only needs to expose [`MongoHandle`] via [`FromRef`] — auth is checked
/// against the process env, so no extra state plumbing is required.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
{
    Router::new().route(DRAIN_DLQ_PATH, post(drain_dlq))
}

/// `POST /v1/wachat/webhook/cron/drain-dlq`
///
/// Counts `webhook_logs` with `processed: false`, marks them processed with a
/// sentinel `error: "marked_by_cleanup_cron"`, and returns the counts. Returns
/// `200 OK` even when `pending == 0` so the caller can treat any 2xx as
/// success.
async fn drain_dlq(
    State(mongo): State<MongoHandle>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    check_cron_secret(&headers)?;

    let coll = mongo.collection::<Document>(WEBHOOK_LOGS_COLLECTION);

    let filter = doc! { "processed": false };

    let pending = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    if pending == 0 {
        return Ok((
            StatusCode::OK,
            Json(DrainResp {
                ok: true,
                pending: 0,
                modified: 0,
                message: "No unprocessed webhooks.".to_owned(),
            }),
        )
            .into_response());
    }

    let update = doc! {
        "$set": {
            "processed": true,
            "error": "marked_by_cleanup_cron",
        }
    };

    let result = coll
        .update_many(filter, update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    info!(
        pending,
        modified = result.modified_count,
        "drained webhook_logs cleanup cron",
    );

    Ok((
        StatusCode::OK,
        Json(DrainResp {
            ok: true,
            pending,
            modified: result.modified_count,
            message: format!("Cleaned up {} stale webhook logs.", result.modified_count),
        }),
    )
        .into_response())
}

/// Extract the cron secret from either `x-cron-secret` or
/// `Authorization: Bearer …`, then constant-time compare against the env.
///
/// Failure modes:
///   * `CRON_SECRET` env is unset / empty → `503` (fail closed; never accept).
///   * Header missing → `401`.
///   * Header present but wrong → `401`.
fn check_cron_secret(headers: &HeaderMap) -> Result<(), ApiError> {
    let configured = std::env::var(CRON_SECRET_ENV).unwrap_or_default();
    if configured.is_empty() {
        warn!("{CRON_SECRET_ENV} unset; refusing to authorize cron drain request");
        // Use Internal rather than Unauthorized so the 5xx flags an ops issue
        // (env not configured) distinct from a 4xx client mistake.
        return Err(ApiError::Internal(anyhow::anyhow!(
            "{CRON_SECRET_ENV} not configured"
        )));
    }

    let presented = headers
        .get("x-cron-secret")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_owned())
        .or_else(|| {
            headers
                .get(axum::http::header::AUTHORIZATION)
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.strip_prefix("Bearer "))
                .map(|s| s.to_owned())
        });

    let Some(presented) = presented else {
        return Err(ApiError::Unauthorized("missing cron secret".to_owned()));
    };

    if !constant_time_eq(presented.as_bytes(), configured.as_bytes()) {
        return Err(ApiError::Unauthorized("invalid cron secret".to_owned()));
    }

    Ok(())
}

/// Constant-time byte comparison so a wrong secret cannot be timed out
/// byte-by-byte.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn constant_time_eq_matches_only_identical_strings() {
        assert!(constant_time_eq(b"abc", b"abc"));
        assert!(!constant_time_eq(b"abc", b"abd"));
        assert!(!constant_time_eq(b"abc", b"ab"));
    }

    #[test]
    fn check_cron_secret_rejects_when_env_missing() {
        // SAFETY: env mutation in tests; no other test in this module reads
        // CRON_SECRET concurrently because the secret-check tests are guarded
        // behind a single-threaded ignore in CI. For unit purposes, just
        // remove and assert — set later tests restore explicitly.
        unsafe {
            std::env::remove_var(CRON_SECRET_ENV);
        }
        let headers = HeaderMap::new();
        assert!(check_cron_secret(&headers).is_err());
    }

    #[test]
    fn check_cron_secret_accepts_x_cron_secret_header() {
        unsafe {
            std::env::set_var(CRON_SECRET_ENV, "topsecret");
        }
        let mut headers = HeaderMap::new();
        headers.insert("x-cron-secret", HeaderValue::from_static("topsecret"));
        assert!(check_cron_secret(&headers).is_ok());
        unsafe {
            std::env::remove_var(CRON_SECRET_ENV);
        }
    }

    #[test]
    fn check_cron_secret_accepts_bearer_authorization() {
        unsafe {
            std::env::set_var(CRON_SECRET_ENV, "topsecret");
        }
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_static("Bearer topsecret"),
        );
        assert!(check_cron_secret(&headers).is_ok());
        unsafe {
            std::env::remove_var(CRON_SECRET_ENV);
        }
    }

    #[test]
    fn check_cron_secret_rejects_wrong_secret() {
        unsafe {
            std::env::set_var(CRON_SECRET_ENV, "topsecret");
        }
        let mut headers = HeaderMap::new();
        headers.insert("x-cron-secret", HeaderValue::from_static("nope"));
        let err = check_cron_secret(&headers).unwrap_err();
        assert!(matches!(err, ApiError::Unauthorized(_)));
        unsafe {
            std::env::remove_var(CRON_SECRET_ENV);
        }
    }
}
