//! HTTP handlers porting the Broadcasts / Automation / Scheduling slice
//! of `src/app/actions/facebook.actions.ts`.
//!
//! Conventions:
//!
//! * Auth is via [`AuthUser`]. There is no anonymous access.
//! * Per-project endpoints additionally enforce
//!   `user.tenant_id == project.userId.to_hex()` after loading the
//!   project via the inline [`load_project_for`] helper. Mirrors the
//!   `getProjectById` access-check the TS source did.
//! * The TS source returned soft `OkResult { success, error }` /
//!   `MessageResult { message, error }` envelopes for form actions. We
//!   keep that wire shape — many TS form-action call sites pattern-match
//!   on `error` rather than HTTP status, so flipping every soft error to
//!   a 4xx here would break them. Hard auth / tenancy errors still 4xx
//!   via [`ApiError`] because those should never reach a happy-path UI.
//! * Mongo `find` / `insertOne` / `updateOne` / `deleteOne` calls are
//!   ported 1:1 from the TS bodies.
//! * `revalidatePath(...)` is intentionally NOT performed here — it's a
//!   Next.js-only concern. The TS shim that wraps these endpoints calls
//!   `revalidatePath` itself after the network round-trip.

use axum::{
    Json,
    extract::{Multipart, Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, NaiveDateTime, Utc};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::{Value, json};
use tracing::{instrument, warn};

use crate::dto::{
    AddRandomizerPostBody, FacebookBroadcastsResponse, LiveStreamsResponse, MessageResult,
    OkResult, RandomizerPostsResponse, SaveRandomizerSettingsBody, SendBroadcastBody,
    UpdateAutomationSettingsBody,
};
use crate::state::WachatFacebookAutomationState;

// ---------------------------------------------------------------------------
// Mongo collection names — kept inline (as the broadcast crate does) so a
// reviewer can map each query 1:1 against the TS literal.
// ---------------------------------------------------------------------------
const PROJECTS_COLL: &str = "projects";
const FACEBOOK_BROADCASTS_COLL: &str = "facebook_broadcasts";
const FACEBOOK_SUBSCRIBERS_COLL: &str = "facebook_subscribers";
const RANDOMIZER_POSTS_COLL: &str = "randomizer_posts";
const FACEBOOK_LIVE_STREAMS_COLL: &str = "facebook_live_streams";

/// Meta Graph API version we pin to. Matches `apiVersion = 'v23.0'` in
/// the TS live-stream upload path and the `https://graph.facebook.com/v23.0`
/// the TS broadcast path used inline.
const META_API_VERSION: &str = "v23.0";

/// Batch size for the per-recipient send loop. Matches `BATCH_SIZE = 10`
/// in `handleSendFacebookBroadcast`.
const BROADCAST_BATCH_SIZE: usize = 10;

// ===========================================================================
// Tenancy guard
// ===========================================================================

/// Load a project by hex id and enforce `user.tenant_id == project.userId`.
///
/// Returns the raw `Document` (not a typed `Project`) because the
/// Facebook fields we care about — `facebookPageId` and `accessToken` —
/// aren't on the shared `wachat_types::Project` shape, which models the
/// WhatsApp/WABA half of the project. Inlined here per the slice
/// contract rather than depending on a sibling crate.
async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Document> {
    let oid = oid_from_str(project_id_hex)?;
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;

    let owner = project
        .get_object_id("userId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing userId")))?;
    if owner.to_hex() != user.tenant_id {
        return Err(ApiError::Forbidden(
            "user does not have access to this project".to_owned(),
        ));
    }
    Ok(project)
}

// ===========================================================================
// Automation settings — handleUpdateFacebookAutomationSettings
// ===========================================================================

/// `POST /projects/{project_id}/automation` —
/// `handleUpdateFacebookAutomationSettings`.
///
/// Writes either `facebookCommentAutoReply` or `facebookWelcomeMessage`
/// onto the project document, depending on `automationType`.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn update_automation_settings(
    user: AuthUser,
    State(state): State<WachatFacebookAutomationState>,
    Path(project_id): Path<String>,
    Json(body): Json<UpdateAutomationSettingsBody>,
) -> Result<Json<OkResult>> {
    // The TS code returned `{ success: false, error }` rather than throwing
    // when access was denied — but we want hard auth/tenancy failures to
    // 4xx, so we still bubble those as `ApiError`. Mirror the rest.
    let _project = load_project_for(&user, &state.mongo, &project_id).await?;

    let oid = oid_from_str(&project_id)?;

    let settings_update: Document = match body.automation_type.as_str() {
        "comment" => {
            let inner = doc! {
                "enabled": body.enabled.unwrap_or(false),
                "replyMode": body.reply_mode.clone().unwrap_or_default(),
                "staticReplyText": body.static_reply_text.clone().unwrap_or_default(),
                "aiReplyPrompt": body.ai_reply_prompt.clone().unwrap_or_default(),
                "moderationEnabled": body.moderation_enabled.unwrap_or(false),
                "moderationPrompt": body.moderation_prompt.clone().unwrap_or_default(),
            };
            doc! { "facebookCommentAutoReply": inner }
        }
        "welcome" => {
            let quick_replies = body
                .quick_replies
                .clone()
                .unwrap_or(Value::Array(Vec::new()));
            let inner = doc! {
                "enabled": body.enabled.unwrap_or(false),
                "message": body.message.clone().unwrap_or_default(),
                "quickReplies": serde_value_to_bson(&quick_replies),
            };
            doc! { "facebookWelcomeMessage": inner }
        }
        _ => {
            return Ok(Json(OkResult {
                success: false,
                error: Some("Invalid automation type specified.".to_owned()),
            }));
        }
    };

    let coll = state.mongo.collection::<Document>(PROJECTS_COLL);
    coll.update_one(doc! { "_id": oid }, doc! { "$set": settings_update })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.update_one(automation)"))
        })?;

    Ok(Json(OkResult {
        success: true,
        error: None,
    }))
}

// ===========================================================================
// Post randomizer — saveRandomizerSettings / list / add / delete
// ===========================================================================

/// `POST /projects/{project_id}/randomizer/settings` —
/// `saveRandomizerSettings`.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn save_randomizer_settings(
    user: AuthUser,
    State(state): State<WachatFacebookAutomationState>,
    Path(project_id): Path<String>,
    Json(body): Json<SaveRandomizerSettingsBody>,
) -> Result<Json<OkResult>> {
    let _project = load_project_for(&user, &state.mongo, &project_id).await?;
    let oid = oid_from_str(&project_id)?;

    let settings = doc! {
        "enabled": body.enabled,
        "frequencyHours": body.frequency_hours,
    };

    let coll = state.mongo.collection::<Document>(PROJECTS_COLL);
    coll.update_one(
        doc! { "_id": oid },
        doc! { "$set": { "postRandomizer": settings } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("projects.update_one(postRandomizer)"))
    })?;

    Ok(Json(OkResult {
        success: true,
        error: None,
    }))
}

/// `GET /projects/{project_id}/randomizer/posts` — `getRandomizerPosts`.
///
/// The TS returned an empty array on access failure rather than 403.
/// We follow that exactly: callers (mostly server components rendering a
/// list) treat empty as "nothing to show", which is the TS behaviour.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn list_randomizer_posts(
    user: AuthUser,
    State(state): State<WachatFacebookAutomationState>,
    Path(project_id): Path<String>,
) -> Result<Json<RandomizerPostsResponse>> {
    let project_oid = match ObjectId::parse_str(&project_id) {
        Ok(o) => o,
        Err(_) => {
            return Ok(Json(RandomizerPostsResponse { posts: Vec::new() }));
        }
    };
    if load_project_for(&user, &state.mongo, &project_id)
        .await
        .is_err()
    {
        return Ok(Json(RandomizerPostsResponse { posts: Vec::new() }));
    }

    let coll = state.mongo.collection::<Document>(RANDOMIZER_POSTS_COLL);
    let cursor = coll
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .await;
    let cursor = match cursor {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "Failed to get randomizer posts");
            return Ok(Json(RandomizerPostsResponse { posts: Vec::new() }));
        }
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            warn!(error = %e, "Failed to collect randomizer posts");
            return Ok(Json(RandomizerPostsResponse { posts: Vec::new() }));
        }
    };
    let posts = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(RandomizerPostsResponse { posts }))
}

/// `POST /projects/{project_id}/randomizer/posts` — `addRandomizerPost`.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn add_randomizer_post(
    user: AuthUser,
    State(state): State<WachatFacebookAutomationState>,
    Path(project_id): Path<String>,
    Json(body): Json<AddRandomizerPostBody>,
) -> Result<Json<OkResult>> {
    if body.message.trim().is_empty() {
        return Ok(Json(OkResult {
            success: false,
            error: Some("Project and message are required.".to_owned()),
        }));
    }
    let _project = load_project_for(&user, &state.mongo, &project_id).await?;
    let project_oid = oid_from_str(&project_id)?;

    let mut new_post = doc! {
        "projectId": project_oid,
        "message": &body.message,
        "createdAt": Utc::now(),
    };
    if let Some(url) = body.image_url.as_deref() {
        if !url.is_empty() {
            new_post.insert("imageUrl", url);
        }
    }

    let coll = state.mongo.collection::<Document>(RANDOMIZER_POSTS_COLL);
    coll.insert_one(new_post).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("randomizer_posts.insert_one"))
    })?;

    Ok(Json(OkResult {
        success: true,
        error: None,
    }))
}

/// `DELETE /projects/{project_id}/randomizer/posts/{post_id}` —
/// `deleteRandomizerPost`. Tenancy is enforced via the project; the
/// query also pins `projectId` so a stolen post id from another tenant
/// cannot delete a row.
#[instrument(skip_all, fields(project_id = %project_id, post_id = %post_id))]
pub async fn delete_randomizer_post(
    user: AuthUser,
    State(state): State<WachatFacebookAutomationState>,
    Path((project_id, post_id)): Path<(String, String)>,
) -> Result<Json<OkResult>> {
    let post_oid = match ObjectId::parse_str(&post_id) {
        Ok(o) => o,
        Err(_) => {
            return Ok(Json(OkResult {
                success: false,
                error: Some("Invalid ID provided.".to_owned()),
            }));
        }
    };
    let project_oid = match ObjectId::parse_str(&project_id) {
        Ok(o) => o,
        Err(_) => {
            return Ok(Json(OkResult {
                success: false,
                error: Some("Invalid ID provided.".to_owned()),
            }));
        }
    };
    let _project = load_project_for(&user, &state.mongo, &project_id).await?;

    let coll = state.mongo.collection::<Document>(RANDOMIZER_POSTS_COLL);
    coll.delete_one(doc! { "_id": post_oid, "projectId": project_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("randomizer_posts.delete_one"))
        })?;

    Ok(Json(OkResult {
        success: true,
        error: None,
    }))
}

// ===========================================================================
// Broadcasts — list / send
// ===========================================================================

/// `GET /projects/{project_id}/broadcasts` — `getFacebookBroadcasts`.
///
/// Mirrors the TS soft-fail: on invalid id / no access / Mongo error,
/// returns an empty list rather than an error envelope.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn list_facebook_broadcasts(
    user: AuthUser,
    State(state): State<WachatFacebookAutomationState>,
    Path(project_id): Path<String>,
) -> Result<Json<FacebookBroadcastsResponse>> {
    let project_oid = match ObjectId::parse_str(&project_id) {
        Ok(o) => o,
        Err(_) => {
            return Ok(Json(FacebookBroadcastsResponse {
                broadcasts: Vec::new(),
            }));
        }
    };
    if load_project_for(&user, &state.mongo, &project_id)
        .await
        .is_err()
    {
        return Ok(Json(FacebookBroadcastsResponse {
            broadcasts: Vec::new(),
        }));
    }

    let coll = state.mongo.collection::<Document>(FACEBOOK_BROADCASTS_COLL);
    let cursor = coll
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .limit(50)
        .await;
    let cursor = match cursor {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "Failed to fetch Facebook broadcasts");
            return Ok(Json(FacebookBroadcastsResponse {
                broadcasts: Vec::new(),
            }));
        }
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            warn!(error = %e, "Failed to collect Facebook broadcasts");
            return Ok(Json(FacebookBroadcastsResponse {
                broadcasts: Vec::new(),
            }));
        }
    };
    let broadcasts = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(FacebookBroadcastsResponse { broadcasts }))
}

/// `POST /projects/{project_id}/broadcasts` —
/// `handleSendFacebookBroadcast`.
///
/// 1. Resolve subscribers under `facebook_subscribers` for this project.
/// 2. Insert a `facebook_broadcasts` row in `QUEUED`, then bump it to
///    `PROCESSING` with `startedAt`.
/// 3. Fan out to Meta in batches of 10 (matches the TS `BATCH_SIZE`)
///    with a 1-second sleep between batches; tally success/failure.
/// 4. Finalise the row to `COMPLETED` or `PARTIAL_FAILURE` with totals.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn send_facebook_broadcast(
    user: AuthUser,
    State(state): State<WachatFacebookAutomationState>,
    Path(project_id): Path<String>,
    Json(body): Json<SendBroadcastBody>,
) -> Result<Json<MessageResult>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let project_oid = project
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing _id")))?;

    let facebook_page_id = match project
        .get_str("facebookPageId")
        .ok()
        .filter(|s| !s.is_empty())
    {
        Some(s) => s.to_owned(),
        None => {
            return Ok(Json(MessageResult {
                error: Some("Project not found or is not configured for Facebook.".to_owned()),
                ..Default::default()
            }));
        }
    };
    let access_token = match project
        .get_str("accessToken")
        .ok()
        .filter(|s| !s.is_empty())
    {
        Some(s) => s.to_owned(),
        None => {
            return Ok(Json(MessageResult {
                error: Some("Project not found or is not configured for Facebook.".to_owned()),
                ..Default::default()
            }));
        }
    };
    // `facebook_page_id` is loaded purely for parity with the TS access
    // check (`!project.facebookPageId` returned the same error). The
    // Graph send path uses `me/messages` with the page access token, so
    // the page id itself is implicit. Suppress the unused warning.
    let _ = facebook_page_id;

    if body.message.trim().is_empty() {
        return Ok(Json(MessageResult {
            error: Some("Message cannot be empty.".to_owned()),
            ..Default::default()
        }));
    }

    // ---- 1. Resolve subscribers ----------------------------------------
    let subs_coll = state
        .mongo
        .collection::<Document>(FACEBOOK_SUBSCRIBERS_COLL);
    let cursor = subs_coll
        .find(doc! { "projectId": project_oid })
        .projection(doc! { "psid": 1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("facebook_subscribers.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("facebook_subscribers.collect"))
    })?;
    let recipient_ids: Vec<String> = docs
        .iter()
        .filter_map(|d| d.get_str("psid").ok().map(str::to_owned))
        .collect();
    if recipient_ids.is_empty() {
        return Ok(Json(MessageResult {
            error: Some(
                "No contacts found to broadcast to. A user must message your page first."
                    .to_owned(),
            ),
            ..Default::default()
        }));
    }

    // ---- 2. Insert the broadcast row ----------------------------------
    let bcasts = state.mongo.collection::<Document>(FACEBOOK_BROADCASTS_COLL);
    let new_doc = doc! {
        "projectId": project_oid,
        "message": &body.message,
        "status": "QUEUED",
        "createdAt": Utc::now(),
        "totalRecipients": recipient_ids.len() as i64,
        "successCount": 0i64,
        "failedCount": 0i64,
    };
    let insert_res = bcasts.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("facebook_broadcasts.insert_one"))
    })?;
    let broadcast_id = insert_res
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted id was not an ObjectId")))?;

    bcasts
        .update_one(
            doc! { "_id": broadcast_id },
            doc! { "$set": {
                "status": "PROCESSING",
                "startedAt": Utc::now(),
            } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("facebook_broadcasts.update_one(PROCESSING)"),
            )
        })?;

    // ---- 3. Fan out in batches ----------------------------------------
    let mut success_count: i64 = 0;
    let mut failed_count: i64 = 0;

    for chunk in recipient_ids.chunks(BROADCAST_BATCH_SIZE) {
        let mut batch_futures = Vec::with_capacity(chunk.len());
        for recipient_id in chunk.iter() {
            let payload = json!({
                "recipient": { "id": recipient_id },
                "messaging_type": "MESSAGE_TAG",
                "message": { "text": &body.message },
                "tag": "POST_PURCHASE_UPDATE",
            });
            // The TS sent `access_token` as a query string. The shared
            // `MetaClient` sends as `Authorization: Bearer …` instead;
            // both are accepted by the Graph API for the messaging
            // endpoint, so we use the cleaner header form.
            let meta = state.meta.clone();
            let token = access_token.clone();
            let recipient = recipient_id.clone();
            batch_futures.push(async move {
                let res: std::result::Result<Value, _> =
                    meta.post_json("me/messages", &token, &payload).await;
                (recipient, res)
            });
        }
        let results = futures::future::join_all(batch_futures).await;
        for (recipient, res) in results {
            match res {
                Ok(_) => success_count += 1,
                Err(e) => {
                    warn!(
                        recipient = %recipient,
                        error = %e,
                        "Failed to send broadcast message",
                    );
                    failed_count += 1;
                }
            }
        }
        // Match the TS `await new Promise(res => setTimeout(res, 1000))`.
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }

    // ---- 4. Finalise --------------------------------------------------
    let final_status = if failed_count > 0 {
        "PARTIAL_FAILURE"
    } else {
        "COMPLETED"
    };
    bcasts
        .update_one(
            doc! { "_id": broadcast_id },
            doc! { "$set": {
                "status": final_status,
                "completedAt": Utc::now(),
                "successCount": success_count,
                "failedCount": failed_count,
            } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("facebook_broadcasts.update_one(final)"),
            )
        })?;

    Ok(Json(MessageResult {
        message: Some(format!(
            "Broadcast sent to {success_count} users. {failed_count} failed."
        )),
        ..Default::default()
    }))
}

// ===========================================================================
// Live streams — list / schedule
// ===========================================================================

/// `GET /projects/{project_id}/live-streams` — `getScheduledLiveStreams`.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn list_scheduled_live_streams(
    user: AuthUser,
    State(state): State<WachatFacebookAutomationState>,
    Path(project_id): Path<String>,
) -> Result<Json<LiveStreamsResponse>> {
    let project_oid = match ObjectId::parse_str(&project_id) {
        Ok(o) => o,
        Err(_) => {
            return Ok(Json(LiveStreamsResponse {
                streams: Vec::new(),
            }));
        }
    };
    if load_project_for(&user, &state.mongo, &project_id)
        .await
        .is_err()
    {
        return Ok(Json(LiveStreamsResponse {
            streams: Vec::new(),
        }));
    }

    let coll = state
        .mongo
        .collection::<Document>(FACEBOOK_LIVE_STREAMS_COLL);
    let cursor = coll
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "scheduledTime": -1 })
        .limit(50)
        .await;
    let cursor = match cursor {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "Failed to fetch scheduled streams");
            return Ok(Json(LiveStreamsResponse {
                streams: Vec::new(),
            }));
        }
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            warn!(error = %e, "Failed to collect scheduled streams");
            return Ok(Json(LiveStreamsResponse {
                streams: Vec::new(),
            }));
        }
    };
    let streams = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(LiveStreamsResponse { streams }))
}

/// `POST /projects/{project_id}/live-streams` —
/// `handleScheduleLiveStream`.
///
/// Multipart endpoint — the TS source took a `FormData` with the video
/// file inline, and the Rust port keeps that contract. Field names
/// match the legacy `formData.get('…')` calls 1:1.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn schedule_live_stream(
    user: AuthUser,
    State(state): State<WachatFacebookAutomationState>,
    Path(project_id): Path<String>,
    mut multipart: Multipart,
) -> Result<Json<MessageResult>> {
    // ---- 1. Pull multipart fields -------------------------------------
    let mut title: Option<String> = None;
    let mut description: Option<String> = None;
    let mut scheduled_date: Option<String> = None;
    let mut scheduled_time: Option<String> = None;
    let mut video_filename: Option<String> = None;
    let mut video_content_type: Option<String> = None;
    let mut video_bytes: Option<Vec<u8>> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::BadRequest(format!("invalid multipart payload: {e}")))?
    {
        let name = field.name().unwrap_or("").to_owned();
        match name.as_str() {
            "title" => title = Some(field.text().await.map_err(map_multipart_err)?),
            "description" => description = Some(field.text().await.map_err(map_multipart_err)?),
            "scheduledDate" => {
                scheduled_date = Some(field.text().await.map_err(map_multipart_err)?)
            }
            "scheduledTime" => {
                scheduled_time = Some(field.text().await.map_err(map_multipart_err)?)
            }
            "videoFile" => {
                video_filename = field.file_name().map(|s| s.to_owned());
                video_content_type = field.content_type().map(|s| s.to_owned());
                let bytes = field.bytes().await.map_err(map_multipart_err)?;
                video_bytes = Some(bytes.to_vec());
            }
            _ => {
                // Drain unknown fields so the multipart stream stays
                // consistent.
                let _ = field.bytes().await;
            }
        }
    }

    let title = title.unwrap_or_default();
    let description = description.unwrap_or_default();
    let scheduled_date = scheduled_date.unwrap_or_default();
    let scheduled_time = scheduled_time.unwrap_or_default();
    let video_filename = video_filename.unwrap_or_else(|| "upload.mp4".to_owned());
    let video_content_type =
        video_content_type.unwrap_or_else(|| "application/octet-stream".to_owned());
    let video_bytes = video_bytes.unwrap_or_default();

    if title.is_empty()
        || scheduled_date.is_empty()
        || scheduled_time.is_empty()
        || video_bytes.is_empty()
    {
        return Ok(Json(MessageResult {
            error: Some("All fields, including a video file, are required.".to_owned()),
            ..Default::default()
        }));
    }

    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let project_oid = project
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing _id")))?;
    let facebook_page_id = match project
        .get_str("facebookPageId")
        .ok()
        .filter(|s| !s.is_empty())
    {
        Some(s) => s.to_owned(),
        None => {
            return Ok(Json(MessageResult {
                error: Some("Project is not fully configured for Facebook posting.".to_owned()),
                ..Default::default()
            }));
        }
    };
    let access_token = match project
        .get_str("accessToken")
        .ok()
        .filter(|s| !s.is_empty())
    {
        Some(s) => s.to_owned(),
        None => {
            return Ok(Json(MessageResult {
                error: Some("Project is not fully configured for Facebook posting.".to_owned()),
                ..Default::default()
            }));
        }
    };

    // ---- 2. Parse + validate schedule timestamp ----------------------
    let scheduled_publish_time = match parse_schedule(&scheduled_date, &scheduled_time) {
        Some(dt) if dt > Utc::now() => dt,
        _ => {
            return Ok(Json(MessageResult {
                error: Some("Invalid or past schedule date/time.".to_owned()),
                ..Default::default()
            }));
        }
    };

    // ---- 3. POST multipart upload to graph-video.facebook.com -------
    let upload_url =
        format!("https://graph-video.facebook.com/{META_API_VERSION}/{facebook_page_id}/videos");
    let unix_secs = scheduled_publish_time.timestamp();

    let part = reqwest::multipart::Part::bytes(video_bytes)
        .file_name(video_filename.clone())
        .mime_str(&video_content_type)
        .map_err(|e| ApiError::BadRequest(format!("invalid video content-type: {e}")))?;
    let form = reqwest::multipart::Form::new()
        .text("access_token", access_token)
        .text("title", title.clone())
        .text("description", description.clone())
        .text("live_status", "SCHEDULED_LIVE")
        .text("scheduled_publish_time", unix_secs.to_string())
        .part("source", part);

    let response = state
        .video_http
        .post(&upload_url)
        .multipart(form)
        .send()
        .await;
    let response = match response {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "Failed to schedule live stream");
            return Ok(Json(MessageResult {
                error: Some(e.to_string()),
                ..Default::default()
            }));
        }
    };

    let status = response.status();
    let body_value: Value = response
        .json()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("graph-video.json")))?;

    if !status.is_success() {
        let msg = body_value
            .pointer("/error/message")
            .and_then(|v| v.as_str())
            .unwrap_or("Failed to upload video.")
            .to_owned();
        return Ok(Json(MessageResult {
            error: Some(msg),
            ..Default::default()
        }));
    }
    if let Some(err) = body_value.get("error") {
        let msg = err
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("Failed to upload video.")
            .to_owned();
        return Ok(Json(MessageResult {
            error: Some(msg),
            ..Default::default()
        }));
    }
    let facebook_video_id = match body_value.get("id").and_then(|v| v.as_str()) {
        Some(s) => s.to_owned(),
        None => {
            return Ok(Json(MessageResult {
                error: Some("Facebook did not return a video ID after upload.".to_owned()),
                ..Default::default()
            }));
        }
    };

    // ---- 4. Persist the scheduled stream -----------------------------
    let new_stream = doc! {
        "projectId": project_oid,
        "title": &title,
        "description": &description,
        "scheduledTime": scheduled_publish_time,
        "facebookVideoId": &facebook_video_id,
        "status": "SCHEDULED_LIVE",
        "createdAt": Utc::now(),
    };
    let coll = state
        .mongo
        .collection::<Document>(FACEBOOK_LIVE_STREAMS_COLL);
    coll.insert_one(new_stream).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("facebook_live_streams.insert_one"))
    })?;

    Ok(Json(MessageResult {
        message: Some("Video successfully scheduled as a live premiere!".to_owned()),
        ..Default::default()
    }))
}

// ===========================================================================
// helpers
// ===========================================================================

/// Best-effort `serde_json::Value` → `bson::Bson` conversion. Falls
/// back to `Bson::Null` if the value can't be represented — in practice
/// `Value` and `Bson` are isomorphic for our shapes.
fn serde_value_to_bson(v: &Value) -> Bson {
    Bson::try_from(v.clone()).unwrap_or(Bson::Null)
}

/// Map a multipart extraction error into `ApiError::BadRequest`.
fn map_multipart_err(e: axum::extract::multipart::MultipartError) -> ApiError {
    ApiError::BadRequest(format!("invalid multipart payload: {e}"))
}

/// Parse the `scheduledDate` (`YYYY-MM-DD`) + `scheduledTime`
/// (`HH:MM[:SS]`) pair into a UTC datetime. The TS used
/// `new Date(\`${date}T${time}\`)` which is local-tz dependent; we
/// pick UTC explicitly for reproducibility — the value is consumed only
/// as a `unix_secs` upload timestamp + a stored `scheduledTime` Mongo
/// field, so absolute correctness across deployments matters more than
/// matching the TS's local-tz behaviour.
fn parse_schedule(date: &str, time: &str) -> Option<DateTime<Utc>> {
    // Accept either `HH:MM` or `HH:MM:SS`.
    let normalized_time = if time.matches(':').count() == 1 {
        format!("{time}:00")
    } else {
        time.to_owned()
    };
    let combined = format!("{date}T{normalized_time}");
    let naive = NaiveDateTime::parse_from_str(&combined, "%Y-%m-%dT%H:%M:%S").ok()?;
    Some(naive.and_utc())
}
