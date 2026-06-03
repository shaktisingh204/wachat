//! Priority levels + per-workspace concurrency caps (Rust side).
//!
//! Track B · Phase 2 · sub-task #4 of 10. Mirrors the Node module at
//! `src/lib/sabflow/queue/concurrency.ts` — the two are deliberately
//! kept identical in shape so a SabFlow operator reading either file
//! sees the same ladder.
//!
//! Two responsibilities:
//!
//!   1. [`Priority`] — the four-tier urgency lattice
//!      (`low` / `normal` / `high` / `critical`) and its
//!      ZSET-ordering helpers. The producer (Node `enqueue.ts`) writes
//!      the named tier into the job hash; the dispatcher reads
//!      [`priority_score`] when promoting from the `delayed` ZSET so
//!      same-millisecond ties resolve deterministically.
//!
//!   2. [`WorkspaceSemaphore`] — a Redis-backed semaphore enforcing
//!      the per-plan concurrency cap. Sibling #3 (the dispatcher) calls
//!      [`WorkspaceSemaphore::acquire`] **before** issuing
//!      `BRPOPLPUSH wait → active`; on denial it requeues the job with
//!      a cooperative delay so a single hot tenant cannot starve others.
//!
//! ## Why a trait instead of a concrete Redis client
//!
//! The dispatcher's real Lua executor will be `fred`-backed (matching
//! `wachat-queue` upstream), but pinning this crate to `fred` here
//! means *every* downstream consumer of `sabflow-executor-queue` —
//! including the foundation scaffold, tests, and any future in-memory
//! variant — has to compile `fred`'s entire feature surface. Instead we
//! expose [`LuaExecutor`], a minimal `async-trait` the dispatcher
//! implements once with `fred`. The unit tests in this module use an
//! in-memory fake.
//!
//! ## Forward declarations
//!
//! - **Plan resolver.** Plan-gate lives in Phase 8 §4. We do not import
//!   the billing crate here; the caller passes
//!   [`WorkspaceSemaphore::new`] a boxed closure
//!   `Fn(WorkspaceId) -> u32` and we trust it. The dispatcher wires the
//!   real resolver at startup.
//! - **Job claim path.** The dispatcher (sub-task #3) calls
//!   `acquire(workspace_id)` immediately before its `BRPOPLPUSH` so the
//!   counter increment and the claim are *not* atomic — that's by
//!   design. The Lua script in [`acquire`] is the only race-free
//!   gate; a successful acquire **guarantees** the counter is
//!   incremented, and the [`SemaphoreGuard`] returned tracks the
//!   release path even if the dispatcher panics mid-claim.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::sync::Mutex;

use async_trait::async_trait;

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

/// Named priority tiers attached to every job at enqueue time. Same four
/// tiers the Node module exposes — the wire contract is symmetrical.
///
/// `low / normal / high / critical` — see the Node-side JSDoc on
/// `src/lib/sabflow/queue/concurrency.ts` for the policy rationale. The
/// numeric mapping is repeated in [`priority_score`] / [`priority_wire`]
/// so neither side can drift without a code review touching both files.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Priority {
    Low,
    Normal,
    High,
    Critical,
}

impl Default for Priority {
    fn default() -> Self {
        Self::Normal
    }
}

impl Priority {
    /// Parse the wire-string tier name into a [`Priority`]. Returns
    /// `None` for unknown input so callers can decide whether to fail
    /// or fall back to [`Priority::default`].
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "low" => Some(Self::Low),
            "normal" => Some(Self::Normal),
            "high" => Some(Self::High),
            "critical" => Some(Self::Critical),
            _ => None,
        }
    }

    /// Wire-string name, matching the TS literal union.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Normal => "normal",
            Self::High => "high",
            Self::Critical => "critical",
        }
    }
}

/// Largest score in the lattice. Used by [`priority_wire`] to flip the
/// ZSET ordering (larger = more urgent) into the Bull v4 wire ordering
/// (smaller = more urgent).
const MAX_PRIORITY_SCORE: u32 = 20;

/// Numeric score per priority tier — **larger = more urgent**. Use this
/// for ZSET ordering in the delayed-job mover (sibling #6) and for the
/// dispatcher's tie-break when two jobs share an enqueue timestamp.
///
/// Mirrors `PRIORITY_SCORES` in the Node module verbatim.
pub fn priority_score(p: Priority) -> u32 {
    match p {
        Priority::Low => 1,
        Priority::Normal => 5,
        Priority::High => 10,
        Priority::Critical => 20,
    }
}

/// Bull v4-compatible **wire** priority — smaller = higher priority.
/// Use this when writing the job-hash `priority` field so `bull-board`
/// sorts the dashboard correctly.
pub fn priority_wire(p: Priority) -> u32 {
    MAX_PRIORITY_SCORE - priority_score(p)
}

// ---------------------------------------------------------------------------
// Plan tier + per-plan concurrency caps
// ---------------------------------------------------------------------------

/// Plan tier ladder. Matches `entitlements.ts`'s `PLAN_TABLE` ids and the
/// seat-model ADR (`free` / `starter` / `pro` / `business` /
/// `enterprise`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PlanTier {
    Free,
    Starter,
    Pro,
    Business,
    Enterprise,
}

impl Default for PlanTier {
    /// Fail-closed default. Mirrors `FALLBACK_PLAN` on the Node side.
    fn default() -> Self {
        Self::Free
    }
}

impl PlanTier {
    /// Tolerant parse — lowercases input, returns `None` for unknown
    /// tiers so callers can choose to fall back to [`PlanTier::default`].
    pub fn parse(value: &str) -> Option<Self> {
        match value.to_ascii_lowercase().as_str() {
            "free" => Some(Self::Free),
            "starter" => Some(Self::Starter),
            "pro" => Some(Self::Pro),
            "business" => Some(Self::Business),
            "enterprise" => Some(Self::Enterprise),
            _ => None,
        }
    }
}

/// Per-plan concurrency caps. **Mirrors the Node module's
/// `CONCURRENCY_CAPS` constant exactly.** See the Node-side JSDoc for
/// the ladder rationale. `enterprise` is intentionally finite (200) —
/// "unlimited per workspace" would un-bound the worker pool.
pub fn concurrency_cap_for_plan(plan: PlanTier) -> u32 {
    match plan {
        PlanTier::Free => 1,
        PlanTier::Starter => 3,
        PlanTier::Pro => 10,
        PlanTier::Business => 50,
        PlanTier::Enterprise => 200,
    }
}

/// Build the canonical per-workspace in-flight counter key. Mirrors
/// `workspaceInflightKey()` on the Node side so both consumers derive
/// the same key from the same template.
///
/// Layout: `sabflow:queue:<queue_name>:wsinflight:<workspace_id>`.
pub fn workspace_inflight_key(queue_name: &str, workspace_id: &str) -> String {
    format!("sabflow:queue:{queue_name}:wsinflight:{workspace_id}")
}

// ---------------------------------------------------------------------------
// LuaExecutor — forward-decl seam for the real Redis client
// ---------------------------------------------------------------------------

/// Minimal Redis-Lua surface the semaphore needs. The dispatcher's
/// concrete implementation (sub-task #3) speaks `fred`; here we keep
/// the trait abstract so this crate compiles without dragging the
/// redis client into the dependency closure.
///
/// Conventions:
///
///   - `script` is the raw Lua source. Implementations may cache by
///     SHA1 via `EVALSHA` — the contract only requires that calling
///     `eval` with the same source returns the same result as a fresh
///     `EVAL`.
///   - `keys` and `args` are passed as UTF-8 strings (Redis is binary-
///     safe but the queue layer never embeds binary). The wachat-queue
///     sibling uses the same shape.
///   - The return value is a single integer because every Lua script
///     this module ships returns 0 (denied) or the new counter value
///     (allowed / released). Callers compare against the cap they
///     passed in `args`.
#[async_trait]
pub trait LuaExecutor: Send + Sync {
    async fn eval(
        &self,
        script: &str,
        keys: &[String],
        args: &[String],
    ) -> Result<i64, LuaExecError>;
}

/// Wire-format error from [`LuaExecutor`]. Implementations stringify
/// their concrete error type into [`LuaExecError::Backend`] — we don't
/// expose `fred`'s `RedisError` here to keep this crate's surface
/// minimal.
#[derive(Debug, thiserror::Error)]
pub enum LuaExecError {
    #[error("redis backend error: {0}")]
    Backend(String),
    #[error("lua script returned unexpected type")]
    BadReturn,
}

// ---------------------------------------------------------------------------
// WorkspaceSemaphore
// ---------------------------------------------------------------------------

/// Closure type for the forward-declared plan-cap resolver. The
/// dispatcher passes this at construction; we deliberately keep it a
/// trait-object closure (not a generic) so [`WorkspaceSemaphore`] can
/// be `Arc`'d and shared without leaking type parameters across the
/// dispatcher's struct fields.
pub type CapResolver = Box<dyn Fn(&str) -> u32 + Send + Sync>;

/// Per-workspace concurrency limiter. One instance per dispatcher
/// process; shared across worker tasks via `Arc<WorkspaceSemaphore>`.
///
/// Lifecycle:
///
///   1. Dispatcher startup: build a [`WorkspaceSemaphore`] with the
///      shared `LuaExecutor` and the plan-cap resolver.
///   2. Per claim: call [`WorkspaceSemaphore::acquire`]. On `Ok(guard)`,
///      the dispatcher owns one slot of in-flight budget and can
///      proceed to `BRPOPLPUSH`. On `Err(SemaphoreError::Denied)`, the
///      dispatcher requeues the job with a cooperative delay (see
///      module-level docs).
///   3. Job completes / fails / stalls: dropping the
///      [`SemaphoreGuard`] runs the release Lua atomically. If the
///      dispatcher needs to release before terminal state (e.g. to
///      hand off mid-claim), it can call
///      [`WorkspaceSemaphore::release`] directly.
pub struct WorkspaceSemaphore {
    redis_client: Arc<dyn LuaExecutor>,
    cap_resolver: CapResolver,
    /// Canonical queue name (e.g. `sabflow:executions`) the counters
    /// live under. The semaphore is *per-queue* because a tenant can
    /// have separate budgets on `executions` vs `webhooks`.
    queue_name: String,
}

impl WorkspaceSemaphore {
    /// Build a new semaphore. `redis_client` is shared (cheap clones);
    /// `cap_resolver` is owned (one per semaphore — the dispatcher
    /// constructs it from its plan-gate closure at startup).
    pub fn new(
        redis_client: Arc<dyn LuaExecutor>,
        cap_resolver: CapResolver,
        queue_name: impl Into<String>,
    ) -> Self {
        Self {
            redis_client,
            cap_resolver,
            queue_name: queue_name.into(),
        }
    }

    /// Atomically check the workspace's current in-flight count against
    /// its cap and increment if there's budget. Returns a guard that
    /// decrements on `Drop` (or on explicit [`SemaphoreGuard::release`]
    /// — see that method for the difference).
    ///
    /// Implementation: a Lua script of the shape
    ///
    /// ```text
    /// local current = tonumber(redis.call('GET', KEYS[1])) or 0
    /// local cap = tonumber(ARGV[1])
    /// if current >= cap then return 0 end
    /// return redis.call('INCR', KEYS[1])
    /// ```
    ///
    /// returns the new counter value on success or `0` on denial. We
    /// don't `SETEX` here — the counter survives across the entire
    /// in-flight period and is reset to zero only by the matching
    /// [`Self::release`] (or by the stalled-job reaper, which DECRs
    /// the counter as it moves the job from `active` → `stalled`).
    pub async fn acquire(&self, workspace_id: &str) -> Result<SemaphoreGuard, SemaphoreError> {
        let cap = (self.cap_resolver)(workspace_id);
        if cap == 0 {
            return Err(SemaphoreError::ZeroCap);
        }
        let key = workspace_inflight_key(&self.queue_name, workspace_id);

        let result = self
            .redis_client
            .eval(ACQUIRE_LUA, &[key.clone()], &[cap.to_string()])
            .await
            .map_err(SemaphoreError::Backend)?;

        if result == 0 {
            // Cap hit — sibling #3 (dispatcher) requeues with delay.
            return Err(SemaphoreError::Denied {
                workspace_id: workspace_id.to_string(),
                cap,
            });
        }

        Ok(SemaphoreGuard {
            client: Arc::clone(&self.redis_client),
            key,
            released: false,
        })
    }

    /// Explicit release alternative — equivalent to dropping the
    /// guard, but `async` so it can be awaited inline. Useful when the
    /// dispatcher needs to release *during* job processing (e.g. when
    /// handing off a long-running execution to a sub-worker pool).
    ///
    /// Unlike `Drop`, this method propagates Redis errors to the
    /// caller, so the dispatcher can decide whether to retry the
    /// decrement or accept temporary cap drift.
    pub async fn release(&self, workspace_id: &str) -> Result<(), SemaphoreError> {
        let key = workspace_inflight_key(&self.queue_name, workspace_id);
        self.redis_client
            .eval(RELEASE_LUA, &[key], &[])
            .await
            .map(|_| ())
            .map_err(SemaphoreError::Backend)
    }

    /// Read-only inspector for tests and admin tooling — does **not**
    /// modify state. Returns the cap the resolver currently reports for
    /// `workspace_id`; the actual in-flight count is a Redis read the
    /// caller performs separately.
    pub fn cap_for(&self, workspace_id: &str) -> u32 {
        (self.cap_resolver)(workspace_id)
    }
}

/// RAII handle returned by [`WorkspaceSemaphore::acquire`]. Drops run
/// the release Lua via a `tokio::spawn` so the destructor stays
/// non-async — the dispatcher can park a guard in any non-async slot
/// (e.g. inside a `tokio::sync::Mutex`-guarded HashMap of pending
/// jobs) without `unsafe`.
///
/// If the guard is dropped *outside* a Tokio runtime (e.g. during a
/// panic on a non-async thread), the release is logged-and-skipped:
/// the stalled-job reaper will eventually DECR the counter when it
/// moves the job into `stalled`. The exact behaviour is documented on
/// [`SemaphoreGuard::release`] for callers that need a synchronous
/// guarantee.
pub struct SemaphoreGuard {
    client: Arc<dyn LuaExecutor>,
    key: String,
    released: bool,
}

impl SemaphoreGuard {
    /// Release the slot now, asynchronously. After this call the guard
    /// is "consumed" and `Drop` becomes a no-op. Propagates Redis
    /// errors so the caller can choose to retry.
    pub async fn release(mut self) -> Result<(), SemaphoreError> {
        self.released = true;
        self.client
            .eval(RELEASE_LUA, &[self.key.clone()], &[])
            .await
            .map(|_| ())
            .map_err(SemaphoreError::Backend)
    }
}

impl Drop for SemaphoreGuard {
    fn drop(&mut self) {
        if self.released {
            return;
        }
        // Best-effort release on drop. We spawn into the ambient Tokio
        // runtime; if there isn't one (panic on a non-async thread),
        // the stalled-job reaper is the safety net.
        let client = Arc::clone(&self.client);
        let key = std::mem::take(&mut self.key);
        if let Ok(handle) = tokio::runtime::Handle::try_current() {
            handle.spawn(async move {
                let _ = client.eval(RELEASE_LUA, &[key], &[]).await;
            });
        }
    }
}

/// Errors surfaced by [`WorkspaceSemaphore::acquire`] /
/// [`WorkspaceSemaphore::release`].
#[derive(Debug, thiserror::Error)]
pub enum SemaphoreError {
    /// The workspace's plan resolves to a cap of zero — typically a
    /// misconfiguration. Returned eagerly without touching Redis.
    #[error("plan cap resolved to zero")]
    ZeroCap,
    /// Cap reached — the dispatcher should requeue with delay rather
    /// than treat this as a fatal job error.
    #[error("workspace {workspace_id} at concurrency cap ({cap})")]
    Denied { workspace_id: String, cap: u32 },
    /// Underlying Redis / Lua error from the executor. The dispatcher
    /// generally retries with backoff; persistent failures should
    /// surface as queue health alerts (sibling #9).
    #[error("semaphore backend error: {0}")]
    Backend(#[from] LuaExecError),
}

// ---------------------------------------------------------------------------
// Lua scripts
// ---------------------------------------------------------------------------

/// Atomic check-and-increment. Returns the new counter on success or
/// `0` if the cap was already hit. `KEYS[1] = wsinflight:<id>`,
/// `ARGV[1] = cap`.
const ACQUIRE_LUA: &str = r#"
local current = tonumber(redis.call('GET', KEYS[1]))
if current == nil then current = 0 end
local cap = tonumber(ARGV[1])
if cap == nil or cap <= 0 then return 0 end
if current >= cap then return 0 end
return redis.call('INCR', KEYS[1])
"#;

/// Decrement the in-flight counter; never goes below zero. `KEYS[1] =
/// wsinflight:<id>`, no `ARGV`. Returns the new value (or 0 if the
/// key was absent / already zero).
const RELEASE_LUA: &str = r#"
local current = tonumber(redis.call('GET', KEYS[1]))
if current == nil or current <= 0 then
  redis.call('SET', KEYS[1], 0)
  return 0
end
local new_value = redis.call('DECR', KEYS[1])
if new_value < 0 then
  redis.call('SET', KEYS[1], 0)
  return 0
end
return new_value
"#;

// ---------------------------------------------------------------------------
// In-memory fake — used in tests + the in-process scaffold dispatcher
// ---------------------------------------------------------------------------

/// In-memory [`LuaExecutor`] that emulates `INCR` / `DECR` / `GET` /
/// `SET` for our two scripts. The dispatcher does **not** use this
/// (it ships a `fred`-backed executor); we expose it so the scaffold
/// builds end-to-end before sibling #3 lands, and so unit tests can
/// exercise the semaphore without spinning up Redis.
#[derive(Default, Clone)]
pub struct InMemoryLuaExecutor {
    state: Arc<Mutex<HashMap<String, i64>>>,
}

impl InMemoryLuaExecutor {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl LuaExecutor for InMemoryLuaExecutor {
    async fn eval(
        &self,
        script: &str,
        keys: &[String],
        args: &[String],
    ) -> Result<i64, LuaExecError> {
        let key = keys
            .first()
            .ok_or_else(|| LuaExecError::Backend("missing key".into()))?
            .clone();

        if script.trim() == ACQUIRE_LUA.trim() {
            let cap: i64 = args
                .first()
                .and_then(|s| s.parse().ok())
                .ok_or_else(|| LuaExecError::Backend("bad cap arg".into()))?;
            if cap <= 0 {
                return Ok(0);
            }
            let mut g = self
                .state
                .lock()
                .map_err(|e| LuaExecError::Backend(e.to_string()))?;
            let cur = *g.get(&key).unwrap_or(&0);
            if cur >= cap {
                return Ok(0);
            }
            let new_value = cur + 1;
            g.insert(key, new_value);
            return Ok(new_value);
        }

        if script.trim() == RELEASE_LUA.trim() {
            let mut g = self
                .state
                .lock()
                .map_err(|e| LuaExecError::Backend(e.to_string()))?;
            let cur = *g.get(&key).unwrap_or(&0);
            if cur <= 0 {
                g.insert(key, 0);
                return Ok(0);
            }
            let new_value = cur - 1;
            g.insert(key, new_value.max(0));
            return Ok(new_value.max(0));
        }

        Err(LuaExecError::Backend("unknown script".into()))
    }
}

// ---------------------------------------------------------------------------
// `Pin<Box<dyn Future>>` helper for non-trait closure callers
// ---------------------------------------------------------------------------

/// Convenience alias the dispatcher can use when it wants to pass an
/// async release callback (e.g. into the shutdown drain) without
/// naming the future type. Not used inside the semaphore itself; kept
/// here so the rest of the crate has one place to import it from.
pub type ReleaseFuture<'a> = Pin<Box<dyn Future<Output = ()> + Send + 'a>>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn priority_scores_match_node_lattice() {
        assert_eq!(priority_score(Priority::Low), 1);
        assert_eq!(priority_score(Priority::Normal), 5);
        assert_eq!(priority_score(Priority::High), 10);
        assert_eq!(priority_score(Priority::Critical), 20);
    }

    #[test]
    fn priority_wire_inverts_score() {
        // critical = highest urgency → smallest wire number (Bull v4).
        assert_eq!(priority_wire(Priority::Critical), 0);
        assert_eq!(priority_wire(Priority::High), 10);
        assert_eq!(priority_wire(Priority::Normal), 15);
        assert_eq!(priority_wire(Priority::Low), 19);
    }

    #[test]
    fn priority_parse_round_trips_known_names() {
        for p in [
            Priority::Low,
            Priority::Normal,
            Priority::High,
            Priority::Critical,
        ] {
            assert_eq!(Priority::parse(p.as_str()), Some(p));
        }
        assert_eq!(Priority::parse("unknown"), None);
    }

    #[test]
    fn plan_caps_match_seat_model_ladder() {
        assert_eq!(concurrency_cap_for_plan(PlanTier::Free), 1);
        assert_eq!(concurrency_cap_for_plan(PlanTier::Starter), 3);
        assert_eq!(concurrency_cap_for_plan(PlanTier::Pro), 10);
        assert_eq!(concurrency_cap_for_plan(PlanTier::Business), 50);
        assert_eq!(concurrency_cap_for_plan(PlanTier::Enterprise), 200);
    }

    #[test]
    fn plan_parse_is_case_insensitive() {
        assert_eq!(PlanTier::parse("FREE"), Some(PlanTier::Free));
        assert_eq!(PlanTier::parse("Enterprise"), Some(PlanTier::Enterprise));
        assert_eq!(PlanTier::parse("nonexistent"), None);
    }

    #[test]
    fn inflight_key_layout_matches_node_module() {
        assert_eq!(
            workspace_inflight_key("sabflow:executions", "ws_42"),
            "sabflow:queue:sabflow:executions:wsinflight:ws_42"
        );
    }

    #[tokio::test(flavor = "current_thread")]
    async fn semaphore_acquires_up_to_cap_then_denies() {
        let exec = Arc::new(InMemoryLuaExecutor::new());
        let sem =
            WorkspaceSemaphore::new(exec.clone(), Box::new(|_ws: &str| 2), "sabflow:executions");

        let g1 = sem.acquire("ws_a").await.expect("first acquire");
        let g2 = sem.acquire("ws_a").await.expect("second acquire");

        let denied = sem.acquire("ws_a").await;
        assert!(matches!(denied, Err(SemaphoreError::Denied { .. })));

        // Releasing one frees a slot.
        g1.release().await.expect("explicit release");
        let g3 = sem.acquire("ws_a").await.expect("post-release acquire");

        // Different workspace has its own budget.
        let g_other = sem.acquire("ws_b").await.expect("other workspace");

        drop(g2);
        drop(g3);
        drop(g_other);
    }

    #[tokio::test(flavor = "current_thread")]
    async fn semaphore_zero_cap_is_rejected_eagerly() {
        let exec = Arc::new(InMemoryLuaExecutor::new());
        let sem = WorkspaceSemaphore::new(exec, Box::new(|_ws: &str| 0), "sabflow:executions");
        let r = sem.acquire("ws").await;
        assert!(matches!(r, Err(SemaphoreError::ZeroCap)));
    }

    #[tokio::test(flavor = "current_thread")]
    async fn drop_guard_releases_slot_via_runtime_handle() {
        let exec = Arc::new(InMemoryLuaExecutor::new());
        let sem = Arc::new(WorkspaceSemaphore::new(
            exec.clone(),
            Box::new(|_ws: &str| 1),
            "sabflow:executions",
        ));

        let g = sem.acquire("ws_drop").await.expect("acquire");
        drop(g);

        // Yield so the spawned release Lua can run.
        tokio::task::yield_now().await;
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;

        let again = sem.acquire("ws_drop").await;
        assert!(again.is_ok(), "drop should have released the slot");
    }
}
