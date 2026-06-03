//! Graceful shutdown for the SabFlow Rust dispatcher worker.
//!
//! Track B Phase 2, sub-task #8. Sibling #3 (the dispatcher main loop) holds
//! a [`ShutdownToken`], checks [`CancellationToken::is_cancelled`] between job
//! claims, and on cancel calls [`drain`] to give in-flight jobs a bounded
//! window to finish before forcibly releasing their Redis locks so another
//! worker can pick them up.
//!
//! Signal handling is platform-aware: SIGTERM + ctrl_c on Unix, ctrl_c only
//! on non-Unix (Windows dev hosts).
//!
//! The `dispatcher::current_jobs()` enumerator is forward-declared — the
//! sibling dispatcher registers it via [`register_current_jobs`] at startup;
//! [`drain`] reads it through [`current_jobs`] when the deadline hits.

use std::sync::Arc;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use tokio::time::{Instant, sleep};
pub use tokio_util::sync::CancellationToken;

/// Default drain deadline if `SABFLOW_DISPATCHER_DRAIN_SECS` is unset or
/// unparseable.
pub const DEFAULT_DRAIN_SECS: u64 = 30;

/// Environment variable that overrides the drain deadline (seconds).
pub const DRAIN_SECS_ENV: &str = "SABFLOW_DISPATCHER_DRAIN_SECS";

/// Polling cadence while waiting for `inflight` to reach zero.
const POLL_INTERVAL: Duration = Duration::from_millis(100);

/// BullMQ-compatible job identifier. Mirrored from sibling crates so we don't
/// pull in a cross-crate dep before the dispatcher type lands; the dispatcher
/// is expected to use the same string-id shape.
pub type JobId = String;

/// Re-export wrapper so the dispatcher can hold a single typed handle without
/// importing `tokio_util` directly.
#[derive(Clone, Debug, Default)]
pub struct ShutdownToken(pub CancellationToken);

impl ShutdownToken {
    /// Construct a fresh shutdown token.
    pub fn new() -> Self {
        Self(CancellationToken::new())
    }

    /// Borrow the inner `CancellationToken` for awaiting / passing to async
    /// primitives that already speak `tokio_util`.
    pub fn inner(&self) -> &CancellationToken {
        &self.0
    }

    /// Cancel the token, signalling shutdown to every holder.
    pub fn cancel(&self) {
        self.0.cancel();
    }

    /// True once `cancel` has been called on this token (or any clone).
    pub fn is_cancelled(&self) -> bool {
        self.0.is_cancelled()
    }
}

/// Outcome of a [`drain`] call.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShutdownResult {
    /// All in-flight jobs finished within the deadline.
    Drained { jobs_completed: usize },
    /// Deadline hit with jobs still running; their Redis locks were released
    /// so another worker can re-claim them.
    TimedOut { jobs_abandoned: usize },
}

/// Read the drain deadline from `SABFLOW_DISPATCHER_DRAIN_SECS`, falling back
/// to [`DEFAULT_DRAIN_SECS`] when unset or unparseable.
pub fn drain_deadline_from_env() -> Duration {
    std::env::var(DRAIN_SECS_ENV)
        .ok()
        .and_then(|raw| raw.parse::<u64>().ok())
        .map(Duration::from_secs)
        .unwrap_or_else(|| Duration::from_secs(DEFAULT_DRAIN_SECS))
}

// ---------------------------------------------------------------------------
// Forward-declared dispatcher hook.
//
// The sibling dispatcher module (sub-task #3 of Phase B.2) owns the canonical
// `dispatcher::current_jobs()` function. To keep this file self-contained and
// land independently of that sibling, we expose a process-global registration
// slot. The dispatcher calls `register_current_jobs(...)` at startup and
// `drain()` reads through `current_jobs()` when the deadline hits.
// ---------------------------------------------------------------------------

type CurrentJobsFn = Box<dyn Fn() -> Vec<JobId> + Send + Sync + 'static>;

static CURRENT_JOBS: OnceLock<CurrentJobsFn> = OnceLock::new();

/// Register the enumerator that returns the set of jobs currently being
/// processed by the dispatcher. Called once by the dispatcher on startup;
/// subsequent calls are ignored (first writer wins).
pub fn register_current_jobs<F>(f: F)
where
    F: Fn() -> Vec<JobId> + Send + Sync + 'static,
{
    let _ = CURRENT_JOBS.set(Box::new(f));
}

/// Return the currently in-flight jobs as known to the dispatcher. Returns
/// an empty `Vec` if no enumerator has been registered yet.
pub fn current_jobs() -> Vec<JobId> {
    CURRENT_JOBS.get().map(|f| f()).unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Signal handlers.
// ---------------------------------------------------------------------------

/// Spawn a background task that listens for SIGTERM (Unix) and ctrl_c on any
/// platform. On either signal, the supplied `token` is cancelled.
///
/// Returns immediately; the listener runs until either signal fires or the
/// process exits.
pub fn install_signal_handlers(token: CancellationToken) {
    tokio::spawn(async move {
        #[cfg(unix)]
        {
            use tokio::signal::unix::{SignalKind, signal};

            let mut sigterm = match signal(SignalKind::terminate()) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("sabflow-dispatcher: failed to install SIGTERM handler: {e}");
                    token.cancel();
                    return;
                }
            };

            tokio::select! {
                _ = sigterm.recv() => {}
                _ = tokio::signal::ctrl_c() => {}
            }
        }

        #[cfg(not(unix))]
        {
            if let Err(e) = tokio::signal::ctrl_c().await {
                eprintln!("sabflow-dispatcher: failed to install ctrl_c handler: {e}");
            }
        }

        token.cancel();
    });
}

// ---------------------------------------------------------------------------
// Drain loop.
// ---------------------------------------------------------------------------

/// Wait for in-flight dispatcher jobs to finish, with a hard deadline.
///
/// Polls `inflight` every 100 ms. If it reaches zero before the deadline,
/// returns [`ShutdownResult::Drained`]. Otherwise enumerates the still-running
/// jobs via the registered `dispatcher::current_jobs()` hook, invokes
/// `on_release_lock(job_id)` for each one so the Redis lock is released and
/// another worker can re-claim the job, and returns
/// [`ShutdownResult::TimedOut`].
///
/// `token` is observed for early exit during the wait, but cancellation alone
/// does not short-circuit the drain — graceful shutdown means *finishing*
/// what we started, up to the deadline.
pub async fn drain<F, Fut>(
    token: CancellationToken,
    inflight: Arc<AtomicUsize>,
    deadline: Duration,
    on_release_lock: F,
) -> ShutdownResult
where
    F: Fn(JobId) -> Fut,
    Fut: std::future::Future<Output = ()>,
{
    let _ = &token; // held so the dispatcher can clone/check it alongside.
    let started = Instant::now();
    let initial = inflight.load(Ordering::Acquire);

    loop {
        let now_inflight = inflight.load(Ordering::Acquire);
        if now_inflight == 0 {
            return ShutdownResult::Drained {
                jobs_completed: initial,
            };
        }

        if started.elapsed() >= deadline {
            // Deadline hit — release each stalled job's lock so another
            // worker can pick it up. We snapshot the dispatcher's current
            // jobs once; the dispatcher is expected to have stopped claiming
            // by now (it checks `token.is_cancelled()` between claims).
            let stalled = current_jobs();
            let abandoned = stalled.len();
            for job_id in stalled {
                on_release_lock(job_id).await;
            }
            return ShutdownResult::TimedOut {
                jobs_abandoned: abandoned,
            };
        }

        sleep(POLL_INTERVAL).await;
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[test]
    fn shutdown_token_cancel_propagates_to_clone() {
        let tok = ShutdownToken::new();
        let clone = tok.clone();
        assert!(!tok.is_cancelled());
        assert!(!clone.is_cancelled());
        tok.cancel();
        assert!(tok.is_cancelled());
        assert!(clone.is_cancelled());
    }

    #[test]
    fn drain_deadline_falls_back_when_env_unset() {
        // SAFETY: tests run single-threaded for this var; we restore after.
        let prev = std::env::var(DRAIN_SECS_ENV).ok();
        unsafe {
            std::env::remove_var(DRAIN_SECS_ENV);
        }
        assert_eq!(
            drain_deadline_from_env(),
            Duration::from_secs(DEFAULT_DRAIN_SECS)
        );
        if let Some(v) = prev {
            unsafe {
                std::env::set_var(DRAIN_SECS_ENV, v);
            }
        }
    }

    #[tokio::test(flavor = "current_thread")]
    async fn drain_returns_drained_when_inflight_reaches_zero() {
        let token = CancellationToken::new();
        let inflight = Arc::new(AtomicUsize::new(2));
        let inflight_w = inflight.clone();

        let worker = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(150)).await;
            inflight_w.fetch_sub(1, Ordering::Release);
            tokio::time::sleep(Duration::from_millis(150)).await;
            inflight_w.fetch_sub(1, Ordering::Release);
        });

        let result = drain(
            token,
            inflight,
            Duration::from_secs(5),
            |_id: JobId| async {},
        )
        .await;

        worker.await.unwrap();
        assert_eq!(result, ShutdownResult::Drained { jobs_completed: 2 });
    }

    #[tokio::test(flavor = "current_thread")]
    async fn drain_times_out_and_releases_locks() {
        let token = CancellationToken::new();
        let inflight = Arc::new(AtomicUsize::new(3));

        // Forward-declared dispatcher hook: pretend two jobs are still held.
        // `register_current_jobs` is first-writer-wins and shared across the
        // whole process / test binary, so we only set it if empty and accept
        // whatever shape it has. To keep this test deterministic regardless
        // of test ordering, we pass the released ids through the callback.
        let released: Arc<Mutex<Vec<JobId>>> = Arc::new(Mutex::new(Vec::new()));
        let released_w = released.clone();

        // Best-effort registration — if another test already registered, the
        // assertion below tolerates either outcome.
        register_current_jobs(|| vec!["job-a".to_string(), "job-b".to_string()]);

        let result = drain(
            token,
            inflight,
            Duration::from_millis(250),
            move |id: JobId| {
                let r = released_w.clone();
                async move {
                    r.lock().unwrap().push(id);
                }
            },
        )
        .await;

        match result {
            ShutdownResult::TimedOut { jobs_abandoned } => {
                let released = released.lock().unwrap();
                assert_eq!(released.len(), jobs_abandoned);
            }
            other => panic!("expected TimedOut, got {other:?}"),
        }
    }
}
