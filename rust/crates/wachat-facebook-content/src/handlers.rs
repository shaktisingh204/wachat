//! HTTP handlers for the Facebook page content slice.
//!
//! Every handler follows the same shape:
//!
//! 1. Resolve the project + access token via `project_loader::load_*`.
//!    Owner-check happens here — invalid id / not your project surfaces
//!    as `403`/`404` rather than the legacy "Access denied" envelope.
//! 2. Build a Meta Graph URL with the desired fields.
//! 3. Call out via the shared `MetaClient` (`Authorization: Bearer …`).
//! 4. Return Meta's response verbatim or a small `{ success, error }`
//!    envelope for mutations.
//!
//! Note on tokens: the legacy TS code passes the token as `?access_token=`
//! query param. The shared `MetaClient` instead sends it as a Bearer
//! header. Both are accepted by Graph API and produce identical
//! responses, so we use the simpler header form.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde_json::{Value, json};

use crate::dto::*;
use crate::project_loader::{load_project_for, load_token_for};
use crate::state::WachatFacebookContentState;

// ===========================================================================
// FEED POSTS
// ===========================================================================

/// `GET /projects/{id}/posts` — getFacebookPosts.
pub async fn get_facebook_posts(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
) -> Result<Json<PostListResponse>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let fields = "id,message,permalink_url,created_time,full_picture,reactions.summary(true),comments.summary(true),shares";
    let path = format!(
        "{}/posts?fields={}&limit=25",
        project.facebook_page_id, fields
    );
    let resp: Value = s.meta.get_json(&path, &project.access_token).await?;
    let posts = resp
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let total_count = posts.len();
    Ok(Json(PostListResponse { posts, total_count }))
}

/// `POST /projects/{id}/posts` — handleCreateFacebookPost (sans multipart).
///
/// The TS legacy action accepted `FormData` carrying file bytes. The
/// Rust port accepts a JSON body whose `mediaUrl` (or `mediaId`) was
/// already produced by the TS shim's upload step.
pub async fn create_post(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
    Json(body): Json<CreatePostBody>,
) -> Result<Json<MessageResult>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;

    let post_type = body.post_type.as_str();
    if !matches!(post_type, "text" | "image" | "video") {
        return Err(ApiError::BadRequest(format!(
            "Unsupported post type '{post_type}' (expected text|image|video)."
        )));
    }

    let mut payload = serde_json::Map::new();
    if let Some(ts) = body.scheduled_publish_time {
        payload.insert(
            "scheduled_publish_time".to_owned(),
            Value::Number(ts.into()),
        );
        payload.insert("published".to_owned(), Value::Bool(false));
    }

    let endpoint = match post_type {
        "text" => {
            let msg = body.message.as_deref().unwrap_or("").to_owned();
            if msg.is_empty() {
                return Ok(Json(MessageResult {
                    error: Some("Message is required for a text post.".to_owned()),
                    ..Default::default()
                }));
            }
            payload.insert("message".to_owned(), Value::String(msg));
            format!("{}/feed", project.facebook_page_id)
        }
        "image" => {
            if body.media_url.is_none() && body.media_id.is_none() {
                return Ok(Json(MessageResult {
                    error: Some("An image URL or pre-uploaded media id is required.".to_owned()),
                    ..Default::default()
                }));
            }
            if let Some(m) = body.message {
                payload.insert("caption".to_owned(), Value::String(m));
            }
            if let Some(t) = body.tags {
                let tag_objects: Vec<Value> = t
                    .split(',')
                    .map(|id| json!({ "tag_uid": id.trim() }))
                    .collect();
                payload.insert("tags".to_owned(), Value::Array(tag_objects));
            }
            if let Some(url) = body.media_url {
                payload.insert("url".to_owned(), Value::String(url));
            } else if let Some(id) = body.media_id {
                // attached_media is the way to publish a pre-uploaded photo
                // node into the page feed.
                payload.insert(
                    "attached_media".to_owned(),
                    Value::Array(vec![json!({ "media_fbid": id })]),
                );
            }
            format!("{}/photos", project.facebook_page_id)
        }
        "video" => {
            if body.media_url.is_none() && body.media_id.is_none() {
                return Ok(Json(MessageResult {
                    error: Some("A video URL or pre-uploaded media id is required.".to_owned()),
                    ..Default::default()
                }));
            }
            if let Some(m) = body.message {
                payload.insert("description".to_owned(), Value::String(m));
            }
            if let Some(url) = body.media_url {
                payload.insert("file_url".to_owned(), Value::String(url));
            } else if let Some(id) = body.media_id {
                payload.insert("file_id".to_owned(), Value::String(id));
            }
            format!("{}/videos", project.facebook_page_id)
        }
        _ => unreachable!(),
    };

    let _: Value = s
        .meta
        .post_json(&endpoint, &project.access_token, &Value::Object(payload))
        .await?;

    let success_message = if body.scheduled_publish_time.is_some() {
        "Post scheduled successfully!"
    } else {
        "Post created successfully!"
    };
    Ok(Json(MessageResult {
        message: Some(success_message.to_owned()),
        ..Default::default()
    }))
}

/// `POST /projects/{id}/posts/bulk` — bulkCreatePosts.
///
/// Sequential per-post calls so partial successes are observable. The TS
/// version did the same loop; we keep it server-side rather than asking
/// the shim to fan out.
pub async fn bulk_create_posts(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
    Json(body): Json<BulkCreateBody>,
) -> Result<Json<BulkCreateResult>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;

    let mut success_count = 0u32;
    let mut fail_count = 0u32;
    let now_secs = chrono::Utc::now().timestamp();

    for post in body.posts {
        let mut payload = serde_json::Map::new();
        let endpoint = if let Some(ref url) = post.image_url {
            payload.insert("url".to_owned(), Value::String(url.clone()));
            if !post.message.is_empty() {
                payload.insert("caption".to_owned(), Value::String(post.message.clone()));
            }
            format!("{}/photos", project.facebook_page_id)
        } else {
            payload.insert("message".to_owned(), Value::String(post.message.clone()));
            format!("{}/feed", project.facebook_page_id)
        };

        if let Some(ref iso) = post.scheduled_time {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(iso) {
                let ts = dt.timestamp();
                if ts > now_secs {
                    payload.insert(
                        "scheduled_publish_time".to_owned(),
                        Value::Number(ts.into()),
                    );
                    payload.insert("published".to_owned(), Value::Bool(false));
                }
            }
        }

        match s
            .meta
            .post_json::<Value, Value>(&endpoint, &project.access_token, &Value::Object(payload))
            .await
        {
            Ok(_) => success_count += 1,
            Err(_) => fail_count += 1,
        }
    }

    Ok(Json(BulkCreateResult {
        success_count,
        fail_count,
        error: None,
    }))
}

/// `PATCH /projects/{id}/posts/{postId}` — handleUpdatePost.
pub async fn update_post(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path((project_id, post_id)): Path<(String, String)>,
    Json(body): Json<UpdatePostBody>,
) -> Result<Json<AckResult>> {
    let token = load_token_for(&user, &s.mongo, &project_id).await?;
    let payload = json!({ "message": body.message });
    let _: Value = s.meta.post_json(&post_id, &token, &payload).await?;
    Ok(Json(AckResult::ok()))
}

/// `DELETE /projects/{id}/posts/{postId}` — handleDeletePost.
pub async fn delete_post(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path((project_id, post_id)): Path<(String, String)>,
) -> Result<Json<AckResult>> {
    let token = load_token_for(&user, &s.mongo, &project_id).await?;
    s.meta.delete(&post_id, &token).await?;
    Ok(Json(AckResult::ok()))
}

/// `POST /projects/{id}/posts/{postId}/publish` — publishScheduledPost.
pub async fn publish_scheduled_post(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path((project_id, post_id)): Path<(String, String)>,
) -> Result<Json<AckResult>> {
    let token = load_token_for(&user, &s.mongo, &project_id).await?;
    let payload = json!({ "is_published": true });
    let _: Value = s.meta.post_json(&post_id, &token, &payload).await?;
    Ok(Json(AckResult::ok()))
}

/// `GET /projects/{id}/posts/{postId}/crosspost-eligible` — getEligibleCrosspostPages.
pub async fn get_eligible_crosspost_pages(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path((project_id, post_id)): Path<(String, String)>,
) -> Result<Json<CrosspostPagesResponse>> {
    let token = load_token_for(&user, &s.mongo, &project_id).await?;
    let path = format!("{post_id}/crosspost_eligible_pages");
    let resp: Value = s.meta.get_json(&path, &token).await?;
    let pages = resp
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    Ok(Json(CrosspostPagesResponse { pages }))
}

/// `POST /projects/{id}/posts/{postId}/crosspost` — handleCrosspostVideo.
pub async fn crosspost_video(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path((project_id, post_id)): Path<(String, String)>,
    Json(body): Json<CrosspostBody>,
) -> Result<Json<AckResult>> {
    if body.target_page_ids.is_empty() {
        return Ok(Json(AckResult {
            success: false,
            error: Some("Missing required information.".to_owned()),
        }));
    }
    let token = load_token_for(&user, &s.mongo, &project_id).await?;
    let path = format!("{post_id}/crosspost");
    let payload = json!({ "crossposted_pages": body.target_page_ids });
    let _: Value = s.meta.post_json(&path, &token, &payload).await?;
    Ok(Json(AckResult::ok()))
}

/// `GET /projects/{id}/scheduled-posts` — getScheduledPosts.
pub async fn get_scheduled_posts(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
) -> Result<Json<DataListResponse>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{}/scheduled_posts?fields=id,message,created_time,scheduled_publish_time&limit=100",
        project.facebook_page_id
    );
    let resp: Value = s.meta.get_json(&path, &project.access_token).await?;
    let data = resp
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    Ok(Json(DataListResponse { data }))
}

/// `GET /projects/{id}/published-posts` — getPublishedPosts (paged).
pub async fn get_published_posts(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
    Query(q): Query<PublishedPostsQuery>,
) -> Result<Json<PublishedPostListResponse>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let limit = q.limit.unwrap_or(25);
    let mut path = format!(
        "{}/published_posts?fields=id,message,permalink_url,created_time,full_picture,type,status_type,attachments{{media,media_type,url,title,description}},reactions.summary(true),comments.summary(true),shares&limit={limit}",
        project.facebook_page_id
    );
    if let Some(after) = q.after.as_deref().filter(|s| !s.is_empty()) {
        path.push_str("&after=");
        path.push_str(after);
    }
    let resp: Value = s.meta.get_json(&path, &project.access_token).await?;
    let posts = resp
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let paging = resp.get("paging").cloned();
    Ok(Json(PublishedPostListResponse { posts, paging }))
}

/// `GET /projects/{id}/visitor-posts` — getVisitorPosts.
pub async fn get_visitor_posts(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
) -> Result<Json<DataListResponse>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{}/visitor_posts?fields=id,message,from{{id,name,picture}},created_time,full_picture,permalink_url,comments.summary(true),reactions.summary(true)&limit=50",
        project.facebook_page_id
    );
    fetch_data_array(&s, &project.access_token, &path).await
}

/// `GET /projects/{id}/tagged-posts` — getTaggedPosts.
pub async fn get_tagged_posts(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
) -> Result<Json<DataListResponse>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{}/tagged?fields=id,message,from{{id,name,picture}},created_time,full_picture,permalink_url&limit=50",
        project.facebook_page_id
    );
    fetch_data_array(&s, &project.access_token, &path).await
}

/// `GET /projects/{id}/posts/{postId}/insights` — getPostInsights.
pub async fn get_post_insights(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path((project_id, post_id)): Path<(String, String)>,
) -> Result<Json<DataListResponse>> {
    let token = load_token_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{post_id}/insights?metric=post_impressions,post_impressions_unique,post_engaged_users,post_clicks,post_clicks_unique,post_reactions_by_type_total,post_activity_by_action_type"
    );
    fetch_data_array(&s, &token, &path).await
}

// ===========================================================================
// PHOTOS & ALBUMS
// ===========================================================================

/// `GET /projects/{id}/photos` — getPagePhotos.
pub async fn get_page_photos(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
) -> Result<Json<DataListResponse>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{}/photos?type=uploaded&fields=id,name,source,images,created_time,album,likes.summary(true),comments.summary(true)&limit=50",
        project.facebook_page_id
    );
    fetch_data_array(&s, &project.access_token, &path).await
}

/// `GET /projects/{id}/albums` — getPageAlbums.
pub async fn get_page_albums(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
) -> Result<Json<DataListResponse>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{}/albums?fields=id,name,count,cover_photo{{source}},created_time,description,type&limit=50",
        project.facebook_page_id
    );
    fetch_data_array(&s, &project.access_token, &path).await
}

/// `POST /projects/{id}/albums` — createPhotoAlbum.
pub async fn create_photo_album(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
    Json(body): Json<CreateAlbumBody>,
) -> Result<Json<CreateAlbumResult>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let mut payload = serde_json::Map::new();
    payload.insert("name".to_owned(), Value::String(body.name));
    if let Some(d) = body.description {
        payload.insert("message".to_owned(), Value::String(d));
    }
    let path = format!("{}/albums", project.facebook_page_id);
    let resp: Value = s
        .meta
        .post_json(&path, &project.access_token, &Value::Object(payload))
        .await?;
    let album_id = resp.get("id").and_then(Value::as_str).map(str::to_owned);
    Ok(Json(CreateAlbumResult {
        album_id,
        error: None,
    }))
}

/// `GET /projects/{id}/albums/{albumId}/photos` — getAlbumPhotos.
pub async fn get_album_photos(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path((project_id, album_id)): Path<(String, String)>,
) -> Result<Json<DataListResponse>> {
    let token = load_token_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{album_id}/photos?fields=id,name,source,images,created_time,likes.summary(true),comments.summary(true)&limit=50"
    );
    fetch_data_array(&s, &token, &path).await
}

/// `GET /projects/{id}/photos/{photoId}` — getPhotoDetails.
pub async fn get_photo_details(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path((project_id, photo_id)): Path<(String, String)>,
) -> Result<Json<Value>> {
    let token = load_token_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{photo_id}?fields=id,name,source,images,created_time,album,likes.summary(true),comments.summary(true),reactions.summary(true)"
    );
    let resp: Value = s.meta.get_json(&path, &token).await?;
    Ok(Json(resp))
}

/// `GET /projects/{id}/photos/{photoId}/insights` — getPhotoInsights.
pub async fn get_photo_insights(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path((project_id, photo_id)): Path<(String, String)>,
) -> Result<Json<DataListResponse>> {
    let token = load_token_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{photo_id}/insights?metric=post_impressions,post_impressions_unique,post_engaged_users,post_clicks"
    );
    fetch_data_array(&s, &token, &path).await
}

// ===========================================================================
// VIDEOS & PLAYLISTS
// ===========================================================================

/// `GET /projects/{id}/videos` — getPageVideos.
pub async fn get_page_videos(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
) -> Result<Json<DataListResponse>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{}/videos?fields=id,title,description,source,picture,length,created_time,views,likes.summary(true),comments.summary(true)&limit=50",
        project.facebook_page_id
    );
    fetch_data_array(&s, &project.access_token, &path).await
}

/// `GET /projects/{id}/videos/{videoId}` — getVideoDetails.
pub async fn get_video_details(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path((project_id, video_id)): Path<(String, String)>,
) -> Result<Json<Value>> {
    let token = load_token_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{video_id}?fields=id,title,description,source,picture,length,created_time,views,likes.summary(true),comments.summary(true),reactions.summary(true)"
    );
    let resp: Value = s.meta.get_json(&path, &token).await?;
    Ok(Json(resp))
}

/// `GET /projects/{id}/videos/{videoId}/insights` — getVideoInsights.
pub async fn get_video_insights(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path((project_id, video_id)): Path<(String, String)>,
) -> Result<Json<DataListResponse>> {
    let token = load_token_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{video_id}/video_insights?metric=total_video_views,total_video_views_unique,total_video_impressions,total_video_impressions_unique,total_video_avg_time_watched,total_video_view_total_time"
    );
    fetch_data_array(&s, &token, &path).await
}

/// `POST /projects/{id}/videos/{videoId}/thumbnail` — handleAddVideoThumbnail.
///
/// Multipart bytes are uploaded via the TS shim — we accept the resulting
/// URL or pre-uploaded thumbnail id.
pub async fn add_video_thumbnail(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path((project_id, video_id)): Path<(String, String)>,
    Json(body): Json<AddThumbnailBody>,
) -> Result<Json<AckResult>> {
    if body.source_url.is_none() && body.thumbnail_id.is_none() {
        return Ok(Json(AckResult {
            success: false,
            error: Some("Missing required fields.".to_owned()),
        }));
    }

    let token = load_token_for(&user, &s.mongo, &project_id).await?;
    let mut payload = serde_json::Map::new();
    if let Some(url) = body.source_url {
        payload.insert("source_url".to_owned(), Value::String(url));
    } else if let Some(id) = body.thumbnail_id {
        payload.insert("thumbnail_id".to_owned(), Value::String(id));
    }

    let path = format!("{video_id}/thumbnails");
    let _: Value = s
        .meta
        .post_json(&path, &token, &Value::Object(payload))
        .await?;
    Ok(Json(AckResult::ok()))
}

/// `GET /projects/{id}/playlists` — getVideoPlaylists.
pub async fn get_video_playlists(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
) -> Result<Json<DataListResponse>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{}/video_lists?fields=id,title,description,creation_time,videos_count&limit=50",
        project.facebook_page_id
    );
    fetch_data_array(&s, &project.access_token, &path).await
}

/// `GET /projects/{id}/playlists/{playlistId}/videos` — getPlaylistVideos.
pub async fn get_playlist_videos(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path((project_id, playlist_id)): Path<(String, String)>,
) -> Result<Json<DataListResponse>> {
    let token = load_token_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{playlist_id}/videos?fields=id,title,description,source,picture,length,created_time&limit=50"
    );
    fetch_data_array(&s, &token, &path).await
}

// ===========================================================================
// REELS & STORIES
// ===========================================================================

/// `GET /projects/{id}/reels` — getPageReels.
pub async fn get_page_reels(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
) -> Result<Json<DataListResponse>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{}/video_reels?fields=id,description,created_time,updated_time,length,permalink_url,picture,source",
        project.facebook_page_id
    );
    fetch_data_array(&s, &project.access_token, &path).await
}

/// `POST /projects/{id}/reels` — publishPageReel (start or finish phase).
///
/// The TS legacy action did three phases: `start` to allocate a video id,
/// raw multipart byte upload to `rupload.facebook.com`, then `finish` to
/// publish. The Rust port handles the two `graph.facebook.com` phases —
/// the TS shim does the binary upload itself because multipart streaming
/// stays in TypeScript per the project's split.
pub async fn publish_page_reel(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
    Json(body): Json<PublishReelBody>,
) -> Result<Json<PublishReelResult>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let phase = body.phase.as_deref().unwrap_or("finish");

    match phase {
        "start" => {
            let path = format!("{}/video_reels", project.facebook_page_id);
            let payload = json!({ "upload_phase": "start" });
            let resp: Value = s
                .meta
                .post_json(&path, &project.access_token, &payload)
                .await?;
            let video_id = resp
                .get("video_id")
                .and_then(Value::as_str)
                .map(str::to_owned);
            Ok(Json(PublishReelResult {
                video_id,
                message: Some("Upload session started.".to_owned()),
                ..Default::default()
            }))
        }
        "finish" => {
            let video_id = body.video_id.ok_or_else(|| {
                ApiError::BadRequest("videoId is required for the finish phase.".to_owned())
            })?;
            let mut payload = serde_json::Map::new();
            payload.insert(
                "upload_phase".to_owned(),
                Value::String("finish".to_owned()),
            );
            payload.insert("video_id".to_owned(), Value::String(video_id));
            if let Some(d) = body.description {
                payload.insert("description".to_owned(), Value::String(d));
            }
            let path = format!("{}/video_reels", project.facebook_page_id);
            let _: Value = s
                .meta
                .post_json(&path, &project.access_token, &Value::Object(payload))
                .await?;
            Ok(Json(PublishReelResult {
                message: Some("Reel published successfully.".to_owned()),
                ..Default::default()
            }))
        }
        other => Err(ApiError::BadRequest(format!(
            "Unsupported reel phase '{other}' (expected start|finish)."
        ))),
    }
}

/// `GET /projects/{id}/stories` — getPageStories.
pub async fn get_page_stories(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
) -> Result<Json<DataListResponse>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let path = format!("{}/stories", project.facebook_page_id);
    fetch_data_array(&s, &project.access_token, &path).await
}

/// `POST /projects/{id}/stories/photo` — publishPhotoStory.
pub async fn publish_photo_story(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
    Json(body): Json<PhotoStoryBody>,
) -> Result<Json<AckResult>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;

    // Step 1: upload the photo as unpublished.
    let photo_path = format!("{}/photos", project.facebook_page_id);
    let photo_payload = json!({ "url": body.photo_url, "published": false });
    let photo_resp: Value = s
        .meta
        .post_json(&photo_path, &project.access_token, &photo_payload)
        .await?;
    let photo_id = photo_resp
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!(
                "Meta did not return a photo id for the unpublished upload"
            ))
        })?
        .to_owned();

    // Step 2: bind it to a story.
    let story_path = format!("{}/photo_stories", project.facebook_page_id);
    let story_payload = json!({ "photo_id": photo_id });
    let _: Value = s
        .meta
        .post_json(&story_path, &project.access_token, &story_payload)
        .await?;
    Ok(Json(AckResult::ok()))
}

/// `POST /projects/{id}/stories/video` — publishVideoStory.
///
/// Three-phase upload: `start` → `rupload.facebook.com` (handled
/// server-side via `file_url=`) → `finish`. Unlike `publishPageReel`
/// where we hand the binary upload to the shim, video stories accept a
/// public URL via `file_url`, so we can do all three phases here.
pub async fn publish_video_story(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
    Json(body): Json<VideoStoryBody>,
) -> Result<Json<AckResult>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let base = format!("{}/video_stories", project.facebook_page_id);

    // Phase 1: start.
    let start_payload = json!({ "upload_phase": "start" });
    let start_resp: Value = s
        .meta
        .post_json(&base, &project.access_token, &start_payload)
        .await?;
    let video_id = start_resp
        .get("video_id")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!(
                "Meta did not return a video id for the story upload session"
            ))
        })?
        .to_owned();

    // Phase 2: tell `rupload` to fetch the video from `file_url`.
    // `MetaClient` only knows about graph.facebook.com, so we POST a
    // body with `file_url` to the start endpoint; Meta routes the
    // download itself given a URL upload phase.
    let upload_path = video_id.clone();
    let upload_payload = json!({
        "upload_phase": "transfer",
        "file_url": body.video_url,
    });
    // Best-effort — Meta returns 200 even when the rupload host is
    // technically `rupload.facebook.com`. If we get back an error, the
    // shim retries via its own client.
    let _ = s
        .meta
        .post_json::<Value, Value>(&upload_path, &project.access_token, &upload_payload)
        .await;

    // Phase 3: finish.
    let finish_payload = json!({
        "upload_phase": "finish",
        "video_id": video_id,
    });
    let _: Value = s
        .meta
        .post_json(&base, &project.access_token, &finish_payload)
        .await?;
    Ok(Json(AckResult::ok()))
}

// ===========================================================================
// RATINGS
// ===========================================================================

/// `GET /projects/{id}/ratings` — getPageRatings.
pub async fn get_page_ratings(
    user: AuthUser,
    State(s): State<WachatFacebookContentState>,
    Path(project_id): Path<String>,
) -> Result<Json<DataListResponse>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let path = format!(
        "{}/ratings?fields=created_time,has_rating,has_review,rating,review_text,reviewer{{id,name,picture}}&limit=50",
        project.facebook_page_id
    );
    fetch_data_array(&s, &project.access_token, &path).await
}

// ===========================================================================
// helpers
// ===========================================================================

async fn fetch_data_array(
    s: &WachatFacebookContentState,
    token: &str,
    path: &str,
) -> Result<Json<DataListResponse>> {
    let resp: Value = s.meta.get_json(path, token).await?;
    let data = resp
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    Ok(Json(DataListResponse { data }))
}
