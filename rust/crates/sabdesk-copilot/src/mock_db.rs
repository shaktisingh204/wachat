use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::*;

#[derive(Debug, Default)]
pub struct MockDb {
    pub training_data: HashMap<Uuid, AiTrainingData>,
    pub suggested_replies: HashMap<Uuid, SuggestedReply>,
    pub summaries: HashMap<Uuid, ConversationSummary>,
    pub sentiments: HashMap<Uuid, SentimentScore>,
    pub deflections: HashMap<Uuid, DeflectionLog>,
}

impl MockDb {
    pub fn new() -> Self {
        Self {
            training_data: HashMap::new(),
            suggested_replies: HashMap::new(),
            summaries: HashMap::new(),
            sentiments: HashMap::new(),
            deflections: HashMap::new(),
        }
    }
}

pub type AppState = Arc<RwLock<MockDb>>;

pub fn create_app_state() -> AppState {
    Arc::new(RwLock::new(MockDb::new()))
}
