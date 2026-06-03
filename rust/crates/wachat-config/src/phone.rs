//! Phone-number sync + business profile update.

use bson::{Document, doc};
use chrono::Utc;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use wachat_meta_client::MetaClient;
use wachat_types::Project;

const PROJECTS_COLL: &str = "projects";

#[derive(Debug, Clone, Serialize)]
pub struct SyncOutcome {
    pub fetched: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileBody {
    #[serde(default)]
    pub about: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub vertical: Option<String>,
    #[serde(default)]
    pub websites: Option<Vec<String>>,
    #[serde(default)]
    pub profile_picture_handle: Option<String>,
}

pub async fn sync_numbers(
    mongo: &MongoHandle,
    meta: &MetaClient,
    project: &Project,
) -> Result<SyncOutcome> {
    let waba_id = project
        .waba_id
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing wabaId".to_owned()))?;
    let token = project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))?;

    #[derive(Deserialize)]
    struct ListResp {
        data: Vec<Value>,
    }
    let path = format!(
        "{waba_id}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,platform_type,throughput"
    );
    let resp: ListResp = meta.get_json(&path, token).await?;
    let count = resp.data.len();

    let bson_array: Vec<bson::Bson> = resp
        .data
        .iter()
        .map(|v| bson::to_bson(v).unwrap_or(bson::Bson::Null))
        .collect();
    let now = bson::DateTime::from_chrono(Utc::now());
    mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(
            doc! { "_id": project.id },
            doc! { "$set": { "phoneNumbers": bson_array, "phoneNumbersSyncedAt": now } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(SyncOutcome { fetched: count })
}

pub async fn update_profile(
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
    body: UpdateProfileBody,
) -> Result<()> {
    let token = project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))?;

    let mut payload = json!({ "messaging_product": "whatsapp" });
    let m = payload.as_object_mut().expect("object literal");
    if let Some(v) = body.about {
        m.insert("about".into(), json!(v));
    }
    if let Some(v) = body.address {
        m.insert("address".into(), json!(v));
    }
    if let Some(v) = body.description {
        m.insert("description".into(), json!(v));
    }
    if let Some(v) = body.email {
        m.insert("email".into(), json!(v));
    }
    if let Some(v) = body.vertical {
        m.insert("vertical".into(), json!(v));
    }
    if let Some(v) = body.websites {
        m.insert("websites".into(), json!(v));
    }
    if let Some(v) = body.profile_picture_handle {
        m.insert("profile_picture_handle".into(), json!(v));
    }

    let path = format!("{phone_number_id}/whatsapp_business_profile");
    let _: serde_json::Value = meta.post_json(&path, token, &payload).await?;
    Ok(())
}
