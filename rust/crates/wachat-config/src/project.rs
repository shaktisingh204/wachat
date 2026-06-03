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
            name: p.name.unwrap_or_default(),
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
    /// Optional — the OAuth-linked WABA flow doesn't have a phone-number
    /// id at creation time (it sync's the numbers from Meta right after).
    /// The legacy manual setup form does always supply one.
    #[serde(default)]
    pub phone_number_id: Option<String>,
    pub access_token: String,
    #[serde(default)]
    pub business_id: Option<String>,
    #[serde(default)]
    pub app_id: Option<String>,
    /// Mirrors the `includeCatalog` flag from the legacy
    /// `_createProjectFromWaba` helper. Stored as
    /// `hasCatalogManagement` on the project doc on first insert.
    #[serde(default)]
    pub include_catalog: Option<bool>,
}

pub async fn get_public(
    mongo: &MongoHandle,
    project_id: &ObjectId,
) -> Result<Option<PublicProject>> {
    let coll = mongo.collection::<Project>(PROJECTS_COLL);
    let p = coll
        .find_one(doc! { "_id": project_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(p.map(PublicProject::from_project))
}

/// Result of `GET /v1/wachat/config/projects/by-waba/{wabaId}`. Returns
/// the owning project's hex `_id` so TS callers that historically did
/// `db.collection('projects').findOne({ wabaId })` can swap to a Rust
/// hop without bringing back a Mongo client.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectByWabaResponse {
    pub project_id: String,
}

/// Resolve a wabaId to its owning project (scoped to the calling user
/// via the caller's tenant check). Returns `None` if no project for that
/// `wabaId` belongs to this user.
pub async fn find_id_by_waba(
    mongo: &MongoHandle,
    user_id: &ObjectId,
    waba_id: &str,
) -> Result<Option<ProjectByWabaResponse>> {
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let doc = coll
        .find_one(doc! { "wabaId": waba_id, "userId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let Some(d) = doc else { return Ok(None) };
    let oid = d
        .get_object_id("_id")
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Some(ProjectByWabaResponse {
        project_id: oid.to_hex(),
    }))
}

pub async fn manual_setup(
    mongo: &MongoHandle,
    user_id: &ObjectId,
    body: ManualSetupBody,
) -> Result<PublicProject> {
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_id = ObjectId::new();

    // Resolve the default plan once so we can seed `planId` /
    // `credits` / `messagesPerSecond` on insert. Mirrors the legacy
    // `_createProjectFromWaba` helper which read `plans.findOne({
    // isDefault: true })` before inserting a brand-new project.
    let default_plan = mongo
        .collection::<Document>("plans")
        .find_one(doc! { "isDefault": true })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let (default_plan_id, default_signup_credits) = match default_plan {
        Some(p) => {
            let pid = p.get_object_id("_id").ok();
            let credits = p
                .get_i64("signupCredits")
                .ok()
                .or_else(|| p.get_i32("signupCredits").ok().map(i64::from))
                .unwrap_or(0);
            (pid, credits)
        }
        None => (None, 0),
    };

    let mut set_on_insert = doc! {
        "_id": new_id,
        "userId": user_id,
        "wabaId": &body.waba_id,
        "createdAt": now,
        "phoneNumbers": Vec::<bson::Bson>::new(),
        "messagesPerSecond": 80i32,
        "credits": default_signup_credits,
    };
    if let Some(plan_id) = default_plan_id {
        set_on_insert.insert("planId", plan_id);
    }
    if let Some(include_catalog) = body.include_catalog {
        set_on_insert.insert("hasCatalogManagement", include_catalog);
    }

    let mut set_doc = doc! {
        "name": &body.name,
        "accessToken": &body.access_token,
        "businessId": body.business_id.as_deref(),
        "appId": body.app_id.as_deref(),
        "updatedAt": now,
    };
    if let Some(pnid) = body.phone_number_id.as_deref() {
        set_doc.insert("phoneNumberId", pnid);
    }

    coll.update_one(
        doc! { "wabaId": &body.waba_id, "userId": user_id },
        doc! {
            "$setOnInsert": set_on_insert,
            "$set": set_doc,
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
