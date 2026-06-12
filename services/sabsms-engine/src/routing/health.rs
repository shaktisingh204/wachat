//! Per-(providerAccountId, destCountry) rolling delivery health.
//!
//! Stats live in Redis hashes keyed
//! `sabsms:health:{acct}:{country}:{bucket}` where `bucket =
//! floor(epoch / 300)` — a two-bucket rotation: writes go to the
//! current 5-minute bucket, reads merge the current + previous bucket,
//! and every key carries a 900s TTL so stale buckets self-expire. This
//! is the simplest correct sliding-window decay: the window covers the
//! last 5–10 minutes of outcomes and old data never lingers.
//!
//! Fields: `sent`, `delivered`, `failed`, `lastDlrMs`.
//!
//! All write hooks are BEST-EFFORT — a Redis hiccup must never fail a
//! send or a webhook ack.

use redis::aio::ConnectionManager;
use redis::AsyncCommands;

/// Bucket width (seconds).
pub const BUCKET_SECS: i64 = 300;
/// Key TTL — covers current + previous bucket with slack.
pub const KEY_TTL_SECS: i64 = 900;
/// Below this many delivered+failed outcomes the score is neutral 1.0
/// (no evidence either way — never punish a cold account).
pub const MIN_VOLUME: u64 = 20;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct HealthStats {
    pub sent: u64,
    pub delivered: u64,
    pub failed: u64,
    pub last_dlr_ms: Option<i64>,
}

impl HealthStats {
    /// Delivered + failed — the outcome volume the score is based on.
    pub fn volume(&self) -> u64 {
        self.delivered + self.failed
    }

    pub fn score(&self) -> f64 {
        health_score(self.delivered, self.failed)
    }
}

/// Laplace-smoothed delivery rate with a min-volume guard:
/// `(delivered + 1) / (delivered + failed + 2)`; fewer than
/// [`MIN_VOLUME`] outcomes → neutral 1.0.
pub fn health_score(delivered: u64, failed: u64) -> f64 {
    let volume = delivered + failed;
    if volume < MIN_VOLUME {
        return 1.0;
    }
    (delivered as f64 + 1.0) / (volume as f64 + 2.0)
}

pub fn bucket_of(epoch_secs: i64) -> i64 {
    epoch_secs.div_euclid(BUCKET_SECS)
}

fn key(acct: &str, country: &str, bucket: i64) -> String {
    format!("sabsms:health:{acct}:{country}:{bucket}")
}

fn now_epoch() -> i64 {
    chrono::Utc::now().timestamp()
}

async fn incr_field(redis: &mut ConnectionManager, acct: &str, country: &str, field: &str) {
    let k = key(acct, country, bucket_of(now_epoch()));
    let res: redis::RedisResult<()> = async {
        let _: i64 = redis.hincr(&k, field, 1).await?;
        let _: bool = redis.expire(&k, KEY_TTL_SECS).await?;
        Ok(())
    }
    .await;
    if let Err(e) = res {
        tracing::warn!(?e, acct, country, field, "health stat write failed");
    }
}

/// Worker hook: a provider accepted the message synchronously.
pub async fn record_sent(redis: &mut ConnectionManager, acct: &str, country: &str) {
    incr_field(redis, acct, country, "sent").await;
}

/// DLR hook: terminal `delivered`, with optional submit→DLR latency.
pub async fn record_delivered(
    redis: &mut ConnectionManager,
    acct: &str,
    country: &str,
    latency_ms: Option<i64>,
) {
    let k = key(acct, country, bucket_of(now_epoch()));
    let res: redis::RedisResult<()> = async {
        let _: i64 = redis.hincr(&k, "delivered", 1).await?;
        if let Some(ms) = latency_ms {
            let _: () = redis.hset(&k, "lastDlrMs", ms).await?;
        }
        let _: bool = redis.expire(&k, KEY_TTL_SECS).await?;
        Ok(())
    }
    .await;
    if let Err(e) = res {
        tracing::warn!(?e, acct, country, "health delivered write failed");
    }
}

/// Hook for terminal failures: synchronous provider rejection in the
/// worker, or a `failed`/`undelivered` DLR.
pub async fn record_failed(redis: &mut ConnectionManager, acct: &str, country: &str) {
    incr_field(redis, acct, country, "failed").await;
}

/// OTP conversion hook — V2.7 calls this from `otp/verify` so the
/// router can rank the `otp` category by CONVERSION rate instead of
/// DLR rate (architecture decision 8). No-op until then; the seam is
/// kept visible so the V2.7 wiring is a one-liner.
pub fn record_conversion(_acct: &str, _country: &str) {}

/// Read the merged (current + previous bucket) stats.
pub async fn read_stats(redis: &mut ConnectionManager, acct: &str, country: &str) -> HealthStats {
    let now_bucket = bucket_of(now_epoch());
    let mut merged = HealthStats::default();
    for bucket in [now_bucket, now_bucket - 1] {
        let k = key(acct, country, bucket);
        let res: redis::RedisResult<std::collections::HashMap<String, String>> =
            redis.hgetall(&k).await;
        match res {
            Ok(map) => {
                let get = |f: &str| map.get(f).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
                merged.sent += get("sent");
                merged.delivered += get("delivered");
                merged.failed += get("failed");
                if merged.last_dlr_ms.is_none() {
                    merged.last_dlr_ms = map.get("lastDlrMs").and_then(|v| v.parse::<i64>().ok());
                }
            }
            Err(e) => {
                tracing::warn!(?e, acct, country, "health stat read failed");
            }
        }
    }
    merged
}

/// `(score, volume)` for the circuit breaker + route ordering.
pub async fn score_and_volume(
    redis: &mut ConnectionManager,
    acct: &str,
    country: &str,
) -> (f64, u64) {
    let stats = read_stats(redis, acct, country).await;
    (stats.score(), stats.volume())
}

/// Enumerate the destination countries an account has stats for, by
/// SCANning `sabsms:health:{acct}:*`. Used by `GET /v1/health/providers`.
pub async fn countries_for_account(redis: &mut ConnectionManager, acct: &str) -> Vec<String> {
    let pattern = format!("sabsms:health:{acct}:*");
    let mut countries: Vec<String> = Vec::new();
    let mut cursor: u64 = 0;
    loop {
        let res: redis::RedisResult<(u64, Vec<String>)> = redis::cmd("SCAN")
            .arg(cursor)
            .arg("MATCH")
            .arg(&pattern)
            .arg("COUNT")
            .arg(200)
            .query_async(redis)
            .await;
        let (next, keys) = match res {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(?e, acct, "health key scan failed");
                break;
            }
        };
        for k in keys {
            // sabsms:health:{acct}:{country}:{bucket}
            let parts: Vec<&str> = k.split(':').collect();
            if parts.len() == 5 {
                let country = parts[3].to_string();
                if !countries.contains(&country) {
                    countries.push(country);
                }
            }
        }
        cursor = next;
        if cursor == 0 {
            break;
        }
    }
    countries.sort();
    countries
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn score_is_neutral_below_min_volume() {
        // 0 outcomes → neutral.
        assert_eq!(health_score(0, 0), 1.0);
        // 19 outcomes (even all failures) → still neutral.
        assert_eq!(health_score(0, 19), 1.0);
        assert_eq!(health_score(10, 9), 1.0);
    }

    #[test]
    fn score_uses_laplace_smoothing_at_volume() {
        // 20 delivered, 0 failed → (20+1)/(20+2) = 21/22.
        let s = health_score(20, 0);
        assert!((s - 21.0 / 22.0).abs() < 1e-12);
        // 0 delivered, 20 failed → 1/22 — bad but never exactly 0.
        let s = health_score(0, 20);
        assert!((s - 1.0 / 22.0).abs() < 1e-12);
        assert!(s > 0.0);
    }

    #[test]
    fn score_orders_healthier_accounts_higher() {
        assert!(health_score(95, 5) > health_score(80, 20));
        assert!(health_score(80, 20) > health_score(50, 50));
    }

    #[test]
    fn score_at_exact_trip_boundary() {
        // 17/20 delivered → (17+1)/22 ≈ 0.818 < 0.85 (would trip);
        // 19/20 delivered → 20/22 ≈ 0.909 (would not).
        assert!(health_score(17, 3) < 0.85);
        assert!(health_score(19, 1) > 0.85);
    }

    #[test]
    fn stats_volume_and_score_helpers() {
        let stats = HealthStats {
            sent: 100,
            delivered: 30,
            failed: 10,
            last_dlr_ms: Some(1200),
        };
        assert_eq!(stats.volume(), 40);
        assert!((stats.score() - 31.0 / 42.0).abs() < 1e-12);
    }

    #[test]
    fn bucket_rotation_is_five_minutes() {
        assert_eq!(bucket_of(0), 0);
        assert_eq!(bucket_of(299), 0);
        assert_eq!(bucket_of(300), 1);
        assert_eq!(bucket_of(599), 1);
        assert_eq!(bucket_of(600), 2);
    }

    #[test]
    fn conversion_hook_is_a_visible_noop_seam() {
        // V2.7 replaces the body; the signature is the contract.
        record_conversion("acct", "US");
    }
}
