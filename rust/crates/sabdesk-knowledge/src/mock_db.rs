use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::{Announcement, Article, Author, Category, Comment, Revision};

#[derive(Debug, Default)]
pub struct AppStateInner {
    pub categories: HashMap<Uuid, Category>,
    pub articles: HashMap<Uuid, Article>,
    pub revisions: HashMap<Uuid, Revision>,
    pub authors: HashMap<Uuid, Author>,
    pub comments: HashMap<Uuid, Comment>,
    pub announcements: HashMap<Uuid, Announcement>,
}

pub type AppState = Arc<RwLock<AppStateInner>>;

pub fn create_mock_db() -> AppState {
    Arc::new(RwLock::new(AppStateInner::default()))
}
