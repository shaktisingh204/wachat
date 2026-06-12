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

// ---------------------------------------------------------------------------
// V2.7 — OTP conversion stats (architecture decision 8).
//
// Two key families, both two-bucket sliding windows over 1-hour buckets
// (the OTP window is 2h — wider than DLR's 10min because conversions
// are user-paced, not carrier-paced):
//
//   `sabsms:otpstats:{acct}:{country}:{prefix}:{bucket}` — per-prefix
//     sent/converted, read by the fraud zero-conversion ticker and the
//     `/v1/otp/stats` endpoint;
//   `sabsms:otpconv:{acct}:{country}:{bucket}` — the (account, country)
//     aggregate the ROUTER reads to rank `otp`-category candidates by
//     conversion instead of DLR.
//
// `sent` is bumped at OTP ENQUEUE time (not delivery), `converted` on
// successful verify — so the ratio is true end-to-end conversion.
// ---------------------------------------------------------------------------

/// OTP stat bucket width (seconds) — 1h, merged window covers 2h.
pub const OTP_BUCKET_SECS: i64 = 3600;
/// TTL on OTP stat keys — current + previous bucket with slack.
pub const OTP_KEY_TTL_SECS: i64 = 3 * 3600;
/// Below this many OTP sends the conversion score is unavailable and
/// the router falls back to the DLR health score.
pub const OTP_MIN_VOLUME: u64 = 10;

pub fn otp_bucket_of(epoch_secs: i64) -> i64 {
    epoch_secs.div_euclid(OTP_BUCKET_SECS)
}

fn otpstats_key(acct: &str, country: &str, prefix: &str, bucket: i64) -> String {
    format!("sabsms:otpstats:{acct}:{country}:{prefix}:{bucket}")
}

fn otpconv_key(acct: &str, country: &str, bucket: i64) -> String {
    format!("sabsms:otpconv:{acct}:{country}:{bucket}")
}

async fn incr_otp_field(
    redis: &mut ConnectionManager,
    acct: &str,
    country: &str,
    prefix: &str,
    field: &str,
) {
    let bucket = otp_bucket_of(now_epoch());
    let keys = [
        otpstats_key(acct, country, prefix, bucket),
        otpconv_key(acct, country, bucket),
    ];
    for k in keys {
        let res: redis::RedisResult<()> = async {
            let _: i64 = redis.hincr(&k, field, 1).await?;
            let _: bool = redis.expire(&k, OTP_KEY_TTL_SECS).await?;
            Ok(())
        }
        .await;
        if let Err(e) = res {
            tracing::warn!(?e, acct, country, prefix, field, "otp stat write failed");
        }
    }
}

/// OTP enqueue hook — `sent++` for (account, country, prefix). Called
/// from `otp::send`/`otp::resend` at enqueue time (NOT delivery).
pub async fn record_otp_sent(
    redis: &mut ConnectionManager,
    acct: &str,
    country: &str,
    prefix: &str,
) {
    incr_otp_field(redis, acct, country, prefix, "sent").await;
}

/// OTP conversion hook — `converted++`; called from `otp::verify` on a
/// successful constant-time code match. This is the (formerly no-op)
/// seam the V2.6 router left for V2.7.
pub async fn record_conversion(
    redis: &mut ConnectionManager,
    acct: &str,
    country: &str,
    prefix: &str,
) {
    incr_otp_field(redis, acct, country, prefix, "converted").await;
}

/// Laplace-smoothed conversion score `(converted + 1) / (sent + 2)`,
/// or `None` below [`OTP_MIN_VOLUME`] sends (router then falls back to
/// the DLR score — never punish a cold account).
pub fn otp_conversion_score(sent: u64, converted: u64) -> Option<f64> {
    if sent < OTP_MIN_VOLUME {
        return None;
    }
    Some((converted as f64 + 1.0) / (sent as f64 + 2.0))
}

/// Merged (current + previous bucket) `(sent, converted)` from the
/// per-(account, country) aggregate the router reads.
pub async fn read_otp_stats(
    redis: &mut ConnectionManager,
    acct: &str,
    country: &str,
) -> (u64, u64) {
    let now_bucket = otp_bucket_of(now_epoch());
    let mut sent = 0u64;
    let mut converted = 0u64;
    for bucket in [now_bucket, now_bucket - 1] {
        let k = otpconv_key(acct, country, bucket);
        let res: redis::RedisResult<std::collections::HashMap<String, String>> =
            redis.hgetall(&k).await;
        match res {
            Ok(map) => {
                let get = |f: &str| map.get(f).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
                sent += get("sent");
                converted += get("converted");
            }
            Err(e) => {
                tracing::warn!(?e, acct, country, "otp stat read failed");
            }
        }
    }
    (sent, converted)
}

/// Conversion score for the router's OTP-category ordering, or `None`
/// when the account is below min-volume (callers fall back to DLR).
pub async fn otp_score(redis: &mut ConnectionManager, acct: &str, country: &str) -> Option<f64> {
    let (sent, converted) = read_otp_stats(redis, acct, country).await;
    otp_conversion_score(sent, converted)
}

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
    fn otp_conversion_score_is_none_below_min_volume() {
        assert_eq!(otp_conversion_score(0, 0), None);
        assert_eq!(otp_conversion_score(9, 9), None);
        // At exactly min volume the score kicks in.
        assert!(otp_conversion_score(10, 0).is_some());
    }

    #[test]
    fn otp_conversion_score_uses_laplace_smoothing() {
        // 10 sent, 8 converted → (8+1)/(10+2) = 9/12 = 0.75.
        let s = otp_conversion_score(10, 8).unwrap();
        assert!((s - 0.75).abs() < 1e-12);
        // Zero conversions never score exactly 0 (Laplace floor).
        let s = otp_conversion_score(30, 0).unwrap();
        assert!((s - 1.0 / 32.0).abs() < 1e-12);
        assert!(s > 0.0);
    }

    #[test]
    fn otp_conversion_score_orders_better_converters_higher() {
        let high = otp_conversion_score(100, 90).unwrap();
        let low = otp_conversion_score(100, 40).unwrap();
        assert!(high > low);
    }

    #[test]
    fn otp_bucket_rotation_is_one_hour() {
        assert_eq!(otp_bucket_of(0), 0);
        assert_eq!(otp_bucket_of(3599), 0);
        assert_eq!(otp_bucket_of(3600), 1);
        assert_eq!(otp_bucket_of(7200), 2);
    }
}
