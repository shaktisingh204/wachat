//! HTTP handlers for the Survey entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateSurveyInput, CreateSurveyResponse, DeleteSurveyResponse, ListQuery, SurveyQuestionInput,
    UpdateSurveyInput,
};
use crate::types::{CrmSurvey, CrmSurveyQuestion};

const COLL: &str = "crm_surveys";
const ENTITY_KIND: &str = "survey";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" => {
            filter.insert("status", "draft");
        }
        "active" => {
            filter.insert("status", "active");
        }
        "closed" => {
            filter.insert("status", "closed");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn question_from_input(q: SurveyQuestionInput) -> CrmSurveyQuestion {
    CrmSurveyQuestion {
        label: q.label.trim().to_string(),
        question_type: q.question_type,
        required: q.required,
        options: q
            .options
            .into_iter()
            .map(|o| o.trim().to_string())
            .filter(|o| !o.is_empty())
            .collect(),
    }
}

fn entity_from_create(input: CreateSurveyInput, user_id: ObjectId) -> Result<CrmSurvey> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    Ok(CrmSurvey {
        id: None,
        user_id,
        title: input.title.trim().to_string(),
        description: input.description,
        survey_type: input.survey_type,
        questions: input
            .questions
            .into_iter()
            .map(question_from_input)
            .filter(|q| !q.label.is_empty())
            .collect(),
        target_audience: input.target_audience,
        audience_ids: input.audience_ids,
        anonymous: input.anonymous,
        starts_at: input.starts_at.map(BsonDateTime::from_chrono),
        ends_at: input.ends_at.map(BsonDateTime::from_chrono),
        response_count: Some(0),
        status: Some(input.status.unwrap_or_else(|| "draft".to_owned())),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSurveyInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.title {
        set.insert("title", v.trim());
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.survey_type {
        set.insert("type", v);
    }
    if let Some(v) = patch.questions {
        let qs: Vec<CrmSurveyQuestion> = v
            .into_iter()
            .map(question_from_input)
            .filter(|q| !q.label.is_empty())
            .collect();
        let docs: Vec<Bson> = qs
            .iter()
            .filter_map(|q| bson::to_document(q).ok().map(Bson::Document))
            .collect();
        set.insert("questions", Bson::Array(docs));
    }
    if let Some(v) = patch.target_audience {
        set.insert("targetAudience", v);
    }
    if let Some(v) = patch.audience_ids {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("audienceIds", Bson::Array(arr));
    }
    if let Some(v) = patch.anonymous {
        set.insert("anonymous", v);
    }
    if let Some(v) = patch.starts_at {
        set.insert("startsAt", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.ends_at {
        set.insert("endsAt", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.response_count {
        set.insert("responseCount", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmSurvey) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmSurvey>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_surveys(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(t) = q
        .survey_type
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("type", t);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmSurvey>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_surveys.find")))?;
    let mut rows: Vec<CrmSurvey> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_surveys.collect")))?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %survey_id))]
pub async fn get_survey(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(survey_id): Path<String>,
) -> Result<Json<CrmSurvey>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&survey_id)?;
    let coll = mongo.collection::<CrmSurvey>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_surveys.find_one")))?
        .ok_or_else(|| ApiError::NotFound("survey".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_survey(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSurveyInput>,
) -> Result<Json<CreateSurveyResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmSurvey>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_surveys.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateSurveyResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %survey_id))]
pub async fn update_survey(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(survey_id): Path<String>,
    Json(patch): Json<UpdateSurveyInput>,
) -> Result<Json<CrmSurvey>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&survey_id)?;

    let coll = mongo.collection::<CrmSurvey>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_surveys.find_one")))?
        .ok_or_else(|| ApiError::NotFound("survey".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_surveys.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("survey".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_surveys.refetch")))?
        .ok_or_else(|| ApiError::NotFound("survey".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %survey_id))]
pub async fn delete_survey(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(survey_id): Path<String>,
) -> Result<Json<DeleteSurveyResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&survey_id)?;

    let coll = mongo.collection::<CrmSurvey>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_surveys.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("survey".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteSurveyResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn entity_from_create_defaults_to_draft() {
        let user_id = ObjectId::new();
        let input = CreateSurveyInput {
            title: "Q3 Engagement".into(),
            ..Default::default()
        };
        let s = entity_from_create(input, user_id).unwrap();
        assert_eq!(s.status.as_deref(), Some("draft"));
        assert_eq!(s.response_count, Some(0));
    }

    #[test]
    fn entity_from_create_rejects_empty_title() {
        let user_id = ObjectId::new();
        let input = CreateSurveyInput {
            title: "  ".into(),
            ..Default::default()
        };
        assert!(entity_from_create(input, user_id).is_err());
    }

    #[test]
    fn entity_from_create_filters_empty_question_labels() {
        let user_id = ObjectId::new();
        let input = CreateSurveyInput {
            title: "x".into(),
            questions: vec![
                SurveyQuestionInput {
                    label: "How happy are you?".into(),
                    question_type: "rating".into(),
                    required: Some(true),
                    options: vec![],
                },
                SurveyQuestionInput {
                    label: "  ".into(),
                    question_type: "short_text".into(),
                    ..Default::default()
                },
            ],
            ..Default::default()
        };
        let s = entity_from_create(input, user_id).unwrap();
        assert_eq!(s.questions.len(), 1);
        assert_eq!(s.questions[0].question_type, "rating");
    }
}
