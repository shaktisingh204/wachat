//! WhatsApp QR code CRUD via Meta.

use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use wachat_meta_client::MetaClient;
use wachat_types::Project;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateQrBody {
    pub prefilled_message: String,
    #[serde(default = "default_image_format")]
    pub generate_qr_image: String,
}

fn default_image_format() -> String {
    "SVG".into()
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateQrBody {
    pub prefilled_message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct QrList {
    pub qr_codes: Vec<Value>,
}

fn token_for(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))
}

pub async fn list(meta: &MetaClient, project: &Project, phone_number_id: &str) -> Result<QrList> {
    #[derive(Deserialize)]
    struct Resp {
        data: Vec<Value>,
    }
    let path = format!("{phone_number_id}/message_qrdls");
    let resp: Resp = meta.get_json(&path, token_for(project)?).await?;
    Ok(QrList {
        qr_codes: resp.data,
    })
}

pub async fn create(
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
    body: CreateQrBody,
) -> Result<Value> {
    let path = format!("{phone_number_id}/message_qrdls");
    let payload = json!({
        "prefilled_message": body.prefilled_message,
        "generate_qr_image": body.generate_qr_image,
    });
    let resp: Value = meta.post_json(&path, token_for(project)?, &payload).await?;
    Ok(resp)
}

pub async fn update(
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
    code: &str,
    body: UpdateQrBody,
) -> Result<Value> {
    let path = format!("{phone_number_id}/message_qrdls/{code}");
    let payload = json!({ "prefilled_message": body.prefilled_message });
    let resp: Value = meta.post_json(&path, token_for(project)?, &payload).await?;
    Ok(resp)
}

pub async fn delete(
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
    code: &str,
) -> Result<()> {
    let path = format!("{phone_number_id}/message_qrdls/{code}");
    meta.delete(&path, token_for(project)?).await?;
    Ok(())
}
