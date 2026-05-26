//! Instagram Graph API operations.
//!
//! Mirrors `src/app/actions/instagram.actions.ts` 1:1. Each public function
//! corresponds to a single legacy server action and returns the same
//! `{ payload? , error? }` envelope so the TS rust-client shim can pass the
//! response through unchanged.
//!
//! The legacy code uses Meta Graph API v23.0 with `?access_token=` as a
//! query string. We use `wachat_meta_client::MetaClient` which sends the
//! token as a `Bearer` header — both are accepted by Meta's Graph API and
//! Bearer is the recommended modern path. The version pin (`v23.0`) is
//! supplied at `MetaClient` construction time by the orchestrating `api`
//! crate.
//!
//! Errors from Meta are converted to a string and surfaced in the `error`
//! field of the response envelope (matching the TS `getErrorMessage(e)`
//! behavior). We never bubble a 4xx/5xx HTTP response — the TS callers all
//! branch on `response.error`, not on the HTTP status of the BFF call.

use bson::{Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::{Value, json};
use tracing::{instrument, warn};
use wachat_meta_client::MetaClient;

use crate::dto::{
    CreateImagePostBody, InstagramAccountResp, InstagramCommentsResp, InstagramConversationsResp,
    InstagramDiscoverResp, InstagramHashtagIdResp, InstagramImagePostResp,
    InstagramMediaDetailsResp, InstagramMediaInsightsResp, InstagramMediaListResp,
    InstagramMessagesResp, InstagramReelsResp, InstagramStoriesResp,
};

const PROJECTS_COLL: &str = "projects";

/// Minimal project facets the Instagram surface reads. The Rust `Project`
/// type in `wachat-types` doesn't expose `facebookPageId`, so we read the
/// raw Mongo `Document` and pull out the strings we need by hand.
struct InstagramProject {
    facebook_page_id: Option<String>,
    access_token: Option<String>,
}

/// Load + tenancy-check a project. Mirrors the
/// `wachat-features::tenancy::load_project_for` contract: 404 if the project
/// doesn't exist, 403 if the caller is not the owner. We deliberately read
/// as `Document` (instead of the typed `Project`) because the legacy TS
/// reads `facebookPageId` which isn't on the typed struct.
#[instrument(skip_all, fields(project_id = %project_id_hex))]
async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<InstagramProject> {
    let oid = ObjectId::parse_str(project_id_hex).map_err(|_| {
        ApiError::BadRequest(format!("invalid project id: {project_id_hex}"))
    })?;
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let doc = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;

    let user_id_hex = doc
        .get_object_id("userId")
        .map(|o| o.to_hex())
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing userId")))?;

    if user.tenant_id != user_id_hex {
        return Err(ApiError::Forbidden(
            "user does not have access to this project".to_owned(),
        ));
    }

    Ok(InstagramProject {
        facebook_page_id: doc.get_str("facebookPageId").ok().map(str::to_owned),
        access_token: doc.get_str("accessToken").ok().map(str::to_owned),
    })
}

/// Percent-encode a query-string value. Plain & cheap — only the bytes the
/// Graph API parameters actually contain (letters, digits, hashtags,
/// usernames). Mirrors `encodeURIComponent` for the safe-set we need.
fn enc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// Pull the project's `accessToken`, returning an `error` envelope rather
/// than a 4xx — matching how the TS legacy shape surfaces missing tokens.
fn need_token(project: &InstagramProject) -> std::result::Result<&str, String> {
    project
        .access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Project access token is missing.".to_owned())
}

/// `getInstagramAccountForPage(projectId)` — fetches the linked IG business
/// account for the project's Facebook Page. Returns `{ instagramAccount }`
/// when found, `{ error }` otherwise.
pub async fn get_account_for_page(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
) -> Result<InstagramAccountResp> {
    let project = match load_project_for(user, mongo, project_id).await {
        Ok(p) => p,
        // The TS returns "Project not found or is not configured for
        // Facebook." for the most common cases; surface tenancy/missing
        // failures as the same envelope shape rather than HTTP errors.
        Err(ApiError::NotFound(_)) | Err(ApiError::Forbidden(_)) => {
            return Ok(InstagramAccountResp {
                instagram_account: None,
                error: Some("Project not found or is not configured for Facebook.".to_owned()),
            });
        }
        Err(e) => return Err(e),
    };

    let Some(page_id) = project.facebook_page_id.as_deref().filter(|s| !s.is_empty()) else {
        return Ok(InstagramAccountResp {
            instagram_account: None,
            error: Some("Project not found or is not configured for Facebook.".to_owned()),
        });
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Ok(InstagramAccountResp {
                instagram_account: None,
                error: Some("Project not found or is not configured for Facebook.".to_owned()),
            });
        }
    };

    let path = format!(
        "{page_id}?fields=instagram_business_account%7Bid%2Cusername%2Cprofile_picture_url%2Cfollowers_count%2Cmedia_count%2Caccount_type%7D"
    );

    match meta.get_json::<Value>(&path, token).await {
        Ok(resp) => {
            let ig = resp
                .get("instagram_business_account")
                .cloned()
                .filter(|v| !v.is_null());
            if ig.is_none() {
                warn!(
                    page_id = %page_id,
                    "[wachat-instagram] no linked Instagram account for Facebook page"
                );
            }
            Ok(InstagramAccountResp {
                instagram_account: ig,
                error: None,
            })
        }
        Err(e) => Ok(InstagramAccountResp {
            instagram_account: None,
            error: Some(e.to_string()),
        }),
    }
}

/// Fetch the IG account id for the project — small DRY helper used by the
/// other endpoints that all start with "find the project's IG account, then
/// hit Graph API".
async fn ig_account_id(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
) -> std::result::Result<(String, InstagramProject), String> {
    let project = match load_project_for(user, mongo, project_id).await {
        Ok(p) => p,
        Err(_) => return Err("Project not found or is not configured for Facebook.".to_owned()),
    };
    let Some(page_id) = project.facebook_page_id.as_deref().filter(|s| !s.is_empty()) else {
        return Err("Project not found or is not configured for Facebook.".to_owned());
    };
    let token = need_token(&project)?;

    let path = format!(
        "{page_id}?fields=instagram_business_account%7Bid%2Cusername%2Cprofile_picture_url%2Cfollowers_count%2Cmedia_count%2Caccount_type%7D"
    );
    let resp: Value = meta.get_json(&path, token).await.map_err(|e| e.to_string())?;
    let id = resp
        .get("instagram_business_account")
        .and_then(|v| v.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_owned)
        .ok_or_else(|| "Instagram account not found.".to_owned())?;
    Ok((id, project))
}

/// `getInstagramMedia(projectId)`.
pub async fn list_media(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
) -> Result<InstagramMediaListResp> {
    let (ig_id, project) = match ig_account_id(user, mongo, meta, project_id).await {
        Ok(v) => v,
        Err(e) => {
            return Ok(InstagramMediaListResp {
                media: None,
                error: Some(e),
            });
        }
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Ok(InstagramMediaListResp {
                media: None,
                error: Some(e),
            });
        }
    };

    let path = format!(
        "{ig_id}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count"
    );
    match meta.get_json::<Value>(&path, token).await {
        Ok(resp) => {
            let media = resp
                .get("data")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            Ok(InstagramMediaListResp {
                media: Some(media),
                error: None,
            })
        }
        Err(e) => Ok(InstagramMediaListResp {
            media: None,
            error: Some(e.to_string()),
        }),
    }
}

/// `getInstagramMediaDetails(projectId, mediaId)`.
pub async fn media_details(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
    media_id: &str,
) -> Result<InstagramMediaDetailsResp> {
    let project = match load_project_for(user, mongo, project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(InstagramMediaDetailsResp {
                media: None,
                error: Some("Project not found or is missing access token.".to_owned()),
            });
        }
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Ok(InstagramMediaDetailsResp {
                media: None,
                error: Some(e),
            });
        }
    };

    // The legacy TS uses a curly-brace `comments{...}` sub-selection. We
    // pre-encode the braces / commas so the path is a stable URL. The path
    // here is `{mediaId}?fields={raw fields with %7B / %7D for braces}`.
    let fields = "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,comments%7Bid,text,timestamp,username,from,replies%7D";
    let path = format!("{media_id}?fields={fields}");

    match meta.get_json::<Value>(&path, token).await {
        Ok(resp) => Ok(InstagramMediaDetailsResp {
            media: Some(resp),
            error: None,
        }),
        Err(e) => Ok(InstagramMediaDetailsResp {
            media: None,
            error: Some(e.to_string()),
        }),
    }
}

/// `getInstagramComments(mediaId, projectId)`.
pub async fn comments(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
    media_id: &str,
) -> Result<InstagramCommentsResp> {
    let project = match load_project_for(user, mongo, project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(InstagramCommentsResp {
                comments: None,
                error: Some("Project access denied or misconfigured.".to_owned()),
            });
        }
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Ok(InstagramCommentsResp {
                comments: None,
                error: Some("Project access denied or misconfigured.".to_owned()),
            });
        }
    };

    let path = format!("{media_id}/comments?fields=id,username,text,timestamp,from");
    match meta.get_json::<Value>(&path, token).await {
        Ok(resp) => {
            let comments = resp
                .get("data")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            Ok(InstagramCommentsResp {
                comments: Some(comments),
                error: None,
            })
        }
        Err(e) => Ok(InstagramCommentsResp {
            comments: None,
            error: Some(e.to_string()),
        }),
    }
}

/// `getInstagramStories(projectId)`.
pub async fn stories(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
) -> Result<InstagramStoriesResp> {
    let (ig_id, project) = match ig_account_id(user, mongo, meta, project_id).await {
        Ok(v) => v,
        Err(e) => {
            return Ok(InstagramStoriesResp {
                stories: None,
                error: Some(e),
            });
        }
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Ok(InstagramStoriesResp {
                stories: None,
                error: Some(e),
            });
        }
    };

    let path = format!("{ig_id}/stories");
    match meta.get_json::<Value>(&path, token).await {
        Ok(resp) => {
            let stories = resp
                .get("data")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            Ok(InstagramStoriesResp {
                stories: Some(stories),
                error: None,
            })
        }
        Err(e) => Ok(InstagramStoriesResp {
            stories: None,
            error: Some(e.to_string()),
        }),
    }
}

/// `discoverInstagramAccount(username, projectId)`.
pub async fn discover(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
    username: &str,
) -> Result<InstagramDiscoverResp> {
    let (ig_id, project) = match ig_account_id(user, mongo, meta, project_id).await {
        Ok(v) => v,
        Err(_) => {
            return Ok(InstagramDiscoverResp {
                account: None,
                error: Some(
                    "Could not find your own Instagram account to perform the discovery."
                        .to_owned(),
                ),
            });
        }
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Ok(InstagramDiscoverResp {
                account: None,
                error: Some(e),
            });
        }
    };

    // `business_discovery.username(<u>){...}` — braces and parens get
    // percent-encoded inline. We deliberately do NOT encode the username
    // beyond %-escaping unsafe bytes (`enc` keeps `_`, `.` etc. literal,
    // matching what `encodeURIComponent` would do for a typical handle).
    let fields = format!(
        "business_discovery.username({}){}",
        enc(username),
        "%7Bfollowers_count%2Cmedia_count%2Cname%2Cprofile_picture_url%2Cmedia%7Bcaption%2Cmedia_url%7D%7D"
    );
    let path = format!("{ig_id}?fields={fields}");

    match meta.get_json::<Value>(&path, token).await {
        Ok(resp) => Ok(InstagramDiscoverResp {
            account: resp
                .get("business_discovery")
                .cloned()
                .filter(|v| !v.is_null()),
            error: None,
        }),
        Err(e) => Ok(InstagramDiscoverResp {
            account: None,
            error: Some(e.to_string()),
        }),
    }
}

/// `createInstagramImagePost(projectId, imageUrl, caption)` — two-step
/// publish: create a media container, then publish it.
pub async fn create_image_post(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
    body: CreateImagePostBody,
) -> Result<InstagramImagePostResp> {
    if body.image_url.trim().is_empty() {
        return Ok(InstagramImagePostResp {
            message: None,
            error: Some("Project ID and Image URL are required.".to_owned()),
        });
    }

    let (ig_id, project) = match ig_account_id(user, mongo, meta, project_id).await {
        Ok(v) => v,
        Err(_) => {
            return Ok(InstagramImagePostResp {
                message: None,
                error: Some("Could not find your Instagram account.".to_owned()),
            });
        }
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Ok(InstagramImagePostResp {
                message: None,
                error: Some("Project access token is missing.".to_owned()),
            });
        }
    };

    // Step 1 — create the media container.
    let container_path = format!("{ig_id}/media");
    let container_payload = json!({
        "image_url": body.image_url,
        "caption": body.caption.clone().unwrap_or_default(),
    });
    let container_resp: Value = match meta
        .post_json(&container_path, token, &container_payload)
        .await
    {
        Ok(v) => v,
        Err(e) => {
            return Ok(InstagramImagePostResp {
                message: None,
                error: Some(e.to_string()),
            });
        }
    };
    let creation_id = match container_resp.get("id").and_then(|v| v.as_str()) {
        Some(id) if !id.is_empty() => id.to_owned(),
        _ => {
            return Ok(InstagramImagePostResp {
                message: None,
                error: Some("Failed to create media container.".to_owned()),
            });
        }
    };

    // Step 2 — publish.
    let publish_path = format!("{ig_id}/media_publish");
    let publish_payload = json!({ "creation_id": creation_id });
    let publish_resp: Value = match meta
        .post_json(&publish_path, token, &publish_payload)
        .await
    {
        Ok(v) => v,
        Err(e) => {
            return Ok(InstagramImagePostResp {
                message: None,
                error: Some(e.to_string()),
            });
        }
    };

    if publish_resp
        .get("id")
        .and_then(|v| v.as_str())
        .map(|s| !s.is_empty())
        .unwrap_or(false)
    {
        Ok(InstagramImagePostResp {
            message: Some("Instagram post published successfully!".to_owned()),
            error: None,
        })
    } else {
        Ok(InstagramImagePostResp {
            message: None,
            error: Some("Publishing failed after container creation.".to_owned()),
        })
    }
}

/// `searchHashtagId(hashtag, projectId)`.
pub async fn search_hashtag_id(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
    hashtag: &str,
) -> Result<InstagramHashtagIdResp> {
    let (ig_id, project) = match ig_account_id(user, mongo, meta, project_id).await {
        Ok(v) => v,
        Err(_) => {
            return Ok(InstagramHashtagIdResp {
                hashtag_id: None,
                error: Some(
                    "Could not find your own Instagram account to perform the search.".to_owned(),
                ),
            });
        }
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Ok(InstagramHashtagIdResp {
                hashtag_id: None,
                error: Some(e),
            });
        }
    };

    let path = format!("ig_hashtag_search?user_id={}&q={}", enc(&ig_id), enc(hashtag));
    match meta.get_json::<Value>(&path, token).await {
        Ok(resp) => {
            let hid = resp
                .get("data")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|first| first.get("id"))
                .and_then(|id| id.as_str())
                .map(str::to_owned);
            Ok(InstagramHashtagIdResp {
                hashtag_id: hid,
                error: None,
            })
        }
        Err(e) => Ok(InstagramHashtagIdResp {
            hashtag_id: None,
            error: Some(e.to_string()),
        }),
    }
}

/// `getHashtagRecentMedia(hashtagId, projectId)`.
pub async fn hashtag_recent_media(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
    hashtag_id: &str,
) -> Result<InstagramMediaListResp> {
    let (ig_id, project) = match ig_account_id(user, mongo, meta, project_id).await {
        Ok(v) => v,
        Err(_) => {
            return Ok(InstagramMediaListResp {
                media: None,
                error: Some("Could not find your own Instagram account.".to_owned()),
            });
        }
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Ok(InstagramMediaListResp {
                media: None,
                error: Some(e),
            });
        }
    };

    let path = format!(
        "{hashtag_id}/recent_media?user_id={}&fields=id,caption,media_type,media_url,permalink,timestamp",
        enc(&ig_id)
    );
    match meta.get_json::<Value>(&path, token).await {
        Ok(resp) => {
            let media = resp
                .get("data")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            Ok(InstagramMediaListResp {
                media: Some(media),
                error: None,
            })
        }
        Err(e) => Ok(InstagramMediaListResp {
            media: None,
            error: Some(e.to_string()),
        }),
    }
}

/// `getHashtagTopMedia(projectId, hashtagId)` — top-performing media for a
/// hashtag. Mirrors [`hashtag_recent_media`] but hits the `top_media` edge
/// with the richer field set used by the call sites in the TS action.
pub async fn hashtag_top_media(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
    hashtag_id: &str,
) -> Result<InstagramMediaListResp> {
    let (ig_id, project) = match ig_account_id(user, mongo, meta, project_id).await {
        Ok(v) => v,
        Err(_) => {
            return Ok(InstagramMediaListResp {
                media: None,
                error: Some("Could not find your own Instagram account.".to_owned()),
            });
        }
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Ok(InstagramMediaListResp {
                media: None,
                error: Some(e),
            });
        }
    };

    let path = format!(
        "{hashtag_id}/top_media?user_id={}&fields=id,caption,media_url,media_type,permalink,thumbnail_url,timestamp,like_count,comments_count",
        enc(&ig_id)
    );
    match meta.get_json::<Value>(&path, token).await {
        Ok(resp) => {
            let media = resp
                .get("data")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            Ok(InstagramMediaListResp {
                media: Some(media),
                error: None,
            })
        }
        Err(e) => Ok(InstagramMediaListResp {
            media: None,
            error: Some(e.to_string()),
        }),
    }
}

/// `getInstagramReels(projectId, limit)` — fetch the connected IG account's
/// `/media` edge with the reels-relevant fields, then filter in-handler to
/// items where `media_product_type == "REELS"`.
pub async fn reels(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
    limit: u32,
) -> Result<InstagramReelsResp> {
    let (ig_id, project) = match ig_account_id(user, mongo, meta, project_id).await {
        Ok(v) => v,
        Err(e) => {
            return Ok(InstagramReelsResp {
                reels: None,
                error: Some(e),
            });
        }
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Ok(InstagramReelsResp {
                reels: None,
                error: Some(e),
            });
        }
    };

    let path = format!(
        "{ig_id}/media?fields=id,caption,media_url,media_type,media_product_type,permalink,thumbnail_url,timestamp,like_count,comments_count&limit={limit}"
    );
    match meta.get_json::<Value>(&path, token).await {
        Ok(resp) => {
            let all = resp
                .get("data")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            let reels: Vec<Value> = all
                .into_iter()
                .filter(|m| {
                    m.get("media_product_type")
                        .and_then(|v| v.as_str())
                        .map(|s| s == "REELS")
                        .unwrap_or(false)
                })
                .collect();
            Ok(InstagramReelsResp {
                reels: Some(reels),
                error: None,
            })
        }
        Err(e) => Ok(InstagramReelsResp {
            reels: None,
            error: Some(e.to_string()),
        }),
    }
}

/// Default metric set used when callers don't pass an explicit `metrics=`
/// query string. Matches the reels insight panel.
const DEFAULT_INSIGHTS_METRICS: &str = "plays,reach,likes,comments,shares,saves";

/// `getMediaInsights(projectId, mediaId, metrics)` — Graph
/// `/{mediaId}/insights?metric=...`. Works for both reels and stories; the
/// caller supplies the appropriate metric CSV (`impressions,reach,replies,
/// exits,taps_forward,taps_back` for stories).
pub async fn media_insights(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
    media_id: &str,
    metrics_csv: Option<&str>,
) -> Result<InstagramMediaInsightsResp> {
    let project = match load_project_for(user, mongo, project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(InstagramMediaInsightsResp {
                data: None,
                error: Some("Project access denied or misconfigured.".to_owned()),
            });
        }
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Ok(InstagramMediaInsightsResp {
                data: None,
                error: Some(e),
            });
        }
    };

    let metrics = metrics_csv
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(DEFAULT_INSIGHTS_METRICS);

    let path = format!("{media_id}/insights?metric={}", enc(metrics));
    match meta.get_json::<Value>(&path, token).await {
        Ok(resp) => {
            let data = resp
                .get("data")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            Ok(InstagramMediaInsightsResp {
                data: Some(data),
                error: None,
            })
        }
        Err(e) => Ok(InstagramMediaInsightsResp {
            data: None,
            error: Some(e.to_string()),
        }),
    }
}

/// `getInstagramConversations(projectId)` — Messenger / IG DM threads on the
/// connected Facebook Page (the API key the legacy TS uses is the same as
/// the `/{pageId}/conversations?platform=instagram` endpoint).
pub async fn conversations(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
) -> Result<InstagramConversationsResp> {
    let project = match load_project_for(user, mongo, project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(InstagramConversationsResp {
                conversations: None,
                error: Some(
                    "Project not found or is not configured for Facebook.".to_owned(),
                ),
            });
        }
    };
    let Some(page_id) = project
        .facebook_page_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
    else {
        return Ok(InstagramConversationsResp {
            conversations: None,
            error: Some("Project is not connected to a Facebook Page.".to_owned()),
        });
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Ok(InstagramConversationsResp {
                conversations: None,
                error: Some(e),
            });
        }
    };

    let path = format!(
        "{page_id}/conversations?platform=instagram&fields=id,updated_time,participants,snippet,unread_count"
    );
    match meta.get_json::<Value>(&path, token).await {
        Ok(resp) => {
            let conversations = resp
                .get("data")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            Ok(InstagramConversationsResp {
                conversations: Some(conversations),
                error: None,
            })
        }
        Err(e) => Ok(InstagramConversationsResp {
            conversations: None,
            error: Some(e.to_string()),
        }),
    }
}

/// `getInstagramConversationMessages(projectId, conversationId)` — messages
/// in a single thread, returned in Graph's native order.
pub async fn conversation_messages(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
    conversation_id: &str,
) -> Result<InstagramMessagesResp> {
    let project = match load_project_for(user, mongo, project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(InstagramMessagesResp {
                messages: None,
                error: Some("Project access denied or misconfigured.".to_owned()),
            });
        }
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Ok(InstagramMessagesResp {
                messages: None,
                error: Some(e),
            });
        }
    };

    let path = format!(
        "{conversation_id}/messages?fields=id,created_time,from,message,attachments"
    );
    match meta.get_json::<Value>(&path, token).await {
        Ok(resp) => {
            let messages = resp
                .get("data")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            Ok(InstagramMessagesResp {
                messages: Some(messages),
                error: None,
            })
        }
        Err(e) => Ok(InstagramMessagesResp {
            messages: None,
            error: Some(e.to_string()),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enc_keeps_unreserved_chars() {
        assert_eq!(enc("abc_123.-~"), "abc_123.-~");
    }

    #[test]
    fn enc_escapes_unsafe() {
        assert_eq!(enc("a b"), "a%20b");
        assert_eq!(enc("#tag"), "%23tag");
        assert_eq!(enc("a/b"), "a%2Fb");
    }

    #[test]
    fn instagram_project_construction() {
        let p = InstagramProject {
            facebook_page_id: Some("123".into()),
            access_token: Some("EAA".into()),
        };
        assert_eq!(p.facebook_page_id.as_deref(), Some("123"));
        assert!(need_token(&p).is_ok());
    }

    #[test]
    fn need_token_rejects_empty() {
        let p = InstagramProject {
            facebook_page_id: None,
            access_token: Some(String::new()),
        };
        assert!(need_token(&p).is_err());
    }
}

/// `sendInstagramMessage(projectId, recipientId, text)`
/// Uses `/{page_id}/messages` to send an Instagram DM, which requires the
/// recipient ID (IGSID) and message payload.
pub async fn send_message(
    user: &AuthUser,
    mongo: &MongoHandle,
    meta: &MetaClient,
    project_id: &str,
    recipient_id: &str,
    text: &str,
) -> Result<crate::dto::InstagramMessageSendResp> {
    let project = match load_project_for(user, mongo, project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(crate::dto::InstagramMessageSendResp {
                message_id: None,
                error: Some("Project access denied or misconfigured.".to_owned()),
            });
        }
    };
    let Some(page_id) = project.facebook_page_id.as_deref().filter(|s| !s.is_empty()) else {
        return Ok(crate::dto::InstagramMessageSendResp {
            message_id: None,
            error: Some("Project is not connected to a Facebook Page.".to_owned()),
        });
    };
    let token = match need_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Ok(crate::dto::InstagramMessageSendResp {
                message_id: None,
                error: Some(e),
            });
        }
    };

    let path = format!("{page_id}/messages");
    let payload = json!({
        "recipient": { "id": recipient_id },
        "message": { "text": text },
        "messaging_type": "RESPONSE"
    });

    match meta.post_json::<_, Value>(&path, token, &payload).await {
        Ok(resp) => {
            let message_id = resp
                .get("message_id")
                .and_then(|v| v.as_str())
                .map(str::to_owned);
            Ok(crate::dto::InstagramMessageSendResp {
                message_id,
                error: None,
            })
        }
        Err(e) => Ok(crate::dto::InstagramMessageSendResp {
            message_id: None,
            error: Some(e.to_string()),
        }),
    }
}
