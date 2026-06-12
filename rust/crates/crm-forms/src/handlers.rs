//! HTTP handlers for the lead-capture Form entity.
//!
//! Every authenticated handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the router
//! constructors in [`crate::router`]):
//!
//! - `/v1/crm/forms` (legacy) — `userId == AuthUser.user_id`. Unchanged
//!   behaviour.
//! - `/v1/sabcrm/forms` (SabCRM suite) — `projectId == ?projectId` /
//!   body `projectId`, required per-request (4xx when absent). Membership
//!   is validated by the Next.js action gate before the request reaches
//!   Rust.
//!
//! [`public_get_form`] is the one UNauthenticated handler: it resolves a
//! published form by its public id (or slug) for the public render page,
//! sanitising tenant ids and post-submit secrets out of the response.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use crm_core::{ScopeMode, TenantScope, sabcrm_project_oid};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use serde_json::{Value as JsonValue, json};
use tracing::instrument;

use crate::dto::{
    CreateFormInput, CreateFormResponse, DeleteFormResponse, ListQuery, ScopeQuery,
    UpdateFormInput,
};
use crate::types::CrmForm;

const COLL: &str = "crm_forms";
const ENTITY_KIND: &str = "form";

/// Resolve the per-request [`TenantScope`] from the mount's [`ScopeMode`].
/// Mirrors `crm_invoices::handlers::resolve_scope`.
fn resolve_scope(
    mode: ScopeMode,
    user: &AuthUser,
    project_id: Option<&str>,
) -> Result<TenantScope> {
    match mode {
        ScopeMode::User => Ok(TenantScope::User(user_oid(user)?)),
        ScopeMode::Project => Ok(TenantScope::Project(sabcrm_project_oid(project_id)?)),
    }
}

fn list_filter(scope: &TenantScope, status: Option<&str>) -> Document {
    let mut filter = scope.filter();
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "published" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut filter = scope.filter();
    filter.insert("_id", oid);
    filter
}

fn form_from_create(
    input: CreateFormInput,
    user_id: ObjectId,
    project_id: Option<ObjectId>,
) -> Result<CrmForm> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmForm {
        id: None,
        user_id,
        project_id,
        name: input.name.trim().to_owned(),
        slug: input
            .slug
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        url: input
            .url
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        fields: input.fields.unwrap_or_default(),
        settings: input.settings,
        submission_count: 0,
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateFormInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .name
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("name", v);
    }
    if let Some(v) = patch.slug {
        set.insert("slug", v);
    }
    if let Some(v) = patch.url {
        set.insert("url", v);
    }
    if let Some(v) = patch.fields {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|f| bson::to_document(&f).ok())
            .collect();
        set.insert("fields", arr);
    }
    if let Some(v) = patch.settings {
        if let Ok(bson_val) = bson::to_bson(&v) {
            set.insert("settings", bson_val);
        }
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmForm) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmForm>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_forms(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(&scope, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "slug", "url"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmForm>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.find")))?;
    let mut rows: Vec<CrmForm> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.collect")))?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %form_id))]
pub async fn get_form(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(form_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<CrmForm>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&form_id)?;
    let coll = mongo.collection::<CrmForm>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.find_one")))?
        .ok_or_else(|| ApiError::NotFound("form".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_form(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateFormInput>,
) -> Result<Json<CreateFormResponse>> {
    let user_id = user_oid(&user)?;
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let project_id = match scope {
        TenantScope::Project(p) => Some(p),
        TenantScope::User(_) => None,
    };
    let mut entity = form_from_create(input, user_id, project_id)?;
    let coll = mongo.collection::<CrmForm>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateFormResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %form_id))]
pub async fn update_form(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(form_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(patch): Json<UpdateFormInput>,
) -> Result<Json<CrmForm>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&form_id)?;
    let coll = mongo.collection::<CrmForm>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.find_one")))?
        .ok_or_else(|| ApiError::NotFound("form".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("form".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.refetch")))?
        .ok_or_else(|| ApiError::NotFound("form".to_owned()))?;
    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %form_id))]
pub async fn delete_form(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(form_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<DeleteFormResponse>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&form_id)?;
    let coll = mongo.collection::<CrmForm>(COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("form".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteFormResponse { deleted: true }))
}

// =========================================================================
// Public (unauthenticated) — form render endpoint
// =========================================================================

/// Sensitive `settings` keys that must NEVER reach the public renderer:
/// webhook URLs + secrets and notification recipient lists.
fn sanitize_settings(mut settings: JsonValue) -> JsonValue {
    if let Some(obj) = settings.as_object_mut() {
        obj.remove("webhook");
        obj.remove("emailNotifications");
        if let Some(post) = obj.get_mut("postSubmit").and_then(JsonValue::as_object_mut) {
            post.remove("webhook");
            post.remove("emailNotifications");
        }
    }
    settings
}

/// Build the `{_id | slug}` lookup filter for a public id: a 24-char hex
/// string resolves by `_id`, anything else by `slug`. Archived forms are
/// always excluded.
fn public_lookup_filter(public_id: &str) -> Result<Document> {
    let trimmed = public_id.trim();
    if trimmed.is_empty() {
        return Err(ApiError::Validation("form id is required".to_owned()));
    }
    let mut filter = match ObjectId::parse_str(trimmed) {
        Ok(oid) => doc! { "_id": oid },
        Err(_) => doc! { "slug": trimmed },
    };
    filter.insert("status", doc! { "$ne": "archived" });
    Ok(filter)
}

/// `GET /v1/sabcrm/forms/public/{publicId}` — UNauthenticated fetch of a
/// form for the public render page. Resolves by `_id` (24-char hex) or
/// `slug`; never returns archived forms. Tenant ids (`userId` /
/// `projectId`) and post-submit secrets are stripped from the response —
/// the form itself carries its tenant server-side, the renderer never
/// needs it.
#[instrument(skip_all, fields(public_id = %public_id))]
pub async fn public_get_form(
    State(mongo): State<MongoHandle>,
    Path(public_id): Path<String>,
) -> Result<Json<JsonValue>> {
    let filter = public_lookup_filter(&public_id)?;
    let coll = mongo.collection::<CrmForm>(COLL);
    let form = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.public_find")))?
        .ok_or_else(|| ApiError::NotFound("form".to_owned()))?;

    let settings = form.settings.map(sanitize_settings);
    Ok(Json(json!({
        "id": form.id.map(|o| o.to_hex()),
        "name": form.name,
        "slug": form.slug,
        "fields": form.fields,
        "settings": settings,
        "status": form.status,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::User(oid), None);
        assert!(f.contains_key("status"));
        // Default should exclude archived (via $ne), not pin a specific value.
        let status = f.get("status").unwrap();
        assert!(status.as_document().is_some());
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        assert!(!f.contains_key("projectId"));
    }

    #[test]
    fn list_filter_project_scope_filters_project_id() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::Project(oid), Some("published"));
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
        assert_eq!(f.get_str("status").unwrap(), "published");
    }

    #[test]
    fn form_from_create_defaults_status_and_submission_count() {
        let user_id = ObjectId::new();
        let input = CreateFormInput {
            name: "Contact Us".into(),
            ..Default::default()
        };
        let f = form_from_create(input, user_id, None).unwrap();
        assert_eq!(f.status, "draft");
        assert_eq!(f.submission_count, 0);
        assert!(f.fields.is_empty());
        assert!(f.id.is_none());
        assert!(f.project_id.is_none());
    }

    #[test]
    fn form_from_create_stamps_project_scope() {
        let user_id = ObjectId::new();
        let project_id = ObjectId::new();
        let input = CreateFormInput {
            name: "Contact Us".into(),
            ..Default::default()
        };
        let f = form_from_create(input, user_id, Some(project_id)).unwrap();
        assert_eq!(f.project_id, Some(project_id));
        assert_eq!(f.user_id, user_id);
    }

    #[test]
    fn form_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateFormInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(form_from_create(input, user_id, None).is_err());
    }

    #[test]
    fn sanitize_settings_strips_webhook_and_notifications() {
        let s = json!({
            "successMessage": "Thanks!",
            "webhook": { "url": "https://x", "secret": "s" },
            "postSubmit": {
                "successMessage": "Thanks!",
                "redirectUrl": "https://y",
                "webhook": { "url": "https://x", "secret": "s" },
                "emailNotifications": { "toEmails": ["a@b.c"] }
            }
        });
        let out = sanitize_settings(s);
        assert!(out.get("webhook").is_none());
        let post = out.get("postSubmit").unwrap();
        assert!(post.get("webhook").is_none());
        assert!(post.get("emailNotifications").is_none());
        assert_eq!(post.get("redirectUrl").unwrap(), "https://y");
    }

    #[test]
    fn public_lookup_filter_branches_on_id_shape() {
        let oid = ObjectId::new();
        let by_id = public_lookup_filter(&oid.to_hex()).unwrap();
        assert_eq!(by_id.get_object_id("_id").unwrap(), oid);
        let by_slug = public_lookup_filter("contact-us").unwrap();
        assert_eq!(by_slug.get_str("slug").unwrap(), "contact-us");
        assert!(public_lookup_filter("   ").is_err());
    }
}
