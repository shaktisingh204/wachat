//! Agent-side HTTP handlers for the SabChat knowledge-base.
//!
//! All endpoints in this module are mounted behind the orchestrator's
//! JWT middleware and consume [`AuthUser`]. Every read and write is
//! scoped by `tenantId == ObjectId::parse_str(&auth.tenant_id)` — a
//! malformed subject yields [`ApiError::Unauthorized`]; cross-tenant
//! ids therefore surface as `404`s because the tenant clause never
//! matches.
//!
//! ## Collections owned by this crate
//!
//! | Collection                | DTO family   | Slug uniqueness |
//! |---------------------------|--------------|-----------------|
//! | `sabchat_kb_portals`      | portal       | per tenant      |
//! | `sabchat_kb_categories`   | category     | per portal      |
//! | `sabchat_kb_articles`     | article      | per portal × language |
//!
//! Duplicate-slug attempts surface [`ApiError::Conflict`]. Article
//! list-by-`q` uses the Mongo `$text` index that the orchestrator
//! creates at startup.

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
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    ARTICLES_PER_PAGE, ArticleResponse, CategoryResponse, CreateArticleBody, CreateCategoryBody,
    CreatePortalBody, ListArticlesQuery, ListArticlesResponse, ListCategoriesQuery,
    ListCategoriesResponse, ListPortalsResponse, PortalResponse, SuccessResponse,
    UpdateArticleBody, UpdateCategoryBody, UpdatePortalBody,
};
use crate::state::SabChatKnowledgeState;

// ---------------------------------------------------------------------------
// Collection name constants — kept centralised so the public handlers can
// reach for the same strings.
// ---------------------------------------------------------------------------

pub(crate) const PORTALS_COLL: &str = "sabchat_kb_portals";
pub(crate) const CATEGORIES_COLL: &str = "sabchat_kb_categories";
pub(crate) const ARTICLES_COLL: &str = "sabchat_kb_articles";

/// Allowed article lifecycle states. Anything else surfaces as a 422.
const ARTICLE_STATUSES: &[&str] = &["draft", "published", "archived"];

// ===========================================================================
// Shared helpers
// ===========================================================================

/// Parse the calling user's `tenantId` claim into an `ObjectId`. Mirrors
/// the same helper in [`sabchat-conversations`] — a malformed claim
/// means a tampered token or a buggy issuer, so we treat it as auth
/// failure rather than a 500.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Trim + non-empty guard for required string fields. Returns the
/// trimmed slice on success.
fn require_non_empty<'a>(field: &str, value: &'a str) -> Result<&'a str> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(ApiError::Validation(format!("`{field}` is required.")));
    }
    Ok(trimmed)
}

/// Render a stored document as the wire shape — hex ObjectIds, ISO-8601
/// timestamps. Thin wrapper so the call site reads naturally.
fn render(doc: Document) -> Value {
    document_to_clean_json(doc)
}

/// Validate that `status` is one of the article lifecycle values.
fn check_article_status(status: &str) -> Result<()> {
    if ARTICLE_STATUSES.contains(&status) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "Invalid article status `{status}`; expected one of: draft, published, archived."
        )))
    }
}

/// Look up a portal id scoped to the caller's tenant. The portal must
/// exist; otherwise yields a 404. Used by category + article creates so
/// we can refuse foreign-tenant portal ids before writing anything.
async fn ensure_portal_in_tenant(
    mongo: &MongoHandle,
    tenant: ObjectId,
    portal_oid: ObjectId,
) -> Result<()> {
    let coll = mongo.collection::<Document>(PORTALS_COLL);
    let found = coll
        .find_one(doc! { "_id": portal_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_kb_portals.find_one"))
        })?;
    if found.is_none() {
        return Err(ApiError::NotFound("Portal not found.".to_owned()));
    }
    Ok(())
}

/// Load one tenant-scoped document by hex id from `coll_name`. Returns
/// 404 on miss. Generic so portal / category / article handlers all
/// share the same plumbing.
async fn load_scoped(
    mongo: &MongoHandle,
    coll_name: &str,
    tenant: ObjectId,
    id_hex: &str,
    not_found_msg: &str,
) -> Result<Document> {
    let oid = oid_from_str(id_hex)?;
    let coll = mongo.collection::<Document>(coll_name);
    coll.find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context(format!("{coll_name}.find_one")))
        })?
        .ok_or_else(|| ApiError::NotFound(not_found_msg.to_owned()))
}

// ===========================================================================
// PORTALS
// ===========================================================================

/// `POST /v1/sabchat/kb/portals` — create a help-center portal under
/// the caller's tenant. Slug must be unique per tenant.
#[instrument(skip_all, fields(slug = %body.slug))]
pub async fn create_portal(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Json(body): Json<CreatePortalBody>,
) -> Result<Json<PortalResponse>> {
    let tenant = tenant_oid(&user)?;
    let name = require_non_empty("name", &body.name)?.to_owned();
    let slug = require_non_empty("slug", &body.slug)?.to_owned();
    let default_language = require_non_empty("defaultLanguage", &body.default_language)?
        .to_owned();

    // ---- slug uniqueness ----------------------------------------------
    let coll = state.mongo.collection::<Document>(PORTALS_COLL);
    let existing = coll
        .find_one(doc! { "tenantId": tenant, "slug": &slug })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_kb_portals.find_one(slug)"),
            )
        })?;
    if existing.is_some() {
        return Err(ApiError::Conflict(format!(
            "Portal slug `{slug}` already exists for this tenant."
        )));
    }

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let theme_doc = doc! {
        "color": body.theme.color.clone().map(Bson::String).unwrap_or(Bson::Null),
    };

    let custom_domain: Bson = body
        .custom_domain
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| Bson::String(s.to_owned()))
        .unwrap_or(Bson::Null);

    let new_oid = ObjectId::new();
    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "name": &name,
        "slug": &slug,
        "defaultLanguage": &default_language,
        "theme": theme_doc,
        "customDomain": custom_domain,
        "active": body.active,
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };

    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_kb_portals.insert_one"))
    })?;

    Ok(Json(PortalResponse {
        portal: render(new_doc),
    }))
}

/// `GET /v1/sabchat/kb/portals` — list every portal owned by the
/// caller's tenant, newest first.
#[instrument(skip_all)]
pub async fn list_portals(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
) -> Result<Json<ListPortalsResponse>> {
    let tenant = tenant_oid(&user)?;
    let coll = state.mongo.collection::<Document>(PORTALS_COLL);

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1, "_id": -1 })
        .build();
    let cursor = coll
        .find(doc! { "tenantId": tenant })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_kb_portals.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_kb_portals.collect"))
    })?;
    let total = docs.len() as u64;
    let portals: Vec<Value> = docs.into_iter().map(render).collect();

    Ok(Json(ListPortalsResponse { portals, total }))
}

/// `GET /v1/sabchat/kb/portals/{id}` — fetch a portal by id.
#[instrument(skip_all, fields(portal_id = %id))]
pub async fn get_portal(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Path(id): Path<String>,
) -> Result<Json<PortalResponse>> {
    let tenant = tenant_oid(&user)?;
    let doc = load_scoped(
        &state.mongo,
        PORTALS_COLL,
        tenant,
        &id,
        "Portal not found.",
    )
    .await?;
    Ok(Json(PortalResponse {
        portal: render(doc),
    }))
}

/// `PATCH /v1/sabchat/kb/portals/{id}` — partial update. Slug renames
/// re-check the tenant-wide uniqueness invariant.
#[instrument(skip_all, fields(portal_id = %id))]
pub async fn update_portal(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Path(id): Path<String>,
    Json(body): Json<UpdatePortalBody>,
) -> Result<Json<PortalResponse>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_scoped(
        &state.mongo,
        PORTALS_COLL,
        tenant,
        &id,
        "Portal not found.",
    )
    .await?;
    let portal_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("portal missing _id")))?;

    let mut set = Document::new();

    if let Some(name) = body.name.as_deref() {
        let trimmed = require_non_empty("name", name)?;
        set.insert("name", trimmed);
    }
    if let Some(slug) = body.slug.as_deref() {
        let trimmed = require_non_empty("slug", slug)?.to_owned();
        // Only re-check uniqueness if the slug actually changed.
        if existing.get_str("slug").unwrap_or_default() != trimmed {
            let coll = state.mongo.collection::<Document>(PORTALS_COLL);
            let dup = coll
                .find_one(doc! {
                    "tenantId": tenant,
                    "slug": &trimmed,
                    "_id": { "$ne": portal_oid },
                })
                .await
                .map_err(|e| {
                    ApiError::Internal(
                        anyhow::Error::new(e).context("sabchat_kb_portals.find_one(slug_dup)"),
                    )
                })?;
            if dup.is_some() {
                return Err(ApiError::Conflict(format!(
                    "Portal slug `{trimmed}` already exists for this tenant."
                )));
            }
        }
        set.insert("slug", trimmed);
    }
    if let Some(default_language) = body.default_language.as_deref() {
        let trimmed = require_non_empty("defaultLanguage", default_language)?;
        set.insert("defaultLanguage", trimmed);
    }
    if let Some(theme) = body.theme.as_ref() {
        set.insert(
            "theme",
            doc! {
                "color": theme.color.clone().map(Bson::String).unwrap_or(Bson::Null),
            },
        );
    }
    if let Some(custom_domain) = body.custom_domain.as_ref() {
        let trimmed = custom_domain.trim();
        if trimmed.is_empty() {
            set.insert("customDomain", Bson::Null);
        } else {
            set.insert("customDomain", trimmed.to_owned());
        }
    }
    if let Some(active) = body.active {
        set.insert("active", active);
    }

    if set.is_empty() {
        // Nothing to update — echo back what we already have.
        return Ok(Json(PortalResponse {
            portal: render(existing),
        }));
    }

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    set.insert("updatedAt", now_bson);

    let coll = state.mongo.collection::<Document>(PORTALS_COLL);
    coll.update_one(
        doc! { "_id": portal_oid, "tenantId": tenant },
        doc! { "$set": set },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_kb_portals.update_one"))
    })?;

    let fresh = load_scoped(
        &state.mongo,
        PORTALS_COLL,
        tenant,
        &id,
        "Portal not found.",
    )
    .await?;
    Ok(Json(PortalResponse {
        portal: render(fresh),
    }))
}

/// `DELETE /v1/sabchat/kb/portals/{id}` — remove a portal. Cascade is
/// intentionally **not** performed here; orphaned categories / articles
/// are pruned by a background sweeper. Keeping the handler narrow
/// matches the rest of the SabChat domain.
#[instrument(skip_all, fields(portal_id = %id))]
pub async fn delete_portal(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&user)?;
    let portal_oid = oid_from_str(&id)?;
    let coll = state.mongo.collection::<Document>(PORTALS_COLL);
    let res = coll
        .delete_one(doc! { "_id": portal_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_kb_portals.delete_one"))
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Portal not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// CATEGORIES
// ===========================================================================

/// `POST /v1/sabchat/kb/categories` — create a category under a portal.
/// Slug must be unique per portal.
#[instrument(skip_all, fields(portal_id = %body.portal_id, slug = %body.slug))]
pub async fn create_category(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Json(body): Json<CreateCategoryBody>,
) -> Result<Json<CategoryResponse>> {
    let tenant = tenant_oid(&user)?;
    let name = require_non_empty("name", &body.name)?.to_owned();
    let slug = require_non_empty("slug", &body.slug)?.to_owned();
    let portal_oid = oid_from_str(&body.portal_id)?;
    ensure_portal_in_tenant(&state.mongo, tenant, portal_oid).await?;

    // ---- per-portal slug uniqueness -----------------------------------
    let coll = state.mongo.collection::<Document>(CATEGORIES_COLL);
    let dup = coll
        .find_one(doc! {
            "tenantId": tenant,
            "portalId": portal_oid,
            "slug": &slug,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_kb_categories.find_one(slug)"),
            )
        })?;
    if dup.is_some() {
        return Err(ApiError::Conflict(format!(
            "Category slug `{slug}` already exists in this portal."
        )));
    }

    let parent_id: Bson = match body
        .parent_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(s) => Bson::ObjectId(oid_from_str(s)?),
        None => Bson::Null,
    };

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();
    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "portalId": portal_oid,
        "parentId": parent_id,
        "name": &name,
        "slug": &slug,
        "sortOrder": body.sort_order,
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };

    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_kb_categories.insert_one"),
        )
    })?;

    Ok(Json(CategoryResponse {
        category: render(new_doc),
    }))
}

/// `GET /v1/sabchat/kb/categories` — list categories, optionally
/// filtered by `portalId`. Sorted by `sortOrder ASC, _id ASC`.
#[instrument(skip_all)]
pub async fn list_categories(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Query(query): Query<ListCategoriesQuery>,
) -> Result<Json<ListCategoriesResponse>> {
    let tenant = tenant_oid(&user)?;
    let mut filter = doc! { "tenantId": tenant };
    if let Some(portal) = query
        .portal_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("portalId", oid_from_str(portal)?);
    }

    let coll = state.mongo.collection::<Document>(CATEGORIES_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "sortOrder": 1, "_id": 1 })
        .build();
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_kb_categories.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_kb_categories.collect"))
    })?;
    let total = docs.len() as u64;
    let categories: Vec<Value> = docs.into_iter().map(render).collect();

    Ok(Json(ListCategoriesResponse { categories, total }))
}

/// `GET /v1/sabchat/kb/categories/{id}` — fetch one category by id.
#[instrument(skip_all, fields(category_id = %id))]
pub async fn get_category(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Path(id): Path<String>,
) -> Result<Json<CategoryResponse>> {
    let tenant = tenant_oid(&user)?;
    let doc = load_scoped(
        &state.mongo,
        CATEGORIES_COLL,
        tenant,
        &id,
        "Category not found.",
    )
    .await?;
    Ok(Json(CategoryResponse {
        category: render(doc),
    }))
}

/// `PATCH /v1/sabchat/kb/categories/{id}` — partial update. Slug
/// renames re-check the per-portal uniqueness invariant. An empty-string
/// `parentId` re-parents to top-level (`null`).
#[instrument(skip_all, fields(category_id = %id))]
pub async fn update_category(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateCategoryBody>,
) -> Result<Json<CategoryResponse>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_scoped(
        &state.mongo,
        CATEGORIES_COLL,
        tenant,
        &id,
        "Category not found.",
    )
    .await?;
    let category_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("category missing _id")))?;
    let portal_oid = existing
        .get_object_id("portalId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("category missing portalId")))?;

    let mut set = Document::new();

    if let Some(name) = body.name.as_deref() {
        let trimmed = require_non_empty("name", name)?;
        set.insert("name", trimmed);
    }
    if let Some(slug) = body.slug.as_deref() {
        let trimmed = require_non_empty("slug", slug)?.to_owned();
        if existing.get_str("slug").unwrap_or_default() != trimmed {
            let coll = state.mongo.collection::<Document>(CATEGORIES_COLL);
            let dup = coll
                .find_one(doc! {
                    "tenantId": tenant,
                    "portalId": portal_oid,
                    "slug": &trimmed,
                    "_id": { "$ne": category_oid },
                })
                .await
                .map_err(|e| {
                    ApiError::Internal(
                        anyhow::Error::new(e)
                            .context("sabchat_kb_categories.find_one(slug_dup)"),
                    )
                })?;
            if dup.is_some() {
                return Err(ApiError::Conflict(format!(
                    "Category slug `{trimmed}` already exists in this portal."
                )));
            }
        }
        set.insert("slug", trimmed);
    }
    if let Some(parent_id) = body.parent_id.as_ref() {
        let trimmed = parent_id.trim();
        if trimmed.is_empty() {
            // Explicit clear → top-level.
            set.insert("parentId", Bson::Null);
        } else {
            set.insert("parentId", oid_from_str(trimmed)?);
        }
    }
    if let Some(sort_order) = body.sort_order {
        set.insert("sortOrder", sort_order);
    }

    if set.is_empty() {
        return Ok(Json(CategoryResponse {
            category: render(existing),
        }));
    }

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    set.insert("updatedAt", now_bson);

    let coll = state.mongo.collection::<Document>(CATEGORIES_COLL);
    coll.update_one(
        doc! { "_id": category_oid, "tenantId": tenant },
        doc! { "$set": set },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_kb_categories.update_one"),
        )
    })?;

    let fresh = load_scoped(
        &state.mongo,
        CATEGORIES_COLL,
        tenant,
        &id,
        "Category not found.",
    )
    .await?;
    Ok(Json(CategoryResponse {
        category: render(fresh),
    }))
}

/// `DELETE /v1/sabchat/kb/categories/{id}` — remove a category.
/// Articles previously assigned to this category retain their stored
/// `categoryId` (which then surfaces as orphaned); the orchestrator
/// reconciles via a background sweeper.
#[instrument(skip_all, fields(category_id = %id))]
pub async fn delete_category(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&user)?;
    let category_oid = oid_from_str(&id)?;
    let coll = state.mongo.collection::<Document>(CATEGORIES_COLL);
    let res = coll
        .delete_one(doc! { "_id": category_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_kb_categories.delete_one"),
            )
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Category not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// ARTICLES
// ===========================================================================

/// `POST /v1/sabchat/kb/articles` — create a new article. Slug must be
/// unique within `(portalId, language)`. Articles default to `draft`.
#[instrument(skip_all, fields(portal_id = %body.portal_id, slug = %body.slug))]
pub async fn create_article(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Json(body): Json<CreateArticleBody>,
) -> Result<Json<ArticleResponse>> {
    let tenant = tenant_oid(&user)?;
    let title = require_non_empty("title", &body.title)?.to_owned();
    let slug = require_non_empty("slug", &body.slug)?.to_owned();
    let language = require_non_empty("language", &body.language)?.to_owned();
    let status = body.status.trim().to_owned();
    check_article_status(&status)?;
    let portal_oid = oid_from_str(&body.portal_id)?;
    ensure_portal_in_tenant(&state.mongo, tenant, portal_oid).await?;

    let category_oid: Bson = match body
        .category_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(s) => Bson::ObjectId(oid_from_str(s)?),
        None => Bson::Null,
    };
    let author_oid: Bson = match body
        .author_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(s) => Bson::ObjectId(oid_from_str(s)?),
        None => Bson::Null,
    };

    // ---- (portal, language) slug uniqueness ---------------------------
    let coll = state.mongo.collection::<Document>(ARTICLES_COLL);
    let dup = coll
        .find_one(doc! {
            "tenantId": tenant,
            "portalId": portal_oid,
            "language": &language,
            "slug": &slug,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_kb_articles.find_one(slug)"),
            )
        })?;
    if dup.is_some() {
        return Err(ApiError::Conflict(format!(
            "Article slug `{slug}` already exists in this portal for language `{language}`."
        )));
    }

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let published_at: Bson = if status == "published" {
        Bson::DateTime(now_bson)
    } else {
        Bson::Null
    };

    let tags_bson = Bson::Array(body.tags.iter().cloned().map(Bson::String).collect());

    let new_oid = ObjectId::new();
    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "portalId": portal_oid,
        "categoryId": category_oid,
        "authorId": author_oid,
        "title": &title,
        "slug": &slug,
        "body": &body.body,
        "tags": tags_bson,
        "language": &language,
        "status": &status,
        "publishedAt": published_at,
        "viewCount": 0_i64,
        "helpfulCount": 0_i64,
        "notHelpfulCount": 0_i64,
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };

    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_kb_articles.insert_one"))
    })?;

    Ok(Json(ArticleResponse {
        article: render(new_doc),
    }))
}

/// `GET /v1/sabchat/kb/articles` — list articles with optional filters.
///
/// Filters compose: `portalId`, `categoryId`, `status`, and `q` (full
/// text search via `$text`). Pagination is page-based using
/// [`ARTICLES_PER_PAGE`].
#[instrument(skip_all)]
pub async fn list_articles(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Query(query): Query<ListArticlesQuery>,
) -> Result<Json<ListArticlesResponse>> {
    let tenant = tenant_oid(&user)?;
    let mut filter = doc! { "tenantId": tenant };

    if let Some(portal) = query
        .portal_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("portalId", oid_from_str(portal)?);
    }
    if let Some(category) = query
        .category_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("categoryId", oid_from_str(category)?);
    }
    if let Some(status) = query
        .status
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        check_article_status(status)?;
        filter.insert("status", status.to_owned());
    }
    if let Some(q) = query.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        // `$text` requires the orchestrator-managed text index.
        filter.insert("$text", doc! { "$search": q });
    }

    let coll = state.mongo.collection::<Document>(ARTICLES_COLL);
    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_kb_articles.count_documents"),
            )
        })?;

    let page = query.page.max(1);
    let skip = (page - 1).saturating_mul(ARTICLES_PER_PAGE as u64);
    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1, "_id": -1 })
        .skip(skip)
        .limit(ARTICLES_PER_PAGE)
        .build();
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_kb_articles.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_kb_articles.collect"))
    })?;
    let articles: Vec<Value> = docs.into_iter().map(render).collect();

    Ok(Json(ListArticlesResponse { articles, total }))
}

/// `GET /v1/sabchat/kb/articles/{id}` — fetch one article by id. Unlike
/// the public counterpart this does **not** bump `viewCount`; it's the
/// agent-side read for editing.
#[instrument(skip_all, fields(article_id = %id))]
pub async fn get_article(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Path(id): Path<String>,
) -> Result<Json<ArticleResponse>> {
    let tenant = tenant_oid(&user)?;
    let doc = load_scoped(
        &state.mongo,
        ARTICLES_COLL,
        tenant,
        &id,
        "Article not found.",
    )
    .await?;
    Ok(Json(ArticleResponse {
        article: render(doc),
    }))
}

/// `PATCH /v1/sabchat/kb/articles/{id}` — partial update. Slug renames
/// re-check `(portalId, language)` uniqueness. Status transitions that
/// move the article to `published` stamp `publishedAt = now` (idempotent
/// — re-publishing doesn't clobber an existing stamp). Use the dedicated
/// `/publish` and `/archive` endpoints for the canonical lifecycle moves.
#[instrument(skip_all, fields(article_id = %id))]
pub async fn update_article(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateArticleBody>,
) -> Result<Json<ArticleResponse>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_scoped(
        &state.mongo,
        ARTICLES_COLL,
        tenant,
        &id,
        "Article not found.",
    )
    .await?;
    let article_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("article missing _id")))?;
    let portal_oid = existing
        .get_object_id("portalId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("article missing portalId")))?;
    let existing_lang = existing
        .get_str("language")
        .unwrap_or("en")
        .to_owned();
    let existing_slug = existing.get_str("slug").unwrap_or_default().to_owned();
    let existing_status = existing.get_str("status").unwrap_or("draft").to_owned();

    let mut set = Document::new();

    if let Some(category_id) = body.category_id.as_ref() {
        let trimmed = category_id.trim();
        if trimmed.is_empty() {
            set.insert("categoryId", Bson::Null);
        } else {
            set.insert("categoryId", oid_from_str(trimmed)?);
        }
    }
    if let Some(title) = body.title.as_deref() {
        let trimmed = require_non_empty("title", title)?;
        set.insert("title", trimmed);
    }
    if let Some(body_md) = body.body.as_ref() {
        set.insert("body", body_md.clone());
    }
    if let Some(tags) = body.tags.as_ref() {
        let arr: Vec<Bson> = tags.iter().cloned().map(Bson::String).collect();
        set.insert("tags", Bson::Array(arr));
    }
    if let Some(author_id) = body.author_id.as_ref() {
        let trimmed = author_id.trim();
        if trimmed.is_empty() {
            set.insert("authorId", Bson::Null);
        } else {
            set.insert("authorId", oid_from_str(trimmed)?);
        }
    }

    // Slug + language together affect the uniqueness key — resolve the
    // "new" pair and check exactly once if either side changed.
    let new_slug = match body.slug.as_deref() {
        Some(s) => require_non_empty("slug", s)?.to_owned(),
        None => existing_slug.clone(),
    };
    let new_language = match body.language.as_deref() {
        Some(s) => require_non_empty("language", s)?.to_owned(),
        None => existing_lang.clone(),
    };
    if new_slug != existing_slug || new_language != existing_lang {
        let coll = state.mongo.collection::<Document>(ARTICLES_COLL);
        let dup = coll
            .find_one(doc! {
                "tenantId": tenant,
                "portalId": portal_oid,
                "language": &new_language,
                "slug": &new_slug,
                "_id": { "$ne": article_oid },
            })
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("sabchat_kb_articles.find_one(slug_dup)"),
                )
            })?;
        if dup.is_some() {
            return Err(ApiError::Conflict(format!(
                "Article slug `{new_slug}` already exists in this portal for language `{new_language}`."
            )));
        }
        if body.slug.is_some() {
            set.insert("slug", &new_slug);
        }
        if body.language.is_some() {
            set.insert("language", &new_language);
        }
    }

    if let Some(status) = body.status.as_deref() {
        let trimmed = require_non_empty("status", status)?.to_owned();
        check_article_status(&trimmed)?;
        set.insert("status", &trimmed);
        // Stamp publishedAt the first time we cross into `published`.
        if trimmed == "published" && existing_status != "published" {
            set.insert("publishedAt", bson::DateTime::from_chrono(Utc::now()));
        }
    }

    if set.is_empty() {
        return Ok(Json(ArticleResponse {
            article: render(existing),
        }));
    }

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    set.insert("updatedAt", now_bson);

    let coll = state.mongo.collection::<Document>(ARTICLES_COLL);
    coll.update_one(
        doc! { "_id": article_oid, "tenantId": tenant },
        doc! { "$set": set },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_kb_articles.update_one"))
    })?;

    let fresh = load_scoped(
        &state.mongo,
        ARTICLES_COLL,
        tenant,
        &id,
        "Article not found.",
    )
    .await?;
    Ok(Json(ArticleResponse {
        article: render(fresh),
    }))
}

/// `DELETE /v1/sabchat/kb/articles/{id}` — remove an article.
#[instrument(skip_all, fields(article_id = %id))]
pub async fn delete_article(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&user)?;
    let article_oid = oid_from_str(&id)?;
    let coll = state.mongo.collection::<Document>(ARTICLES_COLL);
    let res = coll
        .delete_one(doc! { "_id": article_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_kb_articles.delete_one"))
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Article not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

/// `POST /v1/sabchat/kb/articles/{id}/publish` — canonical
/// publish-lifecycle move. Sets `status = "published"`, stamps
/// `publishedAt = now` on first publish, and bumps `updatedAt`.
///
/// Re-publishing an already-published article is a no-op for
/// `publishedAt` (we don't overwrite the original launch stamp) but
/// still bumps `updatedAt` for cache invalidation.
#[instrument(skip_all, fields(article_id = %id))]
pub async fn publish_article(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Path(id): Path<String>,
) -> Result<Json<ArticleResponse>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_scoped(
        &state.mongo,
        ARTICLES_COLL,
        tenant,
        &id,
        "Article not found.",
    )
    .await?;
    let article_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("article missing _id")))?;
    let existing_status = existing.get_str("status").unwrap_or("draft").to_owned();
    let already_stamped = existing
        .get("publishedAt")
        .map(|b| !matches!(b, Bson::Null))
        .unwrap_or(false);

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let mut set = doc! {
        "status": "published",
        "updatedAt": now_bson,
    };
    if !already_stamped || existing_status != "published" {
        set.insert("publishedAt", now_bson);
    }

    let coll = state.mongo.collection::<Document>(ARTICLES_COLL);
    coll.update_one(
        doc! { "_id": article_oid, "tenantId": tenant },
        doc! { "$set": set },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_kb_articles.update_one(publish)"),
        )
    })?;

    let fresh = load_scoped(
        &state.mongo,
        ARTICLES_COLL,
        tenant,
        &id,
        "Article not found.",
    )
    .await?;
    Ok(Json(ArticleResponse {
        article: render(fresh),
    }))
}

/// `POST /v1/sabchat/kb/articles/{id}/archive` — canonical
/// archive-lifecycle move. Sets `status = "archived"` and bumps
/// `updatedAt`. The article disappears from the public surface (which
/// filters on `status = "published"`).
#[instrument(skip_all, fields(article_id = %id))]
pub async fn archive_article(
    user: AuthUser,
    State(state): State<SabChatKnowledgeState>,
    Path(id): Path<String>,
) -> Result<Json<ArticleResponse>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_scoped(
        &state.mongo,
        ARTICLES_COLL,
        tenant,
        &id,
        "Article not found.",
    )
    .await?;
    let article_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("article missing _id")))?;

    let now_bson = bson::DateTime::from_chrono(Utc::now());

    let coll = state.mongo.collection::<Document>(ARTICLES_COLL);
    coll.update_one(
        doc! { "_id": article_oid, "tenantId": tenant },
        doc! {
            "$set": {
                "status": "archived",
                "updatedAt": now_bson,
            },
        },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_kb_articles.update_one(archive)"),
        )
    })?;

    let fresh = load_scoped(
        &state.mongo,
        ARTICLES_COLL,
        tenant,
        &id,
        "Article not found.",
    )
    .await?;
    Ok(Json(ArticleResponse {
        article: render(fresh),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn article_status_whitelist() {
        assert!(check_article_status("draft").is_ok());
        assert!(check_article_status("published").is_ok());
        assert!(check_article_status("archived").is_ok());
        assert!(check_article_status("deleted").is_err());
        assert!(check_article_status("").is_err());
    }

    #[test]
    fn require_non_empty_trims() {
        assert_eq!(require_non_empty("name", "  hi  ").unwrap(), "hi");
        assert!(require_non_empty("name", "   ").is_err());
    }
}
