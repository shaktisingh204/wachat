//! HTTP handlers for the SabChat AI translate domain.
//!
//! | Endpoint                                       | Handler                  |
//! |------------------------------------------------|--------------------------|
//! | `POST /v1/sabchat/ai/translate/text`           | [`translate_text`]       |
//! | `POST /v1/sabchat/ai/translate/detect`         | [`detect`]               |
//! | `POST /v1/sabchat/ai/translate/message`        | [`translate_message`]    |
//!
//! ## Tenancy
//!
//! `translate_text` and `detect` are stateless wrappers around the
//! bound [`Translator`](crate::translator::Translator) — they require a
//! valid `AuthUser` (so unauthenticated requests are rejected at the
//! extractor) but otherwise do not touch Mongo.
//!
//! `translate_message` additionally enforces tenant scope: the target
//! `sabchat_messages` document must live under `auth.tenant_id` parsed
//! as an `ObjectId`, matching the guard used by sibling crates
//! (`sabchat-messages`, `sabchat-conversations`).
//!
//! ## Persistence shape
//!
//! Successful per-message translations are merged onto the message's
//! `provider_metadata.translations` map via a positional `$set`:
//!
//! ```json
//! {
//!   "$set": {
//!     "providerMetadata.translations.<targetLang>": {
//!       "text":  "<translated>",
//!       "model": "<backend>",
//!       "at":    "<ISO-8601 BSON DateTime>"
//!     }
//!   }
//! }
//! ```
//!
//! This shape leaves any pre-existing `providerMetadata` keys untouched
//! and lets later reads index translations by language with a single
//! lookup.

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use sabchat_types::ContentBlock;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{DetectBody, TranslateMessageBody, TranslateMessageResponse, TranslateTextBody};
use crate::state::SabChatAiTranslateState;
use crate::translator::{DetectResp, TranslateResp};

// ===========================================================================
// Collection names
// ===========================================================================

const MESSAGES_COLL: &str = "sabchat_messages";

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse `auth.tenant_id` into an `ObjectId` or fail with 401.
fn tenant_oid(auth: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Load a message under the caller's tenant. Returns 404 for both
/// "does not exist" and "lives under a different tenant" to avoid
/// leaking existence across tenants.
async fn load_message_for_tenant(
    mongo: &MongoHandle,
    message_id_hex: &str,
    tenant: ObjectId,
) -> Result<Document> {
    let oid = oid_from_str(message_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid message id.".to_owned()))?;
    let coll = mongo.collection::<Document>(MESSAGES_COLL);
    coll.find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Message not found.".to_owned()))
}

/// Extract the rendered text from a stored message document. We
/// deserialize the persisted `content` field into the canonical
/// [`ContentBlock`] enum so we share the exact same matcher the rest of
/// the SabChat code uses — there is no parallel "is this block text?"
/// heuristic here. Only [`ContentBlock::Text`] blocks are translatable.
fn extract_text_from_message(msg: &Document) -> Result<String> {
    let content_bson = msg
        .get("content")
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("message missing content")))?;
    let block: ContentBlock = bson::from_bson(content_bson.clone()).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.content deserialise"))
    })?;
    match block {
        ContentBlock::Text { text } => Ok(text),
        _ => Err(ApiError::Validation(
            "Only text messages can be translated.".to_owned(),
        )),
    }
}

// ===========================================================================
// POST /text — translate_text
// ===========================================================================

/// `POST /v1/sabchat/ai/translate/text` — translate a free-form string.
///
/// Pure pass-through to the bound [`Translator`]. Auth is enforced at
/// the extractor; the handler does not touch Mongo.
#[instrument(skip_all, fields(target_lang = %body.target_lang, source_lang = body.source_lang.as_deref().unwrap_or("?")))]
pub async fn translate_text(
    _auth: AuthUser,
    State(state): State<SabChatAiTranslateState>,
    Json(body): Json<TranslateTextBody>,
) -> Result<Json<TranslateResp>> {
    if body.text.trim().is_empty() {
        return Err(ApiError::Validation("Text is required.".to_owned()));
    }
    if body.target_lang.trim().is_empty() {
        return Err(ApiError::Validation(
            "Target language is required.".to_owned(),
        ));
    }

    let resp = state
        .translator
        .translate(
            &body.text,
            &body.target_lang,
            body.source_lang.as_deref().filter(|s| !s.is_empty()),
        )
        .await
        .map_err(|e| ApiError::Internal(e.context("translator.translate")))?;
    Ok(Json(resp))
}

// ===========================================================================
// POST /detect — detect
// ===========================================================================

/// `POST /v1/sabchat/ai/translate/detect` — detect the language of a
/// free-form string.
///
/// Pure pass-through to the bound [`Translator`]. Auth is enforced at
/// the extractor; the handler does not touch Mongo.
#[instrument(skip_all)]
pub async fn detect(
    _auth: AuthUser,
    State(state): State<SabChatAiTranslateState>,
    Json(body): Json<DetectBody>,
) -> Result<Json<DetectResp>> {
    if body.text.trim().is_empty() {
        return Err(ApiError::Validation("Text is required.".to_owned()));
    }

    let resp = state
        .translator
        .detect(&body.text)
        .await
        .map_err(|e| ApiError::Internal(e.context("translator.detect")))?;
    Ok(Json(resp))
}

// ===========================================================================
// POST /message — translate_message
// ===========================================================================

/// `POST /v1/sabchat/ai/translate/message` — translate the text content
/// of a stored message and persist the result on the document.
///
/// Steps:
/// 1. Resolve the target message under the caller's tenant.
/// 2. Pull the rendered text out of the `content` block (only
///    [`ContentBlock::Text`] is translatable; every other variant returns
///    422 with `Validation`).
/// 3. Call the bound [`Translator`].
/// 4. `$set providerMetadata.translations.<targetLang> = { text, model, at }`
///    on the message doc.
#[instrument(skip_all, fields(message_id = %body.message_id, target_lang = %body.target_lang))]
pub async fn translate_message(
    auth: AuthUser,
    State(state): State<SabChatAiTranslateState>,
    Json(body): Json<TranslateMessageBody>,
) -> Result<Json<TranslateMessageResponse>> {
    if body.target_lang.trim().is_empty() {
        return Err(ApiError::Validation(
            "Target language is required.".to_owned(),
        ));
    }

    let tenant = tenant_oid(&auth)?;
    let message = load_message_for_tenant(&state.mongo, &body.message_id, tenant).await?;
    let message_oid = message
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing _id")))?;

    // ---- Pull the source text + translate ------------------------------
    let source_text = extract_text_from_message(&message)?;
    let translate_resp = state
        .translator
        .translate(&source_text, &body.target_lang, None)
        .await
        .map_err(|e| ApiError::Internal(e.context("translator.translate")))?;

    // ---- Persist under provider_metadata.translations[targetLang] ------
    //
    // Dot-path `$set` so we never clobber an unrelated `providerMetadata`
    // key (e.g. WAMID, Telegram update id) and so a future translation
    // into a different language can land on the same document without a
    // read-modify-write.
    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let translation_doc = doc! {
        "text": &translate_resp.translated,
        "model": &translate_resp.model,
        "at": now_bson,
    };
    let path = format!("providerMetadata.translations.{}", body.target_lang);
    let update = doc! {
        "$set": { path: Bson::Document(translation_doc) },
    };

    let coll = state.mongo.collection::<Document>(MESSAGES_COLL);
    coll.update_one(doc! { "_id": message_oid, "tenantId": tenant }, update)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_messages.update_one(translation)"),
            )
        })?;

    Ok(Json(TranslateMessageResponse {
        message_id: message_oid.to_hex(),
        translated: translate_resp.translated,
        detected_source_lang: translate_resp.detected_source_lang,
    }))
}
