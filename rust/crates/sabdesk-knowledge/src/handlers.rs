use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;

use uuid::Uuid;
use serde::Deserialize;

use crate::{
    mock_db::AppState,
    models::{
        Announcement, Article, ArticleStatus, Author, Category, Comment, CommentStatus, CreateAnnouncementRequest, CreateArticleRequest, CreateCategoryRequest, CreateCommentRequest, ModerateCommentRequest, Revision, UpdateArticleRequest
    },
};

// 1. Create Category
pub async fn create_category(
    State(state): State<AppState>,
    Json(payload): Json<CreateCategoryRequest>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    let category = Category {
        id: Uuid::new_v4(),
        parent_id: payload.parent_id,
        name: payload.name,
        description: payload.description,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    db.categories.insert(category.id, category.clone());
    (StatusCode::CREATED, Json(category))
}

// 2. Get Categories
pub async fn get_categories(State(state): State<AppState>) -> impl IntoResponse {
    let db = state.read().await;
    let categories: Vec<Category> = db.categories.values().cloned().collect();
    (StatusCode::OK, Json(categories))
}

// 3. Get Category
pub async fn get_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let db = state.read().await;
    match db.categories.get(&id) {
        Some(category) => (StatusCode::OK, Json(category.clone())).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

// 4. Update Category
#[derive(Deserialize)]
pub struct UpdateCategoryRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub parent_id: Option<Uuid>,
}

pub async fn update_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCategoryRequest>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    if let Some(category) = db.categories.get_mut(&id) {
        if let Some(name) = payload.name {
            category.name = name;
        }
        if let Some(desc) = payload.description {
            category.description = Some(desc);
        }
        if let Some(pid) = payload.parent_id {
            category.parent_id = Some(pid);
        }
        category.updated_at = Utc::now();
        (StatusCode::OK, Json(category.clone())).into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

// 5. Delete Category
pub async fn delete_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    if db.categories.remove(&id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// 6. Create Article
pub async fn create_article(
    State(state): State<AppState>,
    Json(payload): Json<CreateArticleRequest>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    let article = Article {
        id: Uuid::new_v4(),
        category_id: payload.category_id,
        title: payload.title.clone(),
        slug: payload.slug,
        content: payload.content.clone(),
        status: ArticleStatus::Draft,
        author_id: payload.author_id,
        tags: payload.tags,
        view_count: 0,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        published_at: None,
    };
    db.articles.insert(article.id, article.clone());

    // Create initial revision
    let revision = Revision {
        id: Uuid::new_v4(),
        article_id: article.id,
        author_id: payload.author_id,
        content_snapshot: payload.content,
        title_snapshot: payload.title,
        commit_message: Some("Initial Draft".to_string()),
        created_at: Utc::now(),
    };
    db.revisions.insert(revision.id, revision);

    (StatusCode::CREATED, Json(article))
}

// 7. Get Articles (with simple query filter)
#[derive(Deserialize)]
pub struct ArticleQuery {
    pub category_id: Option<Uuid>,
}

pub async fn get_articles(
    State(state): State<AppState>,
    Query(query): Query<ArticleQuery>,
) -> impl IntoResponse {
    let db = state.read().await;
    let mut articles: Vec<Article> = db.articles.values().cloned().collect();
    
    if let Some(cid) = query.category_id {
        articles.retain(|a| a.category_id == cid);
    }
    
    (StatusCode::OK, Json(articles))
}

// 8. Get Article
pub async fn get_article(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    if let Some(article) = db.articles.get_mut(&id) {
        article.view_count += 1; // simple analytics
        let cloned_article = article.clone();
        (StatusCode::OK, Json(cloned_article)).into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

// 9. Update Article (Creates new revision)
pub async fn update_article(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateArticleRequest>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    
    let mut current_snapshot: Option<(String, String, Uuid)> = None;

    if let Some(article) = db.articles.get_mut(&id) {
        if let Some(title) = payload.title.clone() {
            article.title = title;
        }
        if let Some(slug) = payload.slug {
            article.slug = slug;
        }
        if let Some(content) = payload.content.clone() {
            article.content = content;
        }
        if let Some(status) = payload.status {
            article.status = status;
        }
        if let Some(tags) = payload.tags {
            article.tags = tags;
        }
        article.updated_at = Utc::now();

        current_snapshot = Some((article.title.clone(), article.content.clone(), article.author_id));
    }

    if let Some((title_snap, content_snap, author_id)) = current_snapshot {
        let revision = Revision {
            id: Uuid::new_v4(),
            article_id: id,
            author_id,
            content_snapshot: content_snap,
            title_snapshot: title_snap,
            commit_message: Some("Article updated via API".to_string()),
            created_at: Utc::now(),
        };
        db.revisions.insert(revision.id, revision);
        
        let article_res = db.articles.get(&id).unwrap().clone();
        (StatusCode::OK, Json(article_res)).into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

// 10. Publish Article
pub async fn publish_article(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    if let Some(article) = db.articles.get_mut(&id) {
        article.status = ArticleStatus::Published;
        article.published_at = Some(Utc::now());
        article.updated_at = Utc::now();
        (StatusCode::OK, Json(article.clone())).into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

// 11. Delete Article
pub async fn delete_article(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    if db.articles.remove(&id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// 12. Get Article Revisions
pub async fn get_article_revisions(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let db = state.read().await;
    let mut revisions: Vec<Revision> = db.revisions
        .values()
        .filter(|r| r.article_id == id)
        .cloned()
        .collect();
    revisions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    (StatusCode::OK, Json(revisions))
}

// 13. Revert Article Revision
pub async fn revert_article_revision(
    State(state): State<AppState>,
    Path((article_id, revision_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    
    let rev_snapshot = db.revisions.get(&revision_id).cloned();
    
    if let Some(rev) = rev_snapshot {
        if rev.article_id != article_id {
            return StatusCode::BAD_REQUEST.into_response();
        }
        if let Some(article) = db.articles.get_mut(&article_id) {
            article.title = rev.title_snapshot;
            article.content = rev.content_snapshot;
            article.updated_at = Utc::now();
            return (StatusCode::OK, Json(article.clone())).into_response();
        }
    }
    StatusCode::NOT_FOUND.into_response()
}

// 14. Create Author
#[derive(Deserialize)]
pub struct CreateAuthorRequest {
    pub name: String,
    pub email: String,
    pub bio: Option<String>,
    pub role: String,
}

pub async fn create_author(
    State(state): State<AppState>,
    Json(payload): Json<CreateAuthorRequest>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    let author = Author {
        id: Uuid::new_v4(),
        name: payload.name,
        email: payload.email,
        bio: payload.bio,
        role: payload.role,
    };
    db.authors.insert(author.id, author.clone());
    (StatusCode::CREATED, Json(author))
}

// 15. Get Authors
pub async fn get_authors(State(state): State<AppState>) -> impl IntoResponse {
    let db = state.read().await;
    let authors: Vec<Author> = db.authors.values().cloned().collect();
    (StatusCode::OK, Json(authors))
}

// 16. Add Comment
pub async fn add_comment(
    State(state): State<AppState>,
    Json(payload): Json<CreateCommentRequest>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    let comment = Comment {
        id: Uuid::new_v4(),
        article_id: payload.article_id,
        user_id: payload.user_id,
        content: payload.content,
        status: CommentStatus::Pending,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    db.comments.insert(comment.id, comment.clone());
    (StatusCode::CREATED, Json(comment))
}

// 17. Get Article Comments
pub async fn get_article_comments(
    State(state): State<AppState>,
    Path(article_id): Path<Uuid>,
) -> impl IntoResponse {
    let db = state.read().await;
    let comments: Vec<Comment> = db.comments
        .values()
        .filter(|c| c.article_id == article_id && c.status == CommentStatus::Approved)
        .cloned()
        .collect();
    (StatusCode::OK, Json(comments))
}

// 18. Moderate Comment
pub async fn moderate_comment(
    State(state): State<AppState>,
    Path(comment_id): Path<Uuid>,
    Json(payload): Json<ModerateCommentRequest>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    if let Some(comment) = db.comments.get_mut(&comment_id) {
        comment.status = payload.status;
        comment.updated_at = Utc::now();
        (StatusCode::OK, Json(comment.clone())).into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

// 19. Create Announcement
pub async fn create_announcement(
    State(state): State<AppState>,
    Json(payload): Json<CreateAnnouncementRequest>,
) -> impl IntoResponse {
    let mut db = state.write().await;
    let ann = Announcement {
        id: Uuid::new_v4(),
        title: payload.title,
        content: payload.content,
        is_active: true,
        valid_until: payload.valid_until,
        created_at: Utc::now(),
    };
    db.announcements.insert(ann.id, ann.clone());
    (StatusCode::CREATED, Json(ann))
}

// 20. Get Active Announcements
pub async fn get_active_announcements(State(state): State<AppState>) -> impl IntoResponse {
    let db = state.read().await;
    let now = Utc::now();
    let anns: Vec<Announcement> = db.announcements
        .values()
        .filter(|a| a.is_active && a.valid_until.map(|vu| vu > now).unwrap_or(true))
        .cloned()
        .collect();
    (StatusCode::OK, Json(anns))
}

// 21. Search Articles
#[derive(Deserialize)]
pub struct SearchQuery {
    pub query: String,
}
pub async fn search_articles(
    State(state): State<AppState>,
    Query(sq): Query<SearchQuery>,
) -> impl IntoResponse {
    let db = state.read().await;
    let q = sq.query.to_lowercase();
    let results: Vec<Article> = db.articles
        .values()
        .filter(|a| a.title.to_lowercase().contains(&q) || a.content.to_lowercase().contains(&q))
        .cloned()
        .collect();
    (StatusCode::OK, Json(results))
}
