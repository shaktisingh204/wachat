//! HTTP handlers for the Facebook misc-domain endpoints.
//!
//! Ports the residual stub functions in `src/app/actions/facebook.actions.ts`:
//! subscribed-apps + webhook subscription, blocked-profiles read, status
//! probes (messaging-feature-review, publishing-auth-status), and the
//! `fb_competitors` Mongo CRUD + sync flow.
//!
//! All handlers extract a [`sabnode_auth::AuthUser`] from the JWT. Project-
//! scoped endpoints first call [`load_project_for`] to confirm the caller
//! owns the target project — mirrors the `getProjectById` access check at
//! the top of every legacy TS action.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde::Deserialize;
use serde_json::Value;
use wachat_meta_client::{MetaClient, MetaError};

use crate::dto::{
    AckResult, AddCompetitorBody, BlockedProfilesResp, CompetitorsResp, MessagingFeatureReviewItem,
    MessagingFeatureReviewResp, PublishingAuthStatusResp, SubscribedAppsResp,
    UpdateWebhookSubscriptionBody,
};
use crate::state::WachatFacebookMiscState;

const PROJECTS_COLLECTION: &str = "projects";
const FB_COMPETITORS_COLL: &str = "fb_competitors";

// =========================================================================
//  Project / user helpers
// =========================================================================

fn parse_user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

fn parse_project_oid(id: &str) -> Result<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| ApiError::BadRequest("invalid project id".to_owned()))
}

/// Lightweight projection of the `projects` doc fields the misc handlers
/// care about. Loaded as `Document` so we still get owner-based access
/// checks without hard-typing the whole `Project` shape.
pub struct ProjectCtx {
    pub id: ObjectId,
    pub facebook_page_id: Option<String>,
    pub access_token: Option<String>,
}

/// Resolve a project by id and confirm the caller owns it. Returns
/// `NotFound` for both "missing" and "wrong tenant" so we don't leak
/// project existence across tenants. Mirrors `getProjectById(projectId)`
/// in the TS code.
pub async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
) -> Result<ProjectCtx> {
    let project_oid = parse_project_oid(project_id)?;
    let user_oid = parse_user_oid(user)?;

    let coll = mongo.collection::<Document>(PROJECTS_COLLECTION);
    let doc = coll
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("project".to_owned()))?;

    let owner = doc.get_object_id("userId").ok();
    if owner != Some(user_oid) {
        return Err(ApiError::NotFound("project".to_owned()));
    }

    Ok(ProjectCtx {
        id: project_oid,
        facebook_page_id: doc.get_str("facebookPageId").ok().map(|s| s.to_owned()),
        access_token: doc.get_str("accessToken").ok().map(|s| s.to_owned()),
    })
}

const ERR_PROJECT_MISSING_CONFIG: &str = "Project not found or missing configuration.";
const ERR_ACCESS_DENIED: &str = "Access denied.";

fn require_token(p: &ProjectCtx) -> std::result::Result<&str, &'static str> {
    p.access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or(ERR_PROJECT_MISSING_CONFIG)
}

fn require_page(p: &ProjectCtx) -> std::result::Result<(&str, &str), &'static str> {
    let token = require_token(p)?;
    let page = p
        .facebook_page_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or(ERR_PROJECT_MISSING_CONFIG)?;
    Ok((page, token))
}

/// Squash a `MetaError` into the `String` shape the TS callers expect
/// (matches `getErrorMessage(e)` in the TS code).
fn err_msg(e: MetaError) -> String {
    e.to_string()
}

async fn graph_get(
    meta: &MetaClient,
    path: &str,
    token: &str,
) -> std::result::Result<Value, MetaError> {
    meta.get_json::<Value>(path, token).await
}

fn pull_data_array(v: &Value) -> Vec<Value> {
    v.get("data")
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default()
}

// =========================================================================
//  getBlockedProfiles  (GET /:project_id/blocked)
// =========================================================================

pub async fn get_blocked_profiles(
    user: AuthUser,
    State(s): State<WachatFacebookMiscState>,
    Path(project_id): Path<String>,
) -> Json<BlockedProfilesResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(BlockedProfilesResp {
                error: Some(ERR_PROJECT_MISSING_CONFIG.to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(BlockedProfilesResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!("{page}/blocked?limit=100");
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(BlockedProfilesResp {
            profiles: Some(pull_data_array(&v)),
            ..Default::default()
        }),
        Err(e) => Json(BlockedProfilesResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getSubscribedApps  (GET /:project_id/subscribed-apps)
// =========================================================================

pub async fn get_subscribed_apps(
    user: AuthUser,
    State(s): State<WachatFacebookMiscState>,
    Path(project_id): Path<String>,
) -> Json<SubscribedAppsResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(SubscribedAppsResp {
                error: Some(ERR_PROJECT_MISSING_CONFIG.to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(SubscribedAppsResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!("{page}/subscribed_apps");
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(SubscribedAppsResp {
            apps: Some(pull_data_array(&v)),
            ..Default::default()
        }),
        Err(e) => Json(SubscribedAppsResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  updateWebhookSubscription  (POST /:project_id/subscribed-apps)
// =========================================================================

#[derive(Debug, Deserialize)]
struct SubscribeAppEnvelope {
    #[serde(default)]
    success: Option<bool>,
}

pub async fn update_webhook_subscription(
    user: AuthUser,
    State(s): State<WachatFacebookMiscState>,
    Path(project_id): Path<String>,
    Json(body): Json<UpdateWebhookSubscriptionBody>,
) -> Json<AckResult> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(ERR_PROJECT_MISSING_CONFIG.to_owned()),
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(e.to_owned()),
            });
        }
    };

    let payload = serde_json::json!({
        "subscribed_fields": body.subscribed_fields.join(","),
    });
    let path = format!("{page}/subscribed_apps");
    match s
        .meta
        .post_json::<_, SubscribeAppEnvelope>(&path, token, &payload)
        .await
    {
        Ok(env) => Json(AckResult {
            success: Some(env.success.unwrap_or(false)),
            error: None,
        }),
        Err(e) => Json(AckResult {
            success: Some(false),
            error: Some(err_msg(e)),
        }),
    }
}

// =========================================================================
//  unsubscribeApp  (DELETE /:project_id/subscribed-apps)
// =========================================================================

pub async fn unsubscribe_app(
    user: AuthUser,
    State(s): State<WachatFacebookMiscState>,
    Path(project_id): Path<String>,
) -> Json<AckResult> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(ERR_PROJECT_MISSING_CONFIG.to_owned()),
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(e.to_owned()),
            });
        }
    };

    let path = format!("{page}/subscribed_apps");
    match s.meta.delete(&path, token).await {
        Ok(_) => Json(AckResult {
            success: Some(true),
            error: None,
        }),
        Err(e) => Json(AckResult {
            success: Some(false),
            error: Some(err_msg(e)),
        }),
    }
}

// =========================================================================
//  getMessagingFeatureReview  (GET /:project_id/messaging-feature-review)
// =========================================================================

pub async fn get_messaging_feature_review(
    user: AuthUser,
    State(s): State<WachatFacebookMiscState>,
    Path(project_id): Path<String>,
) -> Json<MessagingFeatureReviewResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(MessagingFeatureReviewResp {
                error: Some(ERR_ACCESS_DENIED.to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(MessagingFeatureReviewResp {
                error: Some(ERR_ACCESS_DENIED.to_owned()),
                ..Default::default()
            });
        }
    };

    let path = "me/messaging_feature_review";
    match graph_get(&s.meta, path, token).await {
        Ok(v) => {
            let items = pull_data_array(&v)
                .into_iter()
                .map(|item| MessagingFeatureReviewItem {
                    feature: item
                        .get("feature")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_owned(),
                    status: item
                        .get("status")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_owned(),
                })
                .collect();
            Json(MessagingFeatureReviewResp {
                features: Some(items),
                error: None,
            })
        }
        Err(e) => Json(MessagingFeatureReviewResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getPublishingAuthStatus  (GET /:project_id/publishing-auth-status)
// =========================================================================

pub async fn get_publishing_auth_status(
    user: AuthUser,
    State(s): State<WachatFacebookMiscState>,
    Path(project_id): Path<String>,
) -> Json<PublishingAuthStatusResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(PublishingAuthStatusResp {
                error: Some(ERR_PROJECT_MISSING_CONFIG.to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(PublishingAuthStatusResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let path =
        format!("{page}?fields=publishing_authorization_status,is_published,verification_status");
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(PublishingAuthStatusResp {
            data: Some(v),
            error: None,
        }),
        Err(e) => Json(PublishingAuthStatusResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  Competitors
// =========================================================================

/// `GET /:project_id/competitors` — list tracked competitors for a project.
///
/// Mirrors `getTrackedCompetitors(projectId)`: reads `fb_competitors`
/// filtered by `projectId`, sorted by `createdAt` desc.
pub async fn get_tracked_competitors(
    user: AuthUser,
    State(s): State<WachatFacebookMiscState>,
    Path(project_id): Path<String>,
) -> Json<CompetitorsResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(CompetitorsResp {
                error: Some(ERR_ACCESS_DENIED.to_owned()),
                ..Default::default()
            });
        }
    };

    let coll = s.mongo.collection::<Document>(FB_COMPETITORS_COLL);
    let mut cursor = match coll
        .find(doc! { "projectId": project.id })
        .sort(doc! { "createdAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(CompetitorsResp {
                error: Some(e.to_string()),
                ..Default::default()
            });
        }
    };

    let mut out: Vec<Value> = Vec::new();
    loop {
        match cursor.try_next().await {
            Ok(Some(d)) => out.push(document_to_clean_json(d)),
            Ok(None) => break,
            Err(e) => {
                return Json(CompetitorsResp {
                    error: Some(e.to_string()),
                    ..Default::default()
                });
            }
        }
    }

    Json(CompetitorsResp {
        competitors: Some(out),
        error: None,
    })
}

/// `POST /:project_id/competitors` — add a tracked competitor by Facebook
/// page id. Fetches the competitor's metadata via Graph and upserts a
/// document into `fb_competitors` keyed by `(projectId, pageId)`.
pub async fn add_competitor(
    user: AuthUser,
    State(s): State<WachatFacebookMiscState>,
    Path(project_id): Path<String>,
    Json(body): Json<AddCompetitorBody>,
) -> Json<AckResult> {
    if body.page_id.is_empty() {
        return Json(AckResult {
            success: Some(false),
            error: Some("Page ID is required.".to_owned()),
        });
    }
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(ERR_ACCESS_DENIED.to_owned()),
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(ERR_ACCESS_DENIED.to_owned()),
            });
        }
    };

    let path = format!(
        "{}?fields=id,name,fan_count,followers_count,about,category,picture.width(100).height(100),link",
        urlencoding::encode(&body.page_id),
    );
    let info = match graph_get(&s.meta, &path, token).await {
        Ok(v) => v,
        Err(e) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(err_msg(e)),
            });
        }
    };

    let coll = s.mongo.collection::<Document>(FB_COMPETITORS_COLL);
    let now = bson::DateTime::from_chrono(Utc::now());

    let mut set_doc = doc! {
        "lastSyncedAt": now,
        "updatedAt": now,
    };
    if let Some(name) = info.get("name").and_then(|v| v.as_str()) {
        set_doc.insert("name", name);
    }
    if let Some(fc) = info.get("fan_count").and_then(|v| v.as_i64()) {
        set_doc.insert("fanCount", fc);
    }
    if let Some(fc) = info.get("followers_count").and_then(|v| v.as_i64()) {
        set_doc.insert("followersCount", fc);
    }
    if let Some(about) = info.get("about").and_then(|v| v.as_str()) {
        set_doc.insert("about", about);
    }
    if let Some(cat) = info.get("category").and_then(|v| v.as_str()) {
        set_doc.insert("category", cat);
    }
    if let Some(url) = info
        .get("picture")
        .and_then(|p| p.get("data"))
        .and_then(|d| d.get("url"))
        .and_then(|v| v.as_str())
    {
        set_doc.insert("pictureUrl", url);
    }
    if let Some(link) = info.get("link").and_then(|v| v.as_str()) {
        set_doc.insert("link", link);
    }

    let res = coll
        .update_one(
            doc! { "projectId": project.id, "pageId": &body.page_id },
            doc! {
                "$set": set_doc,
                "$setOnInsert": {
                    "projectId": project.id,
                    "pageId": &body.page_id,
                    "createdAt": now,
                },
            },
        )
        .upsert(true)
        .await;

    match res {
        Ok(_) => Json(AckResult {
            success: Some(true),
            error: None,
        }),
        Err(e) => Json(AckResult {
            success: Some(false),
            error: Some(e.to_string()),
        }),
    }
}

/// `DELETE /competitors/:competitor_id` — remove a tracked competitor.
///
/// Looks the competitor up first, resolves the parent project, and
/// re-runs the tenant access check before deleting.
pub async fn remove_competitor(
    user: AuthUser,
    State(s): State<WachatFacebookMiscState>,
    Path(competitor_id): Path<String>,
) -> Json<AckResult> {
    let oid = match ObjectId::parse_str(&competitor_id) {
        Ok(o) => o,
        Err(_) => {
            return Json(AckResult {
                success: Some(false),
                error: Some("Invalid ID.".to_owned()),
            });
        }
    };

    let coll = s.mongo.collection::<Document>(FB_COMPETITORS_COLL);
    let comp = match coll.find_one(doc! { "_id": oid }).await {
        Ok(Some(d)) => d,
        Ok(None) => {
            return Json(AckResult {
                success: Some(false),
                error: Some("Not found.".to_owned()),
            });
        }
        Err(e) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(e.to_string()),
            });
        }
    };

    let project_oid = match comp.get_object_id("projectId").ok() {
        Some(o) => o,
        None => {
            return Json(AckResult {
                success: Some(false),
                error: Some("Not found.".to_owned()),
            });
        }
    };
    if load_project_for(&user, &s.mongo, &project_oid.to_hex())
        .await
        .is_err()
    {
        return Json(AckResult {
            success: Some(false),
            error: Some(ERR_ACCESS_DENIED.to_owned()),
        });
    }

    match coll.delete_one(doc! { "_id": oid }).await {
        Ok(_) => Json(AckResult {
            success: Some(true),
            error: None,
        }),
        Err(e) => Json(AckResult {
            success: Some(false),
            error: Some(e.to_string()),
        }),
    }
}

/// `POST /competitors/:competitor_id/sync` — refresh metadata for a single
/// tracked competitor by re-fetching the Graph API metadata and updating
/// the cached fields. Mirrors `syncCompetitorData(competitorId)`.
pub async fn sync_competitor_data(
    user: AuthUser,
    State(s): State<WachatFacebookMiscState>,
    Path(competitor_id): Path<String>,
) -> Json<AckResult> {
    let oid = match ObjectId::parse_str(&competitor_id) {
        Ok(o) => o,
        Err(_) => {
            return Json(AckResult {
                success: Some(false),
                error: Some("Invalid ID.".to_owned()),
            });
        }
    };

    let coll = s.mongo.collection::<Document>(FB_COMPETITORS_COLL);
    let comp = match coll.find_one(doc! { "_id": oid }).await {
        Ok(Some(d)) => d,
        Ok(None) => {
            return Json(AckResult {
                success: Some(false),
                error: Some("Not found.".to_owned()),
            });
        }
        Err(e) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(e.to_string()),
            });
        }
    };

    let project_oid = match comp.get_object_id("projectId").ok() {
        Some(o) => o,
        None => {
            return Json(AckResult {
                success: Some(false),
                error: Some("Not found.".to_owned()),
            });
        }
    };
    let page_id = match comp.get_str("pageId").ok() {
        Some(s) => s.to_owned(),
        None => {
            return Json(AckResult {
                success: Some(false),
                error: Some("Competitor record is missing pageId.".to_owned()),
            });
        }
    };

    let project = match load_project_for(&user, &s.mongo, &project_oid.to_hex()).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(ERR_ACCESS_DENIED.to_owned()),
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(ERR_ACCESS_DENIED.to_owned()),
            });
        }
    };

    let path = format!(
        "{}?fields=fan_count,followers_count,name,about,category",
        urlencoding::encode(&page_id),
    );
    let info = match graph_get(&s.meta, &path, token).await {
        Ok(v) => v,
        Err(e) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(err_msg(e)),
            });
        }
    };

    let now = bson::DateTime::from_chrono(Utc::now());
    let mut set_doc = doc! {
        "lastSyncedAt": now,
        "updatedAt": now,
    };
    if let Some(name) = info.get("name").and_then(|v| v.as_str()) {
        set_doc.insert("name", name);
    }
    if let Some(fc) = info.get("fan_count").and_then(|v| v.as_i64()) {
        set_doc.insert("fanCount", fc);
    }
    if let Some(fc) = info.get("followers_count").and_then(|v| v.as_i64()) {
        set_doc.insert("followersCount", fc);
    }
    if let Some(about) = info.get("about").and_then(|v| v.as_str()) {
        set_doc.insert("about", about);
    }
    if let Some(cat) = info.get("category").and_then(|v| v.as_str()) {
        set_doc.insert("category", cat);
    }

    match coll
        .update_one(doc! { "_id": oid }, doc! { "$set": set_doc })
        .await
    {
        Ok(_) => Json(AckResult {
            success: Some(true),
            error: None,
        }),
        Err(e) => Json(AckResult {
            success: Some(false),
            error: Some(e.to_string()),
        }),
    }
}
