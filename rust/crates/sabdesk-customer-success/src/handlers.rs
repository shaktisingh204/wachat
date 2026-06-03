use crate::mock_db::MockDb;
use crate::models::*;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

pub async fn create_account(
    State(db): State<Arc<MockDb>>,
    Json(mut payload): Json<Account>,
) -> (StatusCode, Json<Account>) {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();
    payload.updated_at = Utc::now();
    db.accounts
        .write()
        .await
        .insert(payload.id, payload.clone());
    (StatusCode::CREATED, Json(payload))
}

pub async fn get_account(
    State(db): State<Arc<MockDb>>,
    Path(id): Path<Uuid>,
) -> Result<Json<Account>, StatusCode> {
    let accounts = db.accounts.read().await;
    accounts
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_accounts(State(db): State<Arc<MockDb>>) -> Json<Vec<Account>> {
    let accounts = db.accounts.read().await;
    Json(accounts.values().cloned().collect())
}

pub async fn update_account(
    State(db): State<Arc<MockDb>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<Account>,
) -> Result<Json<Account>, StatusCode> {
    let mut accounts = db.accounts.write().await;
    if let Some(account) = accounts.get_mut(&id) {
        account.name = payload.name;
        account.tier = payload.tier;
        account.arr = payload.arr;
        account.status = payload.status;
        account.updated_at = Utc::now();
        Ok(Json(account.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_account(State(db): State<Arc<MockDb>>, Path(id): Path<Uuid>) -> StatusCode {
    let mut accounts = db.accounts.write().await;
    if accounts.remove(&id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn sync_account(
    State(db): State<Arc<MockDb>>,
    Path(id): Path<Uuid>,
) -> Result<Json<Account>, StatusCode> {
    let mut accounts = db.accounts.write().await;
    if let Some(account) = accounts.get_mut(&id) {
        account.updated_at = Utc::now();
        // Mock external sync
        account.arr += 100.0;
        Ok(Json(account.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn create_health_score(
    State(db): State<Arc<MockDb>>,
    Json(mut payload): Json<HealthScore>,
) -> (StatusCode, Json<HealthScore>) {
    payload.id = Uuid::new_v4();
    payload.timestamp = Utc::now();
    db.health_scores
        .write()
        .await
        .insert(payload.id, payload.clone());
    (StatusCode::CREATED, Json(payload))
}

pub async fn get_health_score(
    State(db): State<Arc<MockDb>>,
    Path(id): Path<Uuid>,
) -> Result<Json<HealthScore>, StatusCode> {
    let scores = db.health_scores.read().await;
    scores
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_account_health_scores(
    State(db): State<Arc<MockDb>>,
    Path(account_id): Path<Uuid>,
) -> Json<Vec<HealthScore>> {
    let scores = db.health_scores.read().await;
    let filtered = scores
        .values()
        .filter(|s| s.account_id == account_id)
        .cloned()
        .collect();
    Json(filtered)
}

pub async fn calculate_health_score(
    State(db): State<Arc<MockDb>>,
    Path(account_id): Path<Uuid>,
) -> Result<Json<HealthScore>, StatusCode> {
    let accounts = db.accounts.read().await;
    if !accounts.contains_key(&account_id) {
        return Err(StatusCode::NOT_FOUND);
    }

    let score = HealthScore {
        id: Uuid::new_v4(),
        account_id,
        score: 85, // Mock calculation
        factors: vec![
            ScoreFactor {
                name: "Usage".to_string(),
                impact: 20,
                description: Some("High usage".to_string()),
            },
            ScoreFactor {
                name: "Support Tickets".to_string(),
                impact: -5,
                description: Some("Few bugs".to_string()),
            },
        ],
        timestamp: Utc::now(),
    };

    db.health_scores
        .write()
        .await
        .insert(score.id, score.clone());
    Ok(Json(score))
}

pub async fn create_qbr_template(
    State(db): State<Arc<MockDb>>,
    Json(mut payload): Json<QbrTemplate>,
) -> (StatusCode, Json<QbrTemplate>) {
    payload.id = Uuid::new_v4();
    for section in &mut payload.sections {
        section.id = Uuid::new_v4();
    }
    db.qbr_templates
        .write()
        .await
        .insert(payload.id, payload.clone());
    (StatusCode::CREATED, Json(payload))
}

pub async fn get_qbr_template(
    State(db): State<Arc<MockDb>>,
    Path(id): Path<Uuid>,
) -> Result<Json<QbrTemplate>, StatusCode> {
    let templates = db.qbr_templates.read().await;
    templates
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_qbr_templates(State(db): State<Arc<MockDb>>) -> Json<Vec<QbrTemplate>> {
    let templates = db.qbr_templates.read().await;
    Json(templates.values().cloned().collect())
}

pub async fn predict_churn(
    State(db): State<Arc<MockDb>>,
    Path(account_id): Path<Uuid>,
) -> Result<Json<ChurnPrediction>, StatusCode> {
    let accounts = db.accounts.read().await;
    if !accounts.contains_key(&account_id) {
        return Err(StatusCode::NOT_FOUND);
    }

    let prediction = ChurnPrediction {
        id: Uuid::new_v4(),
        account_id,
        probability: 0.15, // Mock probability
        risk_factors: vec!["Low engagement".to_string(), "Overdue invoice".to_string()],
        prediction_date: Utc::now(),
    };

    db.churn_predictions
        .write()
        .await
        .insert(prediction.id, prediction.clone());
    Ok(Json(prediction))
}

pub async fn get_churn_prediction(
    State(db): State<Arc<MockDb>>,
    Path(id): Path<Uuid>,
) -> Result<Json<ChurnPrediction>, StatusCode> {
    let predictions = db.churn_predictions.read().await;
    predictions
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn create_success_plan(
    State(db): State<Arc<MockDb>>,
    Json(mut payload): Json<SuccessPlan>,
) -> (StatusCode, Json<SuccessPlan>) {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();
    payload.updated_at = Utc::now();
    for obj in &mut payload.objectives {
        obj.id = Uuid::new_v4();
    }
    db.success_plans
        .write()
        .await
        .insert(payload.id, payload.clone());
    (StatusCode::CREATED, Json(payload))
}

pub async fn get_success_plan(
    State(db): State<Arc<MockDb>>,
    Path(id): Path<Uuid>,
) -> Result<Json<SuccessPlan>, StatusCode> {
    let plans = db.success_plans.read().await;
    plans
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_account_success_plans(
    State(db): State<Arc<MockDb>>,
    Path(account_id): Path<Uuid>,
) -> Json<Vec<SuccessPlan>> {
    let plans = db.success_plans.read().await;
    let filtered = plans
        .values()
        .filter(|p| p.account_id == account_id)
        .cloned()
        .collect();
    Json(filtered)
}

pub async fn update_success_plan(
    State(db): State<Arc<MockDb>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SuccessPlan>,
) -> Result<Json<SuccessPlan>, StatusCode> {
    let mut plans = db.success_plans.write().await;
    if let Some(plan) = plans.get_mut(&id) {
        plan.title = payload.title;
        plan.objectives = payload.objectives;
        plan.status = payload.status;
        plan.updated_at = Utc::now();
        Ok(Json(plan.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn complete_success_plan(
    State(db): State<Arc<MockDb>>,
    Path(id): Path<Uuid>,
) -> Result<Json<SuccessPlan>, StatusCode> {
    let mut plans = db.success_plans.write().await;
    if let Some(plan) = plans.get_mut(&id) {
        plan.status = PlanStatus::Completed;
        plan.updated_at = Utc::now();
        Ok(Json(plan.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
