//! HTTP handlers for the email-templates surface.
//!
//! Conventions (mirrored from `wachat-broadcast::handlers`):
//!
//! - Every handler returns `Result<Json<T>, ApiError>`. The `ApiError`
//!   `IntoResponse` impl in `sabnode-common` renders a uniform
//!   `{ ok: false, error: ... }` envelope.
//! - Every handler takes [`AuthUser`] — there is no anonymous access.
//! - Tenancy: every Mongo read / write is filtered by
//!   `userId = user.tenant_id` (parsed as `ObjectId`). Cross-tenant
//!   data is never visible.
//! - Soft-delete: templates set `status = "archived"` rather than
//!   deleting the row.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateBlockInput, CreateBrandKitInput, CreateTemplateInput, DeleteResponse, EmailBrandKit,
    EmailBuilderDocument, EmailTemplateBlock, EmailTemplateV2, ListQuery, ListResponse,
    PreviewTemplateInput, RenderResponse, RenderTemplateInput, UpdateBrandKitInput,
    UpdateTemplateInput,
};
use crate::render::render_builder_to_html;
use crate::state::EmailTemplatesState;

/// Mongo collection names — single source of truth, matching the TS
/// constants in `src/lib/email/types.ts::EMAIL_COLLECTIONS`.
const TEMPLATES_COLL: &str = "email_templates";
const TEMPLATE_BLOCKS_COLL: &str = "email_template_blocks";
const BRAND_KITS_COLL: &str = "email_brand_kits";

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse `AuthUser.tenant_id` into an `ObjectId`. The whole crate
/// scopes every Mongo query by this id.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    oid_from_str(&user.tenant_id)
}

/// `{ userId: <tenant>, _id: <id>, status: { $ne: "archived" } }` —
/// the ownership + soft-delete guard every per-id read uses.
fn tenant_id_filter(tenant: ObjectId, id: ObjectId) -> Document {
    doc! {
        "_id": id,
        "userId": tenant,
        "status": { "$ne": "archived" },
    }
}

/// Skip helper for `?page=&limit=` pagination.
fn skip_for(page: u64, limit: u64) -> u64 {
    page.saturating_sub(1).saturating_mul(limit)
}

// ===========================================================================
// Templates — list / create / get / patch / delete / render / preview
// ===========================================================================

/// `GET /` — paginated, tenant-scoped list of templates.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_templates(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse<EmailTemplateV2>>> {
    let tenant = tenant_oid(&user)?;
    let mut filter = doc! {
        "userId": tenant,
        "status": { "$ne": "archived" },
    };
    if let Some(cat) = q.category.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", cat);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        // Mongo can't do case-insensitive search without a regex; for
        // template names a simple `$regex` is plenty.
        let pattern = bson::Regex {
            pattern: regex_escape(needle),
            options: "i".to_owned(),
        };
        filter.insert(
            "$or",
            vec![
                doc! { "name":     { "$regex": pattern.clone() } },
                doc! { "subject":  { "$regex": pattern.clone() } },
                doc! { "category": { "$regex": pattern } },
            ],
        );
    }

    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1, "createdAt": -1 })
        .skip(skip_for(q.page, q.limit))
        .limit(q.limit as i64)
        .build();
    let coll = state.mongo.collection::<EmailTemplateV2>(TEMPLATES_COLL);
    let cursor = coll
        .find(filter.clone())
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("templates.find")))?;
    let items: Vec<EmailTemplateV2> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("templates.collect")))?;
    let total = coll
        .count_documents(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("templates.count")))?;
    Ok(Json(ListResponse {
        items,
        total,
        page: q.page,
        limit: q.limit,
    }))
}

/// `GET /library` — curated library templates (`isLibrary: true`).
///
/// Library templates are visible to every tenant, so this list is NOT
/// tenant-scoped. (The legacy TS picked these from a seed collection
/// shared across all users.)
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_library(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse<EmailTemplateV2>>> {
    let _ = user; // auth-only — no tenant scoping.
    let mut filter = doc! {
        "isLibrary": true,
        "status": { "$ne": "archived" },
    };
    if let Some(cat) = q.category.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", cat);
    }
    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1, "createdAt": -1 })
        .skip(skip_for(q.page, q.limit))
        .limit(q.limit as i64)
        .build();

    let coll = state.mongo.collection::<EmailTemplateV2>(TEMPLATES_COLL);
    let cursor = coll
        .find(filter.clone())
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("library.find")))?;
    let items: Vec<EmailTemplateV2> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("library.collect")))?;
    let total = coll
        .count_documents(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("library.count")))?;
    Ok(Json(ListResponse {
        items,
        total,
        page: q.page,
        limit: q.limit,
    }))
}

/// `POST /` — create a new template.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_template(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Json(input): Json<CreateTemplateInput>,
) -> Result<Json<EmailTemplateV2>> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".into()));
    }
    let tenant = tenant_oid(&user)?;
    let brand_oid = match input.brand_kit_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    let now = Utc::now();
    let mut row = EmailTemplateV2 {
        id: None,
        user_id: tenant,
        name: input.name.trim().to_owned(),
        subject: input.subject,
        category: input.category,
        builder_json: input.builder_json,
        mjml: input.mjml,
        html: input.html,
        amp: input.amp,
        thumbnail_url: input.thumbnail_url,
        is_library: input.is_library,
        brand_kit_id: brand_oid,
        version: 1,
        status: "active".to_owned(),
        created_at: now,
        updated_at: now,
    };
    let coll = state.mongo.collection::<EmailTemplateV2>(TEMPLATES_COLL);
    let result = coll
        .insert_one(&row)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("templates.insert_one")))?;
    let new_id = result
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    row.id = Some(new_id);
    Ok(Json(row))
}

/// `GET /{template_id}` — single template read.
#[instrument(skip_all, fields(user_id = %user.user_id, template_id = %template_id))]
pub async fn get_template(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Path(template_id): Path<String>,
) -> Result<Json<EmailTemplateV2>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let coll = state.mongo.collection::<EmailTemplateV2>(TEMPLATES_COLL);
    let row = coll
        .find_one(tenant_id_filter(tenant, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("templates.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("template {template_id}")))?;
    Ok(Json(row))
}

/// `PATCH /{template_id}` — partial update.
#[instrument(skip_all, fields(user_id = %user.user_id, template_id = %template_id))]
pub async fn update_template(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Path(template_id): Path<String>,
    Json(patch): Json<UpdateTemplateInput>,
) -> Result<Json<EmailTemplateV2>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let coll = state.mongo.collection::<EmailTemplateV2>(TEMPLATES_COLL);

    let mut set = doc! { "updatedAt": bson::DateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.subject {
        set.insert("subject", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.builder_json {
        let doc_ = bson::to_bson(&v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("serialize builderJson"))
        })?;
        set.insert("builderJson", doc_);
    }
    if let Some(v) = patch.mjml {
        set.insert("mjml", v);
    }
    if let Some(v) = patch.html {
        set.insert("html", v);
    }
    if let Some(v) = patch.amp {
        set.insert("amp", v);
    }
    if let Some(v) = patch.thumbnail_url {
        set.insert("thumbnailUrl", v);
    }
    if let Some(v) = patch.is_library {
        set.insert("isLibrary", v);
    }
    if let Some(v) = patch.brand_kit_id {
        if v.is_empty() {
            set.insert("brandKitId", bson::Bson::Null);
        } else {
            set.insert("brandKitId", oid_from_str(&v)?);
        }
    }

    let result = coll
        .update_one(tenant_id_filter(tenant, oid), doc! { "$set": set, "$inc": { "version": 1 } })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("templates.update_one")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound(format!("template {template_id}")));
    }
    let after = coll
        .find_one(tenant_id_filter(tenant, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("templates.refetch")))?
        .ok_or_else(|| ApiError::NotFound(format!("template {template_id}")))?;
    Ok(Json(after))
}

/// `DELETE /{template_id}` — soft-delete (archive).
#[instrument(skip_all, fields(user_id = %user.user_id, template_id = %template_id))]
pub async fn delete_template(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Path(template_id): Path<String>,
) -> Result<Json<DeleteResponse>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let coll = state.mongo.collection::<EmailTemplateV2>(TEMPLATES_COLL);
    let result = coll
        .update_one(
            doc! { "_id": oid, "userId": tenant },
            doc! { "$set": {
                "status": "archived",
                "updatedAt": bson::DateTime::from_chrono(Utc::now()),
            } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("templates.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound(format!("template {template_id}")));
    }
    Ok(Json(DeleteResponse { deleted: true }))
}

/// `POST /{template_id}/render` — render the persisted `builderJson`
/// (or the optional body override) to HTML via MJML.
#[instrument(skip_all, fields(user_id = %user.user_id, template_id = %template_id))]
pub async fn render_template(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Path(template_id): Path<String>,
    Json(input): Json<RenderTemplateInput>,
) -> Result<Json<RenderResponse>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let templates = state.mongo.collection::<EmailTemplateV2>(TEMPLATES_COLL);
    let template = templates
        .find_one(tenant_id_filter(tenant, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("render.find_template")))?
        .ok_or_else(|| ApiError::NotFound(format!("template {template_id}")))?;

    let doc_for_render: EmailBuilderDocument = input
        .builder_json
        .or(template.builder_json.clone())
        .ok_or_else(|| ApiError::BadRequest("template has no builderJson to render".into()))?;

    let brand_kit_id = match input.brand_kit_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => template.brand_kit_id,
    };
    let brand = match brand_kit_id {
        Some(bid) => Some(load_brand_kit(&state.mongo, tenant, bid).await?),
        None => None,
    };

    let r = render_builder_to_html(&doc_for_render, brand.as_ref())?;
    Ok(Json(RenderResponse {
        html: r.html,
        mjml: r.mjml,
        warnings: r.warnings,
    }))
}

/// `POST /{template_id}/preview` — like `/render` but substitutes
/// `{{ key }}` merge tags using the supplied `sampleData` flat map.
#[instrument(skip_all, fields(user_id = %user.user_id, template_id = %template_id))]
pub async fn preview_template(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Path(template_id): Path<String>,
    Json(input): Json<PreviewTemplateInput>,
) -> Result<Json<RenderResponse>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let templates = state.mongo.collection::<EmailTemplateV2>(TEMPLATES_COLL);
    let template = templates
        .find_one(tenant_id_filter(tenant, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("preview.find_template")))?
        .ok_or_else(|| ApiError::NotFound(format!("template {template_id}")))?;

    let doc_for_render: EmailBuilderDocument = input
        .builder_json
        .or(template.builder_json.clone())
        .ok_or_else(|| ApiError::BadRequest("template has no builderJson to render".into()))?;

    let brand_kit_id = match input.brand_kit_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => template.brand_kit_id,
    };
    let brand = match brand_kit_id {
        Some(bid) => Some(load_brand_kit(&state.mongo, tenant, bid).await?),
        None => None,
    };

    let mut r = render_builder_to_html(&doc_for_render, brand.as_ref())?;
    if let Some(Value::Object(map)) = input.sample_data {
        for (k, v) in map.into_iter() {
            let needle = format!("{{{{{}}}}}", k.trim());
            let needle_spaced = format!("{{{{ {} }}}}", k.trim());
            let replacement = match v {
                Value::String(s) => s,
                other => other.to_string(),
            };
            r.html = r.html.replace(&needle, &replacement);
            r.html = r.html.replace(&needle_spaced, &replacement);
        }
    }
    Ok(Json(RenderResponse {
        html: r.html,
        mjml: r.mjml,
        warnings: r.warnings,
    }))
}

// ===========================================================================
// Reusable blocks
// ===========================================================================

/// `GET /blocks` — list reusable blocks for the tenant.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_blocks(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse<EmailTemplateBlock>>> {
    let tenant = tenant_oid(&user)?;
    let filter = doc! { "userId": tenant };
    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1, "createdAt": -1 })
        .skip(skip_for(q.page, q.limit))
        .limit(q.limit as i64)
        .build();
    let coll = state.mongo.collection::<EmailTemplateBlock>(TEMPLATE_BLOCKS_COLL);
    let cursor = coll
        .find(filter.clone())
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("blocks.find")))?;
    let items: Vec<EmailTemplateBlock> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("blocks.collect")))?;
    let total = coll
        .count_documents(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("blocks.count")))?;
    Ok(Json(ListResponse {
        items,
        total,
        page: q.page,
        limit: q.limit,
    }))
}

/// `POST /blocks` — save a reusable block.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_block(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Json(input): Json<CreateBlockInput>,
) -> Result<Json<EmailTemplateBlock>> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".into()));
    }
    let tenant = tenant_oid(&user)?;
    let now = Utc::now();
    let mut row = EmailTemplateBlock {
        id: None,
        user_id: tenant,
        name: input.name.trim().to_owned(),
        block: input.block,
        thumbnail_url: input.thumbnail_url,
        created_at: now,
        updated_at: now,
    };
    let coll = state.mongo.collection::<EmailTemplateBlock>(TEMPLATE_BLOCKS_COLL);
    let result = coll
        .insert_one(&row)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("blocks.insert_one")))?;
    let new_id = result
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    row.id = Some(new_id);
    Ok(Json(row))
}

/// `DELETE /blocks/{block_id}` — hard-delete a reusable block.
///
/// Blocks are cheap to recreate (no incoming references), so unlike
/// templates we delete the row outright rather than soft-archive.
#[instrument(skip_all, fields(user_id = %user.user_id, block_id = %block_id))]
pub async fn delete_block(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Path(block_id): Path<String>,
) -> Result<Json<DeleteResponse>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&block_id)?;
    let coll = state.mongo.collection::<EmailTemplateBlock>(TEMPLATE_BLOCKS_COLL);
    let result = coll
        .delete_one(doc! { "_id": oid, "userId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("blocks.delete_one")))?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound(format!("block {block_id}")));
    }
    Ok(Json(DeleteResponse { deleted: true }))
}

// ===========================================================================
// Brand kits
// ===========================================================================

/// `GET /brand-kits` — list brand kits for the tenant.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_brand_kits(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse<EmailBrandKit>>> {
    let tenant = tenant_oid(&user)?;
    let filter = doc! { "userId": tenant };
    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1, "createdAt": -1 })
        .skip(skip_for(q.page, q.limit))
        .limit(q.limit as i64)
        .build();
    let coll = state.mongo.collection::<EmailBrandKit>(BRAND_KITS_COLL);
    let cursor = coll
        .find(filter.clone())
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("brand_kits.find")))?;
    let items: Vec<EmailBrandKit> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("brand_kits.collect")))?;
    let total = coll
        .count_documents(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("brand_kits.count")))?;
    Ok(Json(ListResponse {
        items,
        total,
        page: q.page,
        limit: q.limit,
    }))
}

/// `POST /brand-kits` — create a brand kit.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_brand_kit(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Json(input): Json<CreateBrandKitInput>,
) -> Result<Json<EmailBrandKit>> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".into()));
    }
    if input.palette.primary.trim().is_empty() {
        return Err(ApiError::Validation("palette.primary is required".into()));
    }
    let tenant = tenant_oid(&user)?;
    let now = Utc::now();
    let mut row = EmailBrandKit {
        id: None,
        user_id: tenant,
        name: input.name.trim().to_owned(),
        logo: input.logo,
        palette: input.palette,
        fonts: input.fonts,
        social: input.social,
        footer: input.footer,
        created_at: now,
        updated_at: now,
    };
    let coll = state.mongo.collection::<EmailBrandKit>(BRAND_KITS_COLL);
    let result = coll
        .insert_one(&row)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("brand_kits.insert_one")))?;
    let new_id = result
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    row.id = Some(new_id);
    Ok(Json(row))
}

/// `GET /brand-kits/{kit_id}` — single brand kit read.
#[instrument(skip_all, fields(user_id = %user.user_id, kit_id = %kit_id))]
pub async fn get_brand_kit(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Path(kit_id): Path<String>,
) -> Result<Json<EmailBrandKit>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&kit_id)?;
    let row = load_brand_kit(&state.mongo, tenant, oid).await?;
    Ok(Json(row))
}

/// `PATCH /brand-kits/{kit_id}` — partial update.
#[instrument(skip_all, fields(user_id = %user.user_id, kit_id = %kit_id))]
pub async fn update_brand_kit(
    user: AuthUser,
    State(state): State<EmailTemplatesState>,
    Path(kit_id): Path<String>,
    Json(patch): Json<UpdateBrandKitInput>,
) -> Result<Json<EmailBrandKit>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&kit_id)?;
    let coll = state.mongo.collection::<EmailBrandKit>(BRAND_KITS_COLL);

    let mut set = doc! { "updatedAt": bson::DateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.logo {
        set.insert(
            "logo",
            bson::to_bson(&v).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("serialize logo"))
            })?,
        );
    }
    if let Some(v) = patch.palette {
        set.insert(
            "palette",
            bson::to_bson(&v).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("serialize palette"))
            })?,
        );
    }
    if let Some(v) = patch.fonts {
        set.insert(
            "fonts",
            bson::to_bson(&v).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("serialize fonts"))
            })?,
        );
    }
    if let Some(v) = patch.social {
        set.insert(
            "social",
            bson::to_bson(&v).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("serialize social"))
            })?,
        );
    }
    if let Some(v) = patch.footer {
        set.insert(
            "footer",
            bson::to_bson(&v).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("serialize footer"))
            })?,
        );
    }
    let result = coll
        .update_one(
            doc! { "_id": oid, "userId": tenant },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("brand_kits.update_one")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound(format!("brand kit {kit_id}")));
    }
    let after = load_brand_kit(&state.mongo, tenant, oid).await?;
    Ok(Json(after))
}

// ===========================================================================
// Internals
// ===========================================================================

/// Load a brand kit, scoped by tenant. Surfaces `404` when the kit
/// either doesn't exist or belongs to a different tenant.
async fn load_brand_kit(
    mongo: &MongoHandle,
    tenant: ObjectId,
    kit_id: ObjectId,
) -> Result<EmailBrandKit> {
    let coll = mongo.collection::<EmailBrandKit>(BRAND_KITS_COLL);
    coll.find_one(doc! { "_id": kit_id, "userId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("brand_kits.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("brand kit {}", kit_id.to_hex())))
}

/// Escape regex metacharacters in a user-supplied search needle so
/// `q=foo.bar` doesn't accidentally match `foo<any>bar`.
fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '.' | '+' | '*' | '?' | '(' | ')' | '[' | ']' | '{' | '}' | '|' | '^' | '$' | '\\' => {
                out.push('\\');
                out.push(ch);
            }
            _ => out.push(ch),
        }
    }
    out
}
