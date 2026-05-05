//! Auto-reply rules engine.
//!
//! Mirrors `getAutoReplyRules`, `saveAutoReplyRule`, `deleteAutoReplyRule`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    helpers::{docs_to_json, opt_oid},
    state::WachatFeaturesState,
    tenancy::load_project_for,
};

const COLL: &str = "wa_auto_reply_rules";

#[derive(Debug, Serialize)]
pub struct RulesResp {
    pub rules: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRuleBody {
    #[serde(default)]
    pub rule_id: Option<String>,
    pub name: String,
    pub keywords: String,
    #[serde(default)]
    pub match_type: Option<String>,
    #[serde(default)]
    pub response_type: Option<String>,
    #[serde(default)]
    pub response_text: Option<String>,
    #[serde(default)]
    pub template_name: Option<String>,
    #[serde(default)]
    pub is_active: bool,
    #[serde(default)]
    pub time_from: Option<String>,
    #[serde(default)]
    pub time_to: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MsgResp {
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct OkResp {
    pub success: bool,
}

pub async fn list(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<RulesResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let opts = FindOptions::builder().sort(doc! { "priority": 1 }).build();
    let cursor = coll
        .find(doc! { "projectId": project.id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(RulesResp {
        rules: docs_to_json(docs),
    }))
}

pub async fn save(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<SaveRuleBody>,
) -> Result<Json<MsgResp>> {
    if body.name.trim().is_empty() || body.keywords.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Name and keywords are required.".to_owned(),
        ));
    }
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);

    let keyword_list: Vec<String> = body
        .keywords
        .split(',')
        .map(|k| k.trim().to_lowercase())
        .filter(|k| !k.is_empty())
        .collect();

    let now = bson::DateTime::from_chrono(Utc::now());
    let mut set_doc = doc! {
        "projectId": project.id,
        "name": &body.name,
        "keywords": keyword_list,
        "matchType": body.match_type.unwrap_or_else(|| "contains".to_owned()),
        "responseType": body.response_type.unwrap_or_else(|| "text".to_owned()),
        "responseText": body.response_text.unwrap_or_default(),
        "templateName": body.template_name.unwrap_or_default(),
        "isActive": body.is_active,
        "timeFrom": body.time_from.unwrap_or_default(),
        "timeTo": body.time_to.unwrap_or_default(),
        "updatedAt": now,
    };

    if let Some(rid) = body.rule_id.as_deref().filter(|s| !s.is_empty()) {
        let oid = opt_oid(rid)?;
        coll.update_one(doc! { "_id": oid }, doc! { "$set": set_doc })
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    } else {
        set_doc.insert("createdAt", now);
        set_doc.insert("priority", 0i32);
        coll.insert_one(set_doc)
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    }

    Ok(Json(MsgResp {
        message: "Rule saved.".to_owned(),
    }))
}

pub async fn delete(
    _user: AuthUser,
    Path(rule_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<OkResp>> {
    let oid = opt_oid(&rule_id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}
