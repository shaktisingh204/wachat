//! Public-widget HTTP handlers for SabChat CSAT.
//!
//! Mounted at `/v1/sabchat/csat-public` — the single endpoint here is
//! intentionally anonymous (no [`AuthUser`](sabnode_auth::AuthUser)).
//! Visitor identity is proven by the opaque `visitorToken` body field,
//! which is looked up in `sabchat_widget_sessions`; that row carries the
//! tenant, contact, and conversation ids we need.
//!
//! ## POST /respond
//!
//! Steps:
//!
//! 1. Resolve the widget session by token. Expired / unknown tokens
//!    surface as `401` (collapsed into "session gone").
//! 2. Look up the conversation; recover `customAttrs.pendingSurveyId`.
//!    A missing stash yields `400` (the widget should never call us
//!    without an outstanding survey).
//! 3. Validate the supplied score against the survey's
//!    `[scale_min, scale_max]` range.
//! 4. Insert one row into `sabchat_survey_responses`.
//! 5. Atomically update the conversation: clear
//!    `customAttrs.pendingSurveyId` and set `customAttrs.csat = { score,
//!    max, submittedAt }` so the agent UI / reports can read the rating
//!    inline.

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{PublicRespondBody, PublicRespondResponse};
use crate::handlers::{CONVERSATIONS_COLL, RESPONSES_COLL, SURVEYS_COLL};
use crate::state::SabChatCsatState;

/// Collection name for ephemeral widget sessions. Owned by
/// `sabchat-widget`; we only read from it here.
const SESSIONS_COLL: &str = "sabchat_widget_sessions";

/// Resolved widget-session context. We don't depend on the
/// `sabchat-widget` crate for the schema — the read is a single Mongo
/// `find_one` with `Document` typing.
struct WidgetSession {
    tenant_id: ObjectId,
    contact_id: ObjectId,
    conversation_id: ObjectId,
    expires_at: DateTime<Utc>,
}

/// Look up the widget session keyed by `token`. Returns:
///
/// - `ApiError::Unauthorized` if the token is missing / unknown /
///   expired (collapsed into a single response so widgets always
///   refresh on any of those conditions);
/// - `ApiError::Internal` on Mongo failure.
async fn resolve_session(mongo: &MongoHandle, token: &str) -> Result<WidgetSession> {
    if token.trim().is_empty() {
        return Err(ApiError::Unauthorized("missing visitor token".to_owned()));
    }

    let coll = mongo.collection::<Document>(SESSIONS_COLL);
    let doc = coll
        .find_one(doc! { "visitorToken": token })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_widget_sessions.find_one"))
        })?
        .ok_or_else(|| ApiError::Unauthorized("invalid or expired session".to_owned()))?;

    let tenant_id = doc
        .get_object_id("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("session missing tenantId")))?;
    let contact_id = doc
        .get_object_id("contactId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("session missing contactId")))?;
    let conversation_id = doc
        .get_object_id("conversationId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("session missing conversationId")))?;
    let expires_at = doc
        .get_datetime("expiresAt")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("session missing expiresAt")))?
        .to_chrono();

    if expires_at <= Utc::now() {
        return Err(ApiError::Unauthorized(
            "invalid or expired session".to_owned(),
        ));
    }

    Ok(WidgetSession {
        tenant_id,
        contact_id,
        conversation_id,
        expires_at,
    })
}

// ===========================================================================
// POST /respond — public_respond
// ===========================================================================

/// `POST /v1/sabchat/csat-public/respond` — visitor-side survey
/// submission.
///
/// Body: `{ visitorToken, score, followUpAnswer? }`. The handler
/// recovers tenant / contact / conversation from the widget-session row
/// and the survey id from `conversation.customAttrs.pendingSurveyId`.
/// Score is validated against the survey's `[scaleMin, scaleMax]`.
#[instrument(skip_all)]
pub async fn public_respond(
    State(state): State<SabChatCsatState>,
    Json(body): Json<PublicRespondBody>,
) -> Result<Json<PublicRespondResponse>> {
    let mongo = &state.mongo;
    let session = resolve_session(mongo, &body.visitor_token).await?;
    // `expires_at` is intentionally unused here — the survey-respond
    // path doesn't refresh session TTL the way `post_message` does.
    let _ = session.expires_at;

    // ---- Recover the pending survey id --------------------------------
    let conversations = mongo.collection::<Document>(CONVERSATIONS_COLL);
    let conversation = conversations
        .find_one(doc! {
            "_id": session.conversation_id,
            "tenantId": session.tenant_id,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.find_one(public_respond)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Conversation not found.".to_owned()))?;

    let pending_survey_id: ObjectId = conversation
        .get_document("customAttrs")
        .ok()
        .and_then(|attrs| attrs.get_object_id("pendingSurveyId").ok())
        .ok_or_else(|| {
            ApiError::BadRequest("No pending survey for this conversation.".to_owned())
        })?;

    // ---- Load the survey definition (tenant-scoped) -------------------
    let surveys = mongo.collection::<Document>(SURVEYS_COLL);
    let survey = surveys
        .find_one(doc! {
            "_id": pending_survey_id,
            "tenantId": session.tenant_id,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_surveys.find_one(public_respond)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Survey not found.".to_owned()))?;

    let scale_min = survey.get_i32("scaleMin").map_err(|_| {
        ApiError::Internal(anyhow::anyhow!("survey missing scaleMin"))
    })?;
    let scale_max = survey.get_i32("scaleMax").map_err(|_| {
        ApiError::Internal(anyhow::anyhow!("survey missing scaleMax"))
    })?;

    if body.score < scale_min || body.score > scale_max {
        return Err(ApiError::Validation(format!(
            "Score must be between {scale_min} and {scale_max}."
        )));
    }

    // ---- Insert the response row --------------------------------------
    let response_oid = ObjectId::new();
    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);

    let follow_up: Bson = match body
        .follow_up_answer
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(s) => Bson::String(s.to_owned()),
        None => Bson::Null,
    };

    let response_doc = doc! {
        "_id": response_oid,
        "tenantId": session.tenant_id,
        "surveyId": pending_survey_id,
        "conversationId": session.conversation_id,
        "contactId": session.contact_id,
        "score": body.score,
        "followUpAnswer": follow_up,
        "submittedAt": now_bson,
        "createdAt": now_bson,
    };
    mongo
        .collection::<Document>(RESPONSES_COLL)
        .insert_one(&response_doc)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_survey_responses.insert_one"),
            )
        })?;

    // ---- Update conversation customAttrs ------------------------------
    //
    // Set `customAttrs.csat = { score, max, submittedAt }` and clear the
    // pending stash. We use dotted-path `$set` so we don't clobber any
    // other custom attributes already on the conversation.
    conversations
        .update_one(
            doc! {
                "_id": session.conversation_id,
                "tenantId": session.tenant_id,
            },
            doc! {
                "$set": {
                    "customAttrs.csat": {
                        "score": body.score,
                        "max": scale_max,
                        "submittedAt": now_bson,
                    },
                    "customAttrs.pendingSurveyId": Bson::Null,
                    "updatedAt": now_bson,
                },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(csat_set)"),
            )
        })?;

    Ok(Json(PublicRespondResponse {
        response_id: response_oid.to_hex(),
    }))
}

#[cfg(test)]
mod tests {
    // Live-Mongo paths are exercised by integration tests in `api`;
    // here we keep the unit surface minimal because the public handler
    // is mostly orchestration over collection reads/writes. The pure
    // logic — score-range validation, follow-up-answer trimming — is
    // small enough that the type system carries the contract.

    #[test]
    fn dummy_compiles() {
        // Smoke-test: this module compiles and links against its
        // dependencies. Real coverage lives in the api crate's
        // end-to-end suite.
    }
}
