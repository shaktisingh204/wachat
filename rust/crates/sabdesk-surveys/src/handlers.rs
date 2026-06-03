use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;

use crate::mock_db::AppState;
use crate::models::*;

// 1. Create Survey
pub async fn create_survey(
    State(state): State<AppState>,
    Json(payload): Json<CreateSurveyRequest>,
) -> Result<(StatusCode, Json<SurveyTemplate>), StatusCode> {
    let survey_id = Uuid::new_v4();
    let questions = payload
        .questions
        .into_iter()
        .map(|q| Question {
            id: Uuid::new_v4(),
            title: q.title,
            question_type: q.question_type,
            required: q.required,
            options: q.options,
        })
        .collect();

    let survey = SurveyTemplate {
        id: survey_id,
        name: payload.name,
        description: payload.description,
        questions,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        active: true,
    };

    state
        .surveys
        .write()
        .await
        .insert(survey_id, survey.clone());
    Ok((StatusCode::CREATED, Json(survey)))
}

// 2. Get Survey
pub async fn get_survey(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<SurveyTemplate>, StatusCode> {
    let surveys = state.surveys.read().await;
    match surveys.get(&id) {
        Some(survey) => Ok(Json(survey.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

// 3. List Surveys
pub async fn list_surveys(State(state): State<AppState>) -> Json<Vec<SurveyTemplate>> {
    let surveys = state.surveys.read().await;
    Json(surveys.values().cloned().collect())
}

// 4. Update Survey
pub async fn update_survey(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSurveyRequest>,
) -> Result<Json<SurveyTemplate>, StatusCode> {
    let mut surveys = state.surveys.write().await;
    if let Some(survey) = surveys.get_mut(&id) {
        if let Some(name) = payload.name {
            survey.name = name;
        }
        if let Some(desc) = payload.description {
            survey.description = Some(desc);
        }
        if let Some(active) = payload.active {
            survey.active = active;
        }
        survey.updated_at = Utc::now();
        Ok(Json(survey.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 5. Delete Survey
pub async fn delete_survey(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let mut surveys = state.surveys.write().await;
    if surveys.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 6. Deactivate Survey
pub async fn deactivate_survey(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<SurveyTemplate>, StatusCode> {
    let mut surveys = state.surveys.write().await;
    if let Some(survey) = surveys.get_mut(&id) {
        survey.active = false;
        survey.updated_at = Utc::now();
        Ok(Json(survey.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 7. Activate Survey
pub async fn activate_survey(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<SurveyTemplate>, StatusCode> {
    let mut surveys = state.surveys.write().await;
    if let Some(survey) = surveys.get_mut(&id) {
        survey.active = true;
        survey.updated_at = Utc::now();
        Ok(Json(survey.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 8. Bulk Create Surveys
pub async fn bulk_create_surveys(
    State(state): State<AppState>,
    Json(payload): Json<BulkCreateSurveyRequest>,
) -> Result<(StatusCode, Json<BulkResponse>), StatusCode> {
    let mut created_ids = Vec::new();
    let mut surveys = state.surveys.write().await;

    for req in payload.surveys {
        let survey_id = Uuid::new_v4();
        let questions = req
            .questions
            .into_iter()
            .map(|q| Question {
                id: Uuid::new_v4(),
                title: q.title,
                question_type: q.question_type,
                required: q.required,
                options: q.options,
            })
            .collect();

        let survey = SurveyTemplate {
            id: survey_id,
            name: req.name,
            description: req.description,
            questions,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            active: true,
        };
        surveys.insert(survey_id, survey);
        created_ids.push(survey_id);
    }

    Ok((StatusCode::CREATED, Json(BulkResponse { created_ids })))
}

// 9. Submit Response
pub async fn submit_response(
    State(state): State<AppState>,
    Path(survey_id): Path<Uuid>,
    Json(payload): Json<SubmitResponseRequest>,
) -> Result<(StatusCode, Json<Response>), StatusCode> {
    {
        let surveys = state.surveys.read().await;
        if !surveys.contains_key(&survey_id) {
            return Err(StatusCode::NOT_FOUND);
        }
    }

    let response_id = Uuid::new_v4();
    let response = Response {
        id: response_id,
        survey_id,
        user_id: payload.user_id,
        ticket_id: payload.ticket_id,
        answers: payload.answers,
        submitted_at: Utc::now(),
    };

    state
        .responses
        .write()
        .await
        .insert(response_id, response.clone());
    Ok((StatusCode::CREATED, Json(response)))
}

// 10. Get Response
pub async fn get_response(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Response>, StatusCode> {
    let responses = state.responses.read().await;
    match responses.get(&id) {
        Some(resp) => Ok(Json(resp.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

// 11. List Responses For Survey
pub async fn list_responses_for_survey(
    State(state): State<AppState>,
    Path(survey_id): Path<Uuid>,
) -> Json<Vec<Response>> {
    let responses = state.responses.read().await;
    let filtered = responses
        .values()
        .filter(|r| r.survey_id == survey_id)
        .cloned()
        .collect();
    Json(filtered)
}

// 12. List All Responses
pub async fn list_all_responses(State(state): State<AppState>) -> Json<Vec<Response>> {
    let responses = state.responses.read().await;
    Json(responses.values().cloned().collect())
}

// 13. Delete Response
pub async fn delete_response(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let mut responses = state.responses.write().await;
    if responses.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 14. Get Survey Analytics
pub async fn get_survey_analytics(
    State(state): State<AppState>,
    Path(survey_id): Path<Uuid>,
) -> Result<Json<AnalyticsResponse>, StatusCode> {
    let surveys = state.surveys.read().await;
    let survey = surveys.get(&survey_id).ok_or(StatusCode::NOT_FOUND)?;

    let responses = state.responses.read().await;
    let survey_responses: Vec<_> = responses
        .values()
        .filter(|r| r.survey_id == survey_id)
        .collect();

    let total_responses = survey_responses.len();
    if total_responses == 0 {
        return Ok(Json(AnalyticsResponse {
            survey_id,
            total_responses: 0,
            nps: None,
            csat: None,
        }));
    }

    let mut nps = None;
    let mut csat = None;

    if let Some(nps_q) = survey
        .questions
        .iter()
        .find(|q| matches!(q.question_type, QuestionType::Nps))
    {
        let mut promoters = 0;
        let mut passives = 0;
        let mut detractors = 0;
        let mut total_nps_responses = 0;

        for r in &survey_responses {
            if let Some(ans) = r.answers.iter().find(|a| a.question_id == nps_q.id) {
                if let Some(score) = ans.numeric_answer {
                    total_nps_responses += 1;
                    if score >= 9 {
                        promoters += 1;
                    } else if score >= 7 {
                        passives += 1;
                    } else {
                        detractors += 1;
                    }
                }
            }
        }

        if total_nps_responses > 0 {
            let score = ((promoters as f64 - detractors as f64) / total_nps_responses as f64
                * 100.0) as i32;
            nps = Some(NpsScore {
                survey_id,
                score,
                promoter_count: promoters,
                passive_count: passives,
                detractor_count: detractors,
                total_responses: total_nps_responses,
            });
        }
    }

    if let Some(csat_q) = survey
        .questions
        .iter()
        .find(|q| matches!(q.question_type, QuestionType::Csat))
    {
        let mut satisfied = 0;
        let mut total_csat_responses = 0;

        for r in &survey_responses {
            if let Some(ans) = r.answers.iter().find(|a| a.question_id == csat_q.id) {
                if let Some(score) = ans.numeric_answer {
                    total_csat_responses += 1;
                    if score >= 4 {
                        satisfied += 1;
                    }
                }
            }
        }

        if total_csat_responses > 0 {
            let score = (satisfied as f64 / total_csat_responses as f64) * 100.0;
            csat = Some(CsatScore {
                survey_id,
                score,
                satisfied_count: satisfied,
                total_responses: total_csat_responses,
            });
        }
    }

    Ok(Json(AnalyticsResponse {
        survey_id,
        total_responses,
        nps,
        csat,
    }))
}

// 15. Get NPS Analytics
pub async fn get_nps_analytics(
    State(state): State<AppState>,
    Path(survey_id): Path<Uuid>,
) -> Result<Json<NpsScore>, StatusCode> {
    let analytics = get_survey_analytics(State(state.clone()), Path(survey_id)).await?;
    if let Some(nps) = analytics.0.nps {
        Ok(Json(nps))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 16. Get CSAT Analytics
pub async fn get_csat_analytics(
    State(state): State<AppState>,
    Path(survey_id): Path<Uuid>,
) -> Result<Json<CsatScore>, StatusCode> {
    let analytics = get_survey_analytics(State(state.clone()), Path(survey_id)).await?;
    if let Some(csat) = analytics.0.csat {
        Ok(Json(csat))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

#[derive(Deserialize)]
pub struct StatusQuery {
    pub active: bool,
}

// 17. List Surveys By Status
pub async fn list_surveys_by_status(
    State(state): State<AppState>,
    Query(query): Query<StatusQuery>,
) -> Json<Vec<SurveyTemplate>> {
    let surveys = state.surveys.read().await;
    let filtered = surveys
        .values()
        .filter(|s| s.active == query.active)
        .cloned()
        .collect();
    Json(filtered)
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub query: String,
}

// 18. Search Surveys
pub async fn search_surveys(
    State(state): State<AppState>,
    Query(q): Query<SearchQuery>,
) -> Json<Vec<SurveyTemplate>> {
    let surveys = state.surveys.read().await;
    let filtered = surveys
        .values()
        .filter(|s| s.name.to_lowercase().contains(&q.query.to_lowercase()))
        .cloned()
        .collect();
    Json(filtered)
}

// 19. Get Responses By User
pub async fn get_responses_by_user(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Json<Vec<Response>> {
    let responses = state.responses.read().await;
    let filtered = responses
        .values()
        .filter(|r| r.user_id == Some(user_id))
        .cloned()
        .collect();
    Json(filtered)
}

// 20. Get Responses By Ticket
pub async fn get_responses_by_ticket(
    State(state): State<AppState>,
    Path(ticket_id): Path<Uuid>,
) -> Json<Vec<Response>> {
    let responses = state.responses.read().await;
    let filtered = responses
        .values()
        .filter(|r| r.ticket_id == Some(ticket_id))
        .cloned()
        .collect();
    Json(filtered)
}
