//! Cross-provider failover routing (V2.6).
//!
//! [`select`] turns a message context into an ORDERED list of route
//! candidates:
//!
//!   1. sticky sender (Redis `sabsms:sticky:{ws}:{e164}`, 30d) — moved
//!      to the front when present and its circuit isn't open;
//!   2. the first matching policy rule's routes, weight-ordered
//!      (highest first; equal weights ranked by health score);
//!   3. the fallback — the message doc's own provider/account exactly
//!      as the pre-V2.6 worker resolved it, so messages NEVER fail for
//!      lack of a policy.
//!
//! The worker walks the candidates and fails over ONLY on synchronous
//! provider rejection (never on timeout — double-send risk).

pub mod circuit;
pub mod health;
pub mod policy;

use std::collections::HashMap;
use std::sync::Arc;

use mongodb::bson::{doc, oid::ObjectId, Document};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use sha2::{Digest, Sha256};

use crate::{db, state::AppState, types::ProviderId};

/// Sticky-sender TTL: 30 days.
pub const STICKY_TTL_SECS: u64 = 30 * 24 * 60 * 60;

/// Everything `select` needs to know about the outbound message.
pub struct RoutingContext<'a> {
    pub workspace_id: &'a str,
    pub to_e164: &'a str,
    /// ISO-3166 alpha-2 destination country (see [`country_of`]).
    pub country: &'a str,
    /// Category in its snake_case wire form (e.g. "marketing").
    pub category: &'a str,
    /// Channel wire form ("sms" | "mms" | "rcs").
    pub channel: &'a str,
    /// The provider recorded on the message doc (`None` when the doc's
    /// provider string has no engine adapter).
    pub doc_provider: Option<ProviderId>,
    /// Explicit account pinned on the doc at enqueue time, if any.
    pub doc_provider_account_id: Option<&'a str>,
}

/// Where a candidate came from (observability + preview endpoint).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CandidateSource {
    Sticky,
    Rule,
    Fallback,
}

impl CandidateSource {
    pub fn as_str(self) -> &'static str {
        match self {
            CandidateSource::Sticky => "sticky",
            CandidateSource::Rule => "rule",
            CandidateSource::Fallback => "fallback",
        }
    }
}

#[derive(Clone, Debug)]
pub struct RouteCandidate {
    /// `None` = resolve the workspace default / env fallback for the
    /// provider (the pre-V2.6 `creds::resolve` behaviour).
    pub provider_account_id: Option<String>,
    pub provider: ProviderId,
    /// Sender override (sticky `from` or a pool-selected number).
    pub from_override: Option<String>,
    /// Write the sticky key on success.
    pub sticky_sender: bool,
    /// The rule that produced this candidate, when source == Rule.
    pub rule_id: Option<String>,
    pub source: CandidateSource,
}

fn sticky_key(workspace_id: &str, to_e164: &str) -> String {
    format!("sabsms:sticky:{workspace_id}:{to_e164}")
}

/// Build the ordered candidate list. Never returns an empty vec unless
/// the doc's provider has no adapter AND no policy rule matched.
pub async fn select(state: &Arc<AppState>, ctx: &RoutingContext<'_>) -> Vec<RouteCandidate> {
    // Test mode: SABSMS_PROVIDER_MOCK forces the mock adapter and
    // bypasses policies entirely (mirrors the pre-V2.6 worker).
    if ctx.doc_provider == Some(ProviderId::Mock) {
        return vec![RouteCandidate {
            provider_account_id: None,
            provider: ProviderId::Mock,
            from_override: None,
            sticky_sender: false,
            rule_id: None,
            source: CandidateSource::Fallback,
        }];
    }

    let mut redis = state.redis.clone();

    // Active provider accounts for the workspace: id → provider. Routes
    // referencing unknown / inactive accounts are silently dropped.
    let accounts = active_accounts(state, ctx.workspace_id).await;

    let mut candidates: Vec<RouteCandidate> = Vec::new();

    // 1. Policy rule candidates.
    let policy = policy::load(state, ctx.workspace_id).await;
    if let Some(p) = policy.as_ref() {
        let mctx = policy::MatchContext {
            country: ctx.country,
            category: ctx.category,
            channel: ctx.channel,
            to_e164: ctx.to_e164,
        };
        if let Some(rule) = policy::first_match(&p.rules, &mctx) {
            // Scores for the equal-weight tie-break. OTP-category
            // messages rank by CONVERSION rate (architecture decision
            // 8) — falling back to the DLR health score when an
            // account is below the OTP min-volume; everything else
            // ranks by DLR health.
            let use_conversion = ctx.category == "otp";
            let mut scores: HashMap<String, f64> = HashMap::new();
            for r in &rule.routes {
                if accounts.contains_key(&r.provider_account_id)
                    && !scores.contains_key(&r.provider_account_id)
                {
                    let acct = r.provider_account_id.as_str();
                    let conv = if use_conversion {
                        health::otp_score(&mut redis, acct, ctx.country).await
                    } else {
                        None
                    };
                    let score = match conv {
                        Some(s) => s,
                        None => health::score_and_volume(&mut redis, acct, ctx.country).await.0,
                    };
                    scores.insert(r.provider_account_id.clone(), score);
                }
            }
            let ordered = policy::order_routes(&rule.routes, |acct| {
                scores.get(acct).copied().unwrap_or(1.0)
            });

            // Pool sender override (applies to every candidate the rule
            // produces).
            let from_override = match &rule.pool {
                Some(pool) if !pool.number_ids.is_empty() => {
                    pool_from_override(state, &mut redis, ctx, rule.id.as_str(), pool).await
                }
                _ => None,
            };

            for r in ordered {
                let Some(provider) = accounts.get(&r.provider_account_id).copied() else {
                    continue; // unknown or inactive account
                };
                candidates.push(RouteCandidate {
                    provider_account_id: Some(r.provider_account_id.clone()),
                    provider,
                    from_override: from_override.clone(),
                    sticky_sender: rule.sticky_sender,
                    rule_id: Some(rule.id.clone()),
                    source: CandidateSource::Rule,
                });
            }
        }
    }

    // 2. Fallback — exactly the pre-V2.6 single-candidate behaviour
    //    (doc provider + optional explicit account → creds::resolve).
    if let Some(provider) = ctx.doc_provider {
        candidates.push(RouteCandidate {
            provider_account_id: ctx.doc_provider_account_id.map(|s| s.to_string()),
            provider,
            from_override: None,
            sticky_sender: false,
            rule_id: None,
            source: CandidateSource::Fallback,
        });
    }

    let mut candidates = dedup_candidates(candidates);

    // 3. Sticky sender: move the pinned account to the front (with its
    //    pinned `from`) unless its circuit is open.
    let sticky: Option<String> = redis
        .get::<_, Option<String>>(sticky_key(ctx.workspace_id, ctx.to_e164))
        .await
        .unwrap_or_else(|e| {
            tracing::warn!(?e, "sticky lookup failed");
            None
        });
    if let Some(raw) = sticky {
        if let Some((acct, from)) = raw.split_once('|') {
            let circuit_open =
                circuit::current_state(&mut redis, acct, ctx.country).await == circuit::CircuitState::Open;
            if !circuit_open {
                candidates = apply_sticky_front(
                    candidates,
                    acct,
                    from,
                    accounts.get(acct).copied(),
                );
            }
        }
    }

    candidates
}

/// Write the sticky pin after a successful send on a sticky rule.
pub async fn write_sticky(
    redis: &mut ConnectionManager,
    workspace_id: &str,
    to_e164: &str,
    account_id: &str,
    from: &str,
) {
    let res: redis::RedisResult<()> = redis
        .set_ex(
            sticky_key(workspace_id, to_e164),
            format!("{account_id}|{from}"),
            STICKY_TTL_SECS,
        )
        .await;
    if let Err(e) = res {
        tracing::warn!(?e, workspace = %workspace_id, "sticky write failed");
    }
}

/// Move the sticky account's candidate to the front and pin its `from`;
/// when the account is missing from the list (e.g. policy changed since
/// the pin) prepend it — but only if we still know its provider.
pub fn apply_sticky_front(
    mut candidates: Vec<RouteCandidate>,
    sticky_account: &str,
    sticky_from: &str,
    provider: Option<ProviderId>,
) -> Vec<RouteCandidate> {
    if let Some(pos) = candidates
        .iter()
        .position(|c| c.provider_account_id.as_deref() == Some(sticky_account))
    {
        let mut cand = candidates.remove(pos);
        cand.from_override = Some(sticky_from.to_string());
        cand.source = CandidateSource::Sticky;
        // A pinned contact stays pinned: refresh the key on success.
        cand.sticky_sender = true;
        candidates.insert(0, cand);
    } else if let Some(provider) = provider {
        candidates.insert(
            0,
            RouteCandidate {
                provider_account_id: Some(sticky_account.to_string()),
                provider,
                from_override: Some(sticky_from.to_string()),
                sticky_sender: true,
                rule_id: None,
                source: CandidateSource::Sticky,
            },
        );
    }
    candidates
}

/// Keep the first occurrence per (provider, account-or-default).
pub fn dedup_candidates(candidates: Vec<RouteCandidate>) -> Vec<RouteCandidate> {
    let mut seen: Vec<(ProviderId, Option<String>)> = Vec::new();
    let mut out = Vec::with_capacity(candidates.len());
    for c in candidates {
        let key = (c.provider, c.provider_account_id.clone());
        if seen.contains(&key) {
            continue;
        }
        seen.push(key);
        out.push(c);
    }
    out
}

/// id → provider for the workspace's ACTIVE provider accounts.
async fn active_accounts(
    state: &Arc<AppState>,
    workspace_id: &str,
) -> HashMap<String, ProviderId> {
    let col = state.mongo.collection::<Document>(db::COL_PROVIDER_ACCOUNTS);
    let mut out = HashMap::new();
    let mut cursor = match col
        .find(doc! { "workspaceId": workspace_id, "status": "active" })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!(?e, workspace = %workspace_id, "provider account scan failed");
            return out;
        }
    };
    loop {
        match cursor.advance().await {
            Ok(true) => {}
            Ok(false) => break,
            Err(e) => {
                tracing::warn!(?e, "provider account cursor failed");
                break;
            }
        }
        let Ok(d) = cursor.deserialize_current() else {
            continue;
        };
        let d: Document = d;
        let id = d
            .get_object_id("_id")
            .map(|o| o.to_hex())
            .or_else(|_| d.get_str("_id").map(|s| s.to_string()));
        let provider = d.get_str("provider").ok().and_then(ProviderId::parse);
        if let (Ok(id), Some(provider)) = (id, provider) {
            out.insert(id, provider);
        }
    }
    out
}

/// Pick a pool number's E.164 per the rule's strategy. Returns `None`
/// when no pool number resolves (callers then use the doc's own from).
async fn pool_from_override(
    state: &Arc<AppState>,
    redis: &mut ConnectionManager,
    ctx: &RoutingContext<'_>,
    rule_id: &str,
    pool: &policy::PoolConfig,
) -> Option<String> {
    // Resolve pool numbers → (id, e164), keeping the policy's order.
    let numbers = load_pool_numbers(state, ctx.workspace_id, &pool.number_ids).await;
    if numbers.is_empty() {
        return None;
    }
    let idx = match pool.strategy {
        policy::PoolStrategy::RoundRobin => {
            let counter_key = format!("sabsms:pool:rr:{}:{}", ctx.workspace_id, rule_id);
            let n: i64 = match redis.incr(&counter_key, 1).await {
                Ok(n) => n,
                Err(e) => {
                    tracing::warn!(?e, "pool round-robin counter failed; using first number");
                    1
                }
            };
            ((n - 1).rem_euclid(numbers.len() as i64)) as usize
        }
        // Deterministic per-contact pick — the Redis sticky key
        // (account|from) takes over after the first successful send;
        // this keeps the pre-success choice stable too.
        policy::PoolStrategy::Sticky => sticky_pool_index(ctx.to_e164, numbers.len()),
        policy::PoolStrategy::LeastUsed => {
            let day = chrono::Utc::now().format("%Y%m%d");
            let keys: Vec<String> = numbers
                .iter()
                .map(|(id, _)| format!("sabsms:pool:used:{id}:{day}"))
                .collect();
            let counts: Vec<Option<i64>> = match redis.mget(&keys).await {
                Ok(v) => v,
                Err(e) => {
                    tracing::warn!(?e, "pool least-used MGET failed; using first number");
                    vec![None; numbers.len()]
                }
            };
            let idx = counts
                .iter()
                .enumerate()
                .min_by_key(|(_, c)| c.unwrap_or(0))
                .map(|(i, _)| i)
                .unwrap_or(0);
            let chosen_key = &keys[idx];
            let res: redis::RedisResult<()> = async {
                let _: i64 = redis.incr(chosen_key, 1).await?;
                let _: bool = redis.expire(chosen_key, 2 * 24 * 60 * 60).await?;
                Ok(())
            }
            .await;
            if let Err(e) = res {
                tracing::warn!(?e, "pool least-used counter bump failed");
            }
            idx
        }
    };
    numbers.get(idx).map(|(_, e164)| e164.clone())
}

/// Stable per-contact pool slot: first 8 bytes of SHA-256(to) mod len.
pub fn sticky_pool_index(to_e164: &str, len: usize) -> usize {
    if len == 0 {
        return 0;
    }
    let digest = Sha256::digest(to_e164.as_bytes());
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&digest[..8]);
    (u64::from_be_bytes(bytes) % len as u64) as usize
}

/// (numberId, e164) for the pool's ACTIVE numbers, preserving the
/// policy's `numberIds` order.
async fn load_pool_numbers(
    state: &Arc<AppState>,
    workspace_id: &str,
    number_ids: &[String],
) -> Vec<(String, String)> {
    let col = state.mongo.collection::<Document>(db::COL_NUMBERS);
    let oid_ids: Vec<ObjectId> = number_ids
        .iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .collect();
    let mut by_id: HashMap<String, String> = HashMap::new();
    let mut cursor = match col
        .find(doc! {
            "workspaceId": workspace_id,
            "status": "active",
            "_id": { "$in": oid_ids },
        })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!(?e, workspace = %workspace_id, "pool number scan failed");
            return Vec::new();
        }
    };
    loop {
        match cursor.advance().await {
            Ok(true) => {}
            Ok(false) => break,
            Err(e) => {
                tracing::warn!(?e, "pool number cursor failed");
                break;
            }
        }
        let Ok(d) = cursor.deserialize_current() else {
            continue;
        };
        let d: Document = d;
        if let (Ok(oid), Ok(e164)) = (d.get_object_id("_id"), d.get_str("e164")) {
            by_id.insert(oid.to_hex(), e164.to_string());
        }
    }
    number_ids
        .iter()
        .filter_map(|id| by_id.get(id).map(|e| (id.clone(), e.clone())))
        .collect()
}

// ---------------------------------------------------------------------------
// Health/circuit write hooks — one call site each in the worker + DLR path.
// ---------------------------------------------------------------------------

/// Worker hook: provider accepted the send.
pub async fn note_send_success(redis: &mut ConnectionManager, acct: &str, country: &str) {
    health::record_sent(redis, acct, country).await;
}

/// Terminal failure (synchronous rejection or failed/undelivered DLR):
/// bump the window and feed the circuit breaker.
pub async fn note_failure(redis: &mut ConnectionManager, acct: &str, country: &str) {
    health::record_failed(redis, acct, country).await;
    let (score, volume) = health::score_and_volume(redis, acct, country).await;
    circuit::note_outcome(redis, acct, country, circuit::Outcome::Failed, score, volume).await;
}

/// Delivered DLR: bump the window (+ latency) and let a half-open
/// circuit close.
pub async fn note_delivery(
    redis: &mut ConnectionManager,
    acct: &str,
    country: &str,
    latency_ms: Option<i64>,
) {
    health::record_delivered(redis, acct, country, latency_ms).await;
    let (score, volume) = health::score_and_volume(redis, acct, country).await;
    circuit::note_outcome(redis, acct, country, circuit::Outcome::Delivered, score, volume).await;
}

/// Best-effort ISO-3166 country guess from an E.164 number ("UNK" when
/// the parse fails so callers never block a send on it).
pub fn country_of(e164: &str) -> String {
    use phonenumber::country;
    match phonenumber::parse(Some(country::Id::US), e164) {
        Ok(p) => p
            .country()
            .id()
            .map(|c| format!("{:?}", c))
            .unwrap_or_else(|| "UNK".into()),
        Err(_) => "UNK".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cand(acct: Option<&str>, provider: ProviderId, source: CandidateSource) -> RouteCandidate {
        RouteCandidate {
            provider_account_id: acct.map(|s| s.to_string()),
            provider,
            from_override: None,
            sticky_sender: false,
            rule_id: None,
            source,
        }
    }

    #[test]
    fn dedup_keeps_first_occurrence() {
        let cands = vec![
            cand(Some("a1"), ProviderId::Twilio, CandidateSource::Rule),
            cand(Some("a2"), ProviderId::Telnyx, CandidateSource::Rule),
            // Fallback duplicates the first rule route — dropped.
            cand(Some("a1"), ProviderId::Twilio, CandidateSource::Fallback),
            // Default fallback (no account) is distinct.
            cand(None, ProviderId::Twilio, CandidateSource::Fallback),
        ];
        let out = dedup_candidates(cands);
        assert_eq!(out.len(), 3);
        assert_eq!(out[0].provider_account_id.as_deref(), Some("a1"));
        assert_eq!(out[0].source, CandidateSource::Rule);
        assert_eq!(out[2].provider_account_id, None);
    }

    #[test]
    fn sticky_moves_existing_candidate_to_front_with_pinned_from() {
        let cands = vec![
            cand(Some("a1"), ProviderId::Twilio, CandidateSource::Rule),
            cand(Some("a2"), ProviderId::Telnyx, CandidateSource::Rule),
        ];
        let out = apply_sticky_front(cands, "a2", "+15550001111", None);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].provider_account_id.as_deref(), Some("a2"));
        assert_eq!(out[0].from_override.as_deref(), Some("+15550001111"));
        assert_eq!(out[0].source, CandidateSource::Sticky);
        assert!(out[0].sticky_sender, "pin refresh on success");
        assert_eq!(out[1].provider_account_id.as_deref(), Some("a1"));
    }

    #[test]
    fn sticky_prepends_unknown_account_only_when_provider_known() {
        let cands = vec![cand(Some("a1"), ProviderId::Twilio, CandidateSource::Rule)];
        // Provider known → prepended.
        let out = apply_sticky_front(cands.clone(), "a9", "+1555", Some(ProviderId::Telnyx));
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].provider_account_id.as_deref(), Some("a9"));
        assert_eq!(out[0].provider, ProviderId::Telnyx);
        // Provider unknown (account deleted) → list unchanged.
        let out = apply_sticky_front(cands, "a9", "+1555", None);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].provider_account_id.as_deref(), Some("a1"));
    }

    #[test]
    fn sticky_pool_index_is_deterministic_and_in_range() {
        for len in 1..=7usize {
            let a = sticky_pool_index("+15551230000", len);
            let b = sticky_pool_index("+15551230000", len);
            assert_eq!(a, b);
            assert!(a < len);
        }
        // Different contacts spread across slots (sanity, not uniformity).
        let i1 = sticky_pool_index("+15551230001", 1000);
        let i2 = sticky_pool_index("+15551230002", 1000);
        assert_ne!(i1, i2);
        // Empty pool guarded.
        assert_eq!(sticky_pool_index("+1555", 0), 0);
    }

    /// V2.7 — the select() scoring contract for the `otp` category:
    /// equal-weight routes are tie-broken by CONVERSION score when an
    /// account has ≥ OTP_MIN_VOLUME sends, falling back to the DLR
    /// health score below min-volume; every other category orders by
    /// DLR. Exercises the exact composition select() uses
    /// (`health::otp_conversion_score` → fallback
    /// `health::health_score`) through `policy::order_routes`.
    #[test]
    fn otp_category_orders_by_conversion_not_dlr() {
        use crate::routing::policy::{order_routes, RouteWeight};

        let routes = vec![
            RouteWeight {
                provider_account_id: "dlr-champ".into(),
                weight: 1,
            },
            RouteWeight {
                provider_account_id: "conv-champ".into(),
                weight: 1,
            },
        ];
        let ids = |ordered: &[RouteWeight]| -> Vec<String> {
            ordered.iter().map(|r| r.provider_account_id.clone()).collect()
        };

        // dlr-champ: 98/100 delivered but only 10/100 OTPs converted.
        // conv-champ: 90/100 delivered and 80/100 OTPs converted.
        let dlr = |acct: &str| -> f64 {
            match acct {
                "dlr-champ" => health::health_score(98, 2),
                _ => health::health_score(90, 10),
            }
        };
        let conversion = |acct: &str| -> Option<f64> {
            match acct {
                "dlr-champ" => health::otp_conversion_score(100, 10),
                _ => health::otp_conversion_score(100, 80),
            }
        };

        // Non-OTP categories: DLR health decides → dlr-champ first.
        let by_dlr = order_routes(&routes, &dlr);
        assert_eq!(ids(&by_dlr), vec!["dlr-champ", "conv-champ"]);

        // OTP category: conversion decides → conv-champ first, even
        // though its DLR score is worse.
        let by_conv = order_routes(&routes, |acct| conversion(acct).unwrap_or_else(|| dlr(acct)));
        assert_eq!(ids(&by_conv), vec!["conv-champ", "dlr-champ"]);

        // Below OTP_MIN_VOLUME the conversion score is None and the
        // OTP ordering degrades to DLR — never punish a cold account.
        let cold = |acct: &str| -> Option<f64> {
            match acct {
                "dlr-champ" => health::otp_conversion_score(3, 0),
                _ => health::otp_conversion_score(5, 5),
            }
        };
        assert_eq!(cold("dlr-champ"), None);
        let by_cold = order_routes(&routes, |acct| cold(acct).unwrap_or_else(|| dlr(acct)));
        assert_eq!(ids(&by_cold), vec!["dlr-champ", "conv-champ"]);

        // Weight still outranks any score: a heavier route beats a
        // better-converting light one.
        let weighted = vec![
            RouteWeight {
                provider_account_id: "dlr-champ".into(),
                weight: 100,
            },
            RouteWeight {
                provider_account_id: "conv-champ".into(),
                weight: 1,
            },
        ];
        let by_weight =
            order_routes(&weighted, |acct| conversion(acct).unwrap_or_else(|| dlr(acct)));
        assert_eq!(ids(&by_weight), vec!["dlr-champ", "conv-champ"]);
    }

    #[test]
    fn country_of_resolves_common_destinations() {
        assert_eq!(country_of("+14155552671"), "US");
        assert_eq!(country_of("+919812345678"), "IN");
        assert_eq!(country_of("+447400123456"), "GB");
        // Unparseable input degrades to "UNK" instead of blocking sends.
        assert_eq!(country_of("not-a-number"), "UNK");
    }

    #[test]
    fn candidate_source_strings_are_wire_stable() {
        assert_eq!(CandidateSource::Sticky.as_str(), "sticky");
        assert_eq!(CandidateSource::Rule.as_str(), "rule");
        assert_eq!(CandidateSource::Fallback.as_str(), "fallback");
    }
}
