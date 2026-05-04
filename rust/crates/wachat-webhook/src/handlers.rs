//! HTTP handlers for the Meta webhook routes.
//!
//! Two handlers, one path:
//!
//! * [`verify_challenge`] — `GET /v1/wachat/webhook/meta`. Plain-text
//!   handshake response per Meta's webhook subscription protocol.
//! * [`receive`] — `POST /v1/wachat/webhook/meta`. Signature-verified by the
//!   [`wachat_webhook_verify::VerifiedBody`] extractor before this function
//!   is even called; the handler then parses, looks up the `Project`, and
//!   fans out to per-entry/per-change processors concurrently.
//!
//! Both handlers return `200 OK` to Meta on the happy path. The POST handler
//! returns 200 even when *processor* errors fire — that work is sent to DLQ
//! and the receiver acknowledges so Meta does not retry. Only signature and
//! parse failures (already-rejected by the extractor) become 4xx.

use std::env;

use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use bson::doc;
use bytes::Bytes;
use futures::future::join_all;
use serde_json::json;
use tracing::{trace, warn};

use sabnode_common::ApiError;
use wachat_meta_dto::{Entry, WebhookEvent};
use wachat_types::Project;
use wachat_webhook_verify::VerifiedBody;

use crate::{
    dispatcher::dispatch_change, dto::VerifyQuery, error::WebhookError, state::WebhookState,
};

/// Mongo collection that stores `Project` documents. Mirrors the TS receiver's
/// `db.collection<Project>('projects')` lookup.
const PROJECTS_COLLECTION: &str = "projects";

/// Env var holding the Meta verify token. The TS receiver checks
/// `META_VERIFY_TOKEN`; we accept `WHATSAPP_VERIFY_TOKEN` first (the slice
/// spec's preferred name) and fall back to `META_VERIFY_TOKEN` to keep
/// existing deployments working unchanged during the cutover.
const VERIFY_TOKEN_ENV_PRIMARY: &str = "WHATSAPP_VERIFY_TOKEN";
const VERIFY_TOKEN_ENV_FALLBACK: &str = "META_VERIFY_TOKEN";

/// Handle Meta's `GET` webhook verification handshake.
///
/// Per Meta:
/// * if `hub.mode == "subscribe"` and `hub.verify_token` matches the
///   server-side secret, echo `hub.challenge` back as **plain text** with
///   `200 OK`.
/// * otherwise return `403 Forbidden`.
///
/// We mirror that exactly.
pub async fn verify_challenge(Query(q): Query<VerifyQuery>) -> Response {
    let configured = env::var(VERIFY_TOKEN_ENV_PRIMARY)
        .or_else(|_| env::var(VERIFY_TOKEN_ENV_FALLBACK))
        .ok();

    let Some(expected) = configured else {
        warn!(
            "neither {VERIFY_TOKEN_ENV_PRIMARY} nor {VERIFY_TOKEN_ENV_FALLBACK} set; \
             refusing to complete Meta verification handshake"
        );
        return (StatusCode::FORBIDDEN, "Forbidden").into_response();
    };

    if q.hub_mode == "subscribe" && constant_time_eq(q.hub_verify_token.as_bytes(), expected.as_bytes())
    {
        trace!("Meta verification handshake succeeded");
        // Plain-text body. Meta is strict — must echo the challenge verbatim
        // with no JSON wrapping or extra whitespace.
        (StatusCode::OK, q.hub_challenge).into_response()
    } else {
        warn!(
            mode = %q.hub_mode,
            "Meta verification handshake rejected (bad mode or token)"
        );
        (StatusCode::FORBIDDEN, "Forbidden").into_response()
    }
}

/// Handle a Meta webhook POST.
///
/// `VerifiedBody` already enforces signature correctness — by the time this
/// runs, `body` is the raw, signature-verified payload. We:
///
/// 1. Parse it as `WebhookEvent`. Parse failure → 400 (Meta will not retry).
/// 2. For each `entry[]`, look up the `Project` by `entry.id` (WABA id).
///    Missing projects are logged and DLQ'd, never 4xx'd back to Meta.
/// 3. For each `change` in each entry, dispatch concurrently via
///    `futures::join_all`. Within a single change, ordering is preserved
///    by [`dispatch_change`].
/// 4. Always return `200 OK` to Meta once parsing succeeded.
pub async fn receive(
    State(state): State<WebhookState>,
    VerifiedBody(body): VerifiedBody,
) -> Result<Response, ApiError> {
    // Step 1 — parse. We work from the raw `Bytes` (`from_slice`) so the
    // signed material and the deserialized payload share an identical byte
    // sequence, which matters if a sibling crate ever wants to re-verify.
    let event: WebhookEvent = match serde_json::from_slice::<WebhookEvent>(&body) {
        Ok(ev) => ev,
        Err(err) => {
            warn!(error = %err, "failed to parse webhook payload");
            // Per Meta retry semantics, 400 is logged but not retried. Safe.
            return Err(WebhookError::from(err).into());
        }
    };

    // NOTE: We deliberately **do not** log the parsed event at info/debug.
    // Per slice constraints, raw payloads (and especially message bodies,
    // which may include media URLs, PII, or end-user content) only get
    // emitted at TRACE level. The body of a media message is never logged.
    trace!(
        object = %event.object,
        entries = event.entry.len(),
        "received parsed webhook event"
    );

    // Step 2 + 3 — fan out across entries. Each entry yields its own future
    // that resolves a Project (possibly None) and then dispatches its
    // changes concurrently. We `join_all` across entries so a single slow
    // processor does not stall the rest of the payload.
    let entry_futs = event
        .entry
        .iter()
        .map(|entry| process_entry(&state, entry, &body));

    join_all(entry_futs).await;

    // Step 4 — always 200 once parse + signature succeeded.
    // Meta requires a 2xx within ~20s or it will retry the delivery
    // (with exponential backoff up to several days). Returning anything
    // else here on a transient internal failure would amplify the issue.
    Ok((StatusCode::OK, Json(json!({ "ok": true }))).into_response())
}

/// Process all `Change` items for one `Entry`. Looks up the project,
/// then dispatches each change concurrently.
async fn process_entry(state: &WebhookState, entry: &Entry, raw_payload: &Bytes) {
    let project = match lookup_project_by_waba_id(state, &entry.id).await {
        Ok(Some(p)) => p,
        Ok(None) => {
            // Mirrors TS behavior: an unknown WABA id is logged and the
            // payload is preserved in the DLQ for manual triage.
            warn!(
                waba_id = %entry.id,
                "no project found for incoming webhook entry; sinking to DLQ"
            );
            if let Err(err) = state
                .dlq
                .send_to_dlq(raw_payload.clone(), "project_not_found")
                .await
            {
                tracing::error!(error = %err, "DLQ write failed for unknown project");
            }
            return;
        }
        Err(err) => {
            // Mongo failure: log + DLQ, but never 5xx Meta.
            warn!(
                error = %err,
                waba_id = %entry.id,
                "project lookup failed; sinking to DLQ"
            );
            if let Err(err) = state
                .dlq
                .send_to_dlq(raw_payload.clone(), "project_lookup_error")
                .await
            {
                tracing::error!(error = %err, "DLQ write failed for project_lookup_error");
            }
            return;
        }
    };

    // Fan out across changes within an entry. Within a single change, the
    // dispatcher preserves causality (inbound → contacts → conversations,
    // status → conversations) so ordering between processors of the SAME
    // change.value is intact.
    let change_futs = entry
        .changes
        .iter()
        .map(|change| dispatch_change(state, &project, change, raw_payload));

    // We discard the per-change `Result` because the dispatcher already
    // catches every processor error and routes to DLQ — see its docstring.
    let _ = join_all(change_futs).await;
}

/// Look up a `Project` by Meta WABA id (`entry.id`).
///
/// The TS receiver has additional fast-paths (cache, phone-number-id index,
/// page id index). Phase 2 ships the simple `wabaId` lookup; the in-process
/// LRU cache is owned by `wachat-projects` (a sibling crate) and will be
/// composed in by the binary that mounts this router.
async fn lookup_project_by_waba_id(
    state: &WebhookState,
    waba_id: &str,
) -> anyhow::Result<Option<Project>> {
    // Skip the placeholder WABA id Meta sometimes sends on test deliveries.
    // Mirrors `if (wabaId && wabaId !== '0')` in route.ts.
    if waba_id.is_empty() || waba_id == "0" {
        return Ok(None);
    }

    let coll = state.mongo.collection::<Project>(PROJECTS_COLLECTION);
    let project = coll.find_one(doc! { "wabaId": waba_id }).await?;
    Ok(project)
}

/// Constant-time equality for the verify-token comparison.
///
/// Same reasoning as `wachat-webhook-verify`: comparing a server-side secret
/// with `==` leaks via early exit. The verify-token is short and not the
/// signing secret, but the mechanic is the same — apply the same discipline.
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
