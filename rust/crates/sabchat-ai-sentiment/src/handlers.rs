//! HTTP handlers for the SabChat AI sentiment domain.
//!
//! Each handler maps 1:1 to a route:
//!
//! | Endpoint                                          | Handler                                  |
//! |---------------------------------------------------|------------------------------------------|
//! | `POST /v1/sabchat/ai/sentiment/classify`          | [`classify`]                             |
//! | `POST /v1/sabchat/ai/sentiment/message`           | [`classify_message`]                     |
//! | `POST /v1/sabchat/ai/sentiment/conversation`      | [`classify_conversation`]                |
//!
//! ## Persistence shape
//!
//! On a message we set:
//!
//! ```text
//! { $set: { "providerMetadata.classification": <Classification> } }
//! ```
//!
//! On a conversation we set:
//!
//! ```text
//! { $set: {
//!     "customAttrs.churnRisk": f32,           // average negative score
//!     "customAttrs.lastSentiment": string,    // most-recent visitor msg
//!     "updatedAt": now,
//! } }
//! ```
//!
//! The conversation's `customAttrs` field is stored as a free-form JSON
//! object today (see [`sabchat_types::SabChatConversation`]). We update
//! it via dotted-path `$set` so we never clobber unrelated keys other
//! callers might be writing.
//!
//! ## Tenancy
//!
//! Every request scopes its reads + writes by
//! `tenantId == auth.tenant_id`. A message or conversation that exists
//! under a different tenant looks indistinguishable from "not found" to
//! the caller — that matches the SabChat-wide convention.

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::classifier::{Classification, Sentiment};
use crate::dto::{
    ClassifyBody, ClassifyConversationBody, ClassifyConversationResponse, ClassifyMessageBody,
};
use crate::state::SabChatAiSentimentState;

// ---------------------------------------------------------------------------
// Collection names — match the sibling SabChat handler crates verbatim.
// ---------------------------------------------------------------------------

const MESSAGES_COLL: &str = "sabchat_messages";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";

/// How many recent visitor messages to score per conversation request.
/// Mirrors the slice spec.
const CONVERSATION_WINDOW: i64 = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Parse `auth.tenant_id` into an `ObjectId` or fail with 401.
fn tenant_oid(auth: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Best-effort `serde::Serialize` → `bson::Bson` conversion. The
/// [`Classification`] type is fully serde-friendly so this always
/// round-trips cleanly; we fall back to `Bson::Null` only to keep the
/// signature total.
fn classification_to_bson(c: &Classification) -> Bson {
    let value = serde_json::to_value(c).unwrap_or(serde_json::Value::Null);
    Bson::try_from(value).unwrap_or(Bson::Null)
}

/// Pull the text payload out of a stored message document. Mirrors the
/// `ContentBlock::Text` variant of [`sabchat_types::ContentBlock`].
/// Returns `None` for non-text blocks (image / file / card / etc.); the
/// caller short-circuits with a zero-classification in that case.
fn extract_text_content(message: &Document) -> Option<String> {
    let content = message.get_document("content").ok()?;
    let kind = content.get_str("kind").ok()?;
    if kind != "text" {
        return None;
    }
    content.get_str("text").ok().map(str::to_owned)
}

/// Run the classifier and lift any error into `ApiError::Internal`.
async fn run_classifier(state: &SabChatAiSentimentState, text: &str) -> Result<Classification> {
    state
        .classifier
        .classify(text)
        .await
        .map_err(|e| ApiError::Internal(e.context("classifier.classify")))
}

/// Persist a classification onto one message by `_id` + `tenantId`. The
/// dotted-path `$set` leaves the rest of `providerMetadata` alone.
async fn persist_message_classification(
    mongo: &MongoHandle,
    tenant: ObjectId,
    message_oid: ObjectId,
    classification: &Classification,
) -> Result<()> {
    let coll = mongo.collection::<Document>(MESSAGES_COLL);
    coll.update_one(
        doc! { "_id": message_oid, "tenantId": tenant },
        doc! { "$set": {
            "providerMetadata.classification": classification_to_bson(classification),
        } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_messages.update_one(classification)"),
        )
    })?;
    Ok(())
}

// ===========================================================================
// POST /v1/sabchat/ai/sentiment/classify
// ===========================================================================

/// `POST /classify` — synchronous, stateless text classification. Used
/// by preview UIs that want the score without a write. No Mongo access.
#[instrument(skip_all, fields(text_len = body.text.len()))]
pub async fn classify(
    _auth: AuthUser,
    State(state): State<SabChatAiSentimentState>,
    Json(body): Json<ClassifyBody>,
) -> Result<Json<Classification>> {
    let out = run_classifier(&state, &body.text).await?;
    Ok(Json(out))
}

// ===========================================================================
// POST /v1/sabchat/ai/sentiment/message
// ===========================================================================

/// `POST /message` — load one tenant-scoped message, classify its text
/// content, and persist the result under
/// `providerMetadata.classification`. Non-text content (image / file /
/// card / etc.) is a no-op: we return the zero-classification without
/// writing.
#[instrument(skip_all, fields(message_id = %body.message_id))]
pub async fn classify_message(
    auth: AuthUser,
    State(state): State<SabChatAiSentimentState>,
    Json(body): Json<ClassifyMessageBody>,
) -> Result<Json<Classification>> {
    let tenant = tenant_oid(&auth)?;
    let message_oid = oid_from_str(&body.message_id)
        .map_err(|_| ApiError::BadRequest("Invalid message id.".to_owned()))?;

    let coll = state.mongo.collection::<Document>(MESSAGES_COLL);
    let message = coll
        .find_one(doc! { "_id": message_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Message not found.".to_owned()))?;

    // Non-text content → no-op. We still return a well-formed (zero)
    // classification so the caller has a uniform response shape.
    let Some(text) = extract_text_content(&message) else {
        return Ok(Json(Classification {
            sentiment: Sentiment::Neutral,
            score: 0.0,
            intent: None,
            topic: None,
            pii: Default::default(),
        }));
    };

    let classification = run_classifier(&state, &text).await?;
    persist_message_classification(&state.mongo, tenant, message_oid, &classification).await?;

    Ok(Json(classification))
}

// ===========================================================================
// POST /v1/sabchat/ai/sentiment/conversation
// ===========================================================================

/// `POST /conversation` — score the last [`CONVERSATION_WINDOW`] visitor
/// messages, persist each result, then write
/// `customAttrs.churnRisk` + `customAttrs.lastSentiment` on the parent
/// conversation document.
///
/// Churn risk is the average **negative-signed** score across the
/// scored window: every negative message contributes its `score`,
/// positives subtract their score, neutrals contribute 0. The mean is
/// clamped into `[0.0, 1.0]` (positives bias to 0, negatives bias to
/// 1). With no scoreable messages we leave churn risk at `0.0` and skip
/// the `lastSentiment` write.
#[instrument(skip_all, fields(conversation_id = %body.conversation_id))]
pub async fn classify_conversation(
    auth: AuthUser,
    State(state): State<SabChatAiSentimentState>,
    Json(body): Json<ClassifyConversationBody>,
) -> Result<Json<ClassifyConversationResponse>> {
    let tenant = tenant_oid(&auth)?;
    let conversation_oid = oid_from_str(&body.conversation_id)
        .map_err(|_| ApiError::BadRequest("Invalid conversation id.".to_owned()))?;

    // ---- Tenant-scoped conversation existence check -------------------
    let conversations = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let _ = conversations
        .find_one(doc! { "_id": conversation_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Conversation not found.".to_owned()))?;

    // ---- Pull the last N visitor messages -----------------------------
    //
    // Sorted newest-first; we score every doc that matches. Private
    // notes never have `senderType: visitor`, so they're filtered by
    // the same predicate.
    let messages = state.mongo.collection::<Document>(MESSAGES_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(CONVERSATION_WINDOW)
        .build();
    let cursor = messages
        .find(doc! {
            "tenantId": tenant,
            "conversationId": conversation_oid,
            "senderType": "visitor",
        })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find(visitor)"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.collect(visitor)"))
    })?;

    // ---- Classify + persist per message -------------------------------
    let mut scored: u32 = 0;
    let mut churn_sum: f32 = 0.0;
    // The first iteration (newest message) wins `lastSentiment`.
    let mut last_sentiment: Option<Sentiment> = None;

    for msg in &docs {
        let Some(text) = extract_text_content(msg) else {
            continue;
        };
        let oid = match msg.get_object_id("_id") {
            Ok(o) => o,
            Err(_) => continue,
        };

        let classification = run_classifier(&state, &text).await?;
        persist_message_classification(&state.mongo, tenant, oid, &classification).await?;

        // Signed contribution: negatives push churn up, positives push
        // it down, neutrals are silent.
        let signed = match classification.sentiment {
            Sentiment::Negative => classification.score,
            Sentiment::Positive => -classification.score,
            Sentiment::Neutral => 0.0,
        };
        churn_sum += signed;
        if last_sentiment.is_none() {
            last_sentiment = Some(classification.sentiment);
        }
        scored += 1;
    }

    // ---- Compute + persist conversation churn risk --------------------
    let churn_risk = if scored == 0 {
        0.0
    } else {
        // Mean of signed contributions, mapped from `[-1, 1]` to
        // `[0, 1]` so the value reads "fraction of visitor turn that
        // sounds negative".
        let mean = churn_sum / scored as f32;
        ((mean + 1.0) / 2.0).clamp(0.0, 1.0)
    };

    if scored > 0 {
        let now_bson = bson::DateTime::from_chrono(Utc::now());
        let mut set_doc = doc! {
            "customAttrs.churnRisk": churn_risk as f64,
            "updatedAt": now_bson,
        };
        if let Some(s) = last_sentiment {
            set_doc.insert("customAttrs.lastSentiment", s.as_str());
        }
        conversations
            .update_one(
                doc! { "_id": conversation_oid, "tenantId": tenant },
                doc! { "$set": set_doc },
            )
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("sabchat_conversations.update_one(churnRisk)"),
                )
            })?;
    }

    Ok(Json(ClassifyConversationResponse { scored, churn_risk }))
}
