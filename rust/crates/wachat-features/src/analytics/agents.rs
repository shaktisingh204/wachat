//! Per-agent send + response-time performance, with names looked up
//! from the `agents` collection.
//!
//! Mirrors `getAgentPerformance`.

use std::collections::HashMap;

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::Serialize;
use serde_json::{Map, Value};

use crate::{helpers::doc_to_json, state::WachatFeaturesState, tenancy::load_project_for};

#[derive(Debug, serde::Deserialize)]
pub struct DaysQuery {
    pub days: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PerformanceResp {
    pub performance: Value,
}

pub async fn performance(
    user: AuthUser,
    Path(project_id): Path<String>,
    Query(query): Query<DaysQuery>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<PerformanceResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let messages = state.mongo.collection::<Document>("messages");
    let since = bson::DateTime::from_chrono(Utc::now() - Duration::days(query.days.unwrap_or(30)));

    let pipeline = vec![
        doc! { "$match": {
            "projectId": project.id,
            "direction": "out",
            "timestamp": { "$gte": since },
            "agentId": { "$exists": true, "$ne": null },
        } },
        doc! { "$group": {
            "_id": "$agentId",
            "messagesSent": { "$sum": 1 },
            "avgResponseMs": { "$avg": "$responseTimeMs" },
        } },
    ];
    let cursor = messages
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    // Collect agent ids (some may be hex strings, some ObjectIds — match
    // the legacy code which mapped the raw id).
    let mut agent_ids: Vec<ObjectId> = Vec::new();
    for d in docs.iter() {
        if let Some(id) = d.get("_id") {
            if let Some(s) = id.as_str() {
                if let Ok(oid) = ObjectId::parse_str(s) {
                    agent_ids.push(oid);
                }
            }
        }
    }

    let mut agent_names: HashMap<String, String> = HashMap::new();
    if !agent_ids.is_empty() {
        let agents = state.mongo.collection::<Document>("agents");
        let mut acursor = agents
            .find(doc! { "_id": { "$in": &agent_ids } })
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
        while let Some(d) = acursor
            .try_next()
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        {
            if let Ok(oid) = d.get_object_id("_id") {
                let name = d.get_str("name").unwrap_or("").to_owned();
                agent_names.insert(oid.to_hex(), name);
            }
        }
    }

    let mut out = Vec::with_capacity(docs.len());
    for d in docs {
        let mut json = match doc_to_json(d) {
            Value::Object(m) => m,
            other => {
                let mut m = Map::new();
                m.insert("_value".into(), other);
                m
            }
        };
        let id_str = json
            .get("_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_owned())
            .unwrap_or_default();
        let name = agent_names
            .get(&id_str)
            .cloned()
            .unwrap_or_else(|| "Unknown".to_owned());
        json.insert("agentName".into(), Value::String(name));
        out.push(Value::Object(json));
    }

    Ok(Json(PerformanceResp {
        performance: Value::Array(out),
    }))
}
