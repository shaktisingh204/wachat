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
    InstagramConversationsResp, InstagramDiscoverResp, InstagramHashtagIdResp,
    InstagramImagePostResp, InstagramMediaDetailsResp, InstagramMediaInsightsResp,
    InstagramMediaListResp, InstagramMessagesResp, InstagramReelsResp, InstagramStoriesResp,
    MediaInsightsQuery, ReelsQuery,
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

/// `GET /v1/instagram/projects/:id/hashtags/:hashtag_id/top-media`
pub async fn hashtag_top_media(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path((project_id, hashtag_id)): Path<(String, String)>,
) -> Result<Json<InstagramMediaListResp>> {
    Ok(Json(
        instagram::hashtag_top_media(&user, &s.mongo, &s.meta, &project_id, &hashtag_id).await?,
    ))
}

/// `GET /v1/instagram/projects/:id/reels?limit=25`
pub async fn reels(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path(project_id): Path<String>,
    Query(q): Query<ReelsQuery>,
) -> Result<Json<InstagramReelsResp>> {
    let limit = q.limit.unwrap_or(25);
    Ok(Json(
        instagram::reels(&user, &s.mongo, &s.meta, &project_id, limit).await?,
    ))
}

/// `GET /v1/instagram/projects/:id/media/:media_id/insights?metrics=...`
pub async fn media_insights(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path((project_id, media_id)): Path<(String, String)>,
    Query(q): Query<MediaInsightsQuery>,
) -> Result<Json<InstagramMediaInsightsResp>> {
    Ok(Json(
        instagram::media_insights(
            &user,
            &s.mongo,
            &s.meta,
            &project_id,
            &media_id,
            q.metrics.as_deref(),
        )
        .await?,
    ))
}

/// `GET /v1/instagram/projects/:id/conversations`
pub async fn conversations(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path(project_id): Path<String>,
) -> Result<Json<InstagramConversationsResp>> {
    Ok(Json(
        instagram::conversations(&user, &s.mongo, &s.meta, &project_id).await?,
    ))
}

/// `GET /v1/instagram/projects/:id/conversations/:conversation_id/messages`
pub async fn conversation_messages(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path((project_id, conversation_id)): Path<(String, String)>,
) -> Result<Json<InstagramMessagesResp>> {
    Ok(Json(
        instagram::conversation_messages(&user, &s.mongo, &s.meta, &project_id, &conversation_id)
            .await?,
    ))
}

/// `POST /v1/instagram/projects/:id/messages`
pub async fn send_message(
    user: AuthUser,
    State(s): State<WachatInstagramState>,
    Path(project_id): Path<String>,
    Json(body): Json<crate::dto::SendMessageBody>,
) -> Result<Json<crate::dto::InstagramMessageSendResp>> {
    Ok(Json(
        instagram::send_message(
            &user,
            &s.mongo,
            &s.meta,
            &project_id,
            &body.recipient_id,
            &body.text,
        )
        .await?,
    ))
}
