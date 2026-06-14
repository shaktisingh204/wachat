//! Read-only last-100 of the `wa_carousels` sent-log for a project.

use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Serialize;
use serde_json::Value;

const CAROUSELS_COLL: &str = "wa_carousels";
const DEFAULT_LIMIT: i64 = 100;

#[derive(Debug, Clone, Serialize)]
pub struct CarouselsResponse {
    pub carousels: Vec<Value>,
}

pub async fn list(mongo: &MongoHandle, project_id: &ObjectId) -> Result<CarouselsResponse> {
    let coll = mongo.collection::<Document>(CAROUSELS_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(DEFAULT_LIMIT)
        .build();

    let cursor = coll
        .find(doc! { "projectId": project_id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("carousels.find")))?;

    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("carousels.collect")))?;

    let carousels = docs
        .into_iter()
        .map(|d| serde_json::to_value(d).map_err(|e| ApiError::Internal(anyhow::anyhow!(e))))
        .collect::<Result<Vec<_>>>()?;

    Ok(CarouselsResponse { carousels })
}
