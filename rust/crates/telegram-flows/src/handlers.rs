use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::state::TelegramFlowsState;

const PROJECTS: &str = "projects";
const REPLIES: &str = "telegram_quick_replies";

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "replyId")]
    pub reply_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReplyRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub shortcut: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "parseMode")]
    pub parse_mode: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListResp {
    pub replies: Vec<ReplyRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "replyId")]
    pub reply_id: Option<String>,
    pub shortcut: String,
    pub text: String,
    #[serde(default, rename = "parseMode")]
    pub parse_mode: Option<String>,
}

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}
fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}
fn err(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        ..Default::default()
    })
}
fn dt(o: Option<bson::DateTime>) -> DateTime<Utc> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
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

fn doc_to_row(d: &Document) -> Option<ReplyRow> {
    Some(ReplyRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        shortcut: d.get_str("shortcut").unwrap_or("").to_owned(),
        text: d.get_str("text").unwrap_or("").to_owned(),
        parse_mode: d.get_str("parseMode").ok().map(str::to_owned),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListResp {
                replies: vec![],
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListResp {
                replies: vec![],
                error: Some(e),
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(REPLIES)
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "shortcut": 1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                replies: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                replies: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let replies = docs.iter().filter_map(doc_to_row).collect();
    Json(ListResp { replies, error: None })
}

pub async fn upsert(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Json(body): Json<UpsertBody>,
) -> Json<AckResult> {
    let shortcut = body.shortcut.trim().to_owned();
    let text = body.text.trim().to_owned();
    if shortcut.is_empty() || text.is_empty() {
        return err("shortcut and text are required");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let user_oid = match parse_user_oid(&user) {
        Some(o) => o,
        None => return err("invalid auth subject"),
    };
    let now = bson::DateTime::now();

    let coll = s.mongo.collection::<Document>(REPLIES);
    let mut set = doc! {
        "projectId": project_oid,
        "shortcut": &shortcut,
        "text": &text,
        "updatedAt": now,
    };
    if let Some(pm) = body.parse_mode {
        set.insert("parseMode", pm);
    }

    if let Some(reply_id) = body.reply_id.as_deref() {
        let oid = match parse_oid(reply_id) {
            Some(o) => o,
            None => return err("Invalid reply id."),
        };
        match coll
            .update_one(
                doc! { "_id": oid, "projectId": project_oid },
                doc! { "$set": set },
            )
            .await
        {
            Ok(r) if r.matched_count == 0 => err("Reply not found."),
            Ok(_) => Json(AckResult {
                success: true,
                reply_id: Some(reply_id.to_owned()),
                message: Some("Saved.".to_owned()),
                ..Default::default()
            }),
            Err(e) => err(format!("mongo: {e}")),
        }
    } else {
        set.insert("userId", user_oid);
        set.insert("createdAt", now);
        match coll.insert_one(set).await {
            Ok(res) => {
                let id = res
                    .inserted_id
                    .as_object_id()
                    .map(|o| o.to_hex())
                    .unwrap_or_default();
                Json(AckResult {
                    success: true,
                    reply_id: Some(id),
                    message: Some("Saved.".to_owned()),
                    ..Default::default()
                })
            }
            Err(e) => err(format!("mongo: {e}")),
        }
    }
}

pub async fn delete_reply(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Path(reply_id): Path<String>,
    Query(q): Query<ListQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let oid = match parse_oid(&reply_id) {
        Some(o) => o,
        None => return err("Invalid reply id."),
    };
    match s
        .mongo
        .collection::<Document>(REPLIES)
        .delete_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            reply_id: Some(reply_id),
            message: Some("Deleted.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}
