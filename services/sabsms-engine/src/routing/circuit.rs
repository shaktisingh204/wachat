//! Circuit breaker per (providerAccountId, destCountry).
//!
//! Persisted state lives in the Redis hash
//! `sabsms:circuit:{acct}:{country}` with fields `state` (always
//! "open" when present — "closed" is the ABSENCE of the key),
//! `openedAt` (epoch secs) and `failures` (times tripped). The
//! `half_open` state is DERIVED: an open circuit older than
//! [`OPEN_SECS`] is effectively half-open.
//!
//! Transitions (pure logic in [`transition`], table-tested):
//!   closed     --(score < 0.85 AND volume >= 20 on a failure)--> open(120s)
//!   open       --(120s elapse)----------------------------> half_open
//!   half_open  --(probe send allowed, 1 per 10s via SET NX)--
//!   half_open  --(DLR delivered)--------------------------> closed
//!   half_open  --(failure / DLR failed)-------------------> open(120s again)
//!
//! DLRs are asynchronous, so the half-open "probe" is simply: allow
//! ONE send per 10s window through; the next delivered DLR for that
//! (acct, country) while half-open closes the circuit, a failed one
//! re-opens it.

use redis::aio::ConnectionManager;
use redis::AsyncCommands;

use super::health;

/// How long a tripped circuit stays fully open before probing.
pub const OPEN_SECS: i64 = 120;
/// Trip when the health score drops below this…
pub const TRIP_SCORE: f64 = 0.85;
/// …with at least this many outcomes in the window (hysteresis guard —
/// shared with `health::MIN_VOLUME`).
pub const TRIP_MIN_VOLUME: u64 = health::MIN_VOLUME;
/// Half-open probe budget: one send per this many seconds.
pub const PROBE_INTERVAL_SECS: u64 = 10;
/// Self-clean TTL on the circuit hash.
const CIRCUIT_TTL_SECS: i64 = 3600;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

impl CircuitState {
    pub fn as_str(self) -> &'static str {
        match self {
            CircuitState::Closed => "closed",
            CircuitState::Open => "open",
            CircuitState::HalfOpen => "half_open",
        }
    }
}

/// Persisted snapshot — `opened_at_epoch = None` means no key / closed.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Snapshot {
    pub opened_at_epoch: Option<i64>,
}

/// Outcome fed into the breaker.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Delivered,
    Failed,
}

/// What the caller must persist after a transition.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Action {
    /// No state change.
    None,
    /// (Re-)open: persist `openedAt = now`.
    Open,
    /// Close: delete the circuit key.
    Close,
}

/// Effective state of a snapshot at `now` — open circuits age into
/// half-open after [`OPEN_SECS`].
pub fn effective_state(snap: &Snapshot, now_epoch: i64) -> CircuitState {
    match snap.opened_at_epoch {
        None => CircuitState::Closed,
        Some(at) if now_epoch.saturating_sub(at) < OPEN_SECS => CircuitState::Open,
        Some(_) => CircuitState::HalfOpen,
    }
}

/// Trip condition: enough volume AND a bad score.
pub fn should_trip(score: f64, volume: u64) -> bool {
    volume >= TRIP_MIN_VOLUME && score < TRIP_SCORE
}

/// Pure transition function — the entire breaker state machine.
pub fn transition(
    snap: &Snapshot,
    now_epoch: i64,
    outcome: Outcome,
    score: f64,
    volume: u64,
) -> Action {
    match (effective_state(snap, now_epoch), outcome) {
        // Probe verdicts.
        (CircuitState::HalfOpen, Outcome::Delivered) => Action::Close,
        (CircuitState::HalfOpen, Outcome::Failed) => Action::Open,
        // Closed circuits trip on a failure once the window is bad enough.
        (CircuitState::Closed, Outcome::Failed) if should_trip(score, volume) => Action::Open,
        (CircuitState::Closed, _) => Action::None,
        // Fully open: outcomes from in-flight sends change nothing —
        // the breaker waits out its window.
        (CircuitState::Open, _) => Action::None,
    }
}

fn key(acct: &str, country: &str) -> String {
    format!("sabsms:circuit:{acct}:{country}")
}

fn probe_key(acct: &str, country: &str) -> String {
    format!("sabsms:circuit:probe:{acct}:{country}")
}

fn now_epoch() -> i64 {
    chrono::Utc::now().timestamp()
}

async fn read_snapshot(redis: &mut ConnectionManager, acct: &str, country: &str) -> Snapshot {
    let res: redis::RedisResult<Option<String>> = redis.hget(key(acct, country), "openedAt").await;
    match res {
        Ok(v) => Snapshot {
            opened_at_epoch: v.and_then(|s| s.parse::<i64>().ok()),
        },
        Err(e) => {
            tracing::warn!(?e, acct, country, "circuit read failed; treating as closed");
            Snapshot::default()
        }
    }
}

/// Effective circuit state right now (used by routing + health UI).
pub async fn current_state(
    redis: &mut ConnectionManager,
    acct: &str,
    country: &str,
) -> CircuitState {
    let snap = read_snapshot(redis, acct, country).await;
    effective_state(&snap, now_epoch())
}

/// Send-gate verdict for the worker's candidate loop.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Gate {
    /// Circuit closed — send normally.
    Allow,
    /// Circuit half-open and this send won the probe token.
    Probe,
    /// Circuit open (or half-open with the probe token taken) — skip
    /// this candidate.
    Skip,
}

/// Gate a candidate: closed → `Allow`; open → `Skip`; half-open →
/// at most one `Probe` per [`PROBE_INTERVAL_SECS`] (SET NX EX token).
pub async fn gate(redis: &mut ConnectionManager, acct: &str, country: &str) -> Gate {
    match current_state(redis, acct, country).await {
        CircuitState::Closed => Gate::Allow,
        CircuitState::Open => Gate::Skip,
        CircuitState::HalfOpen => {
            let res: redis::RedisResult<Option<String>> = redis::cmd("SET")
                .arg(probe_key(acct, country))
                .arg("1")
                .arg("NX")
                .arg("EX")
                .arg(PROBE_INTERVAL_SECS)
                .query_async(redis)
                .await;
            match res {
                Ok(Some(_)) => Gate::Probe,
                Ok(None) => Gate::Skip,
                Err(e) => {
                    // Fail open on Redis trouble — losing the probe
                    // throttle is better than losing the message.
                    tracing::warn!(?e, acct, country, "probe token failed; allowing send");
                    Gate::Probe
                }
            }
        }
    }
}

/// Feed an outcome into the breaker. `score`/`volume` must be the
/// freshly-updated health window (read AFTER the corresponding
/// `health::record_*` call).
pub async fn note_outcome(
    redis: &mut ConnectionManager,
    acct: &str,
    country: &str,
    outcome: Outcome,
    score: f64,
    volume: u64,
) {
    let snap = read_snapshot(redis, acct, country).await;
    let now = now_epoch();
    match transition(&snap, now, outcome, score, volume) {
        Action::None => {}
        Action::Open => {
            let k = key(acct, country);
            let res: redis::RedisResult<()> = async {
                let _: () = redis
                    .hset_multiple(&k, &[("state", "open".to_string()), ("openedAt", now.to_string())])
                    .await?;
                let _: i64 = redis.hincr(&k, "failures", 1).await?;
                let _: bool = redis.expire(&k, CIRCUIT_TTL_SECS).await?;
                Ok(())
            }
            .await;
            match res {
                Ok(()) => {
                    tracing::info!(acct, country, score, volume, "circuit opened");
                }
                Err(e) => tracing::warn!(?e, acct, country, "circuit open write failed"),
            }
        }
        Action::Close => {
            let res: redis::RedisResult<i64> = redis.del(key(acct, country)).await;
            match res {
                Ok(_) => tracing::info!(acct, country, "circuit closed after successful probe"),
                Err(e) => tracing::warn!(?e, acct, country, "circuit close write failed"),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const T0: i64 = 1_750_000_000;

    fn closed() -> Snapshot {
        Snapshot::default()
    }

    fn opened_at(at: i64) -> Snapshot {
        Snapshot {
            opened_at_epoch: Some(at),
        }
    }

    #[test]
    fn effective_state_table() {
        let cases: &[(Snapshot, i64, CircuitState)] = &[
            (closed(), T0, CircuitState::Closed),
            // Just opened.
            (opened_at(T0), T0, CircuitState::Open),
            // 119s in — still open.
            (opened_at(T0), T0 + OPEN_SECS - 1, CircuitState::Open),
            // Exactly 120s — half-open.
            (opened_at(T0), T0 + OPEN_SECS, CircuitState::HalfOpen),
            // Way later — still half-open until a probe verdict.
            (opened_at(T0), T0 + 10_000, CircuitState::HalfOpen),
        ];
        for (snap, now, want) in cases {
            assert_eq!(effective_state(snap, *now), *want, "snap={snap:?} now={now}");
        }
    }

    #[test]
    fn trip_condition_requires_volume_and_bad_score() {
        // Bad score, enough volume → trip.
        assert!(should_trip(0.5, 20));
        assert!(should_trip(0.84, 100));
        // Boundary: exactly 0.85 does NOT trip.
        assert!(!should_trip(0.85, 100));
        // Bad score, low volume → never trips (min-volume hysteresis).
        assert!(!should_trip(0.1, 19));
        assert!(!should_trip(0.0, 0));
        // Good score never trips regardless of volume.
        assert!(!should_trip(0.99, 1_000_000));
    }

    #[test]
    fn transition_table() {
        let cases: &[(&str, Snapshot, i64, Outcome, f64, u64, Action)] = &[
            // Closed + healthy failure stats → stay closed.
            ("closed stays on good score", closed(), T0, Outcome::Failed, 0.95, 100, Action::None),
            // Closed + bad window → trip open.
            ("closed trips", closed(), T0, Outcome::Failed, 0.5, 25, Action::Open),
            // Closed + bad score but thin volume → no trip.
            ("closed thin volume", closed(), T0, Outcome::Failed, 0.5, 10, Action::None),
            // Closed + delivered → never opens.
            ("closed delivered", closed(), T0, Outcome::Delivered, 0.5, 100, Action::None),
            // Open (within window): outcomes are ignored.
            ("open ignores failure", opened_at(T0), T0 + 10, Outcome::Failed, 0.1, 100, Action::None),
            ("open ignores delivery", opened_at(T0), T0 + 10, Outcome::Delivered, 0.1, 100, Action::None),
            // Half-open: probe delivered → close.
            ("half_open closes", opened_at(T0), T0 + OPEN_SECS + 1, Outcome::Delivered, 0.1, 100, Action::Close),
            // Half-open: probe failed → re-open (even if score recovered).
            ("half_open reopens", opened_at(T0), T0 + OPEN_SECS + 1, Outcome::Failed, 0.99, 100, Action::Open),
        ];
        for (name, snap, now, outcome, score, volume, want) in cases {
            assert_eq!(
                transition(snap, *now, *outcome, *score, *volume),
                *want,
                "case: {name}"
            );
        }
    }

    #[test]
    fn reopened_circuit_waits_a_full_window_again() {
        // Re-open at T1 (probe failed) → still Open at T1+119, half-open at T1+120.
        let t1 = T0 + OPEN_SECS + 5;
        let snap = opened_at(t1);
        assert_eq!(effective_state(&snap, t1 + OPEN_SECS - 1), CircuitState::Open);
        assert_eq!(effective_state(&snap, t1 + OPEN_SECS), CircuitState::HalfOpen);
    }

    #[test]
    fn state_strings_are_wire_stable() {
        assert_eq!(CircuitState::Closed.as_str(), "closed");
        assert_eq!(CircuitState::Open.as_str(), "open");
        assert_eq!(CircuitState::HalfOpen.as_str(), "half_open");
    }
}
