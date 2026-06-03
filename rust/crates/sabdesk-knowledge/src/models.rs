use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: Uuid,
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ArticleStatus {
    Draft,
    Review,
    Published,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Article {
    pub id: Uuid,
    pub category_id: Uuid,
    pub title: String,
    pub slug: String,
    pub content: String, // Rich text content (HTML/Markdown)
    pub status: ArticleStatus,
    pub author_id: Uuid,
    pub tags: Vec<String>,
    pub view_count: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub published_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Revision {
    pub id: Uuid,
    pub article_id: Uuid,
    pub author_id: Uuid,
    pub content_snapshot: String,
    pub title_snapshot: String,
    pub commit_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Author {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub bio: Option<String>,
    pub role: String, // e.g., "Admin", "Editor", "Contributor"
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CommentStatus {
    Pending,
    Approved,
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Comment {
    pub id: Uuid,
    pub article_id: Uuid,
    pub user_id: Uuid,
    pub content: String,
    pub status: CommentStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Announcement {
    pub id: Uuid,
    pub title: String,
    pub content: String,
    pub is_active: bool,
    pub valid_until: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

// Request Models for Creation/Updates

#[derive(Debug, Deserialize)]
pub struct CreateCategoryRequest {
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateArticleRequest {
    pub category_id: Uuid,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub author_id: Uuid,
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateArticleRequest {
    pub title: Option<String>,
    pub slug: Option<String>,
    pub content: Option<String>,
    pub status: Option<ArticleStatus>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCommentRequest {
    pub article_id: Uuid,
    pub user_id: Uuid,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct ModerateCommentRequest {
    pub status: CommentStatus,
}

#[derive(Debug, Deserialize)]
pub struct CreateAnnouncementRequest {
    pub title: String,
    pub content: String,
    pub valid_until: Option<DateTime<Utc>>,
}
