use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Question {
    pub id: Uuid,
    pub text: String,
    pub max_score: u32,
    pub weight: f32,
    pub category: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QaScorecard {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub questions: Vec<Question>,
    pub created_at: DateTime<Utc>,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Answer {
    pub question_id: Uuid,
    pub score: u32,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TicketEvaluation {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub evaluator_id: Uuid,
    pub agent_id: Uuid,
    pub scorecard_id: Uuid,
    pub answers: Vec<Answer>,
    pub total_score: f32,
    pub feedback: Option<String>,
    pub evaluated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum DisputeStatus {
    Pending,
    UnderReview,
    Resolved(String),
    Rejected,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Dispute {
    pub id: Uuid,
    pub evaluation_id: Uuid,
    pub agent_id: Uuid,
    pub reason: String,
    pub status: DisputeStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalibrationSession {
    pub id: Uuid,
    pub name: String,
    pub ticket_ids: Vec<Uuid>,
    pub participants: Vec<Uuid>,
    pub scorecard_id: Uuid,
    pub scheduled_at: DateTime<Utc>,
    pub is_completed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QaSettings {
    pub id: Uuid,
    pub auto_assign_evaluations: bool,
    pub evaluations_per_agent_per_week: u32,
    pub require_dispute_approval: bool,
}
