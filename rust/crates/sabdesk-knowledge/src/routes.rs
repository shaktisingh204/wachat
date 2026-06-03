use axum::{
    routing::{get, post, put},
    Router,
};

use crate::{
    handlers::*,
    mock_db::AppState,
};

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/categories", get(get_categories).post(create_category))
        .route("/categories/:id", get(get_category).put(update_category).delete(delete_category))
        
        .route("/articles", get(get_articles).post(create_article))
        .route("/articles/search", get(search_articles))
        .route("/articles/:id", get(get_article).put(update_article).delete(delete_article))
        .route("/articles/:id/publish", post(publish_article))
        
        .route("/articles/:id/revisions", get(get_article_revisions))
        .route("/articles/:id/revisions/:rev_id/revert", post(revert_article_revision))
        
        .route("/authors", get(get_authors).post(create_author))
        
        .route("/comments", post(add_comment))
        .route("/articles/:id/comments", get(get_article_comments))
        .route("/comments/:id/moderate", put(moderate_comment))
        
        .route("/announcements", get(get_active_announcements).post(create_announcement))
        
        .with_state(state)
}
