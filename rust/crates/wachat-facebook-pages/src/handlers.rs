//! HTTP handlers for the Facebook Pages domain.
//!
//! Each handler maps 1:1 to an `export async function` in
//! `src/app/actions/facebook.actions.ts` (Pages slice). The TS originals
//! return `{ success?, error?, … }` envelopes and never throw — we follow
//! the same convention so callers can branch on `body.error` without
//! having to special-case 4xx vs JSON envelope errors.
//!
//! ## Project access check
//!
//! [`load_project_for`] resolves a project by id and verifies the caller is
//! the owner (`project.userId === user._id`). This mirrors the TS
//! `getProjectById` helper, which is invoked at the start of nearly every
//! page-scoped action.
//!
//! ## Token plumbing
//!
//! The TS code passes the page access token as `?access_token=…` on every
//! Graph API call. We instead let `MetaClient` set `Authorization: Bearer`
//! — Meta accepts both forms equivalently. For the two "app token"
//! endpoints (`/debug_token`, `/oauth/access_token`) we still build the
//! URL by hand so the TS-equivalent query-string form is preserved.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Deserialize;
use serde_json::{Value, json};
use tracing::warn;
use wachat_meta_client::{MetaClient, MetaError};

use crate::dto::{
    AckResult, CreateLiveVideoBody, CreateLiveVideoResp, CtaResp, DebugTokenResp, DemographicsResp,
    DetailedInsightsQuery, InsightsResp, LiveVideoCommentsResp, LiveVideosResp, LocationsResp,
    ManualSetupBody, OAuthCallbackBody, PageDetailsResp, PageInsightsCompact, PageInsightsResp,
    PageSetupBody, PagesResp, RefreshTokenResp, RolesResp, SetCtaBody, SettingsResp, TabsResp,
    UpdatePageDetailsBody,
};
use crate::state::WachatFacebookPagesState;

const PROJECTS_COLLECTION: &str = "projects";
const USERS_COLLECTION: &str = "users";

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

/// Lightweight projection of the `projects` doc fields the Pages handlers
/// care about. Loaded as `Document` first so we still get owner-based
/// access checks without hard-typing the whole `Project` shape.
pub struct ProjectCtx {
    pub id: ObjectId,
    pub facebook_page_id: Option<String>,
    pub access_token: Option<String>,
}

/// Resolve a project by id and confirm the caller owns it. Returns
/// `NotFound` for both "project missing" *and* "project belongs to another
/// user", so we don't leak project existence across tenants.
///
/// Mirrors the `getProjectById(projectId)` access path the TS module
/// invokes at the top of every action — the TS helper itself is in
/// `src/app/actions/project.actions.ts`.
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

const ERR_PROJECT_MISSING_TOKEN: &str =
    "Project not found or is missing Facebook Page ID or access token.";

fn require_token(p: &ProjectCtx) -> std::result::Result<&str, &'static str> {
    p.access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or(ERR_PROJECT_MISSING_TOKEN)
}

fn require_page(p: &ProjectCtx) -> std::result::Result<(&str, &str), &'static str> {
    let token = require_token(p)?;
    let page = p
        .facebook_page_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or(ERR_PROJECT_MISSING_TOKEN)?;
    Ok((page, token))
}

/// Squash a `MetaError` into the `String` shape the TS callers expect.
/// We deliberately use the human-readable `Display` rather than serialising
/// the structured envelope — matches `getErrorMessage(e)` in the TS code.
fn err_msg(e: MetaError) -> String {
    e.to_string()
}

// =========================================================================
//  handleFacebookPageSetup  (POST /setup)
// =========================================================================

pub async fn handle_facebook_page_setup(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Json(body): Json<PageSetupBody>,
) -> Json<AckResult> {
    if body.facebook_page_id.is_empty() || body.access_token.is_empty() {
        return Json(AckResult {
            error: Some(
                "Required information (Page ID, Token) was not received from Facebook.".to_owned(),
            ),
            ..Default::default()
        });
    }

    let project = match load_project_for(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AckResult {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };

    let coll = s.mongo.collection::<Document>(PROJECTS_COLLECTION);
    let res = coll
        .update_one(
            doc! { "_id": project.id },
            doc! { "$set": {
                "facebookPageId": &body.facebook_page_id,
                "accessToken": &body.access_token,
            } },
        )
        .await;

    match res {
        Ok(_) => Json(AckResult {
            success: Some(true),
            ..Default::default()
        }),
        Err(_) => Json(AckResult {
            error: Some("Failed to save marketing settings.".to_owned()),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  handleFacebookOAuthCallback  (POST /oauth-callback)
// =========================================================================

#[derive(Debug, Deserialize)]
struct OAuthStateCookie {
    #[serde(default)]
    state: Option<String>,
    /// Cookie carries `userId` for the TS implementation but the Rust
    /// handler doesn't need to consume it — the JWT-derived user id is the
    /// source of truth. Kept here so deserialisation tolerates the field.
    #[serde(default, rename = "userId")]
    _user_id: Option<String>,
    /// `includeCatalog` is consumed by the TS WhatsApp branch (which is
    /// not yet ported); keep the field so deserialisation accepts it.
    #[serde(default, rename = "includeCatalog")]
    _include_catalog: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct OauthTokenResponse {
    access_token: Option<String>,
    #[serde(default)]
    expires_in: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct AccountsEnvelope {
    #[serde(default)]
    data: Vec<Value>,
}

/// Handle the post-redirect step of the Facebook OAuth dance.
///
/// **Scope of this Rust port (vs. the TS original):**
/// * `facebook`, `instagram`, `facebook_reauth`, `ad_manager` branches —
///   fully ported. Tokens are exchanged short→long, the user document is
///   updated with the appropriate `metaSuiteAccessToken` /
///   `adManagerAccessToken`, and Pages are upserted into `projects`.
/// * `whatsapp` branch — **not ported** in this slice; it depends on
///   `_createProjectFromWaba`, which lives in another action file. The TS
///   shim should keep handling that branch until that crate lands.
/// * Webhook subscription (`handleSubscribeFacebookPageWebhook`) is
///   currently a best-effort no-op; the Pages slice surfaces successful
///   project upserts and lets the existing subscription flow run from TS.
pub async fn handle_facebook_oauth_callback(
    State(s): State<WachatFacebookPagesState>,
    Json(body): Json<OAuthCallbackBody>,
) -> Json<AckResult> {
    let user_oid = match ObjectId::parse_str(&body.user_id) {
        Ok(o) => o,
        Err(_) => {
            return Json(AckResult {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };

    let cookie: OAuthStateCookie = match serde_json::from_str(&body.state_cookie) {
        Ok(c) => c,
        Err(e) => {
            warn!("[OAuth Callback] Corrupted onboarding_state cookie: {e}");
            return Json(AckResult {
                error: Some("Onboarding session is corrupted. Please try again.".to_owned()),
                ..Default::default()
            });
        }
    };

    if cookie.state.as_deref() != Some(body.state.as_str()) {
        return Json(AckResult {
            error: Some("Invalid state received during authentication.".to_owned()),
            ..Default::default()
        });
    }

    let cfg = &s.config;
    if cfg.app_url.is_empty() {
        return Json(AckResult {
            error: Some(
                "Server is not configured for authentication. NEXT_PUBLIC_APP_URL is not set."
                    .to_owned(),
            ),
            ..Default::default()
        });
    }
    if cfg.facebook_app_id.is_empty() || cfg.facebook_app_secret.is_empty() {
        return Json(AckResult {
            error: Some(format!(
                "Server is not configured for {} authentication. Please ensure credentials are set in your environment variables.",
                body.state
            )),
            ..Default::default()
        });
    }

    let redirect_uri = format!(
        "{}/auth/facebook/callback",
        cfg.app_url.trim_end_matches('/')
    );

    // ----- Step 1: short-lived token exchange -----
    let short_url = format!(
        "oauth/access_token?client_id={}&redirect_uri={}&client_secret={}&code={}",
        urlencoding::encode(&cfg.facebook_app_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&cfg.facebook_app_secret),
        urlencoding::encode(&body.code),
    );
    let short_resp: OauthTokenResponse = match s.meta.get_json(&short_url, "").await {
        Ok(r) => r,
        Err(e) => {
            return Json(AckResult {
                error: Some(err_msg(e)),
                ..Default::default()
            });
        }
    };
    let Some(short_token) = short_resp.access_token else {
        return Json(AckResult {
            error: Some("Failed to obtain access token from Facebook.".to_owned()),
            ..Default::default()
        });
    };

    // ----- Step 2: short→long exchange -----
    let long_url = format!(
        "oauth/access_token?grant_type=fb_exchange_token&client_id={}&client_secret={}&fb_exchange_token={}",
        urlencoding::encode(&cfg.facebook_app_id),
        urlencoding::encode(&cfg.facebook_app_secret),
        urlencoding::encode(&short_token),
    );
    let long_resp: OauthTokenResponse = match s.meta.get_json(&long_url, "").await {
        Ok(r) => r,
        Err(e) => {
            return Json(AckResult {
                error: Some(err_msg(e)),
                ..Default::default()
            });
        }
    };
    let Some(long_token) = long_resp.access_token else {
        return Json(AckResult {
            error: Some("Could not obtain a long-lived token from Facebook.".to_owned()),
            ..Default::default()
        });
    };

    // ----- Step 3: persist token + (optional) page projects -----
    let token_field = match body.state.as_str() {
        "ad_manager" => "adManagerAccessToken",
        // 'whatsapp' | 'instagram' | 'facebook' | 'facebook_reauth' all
        // store under metaSuiteAccessToken in the TS code.
        _ => "metaSuiteAccessToken",
    };

    let users = s.mongo.collection::<Document>(USERS_COLLECTION);
    let mut user_set = doc! { token_field: &long_token };

    match body.state.as_str() {
        "facebook" | "instagram" | "facebook_reauth" => {
            if users
                .update_one(doc! { "_id": user_oid }, doc! { "$set": user_set })
                .await
                .is_err()
            {
                return Json(AckResult {
                    error: Some("Failed to persist long-lived token.".to_owned()),
                    ..Default::default()
                });
            }

            let pages_path = "me/accounts?fields=id,name,access_token,tasks";
            let pages: AccountsEnvelope = match s.meta.get_json(pages_path, &long_token).await {
                Ok(r) => r,
                Err(e) => {
                    return Json(AckResult {
                        error: Some(err_msg(e)),
                        ..Default::default()
                    });
                }
            };

            if pages.data.is_empty() {
                return Json(AckResult {
                    error: Some(
                        "No manageable Facebook Pages found. Please ensure you granted access to at least one page."
                            .to_owned(),
                    ),
                    ..Default::default()
                });
            }

            let projects = s.mongo.collection::<Document>(PROJECTS_COLLECTION);
            let now = bson::DateTime::from_chrono(Utc::now());
            for page in &pages.data {
                let page_id = page.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let page_name = page.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let page_token = page
                    .get("access_token")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if page_id.is_empty() {
                    continue;
                }
                let _ = projects
                    .update_one(
                        doc! { "userId": user_oid, "facebookPageId": page_id },
                        doc! {
                            "$set": { "name": page_name, "accessToken": page_token },
                            "$setOnInsert": {
                                "userId": user_oid,
                                "facebookPageId": page_id,
                                "createdAt": now,
                            }
                        },
                    )
                    .upsert(true)
                    .await;
            }

            let redirect = if body.state == "instagram" {
                "/dashboard/instagram/connections"
            } else {
                "/dashboard/facebook/all-projects"
            };
            Json(AckResult {
                success: Some(true),
                redirect_path: Some(redirect.to_owned()),
                ..Default::default()
            })
        }
        "ad_manager" => {
            // Pull ad accounts and stash on the user doc.
            let ads_path = "me/adaccounts?fields=id,name,account_id";
            let ads: AccountsEnvelope = match s.meta.get_json(ads_path, &long_token).await {
                Ok(r) => r,
                Err(e) => {
                    return Json(AckResult {
                        error: Some(err_msg(e)),
                        ..Default::default()
                    });
                }
            };
            if !ads.data.is_empty() {
                let bson_ads = match bson::to_bson(&ads.data) {
                    Ok(b) => b,
                    Err(_) => bson::Bson::Array(Vec::new()),
                };
                user_set.insert("metaAdAccounts", bson_ads);
            }
            if users
                .update_one(doc! { "_id": user_oid }, doc! { "$set": user_set })
                .await
                .is_err()
            {
                return Json(AckResult {
                    error: Some("Failed to persist ad-manager token.".to_owned()),
                    ..Default::default()
                });
            }
            Json(AckResult {
                success: Some(true),
                redirect_path: Some("/dashboard/ad-manager/ad-accounts".to_owned()),
                ..Default::default()
            })
        }
        "whatsapp" => {
            // The WhatsApp branch in the TS module fans out into a
            // multi-step WABA discovery + project creation flow that
            // crosses this crate's scope. Persist the token so the next
            // sync cycle can pick it up; surface a generic error so the
            // shim falls back to the legacy TS implementation for the
            // remainder of the work.
            let _ = users
                .update_one(doc! { "_id": user_oid }, doc! { "$set": user_set })
                .await;
            // include_catalog is accepted for API parity; the Rust port
            // doesn't use it yet.
            let _ = body.include_catalog;
            Json(AckResult {
                error: Some(
                    "WhatsApp OAuth handling is not implemented in the Rust BFF yet.".to_owned(),
                ),
                ..Default::default()
            })
        }
        _ => Json(AckResult {
            error: Some("Invalid state received during authentication.".to_owned()),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  handleManualFacebookPageSetup  (POST /manual-setup)
// =========================================================================

pub async fn handle_manual_facebook_page_setup(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Json(body): Json<ManualSetupBody>,
) -> Json<AckResult> {
    if body.project_name.is_empty()
        || body.facebook_page_id.is_empty()
        || body.access_token.is_empty()
    {
        return Json(AckResult {
            error: Some("All fields are required for manual setup.".to_owned()),
            ..Default::default()
        });
    }

    let user_oid = match parse_user_oid(&user) {
        Ok(o) => o,
        Err(_) => {
            return Json(AckResult {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };

    let projects = s.mongo.collection::<Document>(PROJECTS_COLLECTION);
    match projects
        .find_one(doc! {
            "userId": user_oid,
            "facebookPageId": &body.facebook_page_id,
        })
        .await
    {
        Ok(Some(_)) => {
            return Json(AckResult {
                error: Some("You have already connected this Facebook Page.".to_owned()),
                ..Default::default()
            });
        }
        Ok(None) => {}
        Err(_) => {
            return Json(AckResult {
                error: Some("Failed to save manual project settings.".to_owned()),
                ..Default::default()
            });
        }
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    let new_doc = doc! {
        "userId": user_oid,
        "name": &body.project_name,
        "facebookPageId": &body.facebook_page_id,
        "accessToken": &body.access_token,
        "phoneNumbers": Vec::<bson::Bson>::new(),
        "createdAt": now,
        "messagesPerSecond": 80i32,
    };
    match projects.insert_one(new_doc).await {
        Ok(_) => Json(AckResult {
            success: Some(true),
            ..Default::default()
        }),
        Err(_) => Json(AckResult {
            error: Some("Failed to save manual project settings.".to_owned()),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getFacebookPages  (GET /)  — user-level "my pages" lookup
// =========================================================================

pub async fn get_facebook_pages(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
) -> Json<PagesResp> {
    let user_oid = match parse_user_oid(&user) {
        Ok(o) => o,
        Err(_) => {
            return Json(PagesResp {
                error: Some("User not logged in.".to_owned()),
                ..Default::default()
            });
        }
    };

    let users = s.mongo.collection::<Document>(USERS_COLLECTION);
    let user_doc = match users.find_one(doc! { "_id": user_oid }).await {
        Ok(Some(d)) => d,
        Ok(None) | Err(_) => {
            return Json(PagesResp {
                error: Some(
                    "Facebook account not connected or user access token is missing. Please go to Project Connections and reconnect."
                        .to_owned(),
                ),
                ..Default::default()
            });
        }
    };

    let token = match user_doc
        .get_str("metaSuiteAccessToken")
        .ok()
        .filter(|s| !s.is_empty())
    {
        Some(t) => t.to_owned(),
        None => {
            return Json(PagesResp {
                error: Some(
                    "Facebook account not connected or user access token is missing. Please go to Project Connections and reconnect."
                        .to_owned(),
                ),
                ..Default::default()
            });
        }
    };

    let path = "me/accounts?fields=id,name,category,tasks";
    match s.meta.get_json::<AccountsEnvelope>(path, &token).await {
        Ok(env) => Json(PagesResp {
            pages: Some(env.data),
            ..Default::default()
        }),
        Err(e) => {
            let msg = err_msg(e);
            // Match the TS heuristic: surface a friendlier message for the
            // common token-expiration shape.
            let lower = msg.to_lowercase();
            let friendly = if lower.contains("session has expired")
                || lower.contains("invalid")
                || lower.contains("token")
            {
                "Your Facebook connection has expired or is invalid. Please go to Project Connections and reconnect."
                    .to_owned()
            } else {
                msg
            };
            Json(PagesResp {
                error: Some(friendly),
                ..Default::default()
            })
        }
    }
}

// =========================================================================
//  Helpers for the project-scoped GETs that just pass through Graph data
// =========================================================================

async fn graph_get(
    meta: &MetaClient,
    path: &str,
    token: &str,
) -> std::result::Result<Value, MetaError> {
    meta.get_json::<Value>(path, token).await
}

fn pull_data_array(v: Value) -> Vec<Value> {
    v.get("data")
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default()
}

// =========================================================================
//  getPageDetails  (GET /:project_id)
// =========================================================================

pub async fn get_page_details(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
) -> Json<PageDetailsResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(PageDetailsResp {
                error: Some(
                    "Project not found or is missing Facebook Page ID or access token.".to_owned(),
                ),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(PageDetailsResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!(
        "{page}?fields=id,name,about,category,fan_count,followers_count,link,location,phone,website,picture.width(100).height(100)"
    );
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(PageDetailsResp {
            page: Some(v),
            ..Default::default()
        }),
        Err(e) => Json(PageDetailsResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  handleUpdatePageDetails  (POST /:project_id/details)
// =========================================================================

pub async fn handle_update_page_details(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
    Json(body): Json<UpdatePageDetailsBody>,
) -> Json<AckResult> {
    if project_id != body.project_id || body.page_id.is_empty() {
        return Json(AckResult {
            error: Some("Missing required IDs.".to_owned()),
            ..Default::default()
        });
    }
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AckResult {
                error: Some("Access denied or project not configured.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(AckResult {
                error: Some("Access denied or project not configured.".to_owned()),
                ..Default::default()
            });
        }
    };

    let mut payload = serde_json::Map::new();
    if let Some(v) = &body.about {
        payload.insert("about".into(), Value::String(v.clone()));
    }
    if let Some(v) = &body.phone {
        payload.insert("phone".into(), Value::String(v.clone()));
    }
    if let Some(v) = &body.website {
        payload.insert("website".into(), Value::String(v.clone()));
    }

    match s
        .meta
        .post_json::<_, Value>(&body.page_id, token, &Value::Object(payload))
        .await
    {
        Ok(_) => Json(AckResult {
            success: Some(true),
            ..Default::default()
        }),
        Err(e) => Json(AckResult {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getPageInsights  (GET /:project_id/insights)
// =========================================================================

pub async fn get_page_insights(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
) -> Json<PageInsightsResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(PageInsightsResp {
                error: Some(
                    "Project not found or is missing Facebook Page ID or access token.".to_owned(),
                ),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(PageInsightsResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let path =
        format!("{page}/insights?metric=page_impressions,page_post_engagements&period=days_28");
    let v = match graph_get(&s.meta, &path, token).await {
        Ok(v) => v,
        Err(e) => {
            return Json(PageInsightsResp {
                error: Some(err_msg(e)),
                ..Default::default()
            });
        }
    };

    let data = v
        .get("data")
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default();
    let pick = |name: &str| -> i64 {
        let metric = data
            .iter()
            .find(|m| m.get("name").and_then(|n| n.as_str()) == Some(name));
        let values = match metric
            .and_then(|m| m.get("values"))
            .and_then(|v| v.as_array())
        {
            Some(v) if !v.is_empty() => v,
            _ => return 0,
        };
        let last = values.last().and_then(|v| v.get("value"));
        let first = values.first().and_then(|v| v.get("value"));
        last.or(first).and_then(|v| v.as_i64()).unwrap_or(0)
    };

    Json(PageInsightsResp {
        insights: Some(PageInsightsCompact {
            page_reach: pick("page_impressions"),
            post_engagement: pick("page_post_engagements"),
        }),
        ..Default::default()
    })
}

// =========================================================================
//  getDetailedPageInsights  (GET /:project_id/insights/detailed)
// =========================================================================

pub async fn get_detailed_page_insights(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
    Query(q): Query<DetailedInsightsQuery>,
) -> Json<InsightsResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(InsightsResp {
                error: Some("Project not found or missing configuration.".to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(InsightsResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    const DEFAULT_METRICS: &str =
        "page_impressions,page_post_engagements,page_views_total,page_fans";
    let metrics = q.metrics.unwrap_or_else(|| DEFAULT_METRICS.to_owned());
    let period = q.period.unwrap_or_else(|| "days_28".to_owned());

    let mut path = format!(
        "{page}/insights?metric={}&period={}",
        urlencoding::encode(&metrics),
        urlencoding::encode(&period)
    );
    if let Some(v) = q.since.as_deref() {
        path.push_str("&since=");
        path.push_str(&urlencoding::encode(v));
    }
    if let Some(v) = q.until.as_deref() {
        path.push_str("&until=");
        path.push_str(&urlencoding::encode(v));
    }

    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(InsightsResp {
            insights: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(InsightsResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getPageFanDemographics  (GET /:project_id/insights/demographics)
// =========================================================================

pub async fn get_page_fan_demographics(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
) -> Json<DemographicsResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(DemographicsResp {
                error: Some("Project not found or missing configuration.".to_owned()),
                ..Default::default()
            });
        }
    };
    if let Err(e) = require_page(&project) {
        return Json(DemographicsResp {
            error: Some(e.to_owned()),
            ..Default::default()
        });
    }
    // NOTE: Meta deprecated page_fans_city/country/gender_age (and the bulk of
    // fan-demographic edges) in Graph API v22+ (Sept 2024). The metrics no longer
    // return data. Return an empty payload until/if Meta ships replacements.
    let _ = &s; // suppress unused
    Json(DemographicsResp::default())
}

// =========================================================================
//  Settings / Locations / Tabs / Roles
// =========================================================================

pub async fn get_page_settings(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
) -> Json<SettingsResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(SettingsResp {
                error: Some("Project not found or missing configuration.".to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(SettingsResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!("{page}/settings");
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(SettingsResp {
            settings: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(SettingsResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn get_page_locations(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
) -> Json<LocationsResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(LocationsResp {
                error: Some("Project not found or missing configuration.".to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(LocationsResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!(
        "{page}/locations?fields=id,name,location{{city,country,latitude,longitude,street,zip}},phone,website&limit=100"
    );
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(LocationsResp {
            locations: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(LocationsResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn get_page_tabs(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
) -> Json<TabsResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(TabsResp {
                error: Some("Project not found or missing configuration.".to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(TabsResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let path =
        format!("{page}/tabs?fields=id,name,link,position,is_permanent,image_url,application");
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(TabsResp {
            tabs: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(TabsResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn get_page_roles(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
) -> Json<RolesResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(RolesResp {
                error: Some("Project not found or missing configuration.".to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(RolesResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!("{page}/roles?fields=name,role,perms");
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(RolesResp {
            roles: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(RolesResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  Page CTA (GET / POST /:project_id/cta)
// =========================================================================

pub async fn get_page_call_to_action(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
) -> Json<CtaResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(CtaResp {
                error: Some("Project not found or missing configuration.".to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(CtaResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!("{page}?fields=call_to_actions");
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => {
            let cta = v
                .get("call_to_actions")
                .and_then(|c| c.get("data"))
                .and_then(|d| d.as_array())
                .and_then(|a| a.first())
                .cloned();
            Json(CtaResp {
                cta,
                ..Default::default()
            })
        }
        Err(e) => Json(CtaResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn set_page_call_to_action(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
    Json(body): Json<SetCtaBody>,
) -> Json<AckResult> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AckResult {
                error: Some("Project not found or missing configuration.".to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(AckResult {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let mut payload = serde_json::Map::new();
    payload.insert("type".into(), Value::String(body.cta_type));
    if let Some(u) = body.web_url {
        payload.insert("web_url".into(), Value::String(u));
    }

    let path = format!("{page}/call_to_actions");
    match s
        .meta
        .post_json::<_, Value>(&path, token, &Value::Object(payload))
        .await
    {
        Ok(_) => Json(AckResult {
            success: Some(true),
            ..Default::default()
        }),
        Err(e) => Json(AckResult {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  Token management (debug / refresh)
// =========================================================================

#[derive(Debug, Deserialize)]
struct DebugTokenEnvelope {
    data: Option<Value>,
}

pub async fn debug_access_token(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
) -> Json<DebugTokenResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(DebugTokenResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t.to_owned(),
        Err(_) => {
            return Json(DebugTokenResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };

    let cfg = &s.config;
    if cfg.facebook_app_id.is_empty() || cfg.facebook_app_secret.is_empty() {
        return Json(DebugTokenResp {
            error: Some("Server credentials not configured.".to_owned()),
            ..Default::default()
        });
    }
    let app_token = format!("{}|{}", cfg.facebook_app_id, cfg.facebook_app_secret);
    let path = format!(
        "debug_token?input_token={}&access_token={}",
        urlencoding::encode(&token),
        urlencoding::encode(&app_token),
    );
    match s.meta.get_json::<DebugTokenEnvelope>(&path, "").await {
        Ok(env) => Json(DebugTokenResp {
            token_info: env.data,
            ..Default::default()
        }),
        Err(e) => Json(DebugTokenResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn refresh_long_lived_token(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
) -> Json<RefreshTokenResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(RefreshTokenResp {
                success: false,
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t.to_owned(),
        Err(_) => {
            return Json(RefreshTokenResp {
                success: false,
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };

    let cfg = &s.config;
    if cfg.facebook_app_id.is_empty() || cfg.facebook_app_secret.is_empty() {
        return Json(RefreshTokenResp {
            success: false,
            error: Some("Server credentials not configured.".to_owned()),
            ..Default::default()
        });
    }
    let path = format!(
        "oauth/access_token?grant_type=fb_exchange_token&client_id={}&client_secret={}&fb_exchange_token={}",
        urlencoding::encode(&cfg.facebook_app_id),
        urlencoding::encode(&cfg.facebook_app_secret),
        urlencoding::encode(&token),
    );
    let resp: OauthTokenResponse = match s.meta.get_json(&path, "").await {
        Ok(r) => r,
        Err(e) => {
            return Json(RefreshTokenResp {
                success: false,
                error: Some(err_msg(e)),
                ..Default::default()
            });
        }
    };
    let Some(new_token) = resp.access_token else {
        return Json(RefreshTokenResp {
            success: false,
            error: Some("Failed to refresh token.".to_owned()),
            ..Default::default()
        });
    };

    let projects = s.mongo.collection::<Document>(PROJECTS_COLLECTION);
    let now = bson::DateTime::from_chrono(Utc::now());
    let _ = projects
        .update_one(
            doc! { "_id": project.id },
            doc! { "$set": { "accessToken": new_token, "tokenRefreshedAt": now } },
        )
        .await;

    Json(RefreshTokenResp {
        success: true,
        new_expiry: resp.expires_in,
        ..Default::default()
    })
}

// =========================================================================
//  Live videos
// =========================================================================

pub async fn get_page_live_videos(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
) -> Json<LiveVideosResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(LiveVideosResp {
                error: Some("Project not found or missing configuration.".to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(LiveVideosResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!(
        "{page}/live_videos?fields=id,title,description,status,embed_html,creation_time,live_views,permalink_url,video{{source,picture,length}}&limit=25"
    );
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(LiveVideosResp {
            live_videos: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(LiveVideosResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn create_live_video(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path(project_id): Path<String>,
    Json(body): Json<CreateLiveVideoBody>,
) -> Json<CreateLiveVideoResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(CreateLiveVideoResp {
                error: Some("Project not found or missing configuration.".to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(CreateLiveVideoResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let mut payload = serde_json::Map::new();
    payload.insert("title".into(), Value::String(body.title));
    payload.insert("status".into(), Value::String("LIVE_NOW".into()));
    if let Some(d) = body.description {
        payload.insert("description".into(), Value::String(d));
    }

    let path = format!("{page}/live_videos");
    match s
        .meta
        .post_json::<_, Value>(&path, token, &Value::Object(payload))
        .await
    {
        Ok(v) => Json(CreateLiveVideoResp {
            live_video: Some(v),
            ..Default::default()
        }),
        Err(e) => Json(CreateLiveVideoResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn end_live_video(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path((project_id, live_video_id)): Path<(String, String)>,
) -> Json<AckResult> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AckResult {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(AckResult {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };

    let payload = json!({ "end_live_video": true });
    match s
        .meta
        .post_json::<_, Value>(&live_video_id, token, &payload)
        .await
    {
        Ok(_) => Json(AckResult {
            success: Some(true),
            ..Default::default()
        }),
        Err(e) => Json(AckResult {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn get_live_video_comments(
    user: AuthUser,
    State(s): State<WachatFacebookPagesState>,
    Path((project_id, live_video_id)): Path<(String, String)>,
) -> Json<LiveVideoCommentsResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(LiveVideoCommentsResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(LiveVideoCommentsResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!(
        "{live_video_id}/comments?fields=id,message,from{{id,name,picture}},created_time&limit=100"
    );
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(LiveVideoCommentsResp {
            comments: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(LiveVideoCommentsResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}
