//! Routing-policy documents + the per-workspace policy cache.
//!
//! One policy doc per workspace lives in `sabsms_routing_policies`
//! (written by the Next.js routing page, validated there with a zod
//! schema that mirrors these structs EXACTLY — camelCase wire form).
//! The engine only reads. Rules are evaluated top-to-bottom; the FIRST
//! rule whose present match-fields all match wins.
//!
//! Caching mirrors `creds.rs`: 60s-TTL `RwLock<HashMap>` keyed by
//! workspaceId, dropped eagerly by `POST /v1/internal/routing/invalidate`.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use mongodb::bson::{doc, Document};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use crate::{db, state::AppState};

const CACHE_TTL: Duration = Duration::from_secs(60);

/// Pool sender-selection strategy (`pool.strategy` on a rule).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PoolStrategy {
    RoundRobin,
    Sticky,
    LeastUsed,
}

/// Number-pool config attached to a rule: the matched rule's sends pick
/// their `from` out of these `sabsms_numbers` ids.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PoolConfig {
    #[serde(default)]
    pub number_ids: Vec<String>,
    pub strategy: PoolStrategy,
}

/// Weighted route target — a provider account + its weight. Higher
/// weight = earlier in the candidate order.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteWeight {
    pub provider_account_id: String,
    pub weight: u32,
}

/// Match conditions. Every PRESENT field must match for the rule to
/// fire; absent fields are wildcards.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleMatch {
    /// ISO-3166 alpha-2 destination country (e.g. "US").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    /// Message category (`transactional|otp|marketing|alert|service`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    /// Channel (`sms|mms|rcs`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub channel: Option<String>,
    /// E.164 string prefix (e.g. "+9198").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prefix: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutingRule {
    pub id: String,
    #[serde(rename = "match", default)]
    pub match_: RuleMatch,
    #[serde(default)]
    pub routes: Vec<RouteWeight>,
    #[serde(default)]
    pub sticky_sender: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pool: Option<PoolConfig>,
}

/// The per-workspace policy doc (`sabsms_routing_policies`, unique on
/// `workspaceId`). `updatedAt` is intentionally NOT modelled — the
/// engine never writes these docs.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutingPolicy {
    pub workspace_id: String,
    #[serde(default)]
    pub rules: Vec<RoutingRule>,
}

/// What the worker needs to match rules against.
pub struct MatchContext<'a> {
    pub country: &'a str,
    pub category: &'a str,
    pub channel: &'a str,
    pub to_e164: &'a str,
}

/// All present match fields must match (logical AND); a rule with an
/// empty match object matches everything.
pub fn rule_matches(m: &RuleMatch, ctx: &MatchContext<'_>) -> bool {
    if let Some(c) = &m.country {
        if !c.eq_ignore_ascii_case(ctx.country) {
            return false;
        }
    }
    if let Some(c) = &m.category {
        if !c.eq_ignore_ascii_case(ctx.category) {
            return false;
        }
    }
    if let Some(c) = &m.channel {
        if !c.eq_ignore_ascii_case(ctx.channel) {
            return false;
        }
    }
    if let Some(p) = &m.prefix {
        if !ctx.to_e164.starts_with(p.as_str()) {
            return false;
        }
    }
    true
}

/// First rule (top-to-bottom) whose match fields all hold. Rules with
/// zero routes can never produce a candidate and are skipped.
pub fn first_match<'a>(
    rules: &'a [RoutingRule],
    ctx: &MatchContext<'_>,
) -> Option<&'a RoutingRule> {
    rules
        .iter()
        .find(|r| !r.routes.is_empty() && rule_matches(&r.match_, ctx))
}

/// Order a rule's routes for the candidate loop: highest weight first;
/// equal weights break ties by health score (higher first). Stable for
/// fully-equal entries (preserves authoring order).
pub fn order_routes(routes: &[RouteWeight], score_of: impl Fn(&str) -> f64) -> Vec<RouteWeight> {
    let mut out: Vec<RouteWeight> = routes.to_vec();
    out.sort_by(|a, b| {
        b.weight.cmp(&a.weight).then_with(|| {
            score_of(&b.provider_account_id)
                .partial_cmp(&score_of(&a.provider_account_id))
                .unwrap_or(std::cmp::Ordering::Equal)
        })
    });
    out
}

/// 60s-TTL policy cache, keyed by workspaceId. `None` is cached too —
/// most workspaces have no policy and we must not re-query Mongo per
/// message for them.
pub type PolicyCache = RwLock<HashMap<String, (Instant, Arc<Option<RoutingPolicy>>)>>;

/// Load the workspace policy through the cache.
pub async fn load(state: &Arc<AppState>, workspace_id: &str) -> Arc<Option<RoutingPolicy>> {
    if let Some((at, cached)) = state.routing_cache.read().await.get(workspace_id) {
        if at.elapsed() < CACHE_TTL {
            return cached.clone();
        }
    }
    let loaded = Arc::new(load_uncached(state, workspace_id).await);
    state
        .routing_cache
        .write()
        .await
        .insert(workspace_id.to_string(), (Instant::now(), loaded.clone()));
    loaded
}

async fn load_uncached(state: &Arc<AppState>, workspace_id: &str) -> Option<RoutingPolicy> {
    let col = state
        .mongo
        .collection::<Document>(db::COL_ROUTING_POLICIES);
    let found = match col.find_one(doc! { "workspaceId": workspace_id }).await {
        Ok(d) => d?,
        Err(e) => {
            tracing::warn!(?e, workspace = %workspace_id, "routing policy load failed; falling back to default route");
            return None;
        }
    };
    match mongodb::bson::from_document::<RoutingPolicy>(found) {
        Ok(p) => Some(p),
        Err(e) => {
            tracing::warn!(?e, workspace = %workspace_id, "routing policy doc failed to deserialize; ignoring policy");
            None
        }
    }
}

/// Drop the cached policy for a workspace (called by
/// `POST /v1/internal/routing/invalidate`).
pub async fn invalidate_workspace(state: &Arc<AppState>, workspace_id: &str) {
    state.routing_cache.write().await.remove(workspace_id);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx<'a>(country: &'a str, category: &'a str, channel: &'a str, to: &'a str) -> MatchContext<'a> {
        MatchContext {
            country,
            category,
            channel,
            to_e164: to,
        }
    }

    fn rule(id: &str, m: RuleMatch, routes: Vec<(&str, u32)>) -> RoutingRule {
        RoutingRule {
            id: id.to_string(),
            match_: m,
            routes: routes
                .into_iter()
                .map(|(a, w)| RouteWeight {
                    provider_account_id: a.to_string(),
                    weight: w,
                })
                .collect(),
            sticky_sender: false,
            pool: None,
        }
    }

    #[test]
    fn empty_match_is_a_wildcard() {
        assert!(rule_matches(
            &RuleMatch::default(),
            &ctx("US", "marketing", "sms", "+15551230000")
        ));
    }

    #[test]
    fn country_match_is_case_insensitive_and_exact() {
        let m = RuleMatch {
            country: Some("us".into()),
            ..Default::default()
        };
        assert!(rule_matches(&m, &ctx("US", "otp", "sms", "+15551230000")));
        assert!(!rule_matches(&m, &ctx("IN", "otp", "sms", "+919812345678")));
    }

    #[test]
    fn category_and_channel_must_both_match_when_present() {
        let m = RuleMatch {
            category: Some("marketing".into()),
            channel: Some("sms".into()),
            ..Default::default()
        };
        assert!(rule_matches(&m, &ctx("US", "marketing", "sms", "+1555")));
        assert!(!rule_matches(&m, &ctx("US", "otp", "sms", "+1555")));
        assert!(!rule_matches(&m, &ctx("US", "marketing", "mms", "+1555")));
    }

    #[test]
    fn prefix_matches_e164_string_prefix() {
        let m = RuleMatch {
            prefix: Some("+9198".into()),
            ..Default::default()
        };
        assert!(rule_matches(&m, &ctx("IN", "otp", "sms", "+919812345678")));
        assert!(!rule_matches(&m, &ctx("IN", "otp", "sms", "+917712345678")));
    }

    #[test]
    fn first_match_takes_the_topmost_matching_rule() {
        let rules = vec![
            rule(
                "r1",
                RuleMatch {
                    country: Some("IN".into()),
                    ..Default::default()
                },
                vec![("acct-in", 10)],
            ),
            rule(
                "r2",
                RuleMatch {
                    country: Some("US".into()),
                    ..Default::default()
                },
                vec![("acct-us-1", 10)],
            ),
            // Also matches US but sits below r2 — never chosen.
            rule("r3", RuleMatch::default(), vec![("acct-any", 1)]),
        ];
        let got = first_match(&rules, &ctx("US", "marketing", "sms", "+1555")).unwrap();
        assert_eq!(got.id, "r2");
    }

    #[test]
    fn first_match_specificity_via_order_prefix_beats_country_when_listed_first() {
        // Specificity is AUTHOR-controlled (rule order), per the plan:
        // "first rule where all present match-fields match wins".
        let rules = vec![
            rule(
                "prefix-rule",
                RuleMatch {
                    prefix: Some("+9198".into()),
                    ..Default::default()
                },
                vec![("acct-prefix", 1)],
            ),
            rule(
                "country-rule",
                RuleMatch {
                    country: Some("IN".into()),
                    ..Default::default()
                },
                vec![("acct-country", 1)],
            ),
        ];
        let got = first_match(&rules, &ctx("IN", "otp", "sms", "+919812345678")).unwrap();
        assert_eq!(got.id, "prefix-rule");
        // A number outside the prefix falls through to the country rule.
        let got = first_match(&rules, &ctx("IN", "otp", "sms", "+917712345678")).unwrap();
        assert_eq!(got.id, "country-rule");
    }

    #[test]
    fn rules_without_routes_are_skipped() {
        let rules = vec![
            rule("empty", RuleMatch::default(), vec![]),
            rule("real", RuleMatch::default(), vec![("acct", 1)]),
        ];
        let got = first_match(&rules, &ctx("US", "otp", "sms", "+1555")).unwrap();
        assert_eq!(got.id, "real");
    }

    #[test]
    fn no_matching_rule_returns_none() {
        let rules = vec![rule(
            "in-only",
            RuleMatch {
                country: Some("IN".into()),
                ..Default::default()
            },
            vec![("acct", 1)],
        )];
        assert!(first_match(&rules, &ctx("US", "otp", "sms", "+1555")).is_none());
    }

    #[test]
    fn order_routes_highest_weight_first() {
        let routes = vec![
            RouteWeight {
                provider_account_id: "low".into(),
                weight: 1,
            },
            RouteWeight {
                provider_account_id: "high".into(),
                weight: 100,
            },
            RouteWeight {
                provider_account_id: "mid".into(),
                weight: 50,
            },
        ];
        let ordered = order_routes(&routes, |_| 1.0);
        let ids: Vec<&str> = ordered.iter().map(|r| r.provider_account_id.as_str()).collect();
        assert_eq!(ids, vec!["high", "mid", "low"]);
    }

    #[test]
    fn order_routes_equal_weights_break_ties_by_health_score() {
        let routes = vec![
            RouteWeight {
                provider_account_id: "sick".into(),
                weight: 10,
            },
            RouteWeight {
                provider_account_id: "healthy".into(),
                weight: 10,
            },
        ];
        let ordered = order_routes(&routes, |acct| if acct == "healthy" { 0.99 } else { 0.5 });
        assert_eq!(ordered[0].provider_account_id, "healthy");
        assert_eq!(ordered[1].provider_account_id, "sick");
    }

    #[test]
    fn order_routes_is_stable_for_fully_equal_entries() {
        let routes = vec![
            RouteWeight {
                provider_account_id: "first".into(),
                weight: 5,
            },
            RouteWeight {
                provider_account_id: "second".into(),
                weight: 5,
            },
        ];
        let ordered = order_routes(&routes, |_| 1.0);
        assert_eq!(ordered[0].provider_account_id, "first");
    }

    #[test]
    fn policy_wire_format_is_camel_case_with_match_key() {
        let policy = RoutingPolicy {
            workspace_id: "ws1".into(),
            rules: vec![RoutingRule {
                id: "r1".into(),
                match_: RuleMatch {
                    country: Some("US".into()),
                    category: Some("marketing".into()),
                    channel: None,
                    prefix: None,
                },
                routes: vec![RouteWeight {
                    provider_account_id: "acct1".into(),
                    weight: 100,
                }],
                sticky_sender: true,
                pool: Some(PoolConfig {
                    number_ids: vec!["n1".into(), "n2".into()],
                    strategy: PoolStrategy::RoundRobin,
                }),
            }],
        };
        let v = serde_json::to_value(&policy).unwrap();
        assert_eq!(v["workspaceId"], "ws1");
        assert_eq!(v["rules"][0]["match"]["country"], "US");
        assert_eq!(v["rules"][0]["routes"][0]["providerAccountId"], "acct1");
        assert_eq!(v["rules"][0]["routes"][0]["weight"], 100);
        assert_eq!(v["rules"][0]["stickySender"], true);
        assert_eq!(v["rules"][0]["pool"]["numberIds"][0], "n1");
        assert_eq!(v["rules"][0]["pool"]["strategy"], "round_robin");
        // Round-trips losslessly.
        let back: RoutingPolicy = serde_json::from_value(v).unwrap();
        assert_eq!(back.rules[0].id, "r1");
        assert_eq!(back.rules[0].pool.as_ref().unwrap().strategy, PoolStrategy::RoundRobin);
    }
}
