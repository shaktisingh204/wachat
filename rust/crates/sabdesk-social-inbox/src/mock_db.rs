use crate::models::{CommentThread, DirectMessage, Mention, ModerationAction, SocialAccount};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone, Default)]
pub struct AppState {
    pub accounts: Arc<RwLock<HashMap<Uuid, SocialAccount>>>,
    pub mentions: Arc<RwLock<HashMap<Uuid, Mention>>>,
    pub dms: Arc<RwLock<HashMap<Uuid, DirectMessage>>>,
    pub threads: Arc<RwLock<HashMap<Uuid, CommentThread>>>,
    pub mod_actions: Arc<RwLock<HashMap<Uuid, ModerationAction>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self::default()
    }
}
