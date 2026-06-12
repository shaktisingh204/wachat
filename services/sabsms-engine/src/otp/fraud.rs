//! OTP fraud guard — default ON (V2.7, differentiator #10).
//!
//! Three layers, evaluated on EVERY `/v1/otp/send` + `/v1/otp/resend`:
//!
//!   1. velocity — per-destination-phone (5/h), per-prefix-per-workspace
//!      (60/h), both plain `INCR` + `EX 3600` counters;
//!   2. new-destination burst — HyperLogLog
//!      `sabsms:fraud:dest:{ws}:{country}:{hour}`; > 500 distinct
//!      destinations/hour flags the workspace (pumping signature);
//!   3. zero-conversion blocklist — `sabsms_fraud_blocks` rows
//!      (workspace-scoped, or global when `workspaceId` is null),
//!      prefix-matched against the destination. Auto-populated by
//!      [`run_ticker`]: any prefix with ≥ 30 sends and 0 conversions
//!      in the 2h otpstats window gets a 24h global block.
//!
//! `SABSMS_FRAUD_MODE` = `enforce` (default) | `monitor` (Block
//! verdicts demote to Flag — logged + evented but allowed; the planned
//! 2-week soak mode) | `off`.

use std::sync::Arc;

use mongodb::bson::{doc, Document};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;

use crate::{
    db,
    events::{self, EngineEvent},
    state::AppState,
};

/// Max OTP sends per destination phone per hour (per workspace).
pub const MAX_PHONE_SENDS_PER_HOUR: i64 = 5;
/// Max OTP sends per destination prefix per hour per workspace.
pub const MAX_PREFIX_SENDS_PER_HOUR: i64 = 60;
/// Distinct destinations per (workspace, country) per hour before the
/// burst detector flags.
pub const MAX_NEW_DESTINATIONS_PER_HOUR: i64 = 500;
/// Zero-conversion auto-block: at least this many sends with 0
/// conversions in the otpstats window.
pub const ZERO_CONVERSION_MIN_SENT: u64 = 30;
/// Auto-block rows expire after 24h.
pub const AUTO_BLOCK_TTL_SECS: i64 = 24 * 3600;

/// Operating mode (`SABSMS_FRAUD_MODE`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FraudMode {
    Enforce,
    Monitor,
    Off,
}

impl FraudMode {
    pub fn parse(s: &str) -> FraudMode {
        match s.trim().to_ascii_lowercase().as_str() {
            "monitor" => FraudMode::Monitor,
            "off" => FraudMode::Off,
            // Default ON — anything unrecognised enforces.
            _ => FraudMode::Enforce,
        }
    }

    pub fn from_env() -> FraudMode {
        FraudMode::parse(&std::env::var("SABSMS_FRAUD_MODE").unwrap_or_default())
    }

    pub fn as_str(self) -> &'static str {
        match self {
            FraudMode::Enforce => "enforce",
            FraudMode::Monitor => "monitor",
            FraudMode::Off => "off",
        }
    }
}

/// Fraud verdict for one send.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Verdict {
    Allow,
    /// Reject the send (`{ error: "fraud_blocked", code }`).
    Block { code: &'static str },
    /// Suspicious but allowed — logged + `FraudBlocked` event.
    Flag { code: &'static str },
}

/// E.164 prefix used for velocity buckets, blocklist rows and
/// conversion stats: the first 8 chars (e.g. `+1415555`).
pub fn prefix8(e164: &str) -> String {
    e164.chars().take(8).collect()
}

/// Pure verdict table over the gathered counters. Counter values are
/// AFTER this send's increment, so the Nth send is the first one past
/// an `N-1` cap.
pub fn evaluate(
    blocklisted: bool,
    phone_sends_hour: i64,
    prefix_sends_hour: i64,
    distinct_dests_hour: i64,
) -> Verdict {
    if blocklisted {
        return Verdict::Block { code: "blocklist" };
    }
    if phone_sends_hour > MAX_PHONE_SENDS_PER_HOUR {
        return Verdict::Block { code: "velocity_phone" };
    }
    if prefix_sends_hour > MAX_PREFIX_SENDS_PER_HOUR {
        return Verdict::Block { code: "velocity_prefix" };
    }
    if distinct_dests_hour > MAX_NEW_DESTINATIONS_PER_HOUR {
        return Verdict::Flag { code: "dest_burst" };
    }
    Verdict::Allow
}

/// Apply the operating mode: `off` allows everything, `monitor`
/// demotes Block → Flag, `enforce` passes verdicts through.
pub fn apply_mode(mode: FraudMode, verdict: Verdict) -> Verdict {
    match (mode, verdict) {
        (FraudMode::Off, _) => Verdict::Allow,
        (FraudMode::Monitor, Verdict::Block { code }) => Verdict::Flag { code },
        (_, v) => v,
    }
}

fn hour_bucket(epoch_secs: i64) -> i64 {
    epoch_secs.div_euclid(3600)
}

async fn incr_hour_counter(redis: &mut ConnectionManager, key: &str) -> i64 {
    let res: redis::RedisResult<i64> = async {
        let n: i64 = redis.incr(key, 1).await?;
        let _: bool = redis.expire(key, 3600).await?;
        Ok(n)
    }
    .await;
    match res {
        Ok(n) => n,
        Err(e) => {
            // Fail OPEN on Redis hiccups — fraud guarding must never
            // take legitimate OTP delivery down with it.
            tracing::warn!(?e, key, "fraud counter failed; treating as 0");
            0
        }
    }
}

/// `Some(prefix)` when a blocklist row covers this destination —
/// workspace rows first, then global (`workspaceId: null`) rows.
/// Expired rows are excluded (belt + the Mongo TTL braces).
async fn blocklist_match(
    state: &Arc<AppState>,
    workspace_id: &str,
    to_e164: &str,
) -> Option<String> {
    // Every prefix of the destination, shortest 2 chars ("+1") up.
    let prefixes: Vec<String> = (2..=to_e164.chars().count())
        .map(|n| to_e164.chars().take(n).collect())
        .collect();
    if prefixes.is_empty() {
        return None;
    }
    let now = mongodb::bson::DateTime::now();
    let col = state.mongo.collection::<Document>(db::COL_FRAUD_BLOCKS);
    let filter = doc! {
        "prefix": { "$in": &prefixes },
        "$and": [
            { "$or": [
                { "workspaceId": workspace_id },
                { "workspaceId": mongodb::bson::Bson::Null },
                { "workspaceId": { "$exists": false } },
            ]},
            { "$or": [
                { "expiresAt": { "$exists": false } },
                { "expiresAt": mongodb::bson::Bson::Null },
                { "expiresAt": { "$gt": now } },
            ]},
        ],
    };
    match col.find_one(filter).await {
        Ok(Some(d)) => {
            let prefix = d.get_str("prefix").unwrap_or_default().to_string();
            // Best-effort hit counter on the matched row.
            if let Ok(id) = d.get_object_id("_id") {
                let _ = col
                    .update_one(doc! { "_id": id }, doc! { "$inc": { "hits": 1 } })
                    .await;
            }
            Some(prefix)
        }
        Ok(None) => None,
        Err(e) => {
            tracing::warn!(?e, workspace = %workspace_id, "fraud blocklist query failed");
            None // fail open
        }
    }
}

/// Run the full pre-send check. Counters are bumped as a side effect
/// (the send is ABOUT to happen; a subsequent Block means it didn't,
/// which only makes the guard stricter). Emits `FraudBlocked` for both
/// Block and Flag outcomes so the review queue sees monitor-mode hits.
pub async fn pre_check(
    state: &Arc<AppState>,
    workspace_id: &str,
    to_e164: &str,
    country: &str,
) -> Verdict {
    let mode = FraudMode::from_env();
    if mode == FraudMode::Off {
        return Verdict::Allow;
    }

    let mut redis = state.redis.clone();
    let prefix = prefix8(to_e164);
    let hour = hour_bucket(chrono::Utc::now().timestamp());

    let phone_key = format!("sabsms:fraud:phone:{workspace_id}:{to_e164}");
    let prefix_key = format!("sabsms:fraud:prefix:{workspace_id}:{prefix}");
    let phone_sends = incr_hour_counter(&mut redis, &phone_key).await;
    let prefix_sends = incr_hour_counter(&mut redis, &prefix_key).await;

    // Distinct-destination HLL for the burst detector.
    let dest_key = format!("sabsms:fraud:dest:{workspace_id}:{country}:{hour}");
    let distinct: i64 = {
        let res: redis::RedisResult<i64> = async {
            let _: i64 = redis::cmd("PFADD")
                .arg(&dest_key)
                .arg(to_e164)
                .query_async(&mut redis)
                .await?;
            let _: bool = redis.expire(&dest_key, 7200).await?;
            let n: i64 = redis::cmd("PFCOUNT").arg(&dest_key).query_async(&mut redis).await?;
            Ok(n)
        }
        .await;
        res.unwrap_or_else(|e| {
            tracing::warn!(?e, "fraud HLL failed; treating as 0");
            0
        })
    };

    let blocked_prefix = blocklist_match(state, workspace_id, to_e164).await;

    let verdict = apply_mode(
        mode,
        evaluate(blocked_prefix.is_some(), phone_sends, prefix_sends, distinct),
    );

    match &verdict {
        Verdict::Allow => {}
        Verdict::Block { code } | Verdict::Flag { code } => {
            tracing::warn!(
                workspace = %workspace_id,
                code,
                mode = mode.as_str(),
                prefix = %prefix,
                "otp fraud guard hit"
            );
            events::emit(
                &mut redis,
                &EngineEvent::FraudBlocked {
                    workspace_id: workspace_id.to_string(),
                    code: code.to_string(),
                    to_prefix: prefix.clone(),
                },
            )
            .await;
        }
    }
    verdict
}

// ---------------------------------------------------------------------------
// Zero-conversion auto-blocklist ticker
// ---------------------------------------------------------------------------

/// Parsed otpstats key → (acct, country, prefix). Key shape:
/// `sabsms:otpstats:{acct}:{country}:{prefix}:{bucket}`.
pub fn parse_otpstats_key(key: &str) -> Option<(String, String, String)> {
    let parts: Vec<&str> = key.split(':').collect();
    if parts.len() != 6 || parts[0] != "sabsms" || parts[1] != "otpstats" {
        return None;
    }
    Some((parts[2].to_string(), parts[3].to_string(), parts[4].to_string()))
}

/// Pure: does this (sent, converted) window deserve an auto-block?
pub fn deserves_zero_conversion_block(sent: u64, converted: u64) -> bool {
    sent >= ZERO_CONVERSION_MIN_SENT && converted == 0
}

/// 60s ticker: scan the otpstats window; any prefix with
/// ≥ [`ZERO_CONVERSION_MIN_SENT`] sends and zero conversions gets a
/// GLOBAL block row (24h expiry, reason `zero_conversion`) + a
/// `FraudBlockAdded` event. Runs forever; every failure is logged and
/// retried next tick.
pub async fn run_ticker(state: Arc<AppState>) {
    loop {
        if FraudMode::from_env() != FraudMode::Off {
            if let Err(e) = tick(&state).await {
                tracing::warn!(?e, "fraud zero-conversion tick failed");
            }
        }
        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
    }
}

async fn tick(state: &Arc<AppState>) -> anyhow::Result<()> {
    let mut redis = state.redis.clone();

    // Aggregate sent/converted per (acct, country, prefix) across the
    // window's live buckets.
    let mut totals: std::collections::HashMap<(String, String, String), (u64, u64)> =
        std::collections::HashMap::new();
    let mut cursor: u64 = 0;
    loop {
        let (next, keys): (u64, Vec<String>) = redis::cmd("SCAN")
            .arg(cursor)
            .arg("MATCH")
            .arg("sabsms:otpstats:*")
            .arg("COUNT")
            .arg(200)
            .query_async(&mut redis)
            .await?;
        for key in keys {
            let Some(id) = parse_otpstats_key(&key) else {
                continue;
            };
            let map: std::collections::HashMap<String, String> = redis.hgetall(&key).await?;
            let get = |f: &str| map.get(f).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
            let entry = totals.entry(id).or_insert((0, 0));
            entry.0 += get("sent");
            entry.1 += get("converted");
        }
        cursor = next;
        if cursor == 0 {
            break;
        }
    }

    let col = state.mongo.collection::<Document>(db::COL_FRAUD_BLOCKS);
    for ((_acct, _country, prefix), (sent, converted)) in totals {
        if !deserves_zero_conversion_block(sent, converted) {
            continue;
        }
        let now = chrono::Utc::now();
        let expires =
            mongodb::bson::DateTime::from_millis((now.timestamp() + AUTO_BLOCK_TTL_SECS) * 1000);
        let now_bson = mongodb::bson::DateTime::from_millis(now.timestamp_millis());
        let res = col
            .update_one(
                doc! {
                    "workspaceId": mongodb::bson::Bson::Null,
                    "prefix": &prefix,
                    "reason": "zero_conversion",
                },
                doc! {
                    "$set": { "expiresAt": expires },
                    "$setOnInsert": {
                        "workspaceId": mongodb::bson::Bson::Null,
                        "prefix": &prefix,
                        "reason": "zero_conversion",
                        "hits": 0_i64,
                        "createdAt": now_bson,
                    },
                },
            )
            .upsert(true)
            .await?;
        if res.upserted_id.is_some() {
            tracing::warn!(prefix = %prefix, sent, "zero-conversion prefix auto-blocked (24h)");
            events::emit(
                &mut redis,
                &EngineEvent::FraudBlockAdded {
                    prefix: prefix.clone(),
                    reason: "zero_conversion".to_string(),
                },
            )
            .await;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefix8_takes_first_eight_chars() {
        assert_eq!(prefix8("+14155552671"), "+1415555");
        assert_eq!(prefix8("+919812345678"), "+9198123");
        // Shorter than 8 → the whole string.
        assert_eq!(prefix8("+1415"), "+1415");
    }

    #[test]
    fn verdict_table_velocity_boundaries() {
        // Phone: 5/h allowed, the 6th blocks.
        assert_eq!(evaluate(false, 5, 1, 1), Verdict::Allow);
        assert_eq!(evaluate(false, 6, 1, 1), Verdict::Block { code: "velocity_phone" });
        // Prefix: 60/h allowed, the 61st blocks.
        assert_eq!(evaluate(false, 1, 60, 1), Verdict::Allow);
        assert_eq!(evaluate(false, 1, 61, 1), Verdict::Block { code: "velocity_prefix" });
        // Destination burst: 500 distinct allowed, 501 flags (not blocks).
        assert_eq!(evaluate(false, 1, 1, 500), Verdict::Allow);
        assert_eq!(evaluate(false, 1, 1, 501), Verdict::Flag { code: "dest_burst" });
    }

    #[test]
    fn verdict_table_blocklist_wins_first() {
        assert_eq!(evaluate(true, 0, 0, 0), Verdict::Block { code: "blocklist" });
        // Blocklist outranks every other signal.
        assert_eq!(evaluate(true, 99, 99, 999), Verdict::Block { code: "blocklist" });
    }

    #[test]
    fn monitor_mode_demotes_blocks_to_flags() {
        let block = Verdict::Block { code: "velocity_phone" };
        assert_eq!(
            apply_mode(FraudMode::Monitor, block.clone()),
            Verdict::Flag { code: "velocity_phone" }
        );
        // Flags stay flags; allows stay allows.
        assert_eq!(
            apply_mode(FraudMode::Monitor, Verdict::Flag { code: "dest_burst" }),
            Verdict::Flag { code: "dest_burst" }
        );
        assert_eq!(apply_mode(FraudMode::Monitor, Verdict::Allow), Verdict::Allow);
        // Enforce passes through; off allows everything.
        assert_eq!(apply_mode(FraudMode::Enforce, block.clone()), block);
        assert_eq!(apply_mode(FraudMode::Off, block), Verdict::Allow);
    }

    #[test]
    fn fraud_mode_parses_with_enforce_default() {
        assert_eq!(FraudMode::parse("enforce"), FraudMode::Enforce);
        assert_eq!(FraudMode::parse("MONITOR"), FraudMode::Monitor);
        assert_eq!(FraudMode::parse("off"), FraudMode::Off);
        // Default ON: empty/garbage enforces.
        assert_eq!(FraudMode::parse(""), FraudMode::Enforce);
        assert_eq!(FraudMode::parse("nonsense"), FraudMode::Enforce);
    }

    #[test]
    fn otpstats_key_parser_round_trips() {
        assert_eq!(
            parse_otpstats_key("sabsms:otpstats:acct1:US:+1415555:493043"),
            Some(("acct1".into(), "US".into(), "+1415555".into()))
        );
        assert_eq!(parse_otpstats_key("sabsms:otpconv:acct1:US:493043"), None);
        assert_eq!(parse_otpstats_key("garbage"), None);
    }

    #[test]
    fn zero_conversion_block_threshold() {
        assert!(!deserves_zero_conversion_block(29, 0));
        assert!(deserves_zero_conversion_block(30, 0));
        assert!(deserves_zero_conversion_block(1000, 0));
        // A single conversion clears the prefix.
        assert!(!deserves_zero_conversion_block(1000, 1));
    }
}
