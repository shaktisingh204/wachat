//! Phone-number registration / verification / 2FA / deregister.

use sabnode_common::{ApiError, Result};
use serde::Deserialize;
use serde_json::{Value, json};
use wachat_meta_client::MetaClient;
use wachat_types::Project;

#[derive(Debug, Clone, Deserialize)]
pub struct PinBody {
    pub pin: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CodeBody {
    pub code: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct VerifReqBody {
    pub method: String,
    pub language: String,
}

fn token_for(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))
}

pub async fn register(
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
    body: PinBody,
) -> Result<()> {
    let path = format!("{phone_number_id}/register");
    let payload = json!({ "messaging_product": "whatsapp", "pin": body.pin });
    let _: Value = meta.post_json(&path, token_for(project)?, &payload).await?;
    Ok(())
}

pub async fn request_verification_code(
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
    body: VerifReqBody,
) -> Result<()> {
    let path = format!("{phone_number_id}/request_code");
    let payload = json!({ "code_method": body.method, "language": body.language });
    let _: Value = meta.post_json(&path, token_for(project)?, &payload).await?;
    Ok(())
}

pub async fn verify_code(
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
    body: CodeBody,
) -> Result<()> {
    let path = format!("{phone_number_id}/verify_code");
    let payload = json!({ "code": body.code });
    let _: Value = meta.post_json(&path, token_for(project)?, &payload).await?;
    Ok(())
}

pub async fn deregister(meta: &MetaClient, project: &Project, phone_number_id: &str) -> Result<()> {
    let path = format!("{phone_number_id}/deregister");
    let _: Value = meta
        .post_json(&path, token_for(project)?, &json!({}))
        .await?;
    Ok(())
}

pub async fn set_two_step_pin(
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
    body: PinBody,
) -> Result<()> {
    let path = phone_number_id.to_owned();
    let payload = json!({ "pin": body.pin });
    let _: Value = meta.post_json(&path, token_for(project)?, &payload).await?;
    Ok(())
}
