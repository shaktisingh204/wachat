//! Webhook subscription management.

use bson::doc;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use wachat_meta_client::MetaClient;
use wachat_types::Project;

const PROJECTS_COLL: &str = "projects";

#[derive(Debug, Clone, Serialize)]
pub struct SubscriptionStatus {
    pub is_active: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscribeBody {
    pub app_id: String,
    pub user_access_token: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SubscribeAllOutcome {
    pub attempted: usize,
    pub succeeded: usize,
    pub failed: Vec<SubscribeFailure>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SubscribeFailure {
    pub project_id: String,
    pub error: String,
}

pub async fn status(
    meta: &MetaClient,
    waba_id: &str,
    access_token: &str,
) -> Result<SubscriptionStatus> {
    #[derive(Deserialize)]
    struct Resp {
        data: Vec<Value>,
    }
    let path = format!("{waba_id}/subscribed_apps");
    let resp: Resp = meta.get_json(&path, access_token).await?;
    Ok(SubscriptionStatus {
        is_active: !resp.data.is_empty(),
    })
}

pub async fn subscribe_one(
    meta: &MetaClient,
    waba_id: &str,
    user_access_token: &str,
) -> Result<()> {
    let path = format!("{waba_id}/subscribed_apps");
    let _: Value = meta.post_json(&path, user_access_token, &json!({})).await?;
    Ok(())
}

pub async fn subscribe_all(mongo: &MongoHandle, meta: &MetaClient) -> Result<SubscribeAllOutcome> {
    use futures::TryStreamExt;
    let cursor = mongo
        .collection::<Project>(PROJECTS_COLL)
        .find(doc! {})
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let projects: Vec<Project> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let mut outcome = SubscribeAllOutcome {
        attempted: 0,
        succeeded: 0,
        failed: Vec::new(),
    };
    for p in projects {
        outcome.attempted += 1;
        let waba = match p.waba_id.as_deref() {
            Some(w) => w,
            None => {
                outcome.failed.push(SubscribeFailure {
                    project_id: p.id.to_hex(),
                    error: "missing wabaId".into(),
                });
                continue;
            }
        };
        let token = match p.access_token.as_deref() {
            Some(t) => t,
            None => {
                outcome.failed.push(SubscribeFailure {
                    project_id: p.id.to_hex(),
                    error: "missing accessToken".into(),
                });
                continue;
            }
        };
        match subscribe_one(meta, waba, token).await {
            Ok(()) => outcome.succeeded += 1,
            Err(e) => outcome.failed.push(SubscribeFailure {
                project_id: p.id.to_hex(),
                error: e.to_string(),
            }),
        }
    }
    Ok(outcome)
}
