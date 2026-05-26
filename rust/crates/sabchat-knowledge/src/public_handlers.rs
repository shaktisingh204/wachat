//! Public-read HTTP handlers for the SabChat knowledge-base.
//!
//! Mounted at `/v1/sabchat/kb-public` — every endpoint in this module is
//! intentionally anonymous (no [`AuthUser`](sabnode_auth::AuthUser)) and
//! returns only **published** articles inside **active** portals.
//!
//! ## Tenancy derivation
//!
//! Public handlers never trust caller-supplied tenant ids. Tenancy is
//! recovered from the portal document itself via the `slug` lookup:
//!
//! ```text
//! GET /portals/{slug}                          → resolves tenant from portal
//! GET /portals/{slug}/articles                 → resolves tenant from portal
//! GET /portals/{slug}/articles/{articleSlug}   → resolves tenant from portal
//! POST /portals/{slug}/articles/{slug}/helpful → resolves tenant from portal
//! ```
//!
//! ## Visibility rules
//!
//! - Portal lookup yields `404` unless `active = true`.
//! - Article reads yield `404` unless `status = "published"`.
//! - `public_get_article` `$inc`s `viewCount` on every hit.
//! - The helpful endpoint `$inc`s `helpfulCount` or `notHelpfulCount`
//!   depending on the request body.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    EXCERPT_CHARS, HelpfulBody, PortalTheme, PublicArticleResponse, PublicArticleSummary,
    PublicListArticlesQuery, PublicListArticlesResponse, PublicPortalResponse, SuccessResponse,
};
use crate::handlers::{ARTICLES_COLL, CATEGORIES_COLL, PORTALS_COLL};
use crate::state::SabChatKnowledgeState;

// ===========================================================================
// Shared helpers
// ===========================================================================

/// Resolve a portal by its slug. Returns the portal document if it
/// exists **and** is active; otherwise a 404. We use this both to
/// recover the tenant id and to gate every public endpoint behind the
/// portal-active flag.
async fn load_active_portal_by_slug(mongo: &MongoHandle, slug: &str) -> Result<Document> {
    if slug.trim().is_empty() {
        return Err(ApiError::NotFound("Portal not found.".to_owned()));
    }
    let coll = mongo.collection::<Document>(PORTALS_COLL);
    coll.find_one(doc! { "slug": slug, "active": true })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_kb_portals.find_one(slug,public)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Portal not found.".to_owned()))
}

/// Extract `(tenantId, portalId)` from a loaded portal document. Both
/// fields are required — a missing one means the document was written
/// outside the expected schema and we surface a 500.
fn portal_keys(portal: &Document) -> Result<(ObjectId, ObjectId)> {
    let tenant_id = portal
        .get_object_id("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("portal missing tenantId")))?;
    let portal_id = portal
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("portal missing _id")))?;
    Ok((tenant_id, portal_id))
}

/// Compute the public excerpt. Prefer an explicit `excerpt` field on
/// the document if present; otherwise take the first
/// [`EXCERPT_CHARS`] characters of `body`. Char-aware so we don't slice
/// inside a multi-byte UTF-8 codepoint.
fn excerpt_from_doc(doc: &Document) -> String {
    if let Ok(explicit) = doc.get_str("excerpt") {
        if !explicit.is_empty() {
            return explicit.to_owned();
        }
    }
    let body = doc.get_str("body").unwrap_or_default();
    body.chars().take(EXCERPT_CHARS).collect()
}

// ===========================================================================
// GET /portals/{slug}
// ===========================================================================

/// `GET /v1/sabchat/kb-public/portals/{slug}` — public portal info.
///
/// Returns only the narrow public-facing fields (name, theme, default
/// language). The tenant id is never exposed.
#[instrument(skip_all, fields(slug = %slug))]
pub async fn public_get_portal(
    State(state): State<SabChatKnowledgeState>,
    Path(slug): Path<String>,
) -> Result<Json<PublicPortalResponse>> {
    let portal = load_active_portal_by_slug(&state.mongo, &slug).await?;

    let name = portal.get_str("name").unwrap_or_default().to_owned();
    let default_language = portal
        .get_str("defaultLanguage")
        .unwrap_or("en")
        .to_owned();

    let theme = portal
        .get_document("theme")
        .ok()
        .and_then(|d| {
            d.get_str("color")
                .ok()
                .filter(|s| !s.is_empty())
                .map(|s| s.to_owned())
        });

    Ok(Json(PublicPortalResponse {
        name,
        theme: PortalTheme { color: theme },
        default_language,
    }))
}

// ===========================================================================
// GET /portals/{slug}/articles
// ===========================================================================

/// `GET /v1/sabchat/kb-public/portals/{slug}/articles` — list published
/// articles inside an active portal. Supports `q` (full-text), `category`
/// (slug — not id) and `tag` filters; all are optional.
///
/// Body content is **never** included — only the projected summary
/// fields (title, slug, excerpt, tags, updatedAt) make it onto the
/// wire.
#[instrument(skip_all, fields(slug = %slug))]
pub async fn public_list_articles(
    State(state): State<SabChatKnowledgeState>,
    Path(slug): Path<String>,
    Query(query): Query<PublicListArticlesQuery>,
) -> Result<Json<PublicListArticlesResponse>> {
    let portal = load_active_portal_by_slug(&state.mongo, &slug).await?;
    let (tenant_id, portal_id) = portal_keys(&portal)?;

    let mut filter = doc! {
        "tenantId": tenant_id,
        "portalId": portal_id,
        "status": "published",
    };

    // --- category slug → ObjectId lookup -------------------------------
    if let Some(cat_slug) = query
        .category
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let cats = state.mongo.collection::<Document>(CATEGORIES_COLL);
        let cat = cats
            .find_one(doc! {
                "tenantId": tenant_id,
                "portalId": portal_id,
                "slug": cat_slug,
            })
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e)
                        .context("sabchat_kb_categories.find_one(public_slug)"),
                )
            })?;
        match cat.and_then(|d| d.get_object_id("_id").ok()) {
            Some(oid) => {
                filter.insert("categoryId", oid);
            }
            // A non-matching category slug means "no results"; we
            // short-circuit rather than scanning the whole collection.
            None => {
                return Ok(Json(PublicListArticlesResponse {
                    articles: Vec::new(),
                    total: 0,
                }));
            }
        }
    }

    if let Some(tag) = query.tag.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("tags", tag.to_owned());
    }
    if let Some(q) = query.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("$text", doc! { "$search": q });
    }

    let coll = state.mongo.collection::<Document>(ARTICLES_COLL);
    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_kb_articles.count_documents(public)"),
            )
        })?;

    // Project just what the summary needs — bandwidth + cache-friendly.
    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1, "_id": -1 })
        .projection(doc! {
            "title": 1,
            "slug": 1,
            "excerpt": 1,
            "body": 1,
            "tags": 1,
            "updatedAt": 1,
        })
        .build();

    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_kb_articles.find(public)"),
            )
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_kb_articles.collect(public)"),
        )
    })?;

    let articles = docs
        .into_iter()
        .map(|d| {
            let title = d.get_str("title").unwrap_or_default().to_owned();
            let slug = d.get_str("slug").unwrap_or_default().to_owned();
            let excerpt = excerpt_from_doc(&d);
            let tags: Vec<String> = d
                .get_array("tags")
                .ok()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|b| b.as_str().map(str::to_owned))
                        .collect()
                })
                .unwrap_or_default();
            // updatedAt round-trips through `document_to_clean_json` so
            // we share the wire shape with the agent-side handlers
            // (ISO-8601 string, not a `{ "$date": ... }` extended-JSON
            // envelope).
            let updated_at = d.get("updatedAt").cloned().and_then(|b| {
                let mut wrap = Document::new();
                wrap.insert("updatedAt", b);
                document_to_clean_json(wrap)
                    .get("updatedAt")
                    .cloned()
            });
            PublicArticleSummary {
                title,
                slug,
                excerpt,
                tags,
                updated_at,
            }
        })
        .collect();

    Ok(Json(PublicListArticlesResponse { articles, total }))
}

// ===========================================================================
// GET /portals/{slug}/articles/{article_slug}
// ===========================================================================

/// `GET /v1/sabchat/kb-public/portals/{slug}/articles/{article_slug}` —
/// full published article. Bumps `viewCount` via a `$inc` update on the
/// way out, returns the canonical document (minus `tenantId`) to the
/// caller.
#[instrument(skip_all, fields(portal_slug = %portal_slug, article_slug = %article_slug))]
pub async fn public_get_article(
    State(state): State<SabChatKnowledgeState>,
    Path((portal_slug, article_slug)): Path<(String, String)>,
) -> Result<Json<PublicArticleResponse>> {
    let portal = load_active_portal_by_slug(&state.mongo, &portal_slug).await?;
    let (tenant_id, portal_id) = portal_keys(&portal)?;

    if article_slug.trim().is_empty() {
        return Err(ApiError::NotFound("Article not found.".to_owned()));
    }

    let coll = state.mongo.collection::<Document>(ARTICLES_COLL);
    let filter = doc! {
        "tenantId": tenant_id,
        "portalId": portal_id,
        "slug": &article_slug,
        "status": "published",
    };

    let mut article = coll
        .find_one(filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_kb_articles.find_one(public)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Article not found.".to_owned()))?;

    let article_oid = article
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("article missing _id")))?;

    // ---- bump viewCount via $inc --------------------------------------
    coll.update_one(
        doc! { "_id": article_oid },
        doc! { "$inc": { "viewCount": 1_i64 } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_kb_articles.$inc(viewCount)"),
        )
    })?;

    // Reflect the +1 in the response so clients don't see a stale count.
    let new_count = article
        .get_i64("viewCount")
        .or_else(|_| article.get_i32("viewCount").map(|n| n as i64))
        .unwrap_or(0)
        + 1;
    article.insert("viewCount", new_count);

    // Strip tenantId from the wire — the public surface never leaks it.
    article.remove("tenantId");

    Ok(Json(PublicArticleResponse {
        article: document_to_clean_json(article),
    }))
}

// ===========================================================================
// POST /portals/{slug}/articles/{article_slug}/helpful
// ===========================================================================

/// `POST /v1/sabchat/kb-public/portals/{slug}/articles/{article_slug}/helpful`
/// — record a thumbs-up / thumbs-down. `body.helpful == true` increments
/// `helpfulCount`; `false` increments `notHelpfulCount`. The portal must
/// be active and the article must be published — otherwise 404.
///
/// We deliberately don't de-dupe per session here; that gate (cookie /
/// IP throttling) sits in the Next.js side that fronts this endpoint.
#[instrument(skip_all, fields(portal_slug = %portal_slug, article_slug = %article_slug))]
pub async fn public_helpful_vote(
    State(state): State<SabChatKnowledgeState>,
    Path((portal_slug, article_slug)): Path<(String, String)>,
    Json(body): Json<HelpfulBody>,
) -> Result<Json<SuccessResponse>> {
    let portal = load_active_portal_by_slug(&state.mongo, &portal_slug).await?;
    let (tenant_id, portal_id) = portal_keys(&portal)?;

    if article_slug.trim().is_empty() {
        return Err(ApiError::NotFound("Article not found.".to_owned()));
    }

    let field = if body.helpful {
        "helpfulCount"
    } else {
        "notHelpfulCount"
    };

    let coll = state.mongo.collection::<Document>(ARTICLES_COLL);
    let res = coll
        .update_one(
            doc! {
                "tenantId": tenant_id,
                "portalId": portal_id,
                "slug": &article_slug,
                "status": "published",
            },
            doc! { "$inc": { field: 1_i64 } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_kb_articles.$inc(helpful)"),
            )
        })?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Article not found.".to_owned()));
    }

    Ok(Json(SuccessResponse::ok()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn excerpt_prefers_explicit_field() {
        let mut d = Document::new();
        d.insert("excerpt", "explicit excerpt");
        d.insert("body", "much longer body content here");
        assert_eq!(excerpt_from_doc(&d), "explicit excerpt");
    }

    #[test]
    fn excerpt_falls_back_to_body_prefix() {
        let mut d = Document::new();
        d.insert("body", "abcdefghij".repeat(50));
        let out = excerpt_from_doc(&d);
        assert_eq!(out.chars().count(), EXCERPT_CHARS);
    }

    #[test]
    fn excerpt_is_char_safe_for_multibyte() {
        let mut d = Document::new();
        // 1000 emoji chars (each is multi-byte) — slice must not panic.
        let body: String = "🦀".repeat(1000);
        d.insert("body", &body);
        let out = excerpt_from_doc(&d);
        assert_eq!(out.chars().count(), EXCERPT_CHARS);
    }
}
