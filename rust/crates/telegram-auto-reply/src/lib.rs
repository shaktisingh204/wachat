//! # telegram-auto-reply
//!
//! Multi-tenant rule-based auto-reply engine. Mounted under
//! `/v1/telegram/auto-reply`. Every endpoint resolves the caller's
//! project before touching state.
//!
//! The pure matching engine in [`engine`] is also exposed as
//! [`match_rules`] so the Telegram webhook handler can ask "given this
//! incoming update, which rules fire?" without going through HTTP.

pub mod dto;
pub mod engine;
pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post, put},
};
use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;
use std::sync::Arc;

pub use dto::{MatchedRule, RuleRow};
pub use engine::{EvalOutcome, Probe, evaluate_rule};
pub use state::TelegramAutoReplyState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramAutoReplyState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list).post(handlers::create))
        .route(
            "/{rule_id}",
            get(handlers::get_one)
                .put(handlers::update)
                .delete(handlers::delete_rule),
        )
        .route("/{rule_id}/enable", post(handlers::enable))
        .route("/{rule_id}/disable", post(handlers::disable))
        .route("/{rule_id}/test", post(handlers::test_rule))
        .route("/{rule_id}/runs", get(handlers::runs))
        .route("/reorder", post(handlers::reorder))
        .route("/match", post(handlers::match_endpoint))
        .route("/conflicts", get(handlers::conflicts))
}

const RULES: &str = "telegram_auto_reply_rules";

/// Pure, non-HTTP entry point: load all enabled rules for the project
/// (optionally scoped to a bot), evaluate them in priority order, and
/// return the matched rules with their actions.
///
/// This is what the Telegram webhook handler will call once wired up;
/// it does NOT enforce cooldowns or record runs — that's the caller's
/// responsibility because cooldown state lives next to the dispatch
/// loop.
pub async fn match_rules(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_oid: Option<ObjectId>,
    probe: &Probe,
) -> Result<Vec<MatchedRule>, String> {
    let mut filter = doc! { "projectId": project_oid, "status": "enabled" };
    if let Some(b) = bot_oid {
        // Rule applies if it has no botId (project-wide) OR matches this bot.
        filter.insert(
            "$or",
            bson::Bson::Array(vec![
                bson::Bson::Document(doc! { "botId": b }),
                bson::Bson::Document(doc! { "botId": { "$exists": false } }),
                bson::Bson::Document(doc! { "botId": bson::Bson::Null }),
            ]),
        );
    }

    let cursor = mongo
        .collection::<Document>(RULES)
        .find(filter)
        .sort(doc! { "priority": 1, "createdAt": 1 })
        .await
        .map_err(|e| format!("mongo: {e}"))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| format!("mongo: {e}"))?;

    let mut matched: Vec<MatchedRule> = Vec::new();
    for d in &docs {
        let rule_json = engine::doc_to_json(d);
        let outcome = evaluate_rule(&rule_json, probe);
        if outcome.matched {
            let id = match d.get_object_id("_id") {
                Ok(o) => o.to_hex(),
                Err(_) => continue,
            };
            let name = d.get_str("name").unwrap_or("").to_owned();
            let priority = d
                .get_i64("priority")
                .or_else(|_| d.get_i32("priority").map(i64::from))
                .unwrap_or(100);
            let actions = rule_json
                .get("actions")
                .and_then(|a| a.as_array())
                .cloned()
                .unwrap_or_default();
            matched.push(MatchedRule {
                rule_id: id,
                name,
                priority,
                actions,
            });
        }
    }
    Ok(matched)
}
