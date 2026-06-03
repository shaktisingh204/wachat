//! Claim-side per-workspace + per-plan rate limiter.
//!
//! Mirrors the TS enqueue-side check in
//! `src/lib/sabflow/queue/rate-limit.ts`. The two helpers share the same
//! Redis key shape so a request that was counted at enqueue time is the
//! same one we observe here — the dispatcher just re-runs the check
//! defensively before it claims a job.
//!
//! ## Algorithm
//!
//! Fixed bucket per wall-clock minute. INCR + EXPIRE 65s. If the post-INCR
//! count exceeds the plan cap we DECR back and return [`RateCheck::Denied`]
//! with `retry_after_ms` set to the time until the next minute boundary.
//!
//! ## Why not Lua?
//!
//! INCR is already atomic against a single key, and our EXPIRE is only set
//! on the first hit (when `count == 1`). The only race is "two callers
//! INCR the same key from 0 to 2 in the same Redis tick and both think
//! they were first"; both will then SET the same TTL on the same key. That
//! is a no-op, not a correctness bug — so a Lua round-trip is unnecessary
//! and we keep the dependency surface (`fred` without `i-scripts`) smaller
//! than the broadcast token-bucket crate.
//!
//! ## Failure mode
//!
//! Redis transport errors are returned as `anyhow::Error` from
//! `[`check_claim_rate`]`. The dispatcher's policy is to *fail closed* on
//! the claim side — if we can't tell whether the workspace is throttled,
//! we refuse the claim and let the next tick try again. That's the
//! opposite of the TS path, which fails open: enqueue is user-facing and
//! must not reject due to platform health, but the worker can safely
//! back off.

use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use fred::clients::Client;
use fred::interfaces::{ClientLike, KeysInterface};
use fred::types::config::Config as FredConfig;
use serde::Serialize;

/// Bucket TTL: 60s window + 5s slack so a check landing on a minute boundary
/// still sees a fresh TTL on the new bucket.
const BUCKET_TTL_SEC: i64 = 65;

/// Plan caps for `workflow_executions/minute`. `None` = unlimited.
///
/// Kept in lockstep with [`PLAN_CAPS_PER_MINUTE`] in the TS helper. Any
/// change here must be mirrored there — the two are the same product
/// surface, just two languages.
fn plan_cap(plan: &str) -> Option<u32> {
    match plan {
        "free" => Some(5),
        "starter" => Some(30),
        "pro" => Some(120),
        "business" => Some(600),
        "enterprise" => None,
        // Unknown plan IDs fall through to the strictest cap, matching the
        // TS `normalisePlan` behaviour. A misconfigured tenant must never
        // accidentally get a *higher* rate by sending garbage.
        _ => Some(5),
    }
}

/// Outcome of a single claim-side rate check.
///
/// `serde::Serialize` is derived so callers can include the result in
/// structured logs / telemetry without re-mapping the variants.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum RateCheck {
    /// Workspace is under its per-minute cap. Caller may claim the job.
    /// `remaining` is the tokens left in the *current* minute window after
    /// this check; on unlimited plans we surface `u32::MAX`.
    Allowed { remaining: u32 },
    /// Workspace is at or above its cap. Caller should skip the claim and
    /// retry after `retry_after_ms`.
    Denied { retry_after_ms: u64 },
}

impl RateCheck {
    /// True when the caller may proceed.
    pub fn is_allowed(self) -> bool {
        matches!(self, RateCheck::Allowed { .. })
    }
}

/// Per-workspace + per-plan claim-side rate check.
///
/// Uses a process-global fred [`Client`] lazily initialised from the
/// `REDIS_URL` env var (falling back to `redis://localhost:6379`).
///
/// Returns:
/// - `Ok(RateCheck::Allowed { remaining })` — claim may proceed.
/// - `Ok(RateCheck::Denied { retry_after_ms })` — claim must back off.
/// - `Err(_)` — Redis was unreachable. Dispatcher policy is to treat this
///   as "do not claim this tick"; see the module doc on fail-closed.
pub async fn check_claim_rate(workspace_id: &str, plan: &str) -> Result<RateCheck> {
    let client = redis_client().await?;
    check_claim_rate_with_client(client, workspace_id, plan).await
}

/// Same as [`check_claim_rate`] but takes a borrowed [`Client`] — useful
/// for tests and for callers that already own a connected fred client
/// (e.g. the dispatcher binary's main loop).
pub async fn check_claim_rate_with_client(
    client: &Client,
    workspace_id: &str,
    plan: &str,
) -> Result<RateCheck> {
    if workspace_id.is_empty() {
        anyhow::bail!("workspace_id must not be empty");
    }

    let cap = match plan_cap(plan) {
        // Unlimited plan — short-circuit without a Redis round-trip.
        None => {
            return Ok(RateCheck::Allowed {
                remaining: u32::MAX,
            });
        }
        Some(c) => c,
    };

    let minute = current_minute()?;
    let key = bucket_key(plan, workspace_id, minute);

    // INCR is atomic. Returns the new value as i64; we cast to u32 with
    // saturation in the (impossible-in-practice) case that someone manually
    // bumped the bucket past 2^32 before we observed it.
    let count: i64 = client
        .incr(&key)
        .await
        .context("INCR sabflow:rate bucket failed")?;

    if count == 1 {
        // First hit in this minute — set TTL. We deliberately do not set
        // EXPIRE on every call: doing so would push the bucket's expiry
        // forward indefinitely and bleed the window across minute boundaries
        // for hot workspaces.
        let _: bool = client
            .expire(&key, BUCKET_TTL_SEC, None)
            .await
            .context("EXPIRE sabflow:rate bucket failed")?;
    }

    if count as u64 > cap as u64 {
        // Roll back so the counter reflects accepted claims only. A failure
        // here is non-fatal — the bucket evicts itself in 65s anyway — so
        // we log and continue rather than propagate.
        if let Err(err) = client.decr::<i64, _>(&key).await {
            tracing::warn!(
                workspace_id,
                plan,
                error = %err,
                "failed to roll back rate-limit counter; bucket will over-count for one minute"
            );
        }
        return Ok(RateCheck::Denied {
            retry_after_ms: ms_until_next_minute()?,
        });
    }

    let remaining = cap.saturating_sub(count.max(0) as u32);
    Ok(RateCheck::Allowed { remaining })
}

// ── Internals ─────────────────────────────────────────────────────────

fn bucket_key(plan: &str, workspace_id: &str, minute: u64) -> String {
    format!("sabflow:rate:{plan}:{workspace_id}:{minute}")
}

fn current_minute() -> Result<u64> {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("system clock before UNIX epoch")?
        .as_secs();
    Ok(secs / 60)
}

fn ms_until_next_minute() -> Result<u64> {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("system clock before UNIX epoch")?
        .as_millis() as u64;
    let into_minute = now_ms % 60_000;
    Ok((60_000 - into_minute).max(1))
}

/// Process-global fred client, lazily initialised on first use.
///
/// Holding the connected `Client` in a `OnceLock` is the same pattern
/// `sabnode-db` uses inside its handle — fred's `Client` is `Arc` inside,
/// so subsequent callers reuse the existing connection task instead of
/// dialling Redis again.
static REDIS_CLIENT: OnceLock<Client> = OnceLock::new();

async fn redis_client() -> Result<&'static Client> {
    if let Some(client) = REDIS_CLIENT.get() {
        return Ok(client);
    }

    let url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let config =
        FredConfig::from_url(&url).with_context(|| format!("parsing REDIS_URL `{url}`"))?;
    let client = Client::new(config, None, None, None);
    client
        .init()
        .await
        .context("initializing fred Redis client for sabflow-executor-queue")?;

    // Race-tolerant set: if another task already initialised, drop ours.
    // fred's connection task is owned by the Client we drop, which will
    // tear itself down when the handle is freed.
    match REDIS_CLIENT.set(client) {
        Ok(()) => Ok(REDIS_CLIENT.get().expect("just set above")),
        Err(_) => Ok(REDIS_CLIENT.get().expect("set by competing task")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bucket_key_matches_ts_shape() {
        // The TS side writes `sabflow:rate:<plan>:<workspaceId>:<minute>`.
        // Both helpers must agree byte-for-byte or the dispatcher will
        // observe a different counter than the enqueue path wrote to.
        assert_eq!(
            bucket_key("pro", "ws_123", 28_700_000),
            "sabflow:rate:pro:ws_123:28700000"
        );
    }

    #[test]
    fn unknown_plan_falls_back_to_free_cap() {
        assert_eq!(plan_cap("free"), Some(5));
        assert_eq!(plan_cap("nonsense"), Some(5));
        assert_eq!(plan_cap(""), Some(5));
    }

    #[test]
    fn enterprise_is_unlimited() {
        assert_eq!(plan_cap("enterprise"), None);
    }

    #[test]
    fn plan_caps_match_spec() {
        assert_eq!(plan_cap("starter"), Some(30));
        assert_eq!(plan_cap("pro"), Some(120));
        assert_eq!(plan_cap("business"), Some(600));
    }

    #[test]
    fn ms_until_next_minute_is_in_range() {
        let ms = ms_until_next_minute().unwrap();
        assert!(ms >= 1 && ms <= 60_000, "got {ms}");
    }

    #[test]
    fn rate_check_is_allowed_helper() {
        assert!(RateCheck::Allowed { remaining: 3 }.is_allowed());
        assert!(
            !RateCheck::Denied {
                retry_after_ms: 100
            }
            .is_allowed()
        );
    }
}
