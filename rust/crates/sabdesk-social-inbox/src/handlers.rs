use crate::mock_db::AppState;
use crate::models::*;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;

#[derive(serde::Serialize)]
pub struct MessageResponse {
    message: String,
}

// 1. Create Social Account
pub async fn create_social_account(
    State(state): State<AppState>,
    Json(mut payload): Json<SocialAccount>,
) -> (StatusCode, Json<SocialAccount>) {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();
    payload.updated_at = Utc::now();

    state
        .accounts
        .write()
        .await
        .insert(payload.id, payload.clone());
    (StatusCode::CREATED, Json(payload))
}

// 2. List Social Accounts
pub async fn list_social_accounts(State(state): State<AppState>) -> Json<Vec<SocialAccount>> {
    let accounts = state.accounts.read().await;
    let list = accounts.values().cloned().collect();
    Json(list)
}

// 3. Get Account by ID
pub async fn get_social_account(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<SocialAccount>, StatusCode> {
    let accounts = state.accounts.read().await;
    match accounts.get(&id) {
        Some(account) => Ok(Json(account.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

// 4. Update Social Account
pub async fn update_social_account(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SocialAccount>,
) -> Result<Json<SocialAccount>, StatusCode> {
    let mut accounts = state.accounts.write().await;
    if let Some(account) = accounts.get_mut(&id) {
        account.handle = payload.handle;
        account.is_active = payload.is_active;
        account.updated_at = Utc::now();
        Ok(Json(account.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 5. Delete Social Account
pub async fn delete_social_account(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let mut accounts = state.accounts.write().await;
    if accounts.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 6. Ingest Mention
pub async fn ingest_mention(
    State(state): State<AppState>,
    Json(mut payload): Json<Mention>,
) -> (StatusCode, Json<Mention>) {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();

    state
        .mentions
        .write()
        .await
        .insert(payload.id, payload.clone());
    (StatusCode::CREATED, Json(payload))
}

// 7. List Mentions
pub async fn list_mentions(State(state): State<AppState>) -> Json<Vec<Mention>> {
    let mentions = state.mentions.read().await;
    let list = mentions.values().cloned().collect();
    Json(list)
}

// 8. Resolve Mention
pub async fn resolve_mention(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Mention>, StatusCode> {
    let mut mentions = state.mentions.write().await;
    if let Some(mention) = mentions.get_mut(&id) {
        mention.is_resolved = true;
        Ok(Json(mention.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 9. Send Direct Message
pub async fn send_direct_message(
    State(state): State<AppState>,
    Json(mut payload): Json<DirectMessage>,
) -> (StatusCode, Json<DirectMessage>) {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();

    state.dms.write().await.insert(payload.id, payload.clone());
    (StatusCode::CREATED, Json(payload))
}

// 10. List DMs
pub async fn list_direct_messages(State(state): State<AppState>) -> Json<Vec<DirectMessage>> {
    let dms = state.dms.read().await;
    let list = dms.values().cloned().collect();
    Json(list)
}

// 11. Mark DM as Read
pub async fn mark_dm_read(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<DirectMessage>, StatusCode> {
    let mut dms = state.dms.write().await;
    if let Some(dm) = dms.get_mut(&id) {
        dm.read_status = true;
        Ok(Json(dm.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 12. Add Comment Thread
pub async fn add_comment_thread(
    State(state): State<AppState>,
    Json(mut payload): Json<CommentThread>,
) -> (StatusCode, Json<CommentThread>) {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();

    state
        .threads
        .write()
        .await
        .insert(payload.id, payload.clone());
    (StatusCode::CREATED, Json(payload))
}

// 13. List Comment Threads
pub async fn list_comment_threads(State(state): State<AppState>) -> Json<Vec<CommentThread>> {
    let threads = state.threads.read().await;
    let list = threads.values().cloned().collect();
    Json(list)
}

#[derive(Deserialize)]
pub struct ReplyPayload {
    pub content: String,
    pub author_id: String,
}

// 14. Reply to Comment Thread
pub async fn reply_to_comment(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReplyPayload>,
) -> Result<(StatusCode, Json<CommentThread>), StatusCode> {
    let mut threads = state.threads.write().await;
    let parent = threads.get_mut(&id).ok_or(StatusCode::NOT_FOUND)?;
    parent.reply_count += 1;

    let new_thread = CommentThread {
        id: Uuid::new_v4(),
        post_id: parent.post_id.clone(),
        parent_comment_id: Some(parent.id.to_string()),
        content: payload.content,
        author_id: payload.author_id,
        created_at: Utc::now(),
        reply_count: 0,
        likes_count: 0,
    };

    let result = new_thread.clone();
    threads.insert(new_thread.id, new_thread);
    Ok((StatusCode::CREATED, Json(result)))
}

// 15. Perform Moderation Action
pub async fn perform_moderation(
    State(state): State<AppState>,
    Json(mut payload): Json<ModerationAction>,
) -> (StatusCode, Json<ModerationAction>) {
    payload.id = Uuid::new_v4();
    payload.timestamp = Utc::now();

    state
        .mod_actions
        .write()
        .await
        .insert(payload.id, payload.clone());
    (StatusCode::CREATED, Json(payload))
}

// 16. Get Moderation Actions
pub async fn list_moderation_actions(State(state): State<AppState>) -> Json<Vec<ModerationAction>> {
    let actions = state.mod_actions.read().await;
    let list = actions.values().cloned().collect();
    Json(list)
}

#[derive(Deserialize)]
pub struct BulkModerationPayload {
    pub entity_ids: Vec<Uuid>,
    pub action: String,
    pub performed_by: String,
    pub entity_type: String,
}

// 17. Bulk Moderation
pub async fn bulk_moderate(
    State(state): State<AppState>,
    Json(payload): Json<BulkModerationPayload>,
) -> (StatusCode, Json<MessageResponse>) {
    let mut actions = state.mod_actions.write().await;
    let mut count = 0;

    for entity_id in payload.entity_ids {
        let mod_action = ModerationAction {
            id: Uuid::new_v4(),
            entity_type: payload.entity_type.clone(),
            entity_id,
            action: payload.action.clone(),
            performed_by: payload.performed_by.clone(),
            timestamp: Utc::now(),
        };
        actions.insert(mod_action.id, mod_action);
        count += 1;
    }

    (
        StatusCode::OK,
        Json(MessageResponse {
            message: format!("Applied {} bulk moderation actions", count),
        }),
    )
}

// 18. Analyze Sentiment
#[derive(Deserialize)]
pub struct AnalyzePayload {
    pub mention_id: Uuid,
    pub predicted_sentiment: Sentiment,
}

pub async fn set_sentiment(
    State(state): State<AppState>,
    Json(payload): Json<AnalyzePayload>,
) -> Result<Json<Mention>, StatusCode> {
    let mut mentions = state.mentions.write().await;
    if let Some(mention) = mentions.get_mut(&payload.mention_id) {
        mention.sentiment = Some(payload.predicted_sentiment);
        Ok(Json(mention.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 19. Get Unresolved Mentions
pub async fn get_unresolved_mentions(State(state): State<AppState>) -> Json<Vec<Mention>> {
    let mentions = state.mentions.read().await;
    let list = mentions
        .values()
        .filter(|m| !m.is_resolved)
        .cloned()
        .collect();
    Json(list)
}

// 20. Clear All Data (Admin)
pub async fn clear_all_data(State(state): State<AppState>) -> (StatusCode, Json<MessageResponse>) {
    state.accounts.write().await.clear();
    state.mentions.write().await.clear();
    state.dms.write().await.clear();
    state.threads.write().await.clear();
    state.mod_actions.write().await.clear();

    (
        StatusCode::OK,
        Json(MessageResponse {
            message: "All data cleared".to_string(),
        }),
    )
}
