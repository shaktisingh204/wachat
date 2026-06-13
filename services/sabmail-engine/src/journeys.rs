//! Journey/automation execution engine (Rust). Advances each enrolled
//! person through the stored journey graph (trigger → send → wait →
//! condition → exit) on each tick. Mirrors the TS reference engine but is
//! the production owner when the Rust engine runs.

use std::sync::Arc;

use mongodb::bson::{doc, oid::ObjectId, Bson, DateTime as BsonDateTime, Document};
use serde::Serialize;

use crate::{db, errors::EngineResult, send, state::AppState};

#[derive(Debug, Default, Serialize)]
pub struct TickResult {
    pub processed: u64,
    pub sent: u64,
    pub completed: u64,
    pub failed: u64,
}

fn node_type(node: &Document) -> String {
    let raw = node
        .get_str("type")
        .ok()
        .map(|s| s.to_string())
        .or_else(|| {
            node.get_document("data")
                .ok()
                .and_then(|d| d.get_str("type").ok())
                .map(|s| s.to_string())
        })
        .unwrap_or_default()
        .to_lowercase();
    if raw.contains("send") || raw.contains("email") || raw.contains("message") {
        "send".into()
    } else if raw.contains("wait") || raw.contains("delay") || raw.contains("sleep") {
        "wait".into()
    } else if raw.contains("condition") || raw.contains("branch") || raw.contains("if") || raw.contains("split") {
        "condition".into()
    } else if raw.contains("exit") || raw.contains("end") || raw.contains("stop") {
        "exit".into()
    } else if raw.contains("trigger") || raw.contains("entry") || raw.contains("start") {
        "trigger".into()
    } else {
        "other".into()
    }
}

fn find_node<'a>(nodes: &'a [Bson], id: &str) -> Option<&'a Document> {
    nodes
        .iter()
        .filter_map(|n| n.as_document())
        .find(|n| n.get_str("id").map(|v| v == id).unwrap_or(false))
}

fn first_next(edges: &[Bson], from_id: &str) -> Option<String> {
    edges
        .iter()
        .filter_map(|e| e.as_document())
        .find(|e| e.get_str("source").map(|v| v == from_id).unwrap_or(false))
        .and_then(|e| e.get_str("target").ok())
        .map(|s| s.to_string())
}

fn node_data_str(node: &Document, key: &str) -> Option<String> {
    node.get_document("data")
        .ok()
        .and_then(|d| d.get_str(key).ok())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
}

fn node_data_i64(node: &Document, key: &str) -> Option<i64> {
    node.get_document("data").ok().and_then(|d| {
        d.get_i64(key)
            .ok()
            .or_else(|| d.get_i32(key).ok().map(|v| v as i64))
    })
}

/// One tick: advance up to `limit` active runs whose `nextRunAt` is due.
pub async fn tick(state: &Arc<AppState>) -> EngineResult<TickResult> {
    let mut out = TickResult::default();
    let now = chrono::Utc::now();
    let now_bson = BsonDateTime::from_millis(now.timestamp_millis());

    let runs_col = state.mongo.collection::<Document>(db::COL_JOURNEY_RUNS);
    let journeys_col = state.mongo.collection::<Document>(db::COL_JOURNEYS);

    let filter = doc! {
        "status": "active",
        "nextRunAt": { "$lte": now_bson },
    };
    let mut cursor = runs_col.find(filter).limit(100).await?;

    use futures_util_compat::Streamish;
    let runs = Streamish::collect(&mut cursor).await?;

    for run in runs {
        out.processed += 1;
        let run_id = match run.get_object_id("_id") {
            Ok(id) => id,
            Err(_) => continue,
        };
        let workspace_id = run.get_str("workspaceId").unwrap_or_default().to_string();
        let person = run.get_str("personEmail").unwrap_or_default().to_string();
        let current_id = run.get_str("currentNodeId").ok().map(|s| s.to_string());
        let run_account = run.get_str("accountId").ok().map(|s| s.to_string());

        let journey_oid = match run
            .get_str("journeyId")
            .ok()
            .and_then(|j| ObjectId::parse_str(j).ok())
        {
            Some(o) => o,
            None => {
                let _ = complete(&runs_col, &run_id, "failed").await;
                out.failed += 1;
                continue;
            }
        };
        let journey = journeys_col
            .find_one(doc! { "_id": journey_oid, "workspaceId": &workspace_id })
            .await?;
        let journey = match journey {
            Some(j) if j.get_bool("enabled").unwrap_or(false) => j,
            _ => {
                let _ = complete(&runs_col, &run_id, "completed").await;
                out.completed += 1;
                continue;
            }
        };

        let empty: Vec<Bson> = Vec::new();
        let nodes = journey.get_array("nodes").unwrap_or(&empty);
        let edges = journey.get_array("edges").unwrap_or(&empty);

        let cur_id = match current_id {
            Some(c) => c,
            None => {
                let _ = complete(&runs_col, &run_id, "completed").await;
                out.completed += 1;
                continue;
            }
        };
        let node = match find_node(nodes, &cur_id) {
            Some(n) => n,
            None => {
                let _ = complete(&runs_col, &run_id, "completed").await;
                out.completed += 1;
                continue;
            }
        };

        match node_type(node).as_str() {
            "send" => {
                let account_id = node_data_str(node, "accountId").or(run_account.clone());
                let subject = node_data_str(node, "subject").unwrap_or_else(|| "(no subject)".into());
                let html = node_data_str(node, "html");
                if let Some(account_id) = account_id {
                    let res = send::send_message(
                        state,
                        send::SendRequest {
                            workspace_id: workspace_id.clone(),
                            account_id,
                            to: vec![person.clone()],
                            cc: vec![],
                            bcc: vec![],
                            subject,
                            html,
                            text: node_data_str(node, "text"),
                        },
                    )
                    .await;
                    match res {
                        Ok(_) => out.sent += 1,
                        Err(_) => out.failed += 1,
                    }
                }
                advance(&runs_col, &run_id, first_next(edges, &cur_id), now_bson).await?;
                if first_next(edges, &cur_id).is_none() {
                    out.completed += 1;
                }
            }
            "wait" => {
                let delay = node_data_i64(node, "delaySeconds").unwrap_or(86_400).max(1);
                let next_at = BsonDateTime::from_millis(
                    (now + chrono::Duration::seconds(delay)).timestamp_millis(),
                );
                advance(&runs_col, &run_id, first_next(edges, &cur_id), next_at).await?;
                if first_next(edges, &cur_id).is_none() {
                    out.completed += 1;
                }
            }
            "exit" => {
                complete(&runs_col, &run_id, "completed").await?;
                out.completed += 1;
            }
            _ => {
                // condition / other → take the first outgoing edge, run now.
                advance(&runs_col, &run_id, first_next(edges, &cur_id), now_bson).await?;
                if first_next(edges, &cur_id).is_none() {
                    out.completed += 1;
                }
            }
        }
    }

    Ok(out)
}

async fn advance(
    runs: &mongodb::Collection<Document>,
    run_id: &ObjectId,
    next: Option<String>,
    next_run_at: BsonDateTime,
) -> EngineResult<()> {
    let now = BsonDateTime::from_millis(chrono::Utc::now().timestamp_millis());
    match next {
        Some(next_id) => {
            runs.update_one(
                doc! { "_id": run_id },
                doc! { "$set": { "currentNodeId": next_id, "nextRunAt": next_run_at, "updatedAt": now } },
            )
            .await?;
        }
        None => {
            runs.update_one(
                doc! { "_id": run_id },
                doc! { "$set": { "status": "completed", "currentNodeId": Bson::Null, "nextRunAt": Bson::Null, "updatedAt": now } },
            )
            .await?;
        }
    }
    Ok(())
}

async fn complete(
    runs: &mongodb::Collection<Document>,
    run_id: &ObjectId,
    status: &str,
) -> EngineResult<()> {
    let now = BsonDateTime::from_millis(chrono::Utc::now().timestamp_millis());
    runs.update_one(
        doc! { "_id": run_id },
        doc! { "$set": { "status": status, "currentNodeId": Bson::Null, "nextRunAt": Bson::Null, "updatedAt": now } },
    )
    .await?;
    Ok(())
}

/// Minimal cursor collector to avoid pulling the futures crate directly.
mod futures_util_compat {
    use mongodb::bson::Document;
    use mongodb::Cursor;

    pub struct Streamish;
    impl Streamish {
        pub async fn collect(cursor: &mut Cursor<Document>) -> Result<Vec<Document>, mongodb::error::Error> {
            let mut out = Vec::new();
            while cursor.advance().await? {
                out.push(cursor.deserialize_current()?);
            }
            Ok(out)
        }
    }
}
