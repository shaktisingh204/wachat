//! Project read + manual setup.

use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use wachat_types::Project;

const PROJECTS_COLL: &str = "projects";

#[derive(Debug, Clone, Serialize)]
pub struct PublicProject {
    #[serde(rename = "_id")]
    pub id: String,
    #[serde(rename = "userId")]
    pub user_id: String,
    pub name: String,
    #[serde(rename = "wabaId", skip_serializing_if = "Option::is_none")]
    pub waba_id: Option<String>,
    #[serde(rename = "businessId", skip_serializing_if = "Option::is_none")]
    pub business_id: Option<String>,
    #[serde(rename = "appId", skip_serializing_if = "Option::is_none")]
    pub app_id: Option<String>,
    #[serde(rename = "phoneNumbers")]
    pub phone_numbers: Vec<Value>,
    #[serde(rename = "createdAt")]
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl PublicProject {
    fn from_project(p: Project) -> Self {
        Self {
            id: p.id.to_hex(),
            user_id: p.user_id.to_hex(),
            name: p.name,
            waba_id: p.waba_id,
            business_id: None,
            app_id: None,
            phone_numbers: p
                .phone_numbers
                .into_iter()
                .map(|pn| serde_json::to_value(pn).unwrap_or(Value::Null))
                .collect(),
            created_at: Utc::now(), // Project struct doesn't expose createdAt — placeholder
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualSetupBody {
    pub name: String,
    pub waba_id: String,
    pub phone_number_id: String,
    pub access_token: String,
    #[serde(default)]
    pub business_id: Option<String>,
    #[serde(default)]
    pub app_id: Option<String>,
}

pub async fn get_public(mongo: &MongoHandle, project_id: &ObjectId) -> Result<Option<PublicProject>> {
    let coll = mongo.collection::<Project>(PROJECTS_COLL);
    let p = coll
        .find_one(doc! { "_id": project_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(p.map(PublicProject::from_project))
}

pub async fn manual_setup(
    mongo: &MongoHandle,
    user_id: &ObjectId,
    body: ManualSetupBody,
) -> Result<PublicProject> {
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_id = ObjectId::new();
    coll.update_one(
        doc! { "wabaId": &body.waba_id, "userId": user_id },
        doc! {
            "$setOnInsert": {
                "_id": new_id,
                "userId": user_id,
                "wabaId": &body.waba_id,
                "createdAt": now,
            },
            "$set": {
                "name": &body.name,
                "phoneNumberId": &body.phone_number_id,
                "accessToken": &body.access_token,
                "businessId": body.business_id.as_deref(),
                "appId": body.app_id.as_deref(),
                "updatedAt": now,
            },
        },
    )
    .with_options(
        mongodb::options::UpdateOptions::builder()
            .upsert(true)
            .build(),
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let project = mongo
        .collection::<Project>(PROJECTS_COLL)
        .find_one(doc! { "wabaId": &body.waba_id, "userId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("project not found post-upsert")))?;

    Ok(PublicProject::from_project(project))
}
