//! HTTP handlers for the Facebook Comments slice.
//!
//! Each handler maps 1:1 to an `export async function` in
//! `src/app/actions/facebook.actions.ts`:
//!
//! | TS export             | Route                                                      |
//! |-----------------------|------------------------------------------------------------|
//! | `handlePostComment`   | `POST   /v1/facebook/comments/{object_id}`                 |
//! | `handleDeleteComment` | `DELETE /v1/facebook/comments/{comment_id}`                |
//! | `handleLikeObject`    | `POST   /v1/facebook/comments/{object_id}/likes`           |
//! | `getPostComments`     | `GET    /v1/facebook/comments/post/{post_id}`              |
//! | `getCommentReplies`   | `GET    /v1/facebook/comments/{comment_id}/replies`        |
//! | `getObjectReactions`  | `GET    /v1/facebook/comments/{object_id}/reactions`       |
//! | `sendPrivateReply`    | `POST   /v1/facebook/comments/{comment_id}/private-replies`|
//!
//! All endpoints follow the `{ success?, error?, … }` envelope convention
//! used by the legacy TS actions — handlers never `?` out into a 4xx body.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::{Value, json};
use wachat_meta_client::MetaError;

use crate::dto::{
    AckResult, CommentRepliesResp, LikeObjectBody, PostCommentBody, PostCommentsResp,
    PrivateReplyBody, ProjectIdQuery, ReactionsResp,
};
use crate::state::WachatFacebookCommentsState;

const PROJECTS_COLLECTION: &str = "projects";

// =========================================================================
//  Project / user helpers (inlined per spec)
// =========================================================================

fn parse_user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

fn parse_project_oid(id: &str) -> Result<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| ApiError::BadRequest("invalid project id".to_owned()))
}

/// Lightweight projection of the `projects` doc fields the comments
/// handlers care about: just the access token. The Comments slice does
/// not need `facebookPageId` because every Graph call is keyed on the
/// path-supplied object/comment id.
pub struct ProjectCtx {
    pub access_token: Option<String>,
}

/// Resolve a project by id and confirm the caller owns it. Mirrors the
/// `getProjectById(projectId)` helper that the TS originals invoke at the
/// top of every action — `NotFound` is returned for both "missing" and
/// "owned by another user" so we don't leak project existence across
/// tenants.
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
        access_token: doc.get_str("accessToken").ok().map(|s| s.to_owned()),
    })
}

fn require_token(p: &ProjectCtx) -> std::result::Result<&str, &'static str> {
    p.access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or("Access denied or project not configured.")
}

/// Squash a `MetaError` into the `String` shape the TS callers expect.
fn err_msg(e: MetaError) -> String {
    e.to_string()
}

fn pull_data_array(v: Value) -> Vec<Value> {
    v.get("data")
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default()
}

// =========================================================================
//  handlePostComment  (POST /{object_id})
// =========================================================================

pub async fn handle_post_comment(
    user: AuthUser,
    State(s): State<WachatFacebookCommentsState>,
    Path(object_id): Path<String>,
    Json(body): Json<PostCommentBody>,
) -> Json<AckResult> {
    if body.project_id.is_empty() || object_id.is_empty() || body.message.is_empty() {
        return Json(AckResult {
            success: Some(false),
            error: Some("Missing required information.".to_owned()),
        });
    }

    let project = match load_project_for(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AckResult {
                success: Some(false),
                error: Some("Access denied or project not configured.".to_owned()),
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(e.to_owned()),
            });
        }
    };

    let path = format!("{object_id}/comments");
    let payload = json!({ "message": body.message });
    match s.meta.post_json::<_, Value>(&path, token, &payload).await {
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
//  handleDeleteComment  (DELETE /{comment_id})
// =========================================================================

pub async fn handle_delete_comment(
    user: AuthUser,
    State(s): State<WachatFacebookCommentsState>,
    Path(comment_id): Path<String>,
    Query(q): Query<ProjectIdQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(AckResult {
                success: Some(false),
                error: Some("Missing required information.".to_owned()),
            });
        }
    };

    if comment_id.is_empty() {
        return Json(AckResult {
            success: Some(false),
            error: Some("Missing required information.".to_owned()),
        });
    }

    let project = match load_project_for(&user, &s.mongo, project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AckResult {
                success: Some(false),
                error: Some("Access denied or project not configured.".to_owned()),
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(e.to_owned()),
            });
        }
    };

    match s.meta.delete(&comment_id, token).await {
        Ok(()) => Json(AckResult {
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
//  handleLikeObject  (POST /{object_id}/likes)
// =========================================================================

pub async fn handle_like_object(
    user: AuthUser,
    State(s): State<WachatFacebookCommentsState>,
    Path(object_id): Path<String>,
    Json(body): Json<LikeObjectBody>,
) -> Json<AckResult> {
    if body.project_id.is_empty() || object_id.is_empty() {
        return Json(AckResult {
            success: Some(false),
            error: Some("Missing required information.".to_owned()),
        });
    }

    let project = match load_project_for(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AckResult {
                success: Some(false),
                error: Some("Access denied or project not configured.".to_owned()),
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(AckResult {
                success: Some(false),
                error: Some(e.to_owned()),
            });
        }
    };

    let path = format!("{object_id}/likes");
    let payload = Value::Object(serde_json::Map::new());
    match s.meta.post_json::<_, Value>(&path, token, &payload).await {
        Ok(_) => Json(AckResult {
            success: Some(true),
            error: None,
        }),
        Err(e) => {
            // Facebook returns an error if you try to like something twice;
            // the TS implementation swallowed that case. Match that.
            let msg = err_msg(e);
            if msg.to_lowercase().contains("already liked") {
                Json(AckResult {
                    success: Some(true),
                    error: None,
                })
            } else {
                Json(AckResult {
                    success: Some(false),
                    error: Some(msg),
                })
            }
        }
    }
}

// =========================================================================
//  getPostComments  (GET /post/{post_id})
// =========================================================================

pub async fn get_post_comments(
    user: AuthUser,
    State(s): State<WachatFacebookCommentsState>,
    Path(post_id): Path<String>,
    Query(q): Query<ProjectIdQuery>,
) -> Json<PostCommentsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(PostCommentsResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };

    let project = match load_project_for(&user, &s.mongo, project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(PostCommentsResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(PostCommentsResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!(
        "{post_id}/comments?fields=id,message,from{{id,name,picture}},created_time,like_count,comment_count,attachment,parent&limit=100"
    );
    match s.meta.get_json::<Value>(&path, token).await {
        Ok(v) => Json(PostCommentsResp {
            comments: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(PostCommentsResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getCommentReplies  (GET /{comment_id}/replies)
// =========================================================================

pub async fn get_comment_replies(
    user: AuthUser,
    State(s): State<WachatFacebookCommentsState>,
    Path(comment_id): Path<String>,
    Query(q): Query<ProjectIdQuery>,
) -> Json<CommentRepliesResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(CommentRepliesResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };

    let project = match load_project_for(&user, &s.mongo, project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(CommentRepliesResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(CommentRepliesResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!(
        "{comment_id}/comments?fields=id,message,from{{id,name,picture}},created_time,like_count&limit=100"
    );
    match s.meta.get_json::<Value>(&path, token).await {
        Ok(v) => Json(CommentRepliesResp {
            replies: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(CommentRepliesResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getObjectReactions  (GET /{object_id}/reactions)
// =========================================================================

pub async fn get_object_reactions(
    user: AuthUser,
    State(s): State<WachatFacebookCommentsState>,
    Path(object_id): Path<String>,
    Query(q): Query<ProjectIdQuery>,
) -> Json<ReactionsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ReactionsResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };

    let project = match load_project_for(&user, &s.mongo, project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(ReactionsResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(ReactionsResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!("{object_id}/reactions?summary=total_count&limit=100");
    match s.meta.get_json::<Value>(&path, token).await {
        Ok(v) => Json(ReactionsResp {
            reactions: Some(v),
            ..Default::default()
        }),
        Err(e) => Json(ReactionsResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  sendPrivateReply  (POST /{comment_id}/private-replies)
// =========================================================================

pub async fn send_private_reply(
    user: AuthUser,
    State(s): State<WachatFacebookCommentsState>,
    Path(comment_id): Path<String>,
    Json(body): Json<PrivateReplyBody>,
) -> Json<AckResult> {
    if body.project_id.is_empty() || comment_id.is_empty() || body.message.is_empty() {
        return Json(AckResult {
            success: Some(false),
            error: Some("Access denied.".to_owned()),
        });
    }

    let project = match load_project_for(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AckResult {
                success: Some(false),
                error: Some("Access denied.".to_owned()),
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(AckResult {
                success: Some(false),
                error: Some("Access denied.".to_owned()),
            });
        }
    };

    let path = format!("{comment_id}/private_replies");
    let payload = json!({ "message": body.message });
    match s.meta.post_json::<_, Value>(&path, token, &payload).await {
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
