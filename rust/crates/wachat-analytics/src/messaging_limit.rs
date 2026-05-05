//! Messaging-limit tier — Meta Graph `GET /{phone-number-id}?fields=messaging_limit_tier`.

use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use wachat_meta_client::MetaClient;
use wachat_types::Project;

#[derive(Debug, Clone, Serialize)]
pub struct MessagingLimitTier {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tier: Option<String>,
}

pub async fn fetch(
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
) -> Result<MessagingLimitTier> {
    let token = project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))?;

    #[derive(Deserialize)]
    struct Resp {
        messaging_limit_tier: Option<String>,
    }
    let path = format!("{phone_number_id}?fields=messaging_limit_tier");
    let resp: Resp = meta.get_json(&path, token).await?;
    Ok(MessagingLimitTier {
        tier: resp.messaging_limit_tier,
    })
}
