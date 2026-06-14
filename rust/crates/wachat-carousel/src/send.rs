//! Send a carousel **template message** and log it.
//!
//! Carousel messages are template sends: `POST /{phone-number-id}/messages`
//! with `type:"template"` and a template whose `components` bind each card's
//! header media + body params + button payloads. The caller supplies the
//! per-card `components` (assembled by the frontend); we wrap, post, and record
//! a `wa_carousels` row for the sent-log read.

use bson::{DateTime, doc, oid::ObjectId};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use wachat_meta_client::MetaClient;
use wachat_types::Project;

use crate::templates::token_for;

const CAROUSELS_COLL: &str = "wa_carousels";

/// Body for `POST /v1/wachat/carousel/projects/{id}/send`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendCarouselBody {
    pub phone_number_id: String,
    pub to: String,
    pub template_name: String,
    pub language: String,
    /// Template `components` array binding the carousel cards.
    pub components: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct SendCarouselResponse {
    pub message_id: Option<String>,
    pub carousel_id: String,
    pub raw: Value,
}

pub async fn send(
    meta: &MetaClient,
    mongo: &MongoHandle,
    project: &Project,
    body: SendCarouselBody,
) -> Result<SendCarouselResponse> {
    let mut template = Map::new();
    template.insert("name".into(), Value::String(body.template_name.clone()));
    template.insert("language".into(), json!({ "code": body.language }));
    template.insert("components".into(), body.components.clone());

    let payload = json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": body.to,
        "type": "template",
        "template": Value::Object(template),
    });

    let path = format!("{}/messages", body.phone_number_id);
    let raw: Value = meta.post_json(&path, token_for(project)?, &payload).await?;

    let message_id = raw
        .get("messages")
        .and_then(|m| m.get(0))
        .and_then(|m| m.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_owned);

    let oid = ObjectId::new();
    let row = doc! {
        "_id": oid,
        "projectId": project.id,
        "phoneNumberId": &body.phone_number_id,
        "to": &body.to,
        "templateName": &body.template_name,
        "language": &body.language,
        "messageId": message_id.clone(),
        "status": "SENT",
        "createdAt": DateTime::now(),
    };
    mongo
        .collection::<bson::Document>(CAROUSELS_COLL)
        .insert_one(row)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("carousel.insert")))?;

    Ok(SendCarouselResponse {
        message_id,
        carousel_id: oid.to_hex(),
        raw,
    })
}
