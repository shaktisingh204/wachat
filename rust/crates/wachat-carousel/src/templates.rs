//! Carousel **template** creation on the WABA.
//!
//! Carousel templates are created on the WABA node
//! (`POST /{waba-id}/message_templates`) with a `CAROUSEL` component holding up
//! to 10 cards, each with its own header media + body + buttons. The exact
//! component schema is large and evolving, so the caller passes the full Meta
//! `components` array through verbatim (the frontend carousel builder assembles
//! it); this module wraps it with name/language/category and posts it.

use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use wachat_meta_client::MetaClient;
use wachat_types::Project;

/// Body for `POST /v1/wachat/carousel/projects/{id}/templates`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCarouselTemplateBody {
    pub name: String,
    pub language: String,
    /// `MARKETING` | `UTILITY`.
    pub category: String,
    /// Full Meta `components` array, including the `CAROUSEL` component.
    pub components: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateCarouselTemplateResponse {
    /// Meta template id, if returned.
    pub template_id: Option<String>,
    pub raw: Value,
}

pub(crate) fn waba_for(project: &Project) -> Result<&str> {
    project
        .waba_id
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing wabaId".to_owned()))
}

pub(crate) fn token_for(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))
}

pub async fn create(
    meta: &MetaClient,
    project: &Project,
    body: CreateCarouselTemplateBody,
) -> Result<CreateCarouselTemplateResponse> {
    let payload = json!({
        "name": body.name,
        "language": body.language,
        "category": body.category,
        "components": body.components,
    });
    let path = format!("{}/message_templates", waba_for(project)?);
    let raw: Value = meta.post_json(&path, token_for(project)?, &payload).await?;
    let template_id = raw.get("id").and_then(|v| v.as_str()).map(str::to_owned);
    Ok(CreateCarouselTemplateResponse { template_id, raw })
}
