//! Template analytics — Meta Graph `template_analytics` field passthrough.

use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use wachat_meta_client::MetaClient;
use wachat_types::Project;

use crate::conversation::Granularity;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateAnalyticsBody {
    pub start_timestamp: i64,
    pub end_timestamp: i64,
    #[serde(default)]
    pub template_ids: Option<Vec<String>>,
    #[serde(default)]
    pub granularity: Option<Granularity>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TemplateAnalyticsResult {
    pub data_points: Vec<Value>,
}

pub async fn fetch(
    meta: &MetaClient,
    project: &Project,
    body: TemplateAnalyticsBody,
) -> Result<TemplateAnalyticsResult> {
    let waba_id = project
        .waba_id
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing wabaId".to_owned()))?;
    let token = project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))?;

    let g = body
        .granularity
        .unwrap_or(crate::conversation::Granularity::Daily);
    // We rely on the SCREAMING_SNAKE_CASE serialization of Granularity.
    let g_str = match g {
        Granularity::HalfHour => "HALF_HOUR",
        Granularity::Daily => "DAILY",
        Granularity::Monthly => "MONTHLY",
    };
    let mut query = format!(
        "template_analytics.start({}).end({}).granularity({})",
        body.start_timestamp, body.end_timestamp, g_str
    );
    if let Some(ids) = body.template_ids.as_ref().filter(|v| !v.is_empty()) {
        let joined = ids
            .iter()
            .map(|s| format!("\"{s}\""))
            .collect::<Vec<_>>()
            .join(",");
        query.push_str(&format!(".template_ids([{joined}])"));
    }

    let path = format!(
        "{waba_id}?fields={}",
        crate::conversation::url_encode(&query)
    );
    let resp: Value = meta.get_json(&path, token).await?;

    let node = resp
        .get("template_analytics")
        .cloned()
        .unwrap_or(Value::Null);
    let data_points = node
        .get("data")
        .and_then(|d| d.get("data_points"))
        .or_else(|| node.get("data_points"))
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default();
    Ok(TemplateAnalyticsResult { data_points })
}
