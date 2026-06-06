//! HTTP handlers for the wachat setup knowledge-base domain.
//!
//! KB articles are **global** content (not per-tenant): any authenticated
//! caller can read every article and (lacking an admin gate here) any
//! authenticated caller may write. The `/wachat/setup/docs` page is the
//! consumer.
//!
//! | Endpoint                                  | Action          |
//! |-------------------------------------------|-----------------|
//! | `GET    /v1/wachat/setup-kb/articles`     | list / search   |
//! | `POST   /v1/wachat/setup-kb/articles`     | create article  |
//! | `PUT    /v1/wachat/setup-kb/articles/{id}`| update article  |
//! | `DELETE /v1/wachat/setup-kb/articles/{id}`| delete article  |

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{ArticleBody, ListArticlesQuery, ListArticlesResponse, SuccessResponse};
use crate::state::WachatSetupKbState;

const COLL: &str = "wa_setup_kb_articles";

/// Ensure the caller presents a well-formed subject (any authenticated user is
/// allowed — KB content is global). Maps a malformed subject to 401.
fn require_auth(user: &AuthUser) -> Result<()> {
    ObjectId::parse_str(&user.user_id)
        .map(|_| ())
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Shared field validation for create / update.
fn validate(body: &ArticleBody) -> Result<()> {
    if body.title.trim().is_empty() {
        return Err(ApiError::Validation("Title is required.".to_owned()));
    }
    if body.content.trim().is_empty() {
        return Err(ApiError::Validation("Content is required.".to_owned()));
    }
    if body.category.trim().is_empty() {
        return Err(ApiError::Validation("Category is required.".to_owned()));
    }
    Ok(())
}

/// Map a frontend `sort` token onto a Mongo sort document. Default is
/// `updatedAt` descending (newest first).
fn sort_doc(sort: Option<&str>) -> Document {
    match sort {
        Some("date-asc") => doc! { "updatedAt": 1 },
        Some("title-asc") => doc! { "title": 1 },
        Some("title-desc") => doc! { "title": -1 },
        // "date-desc" and anything unknown/empty -> newest first.
        _ => doc! { "updatedAt": -1 },
    }
}

// ===========================================================================
// GET /v1/wachat/setup-kb/articles
// ===========================================================================

#[instrument(skip_all)]
pub async fn list_articles(
    user: AuthUser,
    State(state): State<WachatSetupKbState>,
    Query(query): Query<ListArticlesQuery>,
) -> Result<Json<ListArticlesResponse>> {
    require_auth(&user)?;

    // Global content: no userId scoping. Build the search/category filter only.
    let mut filter = Document::new();

    if let Some(q) = query.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        // Case-insensitive substring over title + content (TS: `$or` of regexes).
        let regex = doc! { "$regex": q, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "title": regex.clone() }),
                Bson::Document(doc! { "content": regex }),
            ]),
        );
    }

    if let Some(cat) = query
        .category
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty() && *s != "all")
    {
        filter.insert("category", cat);
    }

    let opts = FindOptions::builder()
        .sort(sort_doc(query.sort.as_deref()))
        .build();

    let coll = state.mongo.collection::<Document>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("setup_kb.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("setup_kb.collect")))?;
    let articles = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListArticlesResponse { articles }))
}

// ===========================================================================
// POST /v1/wachat/setup-kb/articles
// ===========================================================================

#[instrument(skip_all)]
pub async fn create_article(
    user: AuthUser,
    State(state): State<WachatSetupKbState>,
    Json(body): Json<ArticleBody>,
) -> Result<Json<Value>> {
    require_auth(&user)?;
    validate(&body)?;
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();
    let new_doc = doc! {
        "_id": new_oid,
        "title": body.title.trim(),
        "content": body.content.trim(),
        "category": body.category.trim(),
        "createdAt": now,
        "updatedAt": now,
    };
    state
        .mongo
        .collection::<Document>(COLL)
        .insert_one(new_doc.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("setup_kb.insert_one")))?;
    Ok(Json(document_to_clean_json(new_doc)))
}

// ===========================================================================
// PUT /v1/wachat/setup-kb/articles/{article_id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn update_article(
    user: AuthUser,
    State(state): State<WachatSetupKbState>,
    Path(article_id): Path<String>,
    Json(body): Json<ArticleBody>,
) -> Result<Json<SuccessResponse>> {
    require_auth(&user)?;
    validate(&body)?;
    let oid = oid_from_str(&article_id)?;
    let now = bson::DateTime::from_chrono(Utc::now());
    let res = state
        .mongo
        .collection::<Document>(COLL)
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": {
                "title": body.title.trim(),
                "content": body.content.trim(),
                "category": body.category.trim(),
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("setup_kb.update_one")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Article not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/wachat/setup-kb/articles/{article_id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn delete_article(
    user: AuthUser,
    State(state): State<WachatSetupKbState>,
    Path(article_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    require_auth(&user)?;
    let oid = oid_from_str(&article_id)?;
    let res = state
        .mongo
        .collection::<Document>(COLL)
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("setup_kb.delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Article not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}
