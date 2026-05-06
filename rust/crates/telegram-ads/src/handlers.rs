use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::state::TelegramAdsState;

const PROJECTS: &str = "projects";
const CAMPAIGNS: &str = "telegram_ads_campaigns";

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "campaignId")]
    pub campaign_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CampaignRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "platformId")]
    pub platform_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "landingUrl")]
    pub landing_url: Option<String>,
    #[serde(rename = "budgetCents")]
    pub budget_cents: i64,
    pub impressions: i64,
    pub clicks: i64,
    pub notes: String,
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
    pub campaigns: Vec<CampaignRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "campaignId")]
    pub campaign_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default, rename = "platformId")]
    pub platform_id: Option<String>,
    #[serde(default, rename = "landingUrl")]
    pub landing_url: Option<String>,
    #[serde(default, rename = "budgetCents")]
    pub budget_cents: Option<i64>,
    #[serde(default)]
    pub impressions: Option<i64>,
    #[serde(default)]
    pub clicks: Option<i64>,
    #[serde(default)]
    pub notes: Option<String>,
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

fn doc_to_row(d: &Document) -> Option<CampaignRow> {
    Some(CampaignRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        name: d.get_str("name").unwrap_or("").to_owned(),
        status: d.get_str("status").unwrap_or("draft").to_owned(),
        platform_id: d.get_str("platformId").ok().map(str::to_owned),
        landing_url: d.get_str("landingUrl").ok().map(str::to_owned),
        budget_cents: d
            .get_i64("budgetCents")
            .or_else(|_| d.get_i32("budgetCents").map(i64::from))
            .unwrap_or(0),
        impressions: d
            .get_i64("impressions")
            .or_else(|_| d.get_i32("impressions").map(i64::from))
            .unwrap_or(0),
        clicks: d
            .get_i64("clicks")
            .or_else(|_| d.get_i32("clicks").map(i64::from))
            .unwrap_or(0),
        notes: d.get_str("notes").unwrap_or("").to_owned(),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramAdsState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListResp {
                campaigns: vec![],
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListResp {
                campaigns: vec![],
                error: Some(e),
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(CAMPAIGNS)
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                campaigns: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                campaigns: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let campaigns = docs.iter().filter_map(doc_to_row).collect();
    Json(ListResp { campaigns, error: None })
}

pub async fn upsert(
    user: AuthUser,
    State(s): State<TelegramAdsState>,
    Json(body): Json<UpsertBody>,
) -> Json<AckResult> {
    if body.name.trim().is_empty() {
        return err("name is required");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let now = bson::DateTime::now();
    let coll = s.mongo.collection::<Document>(CAMPAIGNS);

    let mut set = doc! {
        "projectId": project_oid,
        "name": body.name.trim(),
        "status": body.status.unwrap_or_else(|| "draft".to_owned()),
        "budgetCents": body.budget_cents.unwrap_or(0),
        "impressions": body.impressions.unwrap_or(0),
        "clicks": body.clicks.unwrap_or(0),
        "notes": body.notes.unwrap_or_default(),
        "updatedAt": now,
    };
    if let Some(p) = body.platform_id {
        set.insert("platformId", p);
    }
    if let Some(u) = body.landing_url {
        set.insert("landingUrl", u);
    }

    if let Some(cid) = body.campaign_id.as_deref() {
        let oid = match parse_oid(cid) {
            Some(o) => o,
            None => return err("Invalid campaign id."),
        };
        match coll
            .update_one(
                doc! { "_id": oid, "projectId": project_oid },
                doc! { "$set": set },
            )
            .await
        {
            Ok(r) if r.matched_count == 0 => err("Campaign not found."),
            Ok(_) => Json(AckResult {
                success: true,
                campaign_id: Some(cid.to_owned()),
                message: Some("Saved.".to_owned()),
                ..Default::default()
            }),
            Err(e) => err(format!("mongo: {e}")),
        }
    } else {
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
                    campaign_id: Some(id),
                    message: Some("Saved.".to_owned()),
                    ..Default::default()
                })
            }
            Err(e) => err(format!("mongo: {e}")),
        }
    }
}

pub async fn delete_campaign(
    user: AuthUser,
    State(s): State<TelegramAdsState>,
    Path(campaign_id): Path<String>,
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
    let oid = match parse_oid(&campaign_id) {
        Some(o) => o,
        None => return err("Invalid campaign id."),
    };
    match s
        .mongo
        .collection::<Document>(CAMPAIGNS)
        .delete_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            campaign_id: Some(campaign_id),
            message: Some("Deleted.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}
