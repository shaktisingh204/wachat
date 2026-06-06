//! Per-agent performance leaderboard — backs `/wachat/team-performance`.
//!
//! Pure Mongo aggregation over the `messages` chat collection (same source as
//! the existing `wachat-features` agent roll-up), enriched with:
//!  - `agentName`         — looked up from the `agents` collection
//!  - `totalConversations`— distinct `conversationId` the agent replied in
//!  - `csatScore`/`csatReviews` — joined from the (genuinely-new)
//!    `wa_chat_ratings` collection (per-agent average rating + review count)
//!
//! `wa_chat_ratings` documents are expected to carry `{ projectId, agentId,
//! score, ... }` where `score` is the customer-satisfaction rating. The join
//! degrades gracefully: when the collection is empty / a given agent has no
//! ratings, `csatScore = 0` and `csatReviews = 0` (never fabricated).
//!
//! No Meta Graph. Returns an empty `performance` array when the project has no
//! agent activity.

use std::collections::HashMap;

use bson::{Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

const MESSAGES_COLL: &str = "messages";
const AGENTS_COLL: &str = "agents";
const RATINGS_COLL: &str = "wa_chat_ratings";

/// `?days=N` (defaults to 30, clamped 1..=365) — mirrors the existing
/// agent-performance window semantics.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentPerformanceQuery {
    #[serde(default)]
    pub days: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentPerformanceRow {
    pub agent_id: String,
    pub agent_name: String,
    pub messages_sent: u64,
    pub avg_response_ms: f64,
    pub total_conversations: u64,
    pub csat_score: f64,
    pub csat_reviews: u64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentPerformanceResult {
    pub days: i64,
    pub performance: Vec<AgentPerformanceRow>,
}

pub async fn aggregate(
    mongo: &MongoHandle,
    project_id: ObjectId,
    query: AgentPerformanceQuery,
) -> Result<AgentPerformanceResult> {
    let days = query.days.unwrap_or(30).clamp(1, 365);
    let since = bson::DateTime::from_chrono(Utc::now() - Duration::days(days));

    // Per-agent send count, mean response time, and distinct conversations.
    let pipeline = vec![
        doc! { "$match": {
            "projectId": project_id,
            "direction": "out",
            "timestamp": { "$gte": since },
            "agentId": { "$exists": true, "$ne": null },
        } },
        doc! { "$group": {
            "_id": "$agentId",
            "messagesSent": { "$sum": 1 },
            "avgResponseMs": { "$avg": "$responseTimeMs" },
            "conversations": { "$addToSet": "$conversationId" },
        } },
        doc! { "$project": {
            "messagesSent": 1,
            "avgResponseMs": 1,
            "totalConversations": { "$size": "$conversations" },
        } },
    ];

    let docs: Vec<Document> = mongo
        .collection::<Document>(MESSAGES_COLL)
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    // Collect the agent ids (hex string or ObjectId) so we can batch the name
    // + CSAT lookups.
    let mut agent_ids_oid: Vec<ObjectId> = Vec::new();
    let mut agent_id_strs: Vec<String> = Vec::new();
    for d in &docs {
        if let Some(id) = d.get("_id") {
            if let Some(s) = id.as_str() {
                agent_id_strs.push(s.to_owned());
                if let Ok(oid) = ObjectId::parse_str(s) {
                    agent_ids_oid.push(oid);
                }
            } else if let Some(oid) = id.as_object_id() {
                agent_id_strs.push(oid.to_hex());
                agent_ids_oid.push(oid);
            }
        }
    }

    let agent_names = load_agent_names(mongo, &agent_ids_oid).await?;
    let csat = load_csat(mongo, project_id, since, &agent_ids_oid, &agent_id_strs).await?;

    let mut performance = Vec::with_capacity(docs.len());
    for d in docs {
        let agent_id = match d.get("_id") {
            Some(v) => v
                .as_str()
                .map(|s| s.to_owned())
                .or_else(|| v.as_object_id().map(|o| o.to_hex()))
                .unwrap_or_default(),
            None => String::new(),
        };
        let agent_name = agent_names
            .get(&agent_id)
            .cloned()
            .unwrap_or_else(|| "Unknown".to_owned());
        let (csat_score, csat_reviews) = csat.get(&agent_id).copied().unwrap_or((0.0, 0));
        performance.push(AgentPerformanceRow {
            agent_name,
            messages_sent: doc_u64(&d, "messagesSent"),
            avg_response_ms: doc_f64(&d, "avgResponseMs"),
            total_conversations: doc_u64(&d, "totalConversations"),
            csat_score,
            csat_reviews,
            agent_id,
        });
    }

    Ok(AgentPerformanceResult { days, performance })
}

/// Map agent hex-id → display name from the `agents` collection.
async fn load_agent_names(
    mongo: &MongoHandle,
    agent_ids: &[ObjectId],
) -> Result<HashMap<String, String>> {
    let mut names: HashMap<String, String> = HashMap::new();
    if agent_ids.is_empty() {
        return Ok(names);
    }
    let mut cursor = mongo
        .collection::<Document>(AGENTS_COLL)
        .find(doc! { "_id": { "$in": agent_ids } })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
    {
        if let Ok(oid) = d.get_object_id("_id") {
            let name = d.get_str("name").unwrap_or("").to_owned();
            names.insert(oid.to_hex(), name);
        }
    }
    Ok(names)
}

/// Map agent hex-id → (avg CSAT score, review count) from `wa_chat_ratings`,
/// scoped to the project + window. Empty/absent ratings → empty map (caller
/// defaults those agents to 0/0).
async fn load_csat(
    mongo: &MongoHandle,
    project_id: ObjectId,
    since: bson::DateTime,
    agent_ids_oid: &[ObjectId],
    agent_id_strs: &[String],
) -> Result<HashMap<String, (f64, u64)>> {
    let mut out: HashMap<String, (f64, u64)> = HashMap::new();
    if agent_ids_oid.is_empty() && agent_id_strs.is_empty() {
        return Ok(out);
    }

    // `agentId` in ratings may be ObjectId or hex string — match either.
    let mut agent_match: Vec<bson::Bson> = Vec::new();
    for s in agent_id_strs {
        agent_match.push(bson::Bson::String(s.clone()));
    }
    for oid in agent_ids_oid {
        agent_match.push(bson::Bson::ObjectId(*oid));
    }

    let pipeline = vec![
        doc! { "$match": {
            "projectId": project_id,
            "agentId": { "$in": agent_match },
            "createdAt": { "$gte": since },
        } },
        doc! { "$group": {
            "_id": "$agentId",
            "csatScore": { "$avg": "$score" },
            "csatReviews": { "$sum": 1 },
        } },
    ];

    let docs: Vec<Document> = mongo
        .collection::<Document>(RATINGS_COLL)
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    for d in &docs {
        let key = d
            .get("_id")
            .and_then(|v| {
                v.as_str()
                    .map(|s| s.to_owned())
                    .or_else(|| v.as_object_id().map(|o| o.to_hex()))
            })
            .unwrap_or_default();
        if key.is_empty() {
            continue;
        }
        out.insert(key, (doc_f64(d, "csatScore"), doc_u64(d, "csatReviews")));
    }
    Ok(out)
}

fn doc_f64(d: &Document, key: &str) -> f64 {
    d.get_f64(key)
        .ok()
        .or_else(|| d.get_i64(key).ok().map(|v| v as f64))
        .or_else(|| d.get_i32(key).ok().map(|v| v as f64))
        .unwrap_or(0.0)
}

fn doc_u64(d: &Document, key: &str) -> u64 {
    d.get_i64(key)
        .ok()
        .map(|x| x.max(0) as u64)
        .or_else(|| d.get_i32(key).ok().map(|x| x.max(0) as u64))
        .unwrap_or(0)
}
