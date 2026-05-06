use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::state::TelegramMiniAppsState;

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";

#[derive(Debug, Clone, Serialize)]
pub struct MiniAppEntry {
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub username: String,
    pub name: String,
    #[serde(rename = "miniAppUrl")]
    pub mini_app_url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListResp {
    #[serde(rename = "miniApps")]
    pub mini_apps: Vec<MiniAppEntry>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}
fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}

async fn require_project(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
) -> Result<ObjectId, String> {
    let project_oid = parse_oid(project_id).ok_or_else(|| "invalid project id".to_owned())?;
    let user_oid = parse_user_oid(user).ok_or_else(|| "invalid auth subject".to_owned())?;
    let project = mongo
        .collection::<Document>(PROJECTS)
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Project not found.".to_owned())?;
    if project.get_object_id("userId").ok() != Some(user_oid) {
        return Err("Project not found.".to_owned());
    }
    Ok(project_oid)
}

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramMiniAppsState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListResp {
                mini_apps: vec![],
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListResp {
                mini_apps: vec![],
                error: Some(e),
            });
        }
    };

    let cursor = match s
        .mongo
        .collection::<Document>(BOTS)
        .find(doc! {
            "projectId": project_oid,
            "miniAppUrl": { "$exists": true, "$ne": "" },
        })
        .sort(doc! { "username": 1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                mini_apps: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                mini_apps: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let mini_apps = docs
        .iter()
        .filter_map(|d| {
            let url = d.get_str("miniAppUrl").ok().filter(|s| !s.is_empty())?;
            Some(MiniAppEntry {
                bot_id: d.get_object_id("_id").ok()?.to_hex(),
                username: d.get_str("username").unwrap_or("").to_owned(),
                name: d.get_str("name").unwrap_or("").to_owned(),
                mini_app_url: url.to_owned(),
            })
        })
        .collect();
    Json(ListResp {
        mini_apps,
        error: None,
    })
}
