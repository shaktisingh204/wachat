use axum::{extract::{Path, State}, Json};
use sabnode_common::{Result, ApiError};
use serde_json::Value;
use bson::Document;
use bson::doc;
use crate::state::EmailDeliverabilityState;
use tracing::warn;

// Helper to resolve token
async fn resolve_provider_token(
    mongo: &sabnode_db::mongo::MongoHandle,
    provider: &str,
    token: &str,
) -> Result<String> {
    let coll = mongo.collection::<Document>("email_settings");
    let path = format!("providerSecrets.{}", provider);
    let d = coll
        .find_one(doc! { &path: token })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("email_settings.find_one")))?
        .ok_or_else(|| ApiError::Unauthorized("invalid provider token".to_owned()))?;
    let user_id = d
        .get_object_id("userId")
        .map(|o| o.to_hex())
        .or_else(|_| d.get_str("userId").map(|s| s.to_owned()))
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("email_settings.userId missing")))?;
    Ok(user_id)
}
