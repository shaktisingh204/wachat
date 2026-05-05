//! Axum handlers for the Instagram surface. Each handler is a one-line
//! shim around the corresponding function in [`crate::instagram`] so the
//! routing/extractor concerns stay separate from the Graph API logic.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use sabnode_auth::AuthUser;
use sabnode_common::Result;

use crate::dto::{
    CreateImagePostBody, HashtagSearchQuery, InstagramAccountResp, InstagramCommentsResp,
    InstagramDiscoverResp, InstagramHashtagIdResp, InstagramImagePostResp,
    InstagramMediaDetailsResp, InstagramMediaListResp, InstagramStoriesResp,
};
use crate::instagram;
use crate::state::WachatInstagramState;

/// `GET /v1/instagram/projects/:id/account`
pub async fn get_account(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path(project_id): Path<String>,
) -> Result<Json<InstagramAccountResp>> {
    Ok(Json(
        instagram::get_account_for_page(&user, &s.mongo, &s.meta, &project_id).await?,
    ))
}

/// `GET /v1/instagram/projects/:id/media`
pub async fn list_media(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path(project_id): Path<String>,
) -> Result<Json<InstagramMediaListResp>> {
    Ok(Json(
        instagram::list_media(&user, &s.mongo, &s.meta, &project_id).await?,
    ))
}

/// `GET /v1/instagram/projects/:id/media/:media_id`
pub async fn media_details(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path((project_id, media_id)): Path<(String, String)>,
) -> Result<Json<InstagramMediaDetailsResp>> {
    Ok(Json(
        instagram::media_details(&user, &s.mongo, &s.meta, &project_id, &media_id).await?,
    ))
}

/// `GET /v1/instagram/projects/:id/media/:media_id/comments`
pub async fn comments(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path((project_id, media_id)): Path<(String, String)>,
) -> Result<Json<InstagramCommentsResp>> {
    Ok(Json(
        instagram::comments(&user, &s.mongo, &s.meta, &project_id, &media_id).await?,
    ))
}

/// `GET /v1/instagram/projects/:id/stories`
pub async fn stories(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path(project_id): Path<String>,
) -> Result<Json<InstagramStoriesResp>> {
    Ok(Json(
        instagram::stories(&user, &s.mongo, &s.meta, &project_id).await?,
    ))
}

/// `GET /v1/instagram/projects/:id/discover/:username`
pub async fn discover(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path((project_id, username)): Path<(String, String)>,
) -> Result<Json<InstagramDiscoverResp>> {
    Ok(Json(
        instagram::discover(&user, &s.mongo, &s.meta, &project_id, &username).await?,
    ))
}

/// `POST /v1/instagram/projects/:id/media`
pub async fn create_image_post(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path(project_id): Path<String>,
    Json(body): Json<CreateImagePostBody>,
) -> Result<Json<InstagramImagePostResp>> {
    Ok(Json(
        instagram::create_image_post(&user, &s.mongo, &s.meta, &project_id, body).await?,
    ))
}

/// `GET /v1/instagram/projects/:id/hashtag-search?q=foo`
pub async fn hashtag_search(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path(project_id): Path<String>,
    Query(q): Query<HashtagSearchQuery>,
) -> Result<Json<InstagramHashtagIdResp>> {
    Ok(Json(
        instagram::search_hashtag_id(&user, &s.mongo, &s.meta, &project_id, &q.q).await?,
    ))
}

/// `GET /v1/instagram/projects/:id/hashtags/:hashtag_id/recent-media`
pub async fn hashtag_recent_media(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path((project_id, hashtag_id)): Path<(String, String)>,
) -> Result<Json<InstagramMediaListResp>> {
    Ok(Json(
        instagram::hashtag_recent_media(&user, &s.mongo, &s.meta, &project_id, &hashtag_id).await?,
    ))
}
