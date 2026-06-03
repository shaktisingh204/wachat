use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct KbArticleDto {
    pub id: String,
    pub title: String,
    pub content: String,
    pub published: bool,
}

#[derive(Serialize, Deserialize)]
pub struct CreateKbArticleDto {
    pub title: String,
    pub content: String,
    pub published: Option<bool>,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateKbArticleDto {
    pub title: Option<String>,
    pub content: Option<String>,
    pub published: Option<bool>,
}
