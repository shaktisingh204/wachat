//! Dispatcher-side metrics for the SabFlow executor queue
//! (Track B · Phase 2 · sub-task #10).
//!
//! Mirrors the Node-side sampler in `src/lib/sabflow/queue/metrics.ts` but
//! covers the metrics the Rust dispatcher is uniquely positioned to record:
//! claim latency, job duration, and per-status job counts.
//!
//! ## Cardinality discipline
//!
//! Per `docs/adr/sabflow-executor-observability.md` §5, `workspaceId` is
//! **never** a metric label. The only allowed labels here are:
//!
//! * `queue` — one of the bounded values `executions | webhooks | cron`,
//! * `status` — one of the bounded values `success | error | canceled`.
//!
//! Both label dimensions are pre-allocated so a scrape that arrives before
//! the first observation returns deterministic zero values rather than a
//! `404`-style absence.
//!
//! ## Why no `metrics` / `prometheus` crate dependency?
//!
//! The workspace has not yet picked an exporter (Phase B.10 ADR).
//! `rust/crates/observability/` exposes only the tracing stack, and the
//! existing crates depend on neither `metrics` nor `prometheus`. Pulling
//! either crate would force a workspace-wide decision in a sub-task that is
//! supposed to land in isolation. Instead we keep an internal `std`-only
//! registry whose surface — `record_claim_latency`, `record_job_duration`,
//! `inc_jobs_total`, `render_prometheus_text` — is small enough to swap for
//! a real backend without churning call sites.

use std::sync::Mutex;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

/// Bounded queue label values.
pub const QUEUES: [&str; 3] = ["executions", "webhooks", "cron"];

/// Bounded status label values for `sabflow_dispatcher_jobs_total` and
/// `sabflow_dispatcher_job_duration_seconds`.
pub const STATUSES: [&str; 3] = ["success", "error", "canceled"];

/// Histogram bucket boundaries in **seconds**.
///
/// Tuned for two regimes:
/// * Claim latency (BRPOPLPUSH) — sub-millisecond happy path, occasional
///   seconds-long stalls when the queue is empty and BRPOP waits.
/// * Job duration — most nodes run in tens of milliseconds, with outliers
///   in the tens of seconds for slow HTTP endpoints.
///
/// Buckets follow Prometheus' "cumulative count of values ≤ bucket" model.
/// The final `+Inf` bucket is added implicitly by the exporter.
const HIST_BUCKETS_SECONDS: [f64; 14] = [
    0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
];

/* ────────────────────────────────────────────────────────────────────────
 * Counter primitive
 * ────────────────────────────────────────────────────────────────────── */

#[derive(Debug, Default)]
struct Counter {
    value: AtomicU64,
}

impl Counter {
    fn inc(&self) {
        self.value.fetch_add(1, Ordering::Relaxed);
    }

    fn get(&self) -> u64 {
        self.value.load(Ordering::Relaxed)
    }
}

/* ────────────────────────────────────────────────────────────────────────
 * Histogram primitive
 * ────────────────────────────────────────────────────────────────────── */

/// Fixed-bucket histogram. Sum is stored as fixed-point microseconds in a
/// `u64` to keep the whole struct lock-free; the exporter divides by 1e6
/// when rendering. Bucket counts are also `AtomicU64` (cumulative *count*,
/// not sum) so concurrent observations don't contend on a single Mutex.
#[derive(Debug)]
struct Histogram {
    /// One counter per bucket boundary (same length as `HIST_BUCKETS_SECONDS`).
    buckets: [AtomicU64; HIST_BUCKETS_SECONDS.len()],
    /// `+Inf` bucket — total observation count.
    count: AtomicU64,
    /// Sum of observations in microseconds (avoids `AtomicF64` portability).
    sum_micros: AtomicU64,
}

impl Histogram {
    const fn new() -> Self {
        // `AtomicU64::new(0)` is const-stable but the array initializer
        // requires a const expression — use `[const { ... }; N]` syntax.
        Self {
            buckets: [const { AtomicU64::new(0) }; HIST_BUCKETS_SECONDS.len()],
            count: AtomicU64::new(0),
            sum_micros: AtomicU64::new(0),
        }
    }

    fn observe(&self, value_seconds: f64) {
        // Defensive clamp — NaN / negative would corrupt bucket counts.
        let v = if value_seconds.is_finite() && value_seconds >= 0.0 {
            value_seconds
        } else {
            0.0
        };

        for (i, &boundary) in HIST_BUCKETS_SECONDS.iter().enumerate() {
            if v <= boundary {
                self.buckets[i].fetch_add(1, Ordering::Relaxed);
            }
        }
        self.count.fetch_add(1, Ordering::Relaxed);

        // Cap at u64::MAX / 1e6 worth of seconds — well past any plausible
        // production runtime, so saturating add is fine.
        let micros = (v * 1_000_000.0) as u64;
        self.sum_micros.fetch_add(micros, Ordering::Relaxed);
    }

    /// Render this histogram as Prometheus text-format lines under the
    /// provided metric name + label set.
    fn render(&self, metric: &str, label_kv: &str, out: &mut String) {
        for (i, &boundary) in HIST_BUCKETS_SECONDS.iter().enumerate() {
            let count = self.buckets[i].load(Ordering::Relaxed);
            let sep = if label_kv.is_empty() { "" } else { "," };
            out.push_str(&format!(
                "{metric}_bucket{{{label_kv}{sep}le=\"{boundary}\"}} {count}\n"
            ));
        }
        let total = self.count.load(Ordering::Relaxed);
        let sep = if label_kv.is_empty() { "" } else { "," };
        out.push_str(&format!(
            "{metric}_bucket{{{label_kv}{sep}le=\"+Inf\"}} {total}\n"
        ));
        let sum_seconds = self.sum_micros.load(Ordering::Relaxed) as f64 / 1_000_000.0;
        out.push_str(&format!("{metric}_sum{{{label_kv}}} {sum_seconds}\n"));
        out.push_str(&format!("{metric}_count{{{label_kv}}} {total}\n"));
    }
}

/* ────────────────────────────────────────────────────────────────────────
 * Registry
 * ────────────────────────────────────────────────────────────────────── */

#[derive(Debug)]
struct Registry {
    /// `sabflow_dispatcher_claim_latency_seconds` — no labels (queue-agnostic
    /// for now; the dispatcher claims across queues with a single BRPOPLPUSH
    /// loop).
    claim_latency: Histogram,

    /// `sabflow_dispatcher_job_duration_seconds{status}` — one histogram per
    /// terminal status.
    job_duration: [Histogram; STATUSES.len()],

    /// `sabflow_dispatcher_jobs_total{queue,status}` — counter per
    /// (queue × status) combo.
    jobs_total: [[Counter; STATUSES.len()]; QUEUES.len()],
}

impl Registry {
    fn new() -> Self {
        Self {
            claim_latency: Histogram::new(),
            job_duration: [Histogram::new(), Histogram::new(), Histogram::new()],
            jobs_total: [
                [Counter::default(), Counter::default(), Counter::default()],
                [Counter::default(), Counter::default(), Counter::default()],
                [Counter::default(), Counter::default(), Counter::default()],
            ],
        }
    }
}

/// Global registry — read-mostly, so a `Mutex` is overkill, but we already
/// have lock-free atomics inside each metric. The `OnceLock` only guards
/// initialization.
static REGISTRY: OnceLock<Registry> = OnceLock::new();

fn registry() -> &'static Registry {
    REGISTRY.get_or_init(Registry::new)
}

fn status_index(status: &str) -> Option<usize> {
    STATUSES.iter().position(|s| *s == status)
}

fn queue_index(queue: &str) -> Option<usize> {
    QUEUES.iter().position(|q| *q == queue)
}

/* ────────────────────────────────────────────────────────────────────────
 * Public API — recording
 * ────────────────────────────────────────────────────────────────────── */

/// Record the duration of a single BRPOPLPUSH claim attempt.
///
/// Call this immediately after the claim returns (including failed claims
/// where the call timed out — the timeout itself is a useful signal).
pub fn record_claim_latency(d: Duration) {
    registry().claim_latency.observe(d.as_secs_f64());
}

/// Record the wall-clock duration of a finished job, tagged by terminal
/// `status`. Unknown statuses are dropped on the floor (cardinality discipline).
pub fn record_job_duration(status: &str, d: Duration) {
    let Some(i) = status_index(status) else {
        return;
    };
    registry().job_duration[i].observe(d.as_secs_f64());
}

/// Increment the `(queue, status)` jobs counter.
///
/// Unknown values are dropped — pre-allocating the bounded combinations
/// means an unknown label can only come from a programming error.
pub fn inc_jobs_total(queue: &str, status: &str) {
    let Some(qi) = queue_index(queue) else {
        return;
    };
    let Some(si) = status_index(status) else {
        return;
    };
    registry().jobs_total[qi][si].inc();
}

/// Convenience scope guard for the BRPOPLPUSH happy path. Drop to record.
///
/// ```ignore
/// let _claim = ClaimLatencyTimer::start();
/// redis.brpoplpush(...).await?;
/// drop(_claim); // records on drop
/// ```
pub struct ClaimLatencyTimer {
    start: std::time::Instant,
}

impl ClaimLatencyTimer {
    pub fn start() -> Self {
        Self {
            start: std::time::Instant::now(),
        }
    }
}

impl Drop for ClaimLatencyTimer {
    fn drop(&mut self) {
        record_claim_latency(self.start.elapsed());
    }
}

/* ────────────────────────────────────────────────────────────────────────
 * Public API — exporter
 * ────────────────────────────────────────────────────────────────────── */

/// Render the dispatcher registry as Prometheus text-format.
///
/// The Phase B.10 service-level `/metrics` endpoint composes this with the
/// gauges produced on the Node side; for now we expose the function so a
/// future Axum handler can call it directly.
pub fn render_prometheus_text() -> String {
    // Single mutex guards the *output buffer* (not the metrics themselves —
    // those use atomics). Cheap: scrapes are at most once every few seconds.
    static RENDER_LOCK: Mutex<()> = Mutex::new(());
    let _guard = RENDER_LOCK.lock().unwrap_or_else(|e| e.into_inner());

    let reg = registry();
    let mut out = String::with_capacity(4096);

    // sabflow_dispatcher_claim_latency_seconds (no labels)
    out.push_str(
        "# HELP sabflow_dispatcher_claim_latency_seconds Duration of a \
         BRPOPLPUSH claim attempt (seconds).\n",
    );
    out.push_str("# TYPE sabflow_dispatcher_claim_latency_seconds histogram\n");
    reg.claim_latency
        .render("sabflow_dispatcher_claim_latency_seconds", "", &mut out);

    // sabflow_dispatcher_job_duration_seconds{status}
    out.push_str(
        "# HELP sabflow_dispatcher_job_duration_seconds End-to-end wall-clock \
         per job, labelled by terminal status.\n",
    );
    out.push_str("# TYPE sabflow_dispatcher_job_duration_seconds histogram\n");
    for (i, status) in STATUSES.iter().enumerate() {
        let label_kv = format!("status=\"{status}\"");
        reg.job_duration[i].render(
            "sabflow_dispatcher_job_duration_seconds",
            &label_kv,
            &mut out,
        );
    }

    // sabflow_dispatcher_jobs_total{queue,status}
    out.push_str(
        "# HELP sabflow_dispatcher_jobs_total Count of finished jobs by queue \
         and status.\n",
    );
    out.push_str("# TYPE sabflow_dispatcher_jobs_total counter\n");
    for (qi, queue) in QUEUES.iter().enumerate() {
        for (si, status) in STATUSES.iter().enumerate() {
            let count = reg.jobs_total[qi][si].get();
            out.push_str(&format!(
                "sabflow_dispatcher_jobs_total{{queue=\"{queue}\",status=\"{status}\"}} \
                 {count}\n"
            ));
        }
    }

    out
}

/* ────────────────────────────────────────────────────────────────────────
 * Tests
 * ────────────────────────────────────────────────────────────────────── */

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn histogram_observes_into_correct_buckets() {
        let h = Histogram::new();
        h.observe(0.0001); // <= 0.0005
        h.observe(0.5); // <= 0.5
        h.observe(100.0); // only +Inf

        assert_eq!(h.buckets[0].load(Ordering::Relaxed), 1);
        // 0.5 is the 10th boundary (index 9); everything from index 9 up
        // through to the largest finite bucket should have caught it.
        assert!(h.buckets[9].load(Ordering::Relaxed) >= 1);
        assert_eq!(h.count.load(Ordering::Relaxed), 3);
    }

    #[test]
    fn counter_increments_atomically() {
        let c = Counter::default();
        c.inc();
        c.inc();
        assert_eq!(c.get(), 2);
    }

    #[test]
    fn render_includes_all_bounded_combinations() {
        // Trigger pre-allocation by inducing at least one observation per
        // metric — though even with zero observations the rendered output
        // must list every (queue, status) combo per the contract.
        inc_jobs_total("executions", "success");
        record_job_duration("error", Duration::from_millis(120));
        record_claim_latency(Duration::from_micros(800));

        let txt = render_prometheus_text();
        for q in QUEUES {
            for s in STATUSES {
                assert!(
                    txt.contains(&format!(
                        "sabflow_dispatcher_jobs_total{{queue=\"{q}\",status=\"{s}\"}}"
                    )),
                    "missing jobs_total label combo queue={q} status={s} in:\n{txt}"
                );
            }
        }
        assert!(txt.contains("sabflow_dispatcher_claim_latency_seconds_count"));
        assert!(txt.contains("sabflow_dispatcher_job_duration_seconds_bucket"));
    }

    #[test]
    fn unknown_labels_are_silently_dropped() {
        // Should not panic, should not insert anything.
        inc_jobs_total("nonsense", "success");
        record_job_duration("invented-status", Duration::from_secs(1));
        // No assertion on counts — point is the call doesn't blow up and
        // doesn't grow cardinality.
    }

    #[test]
    fn claim_latency_timer_records_on_drop() {
        let before = registry().claim_latency.count.load(Ordering::Relaxed);
        {
            let _t = ClaimLatencyTimer::start();
            std::thread::sleep(Duration::from_millis(1));
        }
        let after = registry().claim_latency.count.load(Ordering::Relaxed);
        assert!(after > before);
    }
}
