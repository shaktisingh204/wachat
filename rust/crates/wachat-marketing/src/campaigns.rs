//! Read-only access to the `wa_marketing_campaigns` collection (written by
//! `send::send`). Last-100 rows for a project, newest first — mirrors the
//! `wachat-calling` logs read so the marketing campaigns page can treat the
//! response as a plain array.

use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Serialize;
use serde_json::Value;

const CAMPAIGNS_COLL: &str = "wa_marketing_campaigns";
const DEFAULT_LIMIT: i64 = 100;

#[derive(Debug, Clone, Serialize)]
pub struct CampaignsResponse {
    pub campaigns: Vec<Value>,
}

/// `db.wa_marketing_campaigns.find({projectId}).sort({createdAt:-1}).limit(100)`.
pub async fn list(mongo: &MongoHandle, project_id: &ObjectId) -> Result<CampaignsResponse> {
    let coll = mongo.collection::<Document>(CAMPAIGNS_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(DEFAULT_LIMIT)
        .build();

    let cursor = coll
        .find(doc! { "projectId": project_id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("marketing.campaigns.find")))?;

    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("marketing.campaigns.collect")))?;

    let campaigns = docs
        .into_iter()
        .map(|d| serde_json::to_value(d).map_err(|e| ApiError::Internal(anyhow::anyhow!(e))))
        .collect::<Result<Vec<_>>>()?;

    Ok(CampaignsResponse { campaigns })
}
