//! Read-only last-100 of `wa_calls` for a project (Calling-API call log).

use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Serialize;
use serde_json::Value;

const CALLS_COLL: &str = "wa_calls";
const DEFAULT_LIMIT: i64 = 100;

#[derive(Debug, Clone, Serialize)]
pub struct CallsResponse {
    pub calls: Vec<Value>,
}

pub async fn list(mongo: &MongoHandle, project_id: &ObjectId) -> Result<CallsResponse> {
    let coll = mongo.collection::<Document>(CALLS_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(DEFAULT_LIMIT)
        .build();

    let cursor = coll
        .find(doc! { "projectId": project_id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("wa_calls.find")))?;

    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("wa_calls.collect")))?;

    let calls = docs
        .into_iter()
        .map(|d| serde_json::to_value(d).map_err(|e| ApiError::Internal(anyhow::anyhow!(e))))
        .collect::<Result<Vec<_>>>()?;

    Ok(CallsResponse { calls })
}
