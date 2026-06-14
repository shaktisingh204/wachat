//! Marketing-traffic template send (Marketing Messages API / MM Lite).
//!
//! MM Lite is Meta's dedicated **marketing** connection: a WABA enabled for MM
//! Lite gets higher deliverability and AI-optimized delivery for template
//! traffic, with optional per-message **TTL** and tracking. The wire call is a
//! standard template send on the phone-number node — Meta routes it over the
//! marketing connection based on the WABA's MM Lite enablement and the
//! template's MARKETING category. This module builds that payload (template +
//! optional TTL + `biz_opaque_callback_data` tracking), posts it, and records a
//! row in `wa_marketing_campaigns` so the campaign log can read it back.

use bson::{DateTime, doc, oid::ObjectId};
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use wachat_meta_client::MetaClient;
use wachat_types::Project;

use sabnode_db::mongo::MongoHandle;

const CAMPAIGNS_COLL: &str = "wa_marketing_campaigns";

/// Body for `POST /v1/wachat/marketing/projects/{id}/send`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMarketingBody {
    pub phone_number_id: String,
    /// Recipient in E.164 (no `+` needed; Meta accepts digits).
    pub to: String,
    pub template_name: String,
    /// Template language code, e.g. `"en_US"`.
    pub language: String,
    /// Template `components` array (header/body/button params), passed through.
    #[serde(default)]
    pub components: Option<Value>,
    /// Marketing TTL in seconds — drop the message if undelivered past this.
    #[serde(default)]
    pub ttl_seconds: Option<u64>,
    /// Opaque tracking id echoed back on status webhooks
    /// (`biz_opaque_callback_data`).
    #[serde(default)]
    pub tracking_id: Option<String>,
    /// Opt into Meta's AI-optimized delivery for MM Lite traffic.
    #[serde(default)]
    pub ai_optimized: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SendMarketingResponse {
    /// Meta `wamid` of the queued message, if returned.
    pub message_id: Option<String>,
    /// Local campaign-log document id.
    pub campaign_id: String,
    pub raw: Value,
}

fn token_for(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))
}

/// Build the template-message payload + post to `{phone_number_id}/messages`,
/// then persist a `wa_marketing_campaigns` row.
pub async fn send(
    meta: &MetaClient,
    mongo: &MongoHandle,
    project: &Project,
    body: SendMarketingBody,
) -> Result<SendMarketingResponse> {
    let mut template = Map::new();
    template.insert("name".into(), Value::String(body.template_name.clone()));
    template.insert("language".into(), json!({ "code": body.language }));
    if let Some(components) = body.components.clone() {
        template.insert("components".into(), components);
    }

    let mut payload = Map::new();
    payload.insert("messaging_product".into(), Value::String("whatsapp".into()));
    payload.insert("recipient_type".into(), Value::String("individual".into()));
    payload.insert("to".into(), Value::String(body.to.clone()));
    payload.insert("type".into(), Value::String("template".into()));
    payload.insert("template".into(), Value::Object(template));
    if let Some(ttl) = body.ttl_seconds {
        payload.insert("ttl".into(), json!(ttl));
    }
    if let Some(track) = body.tracking_id.clone() {
        payload.insert("biz_opaque_callback_data".into(), Value::String(track));
    }

    let path = format!("{}/messages", body.phone_number_id);
    let raw: Value = meta
        .post_json(&path, token_for(project)?, &Value::Object(payload))
        .await?;

    let message_id = raw
        .get("messages")
        .and_then(|m| m.get(0))
        .and_then(|m| m.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_owned);

    let campaign_oid = ObjectId::new();
    let row = doc! {
        "_id": campaign_oid,
        "projectId": project.id,
        "phoneNumberId": &body.phone_number_id,
        "to": &body.to,
        "templateName": &body.template_name,
        "language": &body.language,
        "ttlSeconds": body.ttl_seconds.map(|t| t as i64),
        "trackingId": body.tracking_id.clone(),
        "aiOptimized": body.ai_optimized.unwrap_or(false),
        "messageId": message_id.clone(),
        "channel": "MM_LITE",
        "status": "SENT",
        "createdAt": DateTime::now(),
    };
    mongo
        .collection::<bson::Document>(CAMPAIGNS_COLL)
        .insert_one(row)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("marketing.campaign.insert")))?;

    Ok(SendMarketingResponse {
        message_id,
        campaign_id: campaign_oid.to_hex(),
        raw,
    })
}
