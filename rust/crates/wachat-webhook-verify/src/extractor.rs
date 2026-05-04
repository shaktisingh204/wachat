//! Axum extractor that yields a `Bytes` body only after verifying the
//! Meta `X-Hub-Signature-256` header.
//!
//! Wire it into a router:
//!
//! ```ignore
//! use std::sync::Arc;
//! use axum::{Router, routing::post};
//! use wachat_webhook_verify::{VerifiedBody, WebhookVerifier};
//!
//! async fn webhook(VerifiedBody(body): VerifiedBody) -> &'static str {
//!     // body is the raw, signature-verified request payload. Parse it
//!     // *here* — never before the extractor has run.
//!     let _payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
//!     "ok"
//! }
//!
//! let verifier = Arc::new(WebhookVerifier::new(
//!     std::env::var("FACEBOOK_APP_SECRET").unwrap().into_bytes(),
//! ));
//! let app = Router::new()
//!     .route("/webhooks/meta", post(webhook))
//!     .with_state(verifier);
//! ```
//!
//! `Arc<WebhookVerifier>` must be reachable from the router state via
//! `FromRef`, the same pattern `sabnode-auth` uses for `AuthConfig`.

use std::sync::Arc;

use axum::{
    body::Bytes,
    extract::{FromRef, FromRequest, Request},
    http::HeaderValue,
};

use sabnode_common::ApiError;

use crate::{error::VerifyError, verifier::WebhookVerifier};

/// Header Meta sends the HMAC-SHA256 digest in. Lowercase to match
/// axum's case-insensitive header storage and the Node receiver's
/// `request.headers.get('x-hub-signature-256')` call.
const SIGNATURE_HEADER: &str = "x-hub-signature-256";

/// Raw, signature-verified webhook body.
///
/// The wrapped `Bytes` is exactly what Meta posted — handlers should
/// deserialize from this and never re-read the body from the request.
#[derive(Debug, Clone)]
pub struct VerifiedBody(pub Bytes);

impl<S> FromRequest<S> for VerifiedBody
where
    S: Send + Sync,
    Arc<WebhookVerifier>: FromRef<S>,
{
    // Reject straight into the standard JSON error envelope.
    type Rejection = ApiError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let verifier: Arc<WebhookVerifier> = Arc::<WebhookVerifier>::from_ref(state);

        // Pull the signature header BEFORE consuming the body — we need
        // both, and `Bytes::from_request` consumes the request.
        let sig: Option<HeaderValue> = req.headers().get(SIGNATURE_HEADER).cloned();

        // Read raw body first. `Bytes::from_request` is the canonical
        // axum way to get a raw body slice; it also enforces the
        // request body size limit configured on the router.
        let body = Bytes::from_request(req, state).await.map_err(|err| {
            tracing::warn!(error = %err, "failed to read webhook body");
            ApiError::BadRequest("failed to read webhook body".to_owned())
        })?;

        let sig = sig.ok_or_else(|| {
            tracing::warn!("webhook rejected: missing X-Hub-Signature-256");
            ApiError::from(VerifyError::MissingHeader)
        })?;

        // Header values are bytes. Reject anything non-ASCII before
        // touching it as a `&str`.
        let sig_str = sig.to_str().map_err(|_| {
            tracing::warn!("webhook rejected: non-ASCII signature header");
            ApiError::from(VerifyError::BadFormat)
        })?;

        verifier.verify(sig_str, &body).map_err(|err| {
            tracing::warn!(error = %err, "webhook rejected: signature verification failed");
            ApiError::from(err)
        })?;

        Ok(VerifiedBody(body))
    }
}
