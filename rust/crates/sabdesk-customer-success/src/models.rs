use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HealthScore {
    pub id: Uuid,
    pub account_id: Uuid,
    pub score: i32,
    pub factors: Vec<ScoreFactor>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScoreFactor {
    pub name: String,
    pub impact: i32,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Account {
    pub id: Uuid,
    pub name: String,
    pub tier: String,
    pub arr: f64,
    pub status: AccountStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum AccountStatus {
    Active,
    AtRisk,
    Churned,
    Onboarding,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QbrTemplate {
    pub id: Uuid,
    pub title: String,
    pub sections: Vec<QbrSection>,
    pub is_default: bool,
    pub created_by: Uuid,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QbrSection {
    pub id: Uuid,
    pub title: String,
    pub content_placeholder: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChurnPrediction {
    pub id: Uuid,
    pub account_id: Uuid,
    pub probability: f64,
    pub risk_factors: Vec<String>,
    pub prediction_date: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SuccessPlan {
    pub id: Uuid,
    pub account_id: Uuid,
    pub title: String,
    pub objectives: Vec<Objective>,
    pub status: PlanStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Objective {
    pub id: Uuid,
    pub description: String,
    pub target_date: DateTime<Utc>,
    pub is_completed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum PlanStatus {
    Draft,
    Active,
    Completed,
    Archived,
}
