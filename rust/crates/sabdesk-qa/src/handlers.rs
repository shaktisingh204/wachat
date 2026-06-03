use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use chrono::Utc;
use crate::mock_db::MockDb;
use crate::models::*;

// --- SCORECARDS ---

pub async fn create_scorecard(
    State(db): State<MockDb>,
    Json(mut payload): Json<QaScorecard>,
) -> Result<Json<QaScorecard>, StatusCode> {
    let mut state = db.write().await;
    let id = Uuid::new_v4();
    payload.id = id;
    payload.created_at = Utc::now();
    state.scorecards.insert(id, payload.clone());
    Ok(Json(payload))
}

pub async fn get_scorecard(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<QaScorecard>, StatusCode> {
    let state = db.read().await;
    match state.scorecards.get(&id) {
        Some(s) => Ok(Json(s.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn list_scorecards(
    State(db): State<MockDb>,
) -> Result<Json<Vec<QaScorecard>>, StatusCode> {
    let state = db.read().await;
    let list: Vec<QaScorecard> = state.scorecards.values().cloned().collect();
    Ok(Json(list))
}

pub async fn update_scorecard(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<QaScorecard>,
) -> Result<Json<QaScorecard>, StatusCode> {
    let mut state = db.write().await;
    if let Some(s) = state.scorecards.get_mut(&id) {
        s.name = payload.name;
        s.description = payload.description;
        s.questions = payload.questions;
        s.is_active = payload.is_active;
        Ok(Json(s.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_scorecard(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let mut state = db.write().await;
    if state.scorecards.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn add_question_to_scorecard(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(mut question): Json<Question>,
) -> Result<Json<QaScorecard>, StatusCode> {
    let mut state = db.write().await;
    if let Some(s) = state.scorecards.get_mut(&id) {
        question.id = Uuid::new_v4();
        s.questions.push(question);
        Ok(Json(s.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn remove_question_from_scorecard(
    State(db): State<MockDb>,
    Path((scorecard_id, question_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<QaScorecard>, StatusCode> {
    let mut state = db.write().await;
    if let Some(s) = state.scorecards.get_mut(&scorecard_id) {
        s.questions.retain(|q| q.id != question_id);
        Ok(Json(s.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- EVALUATIONS ---

pub async fn submit_evaluation(
    State(db): State<MockDb>,
    Json(mut payload): Json<TicketEvaluation>,
) -> Result<Json<TicketEvaluation>, StatusCode> {
    let mut state = db.write().await;
    
    // Calculate total score based on scorecard
    let total_score = if let Some(scorecard) = state.scorecards.get(&payload.scorecard_id) {
        let mut score = 0.0;
        for ans in &payload.answers {
            if let Some(q) = scorecard.questions.iter().find(|q| q.id == ans.question_id) {
                score += (ans.score as f32) * q.weight;
            }
        }
        score
    } else {
        return Err(StatusCode::BAD_REQUEST);
    };

    let id = Uuid::new_v4();
    payload.id = id;
    payload.evaluated_at = Utc::now();
    payload.total_score = total_score;
    
    state.evaluations.insert(id, payload.clone());
    Ok(Json(payload))
}

pub async fn get_evaluation(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<TicketEvaluation>, StatusCode> {
    let state = db.read().await;
    match state.evaluations.get(&id) {
        Some(e) => Ok(Json(e.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn list_evaluations(
    State(db): State<MockDb>,
) -> Result<Json<Vec<TicketEvaluation>>, StatusCode> {
    let state = db.read().await;
    let list: Vec<TicketEvaluation> = state.evaluations.values().cloned().collect();
    Ok(Json(list))
}

pub async fn update_evaluation(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<TicketEvaluation>,
) -> Result<Json<TicketEvaluation>, StatusCode> {
    let mut state = db.write().await;
    if let Some(e) = state.evaluations.get_mut(&id) {
        e.answers = payload.answers;
        e.feedback = payload.feedback;
        Ok(Json(e.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_evaluation(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let mut state = db.write().await;
    if state.evaluations.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn calculate_evaluation_score(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<f32>, StatusCode> {
    let mut state = db.write().await;
    if let Some(eval) = state.evaluations.get(&id).cloned() {
        if let Some(scorecard) = state.scorecards.get(&eval.scorecard_id) {
            let mut score = 0.0;
            for ans in &eval.answers {
                if let Some(q) = scorecard.questions.iter().find(|q| q.id == ans.question_id) {
                    score += (ans.score as f32) * q.weight;
                }
            }
            if let Some(e) = state.evaluations.get_mut(&id) {
                e.total_score = score;
            }
            return Ok(Json(score));
        }
    }
    Err(StatusCode::NOT_FOUND)
}

// --- DISPUTES ---

pub async fn raise_dispute(
    State(db): State<MockDb>,
    Json(mut payload): Json<Dispute>,
) -> Result<Json<Dispute>, StatusCode> {
    let mut state = db.write().await;
    if !state.evaluations.contains_key(&payload.evaluation_id) {
        return Err(StatusCode::BAD_REQUEST);
    }
    let id = Uuid::new_v4();
    payload.id = id;
    payload.status = DisputeStatus::Pending;
    payload.created_at = Utc::now();
    payload.updated_at = Utc::now();
    state.disputes.insert(id, payload.clone());
    Ok(Json(payload))
}

pub async fn get_dispute(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<Dispute>, StatusCode> {
    let state = db.read().await;
    match state.disputes.get(&id) {
        Some(d) => Ok(Json(d.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn list_disputes(
    State(db): State<MockDb>,
) -> Result<Json<Vec<Dispute>>, StatusCode> {
    let state = db.read().await;
    let list: Vec<Dispute> = state.disputes.values().cloned().collect();
    Ok(Json(list))
}

pub async fn resolve_dispute(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(resolution): Json<String>,
) -> Result<Json<Dispute>, StatusCode> {
    let mut state = db.write().await;
    if let Some(d) = state.disputes.get_mut(&id) {
        d.status = DisputeStatus::Resolved(resolution.clone());
        d.updated_at = Utc::now();
        Ok(Json(d.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn reject_dispute(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<Dispute>, StatusCode> {
    let mut state = db.write().await;
    if let Some(d) = state.disputes.get_mut(&id) {
        d.status = DisputeStatus::Rejected;
        d.updated_at = Utc::now();
        Ok(Json(d.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- CALIBRATION SESSIONS ---

pub async fn create_calibration_session(
    State(db): State<MockDb>,
    Json(mut payload): Json<CalibrationSession>,
) -> Result<Json<CalibrationSession>, StatusCode> {
    let mut state = db.write().await;
    let id = Uuid::new_v4();
    payload.id = id;
    state.calibration_sessions.insert(id, payload.clone());
    Ok(Json(payload))
}

pub async fn get_calibration_session(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<CalibrationSession>, StatusCode> {
    let state = db.read().await;
    match state.calibration_sessions.get(&id) {
        Some(c) => Ok(Json(c.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn list_calibration_sessions(
    State(db): State<MockDb>,
) -> Result<Json<Vec<CalibrationSession>>, StatusCode> {
    let state = db.read().await;
    let list: Vec<CalibrationSession> = state.calibration_sessions.values().cloned().collect();
    Ok(Json(list))
}

pub async fn complete_calibration_session(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<CalibrationSession>, StatusCode> {
    let mut state = db.write().await;
    if let Some(c) = state.calibration_sessions.get_mut(&id) {
        c.is_completed = true;
        Ok(Json(c.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- SETTINGS ---

pub async fn get_settings(
    State(db): State<MockDb>,
) -> Result<Json<QaSettings>, StatusCode> {
    let state = db.read().await;
    if let Some(settings) = &state.settings {
        Ok(Json(settings.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn update_settings(
    State(db): State<MockDb>,
    Json(mut payload): Json<QaSettings>,
) -> Result<Json<QaSettings>, StatusCode> {
    let mut state = db.write().await;
    payload.id = Uuid::new_v4();
    state.settings = Some(payload.clone());
    Ok(Json(payload))
}
