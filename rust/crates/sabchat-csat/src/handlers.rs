//! HTTP handlers for the agent-side SabChat CSAT surface.
//!
//! Every handler enforces tenancy by filtering on
//! `tenantId == ObjectId::parse_str(&auth.tenant_id)`. An unparseable
//! subject yields [`ApiError::Unauthorized`]. Cross-tenant reads /
//! writes therefore surface as plain `404`s, since the tenant clause
//! never matches a foreign-tenant document.
//!
//! ## Endpoints
//!
//! | Endpoint                                       | Handler           |
//! |------------------------------------------------|-------------------|
//! | `POST   /v1/sabchat/csat/surveys`              | `create_survey`   |
//! | `GET    /v1/sabchat/csat/surveys`              | `list_surveys`    |
//! | `GET    /v1/sabchat/csat/surveys/{id}`         | `get_survey`      |
//! | `PATCH  /v1/sabchat/csat/surveys/{id}`         | `update_survey`   |
//! | `DELETE /v1/sabchat/csat/surveys/{id}`         | `delete_survey`   |
//! | `POST   /v1/sabchat/csat/send/{conversationId}`| `send_survey`     |
//! | `GET    /v1/sabchat/csat/responses`            | `list_responses`  |
//! | `GET    /v1/sabchat/csat/stats`                | `survey_stats`    |

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabchat_types::content::{ContentBlock, FormField};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateSurveyBody, DEFAULT_LIMIT, ListResponsesQuery, ListResponsesResponse, ListSurveysQuery,
    ListSurveysResponse, MAX_LIMIT, SendSurveyBody, SendSurveyResponse, StatsQuery, StatsResponse,
    SuccessResponse, SurveyKind, SurveyResponse, SurveyTrigger, UpdateSurveyBody,
};
use crate::state::SabChatCsatState;

// ---------------------------------------------------------------------------
// Collection names
// ---------------------------------------------------------------------------

/// Survey definitions.
pub(crate) const SURVEYS_COLL: &str = "sabchat_surveys";

/// One row per visitor submission.
pub(crate) const RESPONSES_COLL: &str = "sabchat_survey_responses";

/// Owned by `sabchat-conversations`; we update `customAttrs` on it.
pub(crate) const CONVERSATIONS_COLL: &str = "sabchat_conversations";

/// Owned by `sabchat-messages`; we append the outbound `Form` block.
pub(crate) const MESSAGES_COLL: &str = "sabchat_messages";

// ===========================================================================
// Shared helpers
// ===========================================================================

/// Parse the calling user's `tenantId` claim into an `ObjectId`. A
/// malformed claim is treated as an auth failure (the JWT was issued by
/// us, so a bad value means a tampered token or a buggy issuer).
pub(crate) fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Map [`SurveyKind`] to its serde snake_case discriminant.
fn kind_to_str(k: SurveyKind) -> &'static str {
    match k {
        SurveyKind::Csat => "csat",
        SurveyKind::Nps => "nps",
        SurveyKind::Ces => "ces",
    }
}

/// Map [`SurveyTrigger`] to its serde snake_case discriminant.
fn trigger_to_str(t: SurveyTrigger) -> &'static str {
    match t {
        SurveyTrigger::OnResolve => "on_resolve",
        SurveyTrigger::Manual => "manual",
    }
}

/// Load one survey, scoped to the caller's tenant. Returns `404` when
/// no matching document exists.
async fn load_survey_scoped(
    mongo: &MongoHandle,
    tenant: ObjectId,
    survey_id_hex: &str,
) -> Result<Document> {
    let survey_oid = oid_from_str(survey_id_hex)?;
    let coll = mongo.collection::<Document>(SURVEYS_COLL);
    coll.find_one(doc! { "_id": survey_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_surveys.find_one(scoped)"))
        })?
        .ok_or_else(|| ApiError::NotFound("Survey not found.".to_owned()))
}

/// Load a tenant-scoped conversation. Used by the send-survey handler
/// to ensure the conversation exists before we append a message to it.
async fn load_conversation_scoped(
    mongo: &MongoHandle,
    tenant: ObjectId,
    conversation_id_hex: &str,
) -> Result<Document> {
    let oid = oid_from_str(conversation_id_hex)?;
    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.find_one(scoped)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Conversation not found.".to_owned()))
}

/// Validate that `[scale_min, scale_max]` is a sane non-empty integer
/// range. We require `scale_min < scale_max` (a single-point scale is
/// not useful) and impose a soft ceiling on the span so we don't blow
/// up the outbound form's options list.
fn validate_scale(min: i32, max: i32) -> Result<()> {
    if min >= max {
        return Err(ApiError::Validation(
            "scaleMin must be strictly less than scaleMax.".to_owned(),
        ));
    }
    if max - min > 100 {
        return Err(ApiError::Validation(
            "Score range is too wide (max span is 100).".to_owned(),
        ));
    }
    Ok(())
}

// ===========================================================================
// POST /surveys — create_survey
// ===========================================================================

/// `POST /v1/sabchat/csat/surveys` — create a new survey definition.
#[instrument(skip_all)]
pub async fn create_survey(
    user: AuthUser,
    State(state): State<SabChatCsatState>,
    Json(body): Json<CreateSurveyBody>,
) -> Result<Json<SurveyResponse>> {
    if body.name.trim().is_empty() {
        return Err(ApiError::Validation("Survey name is required.".to_owned()));
    }
    if body.question.trim().is_empty() {
        return Err(ApiError::Validation("Question is required.".to_owned()));
    }
    validate_scale(body.scale_min, body.scale_max)?;

    let tenant = tenant_oid(&user)?;
    let new_oid = ObjectId::new();
    let now_bson = bson::DateTime::from_chrono(Utc::now());

    let trigger = body.trigger.unwrap_or(SurveyTrigger::Manual);
    let active = body.active.unwrap_or(true);

    let follow_up: Bson = match body
        .follow_up_question
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(s) => Bson::String(s.to_owned()),
        None => Bson::Null,
    };

    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "name": body.name.trim(),
        "kind": kind_to_str(body.kind),
        "scaleMin": body.scale_min,
        "scaleMax": body.scale_max,
        "question": body.question.trim(),
        "followUpQuestion": follow_up,
        "trigger": trigger_to_str(trigger),
        "active": active,
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };

    let coll = state.mongo.collection::<Document>(SURVEYS_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_surveys.insert_one"))
    })?;

    Ok(Json(SurveyResponse {
        survey: document_to_clean_json(new_doc),
    }))
}

// ===========================================================================
// GET /surveys — list_surveys
// ===========================================================================

/// `GET /v1/sabchat/csat/surveys` — list every survey owned by the
/// calling tenant, sorted by `createdAt DESC, _id DESC`.
#[instrument(skip_all)]
pub async fn list_surveys(
    user: AuthUser,
    State(state): State<SabChatCsatState>,
    Query(query): Query<ListSurveysQuery>,
) -> Result<Json<ListSurveysResponse>> {
    let tenant = tenant_oid(&user)?;
    let mut filter = doc! { "tenantId": tenant };

    if let Some(k) = query.kind {
        filter.insert("kind", kind_to_str(k));
    }
    if let Some(active) = query.active {
        filter.insert("active", active);
    }

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1, "_id": -1 })
        .build();

    let coll = state.mongo.collection::<Document>(SURVEYS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_surveys.find")))?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_surveys.collect"))
    })?;

    let surveys: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListSurveysResponse { surveys }))
}

// ===========================================================================
// GET /surveys/{id} — get_survey
// ===========================================================================

/// `GET /v1/sabchat/csat/surveys/{id}` — fetch one survey by id,
/// tenant-scoped.
#[instrument(skip_all, fields(survey_id = %id))]
pub async fn get_survey(
    user: AuthUser,
    State(state): State<SabChatCsatState>,
    Path(id): Path<String>,
) -> Result<Json<SurveyResponse>> {
    let tenant = tenant_oid(&user)?;
    let doc = load_survey_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(SurveyResponse {
        survey: document_to_clean_json(doc),
    }))
}

// ===========================================================================
// PATCH /surveys/{id} — update_survey
// ===========================================================================

/// `PATCH /v1/sabchat/csat/surveys/{id}` — partial update. Every field
/// is optional; the handler only `$set`s keys that are present in the
/// JSON body.
#[instrument(skip_all, fields(survey_id = %id))]
pub async fn update_survey(
    user: AuthUser,
    State(state): State<SabChatCsatState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateSurveyBody>,
) -> Result<Json<SurveyResponse>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_survey_scoped(&state.mongo, tenant, &id).await?;
    let survey_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("survey missing _id")))?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
    };

    if let Some(name) = body.name.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        set.insert("name", name);
    }
    if let Some(k) = body.kind {
        set.insert("kind", kind_to_str(k));
    }
    if let Some(t) = body.trigger {
        set.insert("trigger", trigger_to_str(t));
    }
    if let Some(active) = body.active {
        set.insert("active", active);
    }
    if let Some(q) = body
        .question
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        set.insert("question", q);
    }
    if body.follow_up_question.is_some() {
        // `follow_up_question: null` (or empty string) clears the field;
        // a non-empty string replaces it.
        let v = body.follow_up_question.as_deref().unwrap_or("");
        if v.trim().is_empty() {
            set.insert("followUpQuestion", Bson::Null);
        } else {
            set.insert("followUpQuestion", v.trim());
        }
    }

    // Re-validate the scale only if either bound is being updated.
    let new_min = body.scale_min.or_else(|| existing.get_i32("scaleMin").ok());
    let new_max = body.scale_max.or_else(|| existing.get_i32("scaleMax").ok());
    if body.scale_min.is_some() || body.scale_max.is_some() {
        if let (Some(min), Some(max)) = (new_min, new_max) {
            validate_scale(min, max)?;
        }
        if let Some(min) = body.scale_min {
            set.insert("scaleMin", min);
        }
        if let Some(max) = body.scale_max {
            set.insert("scaleMax", max);
        }
    }

    let coll = state.mongo.collection::<Document>(SURVEYS_COLL);
    coll.update_one(
        doc! { "_id": survey_oid, "tenantId": tenant },
        doc! { "$set": set },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_surveys.update_one"))
    })?;

    let fresh = load_survey_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(SurveyResponse {
        survey: document_to_clean_json(fresh),
    }))
}

// ===========================================================================
// DELETE /surveys/{id} — delete_survey
// ===========================================================================

/// `DELETE /v1/sabchat/csat/surveys/{id}` — hard-delete a survey
/// definition. Responses already collected against the survey are
/// retained (their `surveyId` field will still resolve via `_id` on the
/// reports side; the agent UI can flag orphaned rows).
#[instrument(skip_all, fields(survey_id = %id))]
pub async fn delete_survey(
    user: AuthUser,
    State(state): State<SabChatCsatState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&user)?;
    let survey_oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>(SURVEYS_COLL);
    let res = coll
        .delete_one(doc! { "_id": survey_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_surveys.delete_one"))
        })?;

    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Survey not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /send/{conversationId} — send_survey
// ===========================================================================

/// `POST /v1/sabchat/csat/send/{conversationId}` — dispatch the survey
/// to a conversation.
///
/// Steps:
///
/// 1. Tenancy-scoped load of both the survey and the conversation.
/// 2. Build a [`ContentBlock::Form`] with one required `select` field
///    (the score, options `scale_min..=scale_max`) plus an optional
///    `textarea` field for the follow-up answer.
/// 3. Insert the outbound bot message row into `sabchat_messages`.
/// 4. Stash `customAttrs.pendingSurveyId` on the conversation so the
///    public-respond endpoint can recover it from the visitor session.
#[instrument(skip_all, fields(conversation_id = %conversation_id, survey_id = %body.survey_id))]
pub async fn send_survey(
    user: AuthUser,
    State(state): State<SabChatCsatState>,
    Path(conversation_id): Path<String>,
    Json(body): Json<SendSurveyBody>,
) -> Result<Json<SendSurveyResponse>> {
    let tenant = tenant_oid(&user)?;

    // ---- Load survey + conversation -----------------------------------
    let survey = load_survey_scoped(&state.mongo, tenant, &body.survey_id).await?;
    if !survey.get_bool("active").unwrap_or(true) {
        return Err(ApiError::Validation("Survey is inactive.".to_owned()));
    }

    let conversation = load_conversation_scoped(&state.mongo, tenant, &conversation_id).await?;
    let conversation_oid = conversation
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;
    let inbox_oid = conversation
        .get_object_id("inboxId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing inboxId")))?;
    let contact_oid = conversation
        .get_object_id("contactId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing contactId")))?;

    let survey_oid = survey
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("survey missing _id")))?;
    let scale_min = survey.get_i32("scaleMin").map_err(|_| {
        ApiError::Internal(anyhow::anyhow!("survey missing scaleMin"))
    })?;
    let scale_max = survey.get_i32("scaleMax").map_err(|_| {
        ApiError::Internal(anyhow::anyhow!("survey missing scaleMax"))
    })?;
    let question = survey.get_str("question").unwrap_or_default().to_owned();
    let follow_up_question = survey.get_str("followUpQuestion").ok().map(str::to_owned);

    // ---- Build the form block ------------------------------------------
    let options: Vec<String> = (scale_min..=scale_max).map(|n| n.to_string()).collect();
    let mut fields: Vec<FormField> = Vec::with_capacity(2);
    fields.push(FormField {
        key: "score".to_owned(),
        label: question.clone(),
        kind: "select".to_owned(),
        required: true,
        options,
    });
    if let Some(label) = follow_up_question.as_deref().filter(|s| !s.is_empty()) {
        fields.push(FormField {
            key: "follow_up".to_owned(),
            label: label.to_owned(),
            kind: "textarea".to_owned(),
            required: false,
            options: Vec::new(),
        });
    }
    let content = ContentBlock::Form { fields };
    let content_bson: Bson = bson::to_bson(&content).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("serialize ContentBlock::Form"))
    })?;

    // ---- Insert the outbound bot message ------------------------------
    let message_oid = ObjectId::new();
    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let message_doc = doc! {
        "_id": message_oid,
        "tenantId": tenant,
        "conversationId": conversation_oid,
        "inboxId": inbox_oid,
        "contactId": contact_oid,
        "senderType": "bot",
        "senderId": Bson::Null,
        "direction": "outbound",
        "content": content_bson,
        "attachments": Bson::Array(Vec::new()),
        "providerMetadata": Bson::Document(doc! {
            "csatSurveyId": survey_oid,
        }),
        "private": false,
        "createdAt": now_bson,
    };
    state
        .mongo
        .collection::<Document>(MESSAGES_COLL)
        .insert_one(message_doc)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one(csat)"))
        })?;

    // ---- Stash pendingSurveyId on the conversation --------------------
    let preview = format!("Survey: {question}");
    state
        .mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant },
            doc! {
                "$set": {
                    "customAttrs.pendingSurveyId": survey_oid,
                    "lastMessageAt": now_bson,
                    "lastMessagePreview": preview,
                    "updatedAt": now_bson,
                },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(csat_pending)"),
            )
        })?;

    Ok(Json(SendSurveyResponse {
        message_id: message_oid.to_hex(),
        survey_id: survey_oid.to_hex(),
    }))
}

// ===========================================================================
// GET /responses — list_responses
// ===========================================================================

/// `GET /v1/sabchat/csat/responses` — paginated response list,
/// tenant-scoped.
///
/// Sort order is `submittedAt DESC, _id DESC`; the cursor is the hex
/// `_id` of the last document returned.
#[instrument(skip_all)]
pub async fn list_responses(
    user: AuthUser,
    State(state): State<SabChatCsatState>,
    Query(query): Query<ListResponsesQuery>,
) -> Result<Json<ListResponsesResponse>> {
    let tenant = tenant_oid(&user)?;
    let mut filter = doc! { "tenantId": tenant };

    if let Some(s) = query
        .survey_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("surveyId", oid_from_str(s)?);
    }
    if let Some(c) = query
        .conversation_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("conversationId", oid_from_str(c)?);
    }
    if let Some(cur) = query.cursor.as_deref().filter(|s| !s.is_empty()) {
        let cursor_oid = oid_from_str(cur)?;
        filter.insert("_id", doc! { "$lt": cursor_oid });
    }

    let limit = query
        .limit
        .filter(|n| *n > 0)
        .unwrap_or(DEFAULT_LIMIT)
        .min(MAX_LIMIT);

    let opts = FindOptions::builder()
        .sort(doc! { "submittedAt": -1, "_id": -1 })
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<Document>(RESPONSES_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_survey_responses.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_survey_responses.collect"))
    })?;

    let next_cursor = if (docs.len() as i64) >= limit {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|oid| oid.to_hex())
    } else {
        None
    };

    let responses: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListResponsesResponse {
        responses,
        next_cursor,
    }))
}

// ===========================================================================
// GET /stats — survey_stats
// ===========================================================================

/// `GET /v1/sabchat/csat/stats` — aggregate count, mean, and per-score
/// distribution over an optional `[from, to]` time window.
///
/// Implemented as a single Mongo collection scan with an in-process
/// reduce — we don't need an aggregation pipeline at the volumes a
/// per-tenant survey accumulates (thousands at most per month).
#[instrument(skip_all, fields(survey_id = %query.survey_id))]
pub async fn survey_stats(
    user: AuthUser,
    State(state): State<SabChatCsatState>,
    Query(query): Query<StatsQuery>,
) -> Result<Json<StatsResponse>> {
    let tenant = tenant_oid(&user)?;
    let survey_oid = oid_from_str(&query.survey_id)?;

    let mut filter = doc! {
        "tenantId": tenant,
        "surveyId": survey_oid,
    };

    if query.from.is_some() || query.to.is_some() {
        let mut range = Document::new();
        if let Some(s) = query.from.as_deref().filter(|s| !s.is_empty()) {
            let dt: DateTime<Utc> = DateTime::parse_from_rfc3339(s)
                .map_err(|e| {
                    ApiError::Validation(format!("Invalid `from` (RFC3339 expected): {e}"))
                })?
                .with_timezone(&Utc);
            range.insert("$gte", bson::DateTime::from_chrono(dt));
        }
        if let Some(s) = query.to.as_deref().filter(|s| !s.is_empty()) {
            let dt: DateTime<Utc> = DateTime::parse_from_rfc3339(s)
                .map_err(|e| ApiError::Validation(format!("Invalid `to` (RFC3339 expected): {e}")))?
                .with_timezone(&Utc);
            range.insert("$lte", bson::DateTime::from_chrono(dt));
        }
        filter.insert("submittedAt", range);
    }

    let coll = state.mongo.collection::<Document>(RESPONSES_COLL);
    let cursor = coll.find(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_survey_responses.find(stats)"))
    })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_survey_responses.collect(stats)"),
        )
    })?;

    let mut count: u64 = 0;
    let mut sum: i64 = 0;
    let mut distribution: serde_json::Map<String, Value> = serde_json::Map::new();
    for d in &docs {
        let score = d
            .get_i32("score")
            .or_else(|_| d.get_i64("score").map(|n| n as i32))
            .ok();
        if let Some(s) = score {
            count += 1;
            sum += s as i64;
            let key = s.to_string();
            let next = distribution
                .get(&key)
                .and_then(Value::as_i64)
                .unwrap_or(0)
                + 1;
            distribution.insert(key, Value::from(next));
        }
    }
    let mean = if count > 0 {
        Some(sum as f64 / count as f64)
    } else {
        None
    };

    Ok(Json(StatsResponse {
        count,
        mean,
        distribution,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kind_to_str_matches_serde_discriminants() {
        assert_eq!(kind_to_str(SurveyKind::Csat), "csat");
        assert_eq!(kind_to_str(SurveyKind::Nps), "nps");
        assert_eq!(kind_to_str(SurveyKind::Ces), "ces");
    }

    #[test]
    fn trigger_to_str_matches_serde_discriminants() {
        assert_eq!(trigger_to_str(SurveyTrigger::OnResolve), "on_resolve");
        assert_eq!(trigger_to_str(SurveyTrigger::Manual), "manual");
    }

    #[test]
    fn validate_scale_rejects_empty_range() {
        assert!(validate_scale(5, 5).is_err());
        assert!(validate_scale(5, 4).is_err());
    }

    #[test]
    fn validate_scale_accepts_standard_ranges() {
        assert!(validate_scale(1, 5).is_ok()); // CSAT
        assert!(validate_scale(0, 10).is_ok()); // NPS
        assert!(validate_scale(1, 7).is_ok()); // CES
    }
}
