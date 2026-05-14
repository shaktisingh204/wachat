//! Long-running webhook dispatcher.
//!
//! Two cooperating loops, both driven by a single `run()` future:
//!
//! 1. **Live fan-out** — PSUBSCRIBEs `sabwa:*:events` on Redis. For every
//!    [`SabwaEvent`] that comes through, we resolve the originating
//!    `projectId` (via the session's row in `sabwa_sessions`), load the
//!    project's [`SabwaWebhook`] list (60-second LRU cache) and POST the
//!    event to each subscriber whose `events` filter matches.
//!
//! 2. **Retry sweeper** — every 10 s, polls the Redis sorted-set
//!    `sabwa:webhooks:retry` for entries whose score (a Unix-seconds
//!    next-run timestamp) is due, and reissues those deliveries.
//!
//! On any non-2xx response or transport error we:
//! - persist a [`DeliveryAttempt`] document to `sabwa_webhook_deliveries`,
//! - look up the next backoff via
//!   [`delivery::next_retry_delay`](super::delivery::next_retry_delay), and
//! - if the policy still allows it, `ZADD` the job back onto the retry set.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::Context;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use mongodb::bson::{doc, oid::ObjectId};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use crate::realtime::events::SabwaEvent;
use crate::state::AppState;

use super::delivery::{self, deliver, DeliveryAttempt};

/// Redis pattern matching every per-session event channel.
///
/// Matches the convention coined in `realtime::events::channel`:
/// `sabwa:{sessionId}:events`.
const EVENT_CHANNEL_PATTERN: &str = "sabwa:*:events";

/// Redis sorted-set key used to schedule retries. Score = Unix-seconds
/// timestamp at which the job becomes due; member = JSON-encoded
/// [`RetryJob`].
pub const RETRY_ZSET: &str = "sabwa:webhooks:retry";

/// How often the inner loop sweeps the retry zset.
const RETRY_TICK: Duration = Duration::from_secs(10);

/// How long a per-project webhook list is cached for. Trades a tight
/// freshness window against hammering Mongo on every published event.
const WEBHOOK_CACHE_TTL: Duration = Duration::from_secs(60);

/// `sabwa_webhooks` Mongo collection name (mirrors
/// `src/lib/sabwa/constants.ts`).
const WEBHOOKS_COLLECTION: &str = "sabwa_webhooks";

// ─────────────────────────────────────────────────────────────────────────
//   Local mirror of the `sabwa_webhooks` document.
//
//   We intentionally keep this local instead of pulling it from
//   `crate::db::misc` — that module is still a scaffold placeholder, and
//   per the task brief we MUST NOT modify other modules.
// ─────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SabwaWebhookDoc {
    #[serde(rename = "_id")]
    id: ObjectId,
    project_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    session_id: Option<ObjectId>,
    url: String,
    events: Vec<String>,
    signing_secret: String,
    #[serde(default = "default_true")]
    enabled: bool,
    #[serde(default)]
    failure_count: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    last_delivery_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    last_delivery_status: Option<i32>,
}

fn default_true() -> bool {
    true
}

/// A job recorded in the retry sorted-set.
///
/// Re-deserialised by the retry sweeper when its score becomes due.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct RetryJob {
    webhook_id: String,
    url: String,
    /// Shared secret captured at first-attempt time. Using the snapshot
    /// keeps retries valid even if the operator rotates the secret in the
    /// meantime — fresher copies will be picked up on subsequent live
    /// fan-outs anyway.
    secret: String,
    event_id: String,
    body: serde_json::Value,
    /// Attempt counter of the *previous* (failed) attempt.  The retry
    /// itself will be `attempt_n + 1`.
    attempt_n: u32,
}

/// Per-project cache entry.
#[derive(Clone)]
struct CacheEntry {
    fetched_at: Instant,
    hooks: Vec<SabwaWebhookDoc>,
}

type WebhookCache = Arc<RwLock<HashMap<ObjectId, CacheEntry>>>;

/// Background task that bridges the realtime Redis fan-out to outbound
/// subscriber URLs.
///
/// A `Dispatcher` owns:
/// - a [`reqwest::Client`] with HTTP keepalive, reused across all deliveries;
/// - a 60-second in-memory cache of `sabwa_webhooks` rows keyed by project;
/// - shared [`AppState`] for Mongo + Redis access.
///
/// Cloning is intentionally not implemented — there's exactly one of these
/// per process, spawned from `main.rs`.
pub struct Dispatcher {
    state: AppState,
    http: reqwest::Client,
    cache: WebhookCache,
}

impl Dispatcher {
    /// Construct a new dispatcher.  Does **not** start any background work —
    /// the caller spawns [`Self::run`] when ready.
    pub fn new(state: AppState) -> Self {
        // Same per-attempt timeout as the standalone `deliver()` helper, so
        // a slow receiver can't stall the whole loop.
        let http = reqwest::Client::builder()
            .timeout(delivery::REQUEST_TIMEOUT)
            .user_agent(concat!("sabwa-engine/", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("reqwest client build");

        Self {
            state,
            http,
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Run both the live-event subscriber and the retry sweeper until one
    /// of them returns (which only happens on a fatal error). Errors from
    /// the retry sweeper are logged and the loop restarts — only an error
    /// from the subscriber breaks out, since without a subscription we
    /// have nothing useful to do.
    pub async fn run(self) -> anyhow::Result<()> {
        tracing::info!(
            target: "sabwa::webhooks::dispatcher",
            pattern = EVENT_CHANNEL_PATTERN,
            "starting webhook dispatcher"
        );

        let Self { state, http, cache } = self;

        let live = tokio::spawn(run_live_subscriber(
            state.clone(),
            http.clone(),
            cache.clone(),
        ));
        let retry = tokio::spawn(run_retry_sweeper(state, http));

        // `tokio::select!` cancels the other branch as soon as one returns —
        // that's the right behaviour for our "either crashes ⇒ supervisor
        // restarts the whole task" model.
        tokio::select! {
            res = live => {
                match res {
                    Ok(inner) => inner,
                    Err(join) => Err(anyhow::anyhow!("live subscriber task panicked: {join}")),
                }
            }
            res = retry => {
                match res {
                    Ok(inner) => inner,
                    Err(join) => Err(anyhow::anyhow!("retry sweeper task panicked: {join}")),
                }
            }
        }
    }
}

/// Free-function shorthand used from `main.rs`.
///
/// Equivalent to `Dispatcher::new(state).run().await`.
pub async fn run(state: AppState) -> anyhow::Result<()> {
    Dispatcher::new(state).run().await
}

// ─────────────────────────────────────────────────────────────────────────
//   Live fan-out (PSUBSCRIBE sabwa:*:events)
// ─────────────────────────────────────────────────────────────────────────

async fn run_live_subscriber(
    state: AppState,
    http: reqwest::Client,
    cache: WebhookCache,
) -> anyhow::Result<()> {
    let mut pubsub = state
        .redis
        .get_async_pubsub()
        .await
        .context("opening Redis pub/sub for webhook dispatcher")?;
    pubsub
        .psubscribe(EVENT_CHANNEL_PATTERN)
        .await
        .with_context(|| format!("PSUBSCRIBE {EVENT_CHANNEL_PATTERN}"))?;

    let mut messages = pubsub.into_on_message();
    while let Some(msg) = messages.next().await {
        let channel: String = msg.get_channel_name().to_owned();
        let payload: Vec<u8> = match msg.get_payload() {
            Ok(p) => p,
            Err(err) => {
                tracing::warn!(
                    target: "sabwa::webhooks::dispatcher",
                    channel = %channel,
                    error = %err,
                    "dropping malformed pub/sub payload"
                );
                continue;
            }
        };

        let Some(session_id) = parse_session_id(&channel) else {
            tracing::warn!(
                target: "sabwa::webhooks::dispatcher",
                channel = %channel,
                "channel name didn't match sabwa:<id>:events"
            );
            continue;
        };

        let event: SabwaEvent = match serde_json::from_slice(&payload) {
            Ok(ev) => ev,
            Err(err) => {
                tracing::warn!(
                    target: "sabwa::webhooks::dispatcher",
                    channel = %channel,
                    error = %err,
                    "dropping un-parseable SabwaEvent"
                );
                continue;
            }
        };

        // Off-load actual dispatch so a single slow Mongo/HTTP call cannot
        // back the pub/sub stream up.
        let state = state.clone();
        let http = http.clone();
        let cache = cache.clone();
        let payload_bytes = payload;
        tokio::spawn(async move {
            if let Err(err) =
                handle_event(&state, &http, &cache, &session_id, &event, &payload_bytes).await
            {
                tracing::warn!(
                    target: "sabwa::webhooks::dispatcher",
                    session_id = %session_id,
                    error = %err,
                    "failed to dispatch event to webhooks"
                );
            }
        });
    }

    Err(anyhow::anyhow!("redis pub/sub stream ended unexpectedly"))
}

/// Strip the `sabwa:` prefix and `:events` suffix off a channel name and
/// return the middle session-id segment.
fn parse_session_id(channel: &str) -> Option<String> {
    let rest = channel.strip_prefix("sabwa:")?;
    let id = rest.strip_suffix(":events")?;
    if id.is_empty() {
        None
    } else {
        Some(id.to_owned())
    }
}

/// Dispatch one event to every matching webhook.
async fn handle_event(
    state: &AppState,
    http: &reqwest::Client,
    cache: &WebhookCache,
    session_id: &str,
    event: &SabwaEvent,
    raw_payload: &[u8],
) -> anyhow::Result<()> {
    // 1. Resolve the originating projectId via the session row.
    let session_oid = match ObjectId::parse_str(session_id) {
        Ok(oid) => oid,
        Err(_) => {
            tracing::debug!(
                target: "sabwa::webhooks::dispatcher",
                session_id,
                "session id is not a valid ObjectId; skipping"
            );
            return Ok(());
        }
    };

    let sessions = state.db.collection::<mongodb::bson::Document>("sabwa_sessions");
    let session_doc = sessions
        .find_one(doc! { "_id": &session_oid })
        .projection(doc! { "projectId": 1 })
        .await
        .context("looking up sabwa_sessions for project resolution")?;

    let Some(project_id) = session_doc.and_then(|d| d.get_object_id("projectId").ok()) else {
        tracing::debug!(
            target: "sabwa::webhooks::dispatcher",
            session_id,
            "no session row / projectId; nothing to dispatch"
        );
        return Ok(());
    };

    // 2. Load (or hit cache for) the project's webhook subscriptions.
    let hooks = load_webhooks(state, cache, &project_id).await?;
    if hooks.is_empty() {
        return Ok(());
    }

    // 3. Filter by event-type and (optional) session pin.
    let event_type = event_type_str(event);
    let event_id = uuid::Uuid::new_v4().to_string();
    let body: serde_json::Value = serde_json::from_slice(raw_payload)
        .unwrap_or_else(|_| serde_json::json!({ "raw": String::from_utf8_lossy(raw_payload) }));

    for hook in hooks {
        if !hook.enabled {
            continue;
        }
        if !hook.events.iter().any(|e| e == event_type) {
            continue;
        }
        if let Some(pinned) = &hook.session_id {
            if *pinned != session_oid {
                continue;
            }
        }

        let state = state.clone();
        let http = http.clone();
        let event_id = event_id.clone();
        let body = body.clone();
        tokio::spawn(async move {
            dispatch_one(&state, &http, &hook, &event_id, &body, 1).await;
        });
    }

    Ok(())
}

/// Map a [`SabwaEvent`] variant to the wire-format event type string used by
/// `sabwa_webhooks.events` (see `SABWA_PLAN.md` §12).
fn event_type_str(ev: &SabwaEvent) -> &'static str {
    match ev {
        SabwaEvent::Message(m) if m.message.from_me => "message.sent",
        SabwaEvent::Message(_) => "message.received",
        SabwaEvent::MessageStatus(_) => "message.status",
        SabwaEvent::Chat(_) => "chat.updated",
        SabwaEvent::Presence(_) | SabwaEvent::Typing(_) => "presence.updated",
        SabwaEvent::Qr(_) => "session.qr",
        SabwaEvent::PairCode(_) => "session.pair_code",
        SabwaEvent::Status(s) => match s.status.as_str() {
            "connected" => "session.connected",
            "logged_out" | "disconnected" => "session.disconnected",
            _ => "session.status",
        },
    }
}

/// Cached lookup of every webhook configured for `project_id`.
async fn load_webhooks(
    state: &AppState,
    cache: &WebhookCache,
    project_id: &ObjectId,
) -> anyhow::Result<Vec<SabwaWebhookDoc>> {
    {
        let guard = cache.read().await;
        if let Some(entry) = guard.get(project_id) {
            if entry.fetched_at.elapsed() < WEBHOOK_CACHE_TTL {
                return Ok(entry.hooks.clone());
            }
        }
    }

    let col = state
        .db
        .collection::<SabwaWebhookDoc>(WEBHOOKS_COLLECTION);
    let cursor = col
        .find(doc! { "projectId": project_id, "enabled": true })
        .await
        .context("sabwa_webhooks.find")?;
    let hooks: Vec<SabwaWebhookDoc> = futures::TryStreamExt::try_collect(cursor)
        .await
        .context("collecting sabwa_webhooks")?;

    let mut guard = cache.write().await;
    guard.insert(
        project_id.clone(),
        CacheEntry {
            fetched_at: Instant::now(),
            hooks: hooks.clone(),
        },
    );
    Ok(hooks)
}

/// Perform one delivery attempt and persist a [`DeliveryAttempt`] record;
/// on failure, schedule a retry per [`delivery::next_retry_delay`].
async fn dispatch_one(
    state: &AppState,
    http: &reqwest::Client,
    hook: &SabwaWebhookDoc,
    event_id: &str,
    body: &serde_json::Value,
    attempt_n: u32,
) {
    let mut record =
        DeliveryAttempt::new(hook.id.to_hex(), event_id.to_owned(), hook.url.clone(), attempt_n);

    let outcome = deliver(http, &hook.url, &hook.signing_secret, event_id, body).await;
    let ok = match outcome {
        Ok(code) => {
            record.status_code = code;
            (200..300).contains(&code)
        }
        Err(err) => {
            record.error = Some(format!("{err:#}"));
            tracing::warn!(
                target: "sabwa::webhooks::dispatcher",
                url = %hook.url,
                attempt_n,
                error = %err,
                "webhook POST failed"
            );
            false
        }
    };

    // Best-effort: never bubble a Mongo write error up past this point —
    // the delivery already happened (or failed), losing the audit row is
    // strictly less bad than crashing the dispatcher.
    if let Err(err) = persist_attempt(state, &record).await {
        tracing::warn!(
            target: "sabwa::webhooks::dispatcher",
            error = %err,
            "persisting DeliveryAttempt failed"
        );
    }

    if ok {
        return;
    }

    if let Some(delay) = delivery::next_retry_delay(attempt_n) {
        let due_at = Utc::now().timestamp() + delay.as_secs() as i64;
        let job = RetryJob {
            webhook_id: hook.id.to_hex(),
            url: hook.url.clone(),
            secret: hook.signing_secret.clone(),
            event_id: event_id.to_owned(),
            body: body.clone(),
            attempt_n,
        };
        if let Err(err) = enqueue_retry(state, &job, due_at).await {
            tracing::warn!(
                target: "sabwa::webhooks::dispatcher",
                error = %err,
                "failed to enqueue webhook retry"
            );
        }
    } else {
        tracing::warn!(
            target: "sabwa::webhooks::dispatcher",
            webhook_id = %hook.id,
            url = %hook.url,
            attempt_n,
            "webhook exhausted retry policy; giving up"
        );
    }
}

async fn persist_attempt(state: &AppState, record: &DeliveryAttempt) -> anyhow::Result<()> {
    let col = state
        .db
        .collection::<DeliveryAttempt>(delivery::COLLECTION);
    col.insert_one(record)
        .await
        .context("sabwa_webhook_deliveries.insert")?;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────
//   Retry sweeper (poll ZRANGEBYSCORE every 10s)
// ─────────────────────────────────────────────────────────────────────────

async fn enqueue_retry(state: &AppState, job: &RetryJob, due_at: i64) -> anyhow::Result<()> {
    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .context("opening Redis connection for ZADD")?;
    let member = serde_json::to_string(job).context("serialising RetryJob")?;
    let _: i64 = conn
        .zadd(RETRY_ZSET, member, due_at)
        .await
        .with_context(|| format!("ZADD {RETRY_ZSET}"))?;
    tracing::debug!(
        target: "sabwa::webhooks::dispatcher",
        webhook_id = %job.webhook_id,
        attempt_n = job.attempt_n,
        due_at,
        "scheduled webhook retry"
    );
    Ok(())
}

async fn run_retry_sweeper(state: AppState, http: reqwest::Client) -> anyhow::Result<()> {
    let mut ticker = tokio::time::interval(RETRY_TICK);
    // `Delay` semantics so the first tick fires after one interval, giving
    // the live subscriber a moment to come up first.
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        ticker.tick().await;
        if let Err(err) = sweep_once(&state, &http).await {
            tracing::warn!(
                target: "sabwa::webhooks::dispatcher",
                error = %err,
                "retry sweep failed; will try again next tick"
            );
        }
    }
}

async fn sweep_once(state: &AppState, http: &reqwest::Client) -> anyhow::Result<()> {
    let now = Utc::now().timestamp();

    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .context("opening Redis connection for retry sweep")?;

    // Pull due members (score ≤ now). We cap at 100 per tick so a giant
    // backlog can't monopolise one sweep — anything left will be picked
    // up on the next tick.
    let due: Vec<String> = conn
        .zrangebyscore_limit(RETRY_ZSET, 0_i64, now, 0, 100)
        .await
        .with_context(|| format!("ZRANGEBYSCORE {RETRY_ZSET}"))?;

    if due.is_empty() {
        return Ok(());
    }

    tracing::debug!(
        target: "sabwa::webhooks::dispatcher",
        count = due.len(),
        "draining due webhook retries"
    );

    for raw in due {
        // Remove first — if redelivery fails we'll ZADD a fresh entry with
        // the next-step delay; this prevents two parallel sweeps from
        // double-firing the same retry.
        let _: i64 = conn
            .zrem(RETRY_ZSET, &raw)
            .await
            .with_context(|| format!("ZREM {RETRY_ZSET}"))?;

        let job: RetryJob = match serde_json::from_str(&raw) {
            Ok(j) => j,
            Err(err) => {
                tracing::warn!(
                    target: "sabwa::webhooks::dispatcher",
                    error = %err,
                    "dropping un-parseable retry job"
                );
                continue;
            }
        };

        let next_attempt = job.attempt_n + 1;
        let state = state.clone();
        let http = http.clone();
        tokio::spawn(async move {
            redispatch(&state, &http, job, next_attempt).await;
        });
    }

    Ok(())
}

/// Re-issue a previously-failed delivery, persist a fresh attempt record,
/// and schedule the next retry (if the policy still allows it).
async fn redispatch(state: &AppState, http: &reqwest::Client, job: RetryJob, attempt_n: u32) {
    let mut record = DeliveryAttempt::new(
        job.webhook_id.clone(),
        job.event_id.clone(),
        job.url.clone(),
        attempt_n,
    );

    let outcome = deliver(http, &job.url, &job.secret, &job.event_id, &job.body).await;
    let ok = match outcome {
        Ok(code) => {
            record.status_code = code;
            (200..300).contains(&code)
        }
        Err(err) => {
            record.error = Some(format!("{err:#}"));
            tracing::warn!(
                target: "sabwa::webhooks::dispatcher",
                webhook_id = %job.webhook_id,
                attempt_n,
                error = %err,
                "webhook retry failed"
            );
            false
        }
    };

    if let Err(err) = persist_attempt(state, &record).await {
        tracing::warn!(
            target: "sabwa::webhooks::dispatcher",
            error = %err,
            "persisting retry DeliveryAttempt failed"
        );
    }

    if ok {
        tracing::info!(
            target: "sabwa::webhooks::dispatcher",
            webhook_id = %job.webhook_id,
            attempt_n,
            "webhook retry succeeded"
        );
        return;
    }

    if let Some(delay) = delivery::next_retry_delay(attempt_n) {
        let due_at = Utc::now().timestamp() + delay.as_secs() as i64;
        let next = RetryJob {
            attempt_n,
            ..job
        };
        if let Err(err) = enqueue_retry(state, &next, due_at).await {
            tracing::warn!(
                target: "sabwa::webhooks::dispatcher",
                error = %err,
                "failed to re-enqueue webhook retry"
            );
        }
    } else {
        tracing::warn!(
            target: "sabwa::webhooks::dispatcher",
            webhook_id = %job.webhook_id,
            attempt_n,
            "webhook exhausted retry policy; giving up"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::realtime::events::{
        MessageEvent, MessagePayload, SabwaEvent, StatusEvent,
    };

    #[test]
    fn parses_session_id_from_channel() {
        assert_eq!(
            parse_session_id("sabwa:abc123:events").as_deref(),
            Some("abc123")
        );
    }

    #[test]
    fn rejects_unrelated_channels() {
        assert_eq!(parse_session_id("not-sabwa:abc:events"), None);
        assert_eq!(parse_session_id("sabwa:abc:other"), None);
        assert_eq!(parse_session_id("sabwa::events"), None);
    }

    #[test]
    fn event_type_string_distinguishes_inbound_outbound() {
        let inbound = SabwaEvent::Message(MessageEvent {
            session_id: "s".into(),
            chat_jid: "x@s.whatsapp.net".into(),
            message: MessagePayload {
                message_id: "m1".into(),
                from_jid: "x@s.whatsapp.net".into(),
                from_me: false,
                kind: "text".into(),
                body: Some("hi".into()),
                media_url: None,
                ts: 0,
            },
        });
        assert_eq!(event_type_str(&inbound), "message.received");

        let outbound = SabwaEvent::Message(MessageEvent {
            session_id: "s".into(),
            chat_jid: "x@s.whatsapp.net".into(),
            message: MessagePayload {
                message_id: "m2".into(),
                from_jid: "self@s.whatsapp.net".into(),
                from_me: true,
                kind: "text".into(),
                body: Some("hi".into()),
                media_url: None,
                ts: 0,
            },
        });
        assert_eq!(event_type_str(&outbound), "message.sent");
    }

    #[test]
    fn event_type_string_maps_status_lifecycle() {
        let ev = SabwaEvent::Status(StatusEvent {
            session_id: "s".into(),
            status: "connected".into(),
            detail: None,
            ts: 0,
        });
        assert_eq!(event_type_str(&ev), "session.connected");

        let ev = SabwaEvent::Status(StatusEvent {
            session_id: "s".into(),
            status: "logged_out".into(),
            detail: None,
            ts: 0,
        });
        assert_eq!(event_type_str(&ev), "session.disconnected");
    }
}
