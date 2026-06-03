use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum QuestionType {
    Text,
    MultipleChoice,
    Nps,
    Csat,
    Boolean,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Question {
    pub id: Uuid,
    pub title: String,
    pub question_type: QuestionType,
    pub required: bool,
    pub options: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurveyTemplate {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub questions: Vec<Question>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Answer {
    pub question_id: Uuid,
    pub text_answer: Option<String>,
    pub choice_answer: Option<String>,
    pub numeric_answer: Option<i32>,
    pub boolean_answer: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Response {
    pub id: Uuid,
    pub survey_id: Uuid,
    pub user_id: Option<Uuid>,
    pub ticket_id: Option<Uuid>,
    pub answers: Vec<Answer>,
    pub submitted_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NpsScore {
    pub survey_id: Uuid,
    pub score: i32,
    pub promoter_count: u32,
    pub passive_count: u32,
    pub detractor_count: u32,
    pub total_responses: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsatScore {
    pub survey_id: Uuid,
    pub score: f64,
    pub satisfied_count: u32,
    pub total_responses: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSurveyRequest {
    pub name: String,
    pub description: Option<String>,
    pub questions: Vec<QuestionRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestionRequest {
    pub title: String,
    pub question_type: QuestionType,
    pub required: bool,
    pub options: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSurveyRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitResponseRequest {
    pub user_id: Option<Uuid>,
    pub ticket_id: Option<Uuid>,
    pub answers: Vec<Answer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsResponse {
    pub survey_id: Uuid,
    pub total_responses: usize,
    pub nps: Option<NpsScore>,
    pub csat: Option<CsatScore>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkCreateSurveyRequest {
    pub surveys: Vec<CreateSurveyRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkResponse {
    pub created_ids: Vec<Uuid>,
}
