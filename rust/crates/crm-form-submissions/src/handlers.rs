//! HTTP handlers for the Form Submission entity.
//!
//! Every authenticated handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the router
//! constructors in [`crate::router`]):
//!
//! - `/v1/crm/form-submissions` (legacy) — `userId == AuthUser.user_id`.
//!   Unchanged behaviour.
//! - `/v1/sabcrm/form-submissions` (SabCRM suite) — `projectId ==
//!   ?projectId` / body `projectId`, required per-request (4xx when
//!   absent). Membership is validated by the Next.js action gate before
//!   the request reaches Rust.
//!
//! [`public_submit`] is the one UNauthenticated handler: it resolves a
//! published form by its public id (or slug), inherits the form's tenant
//! (`userId` + optional `projectId`), records the submission, bumps the
//! form's `submissionCount`, dispatches the form's signed webhook
//! (HMAC-SHA256 over the JSON payload, `X-Form-Webhook-Signature` header —
//! same contract as the legacy `dispatchPostSubmit`), and echoes the
//! configured success message / redirect URL.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use crm_core::{ScopeMode, TenantScope, sabcrm_project_oid};
use futures::TryStreamExt;
use hmac::{Hmac, Mac};
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use sha2::Sha256;
use tracing::{instrument, warn};

use crate::dto::{
    CreateSubmissionInput, CreateSubmissionResponse, DeleteSubmissionResponse, ListQuery,
    PublicSubmitInput, PublicSubmitResponse, ScopeQuery, UpdateSubmissionInput,
};
use crate::types::CrmFormSubmission;

const COLL: &str = "crm_form_submissions";
const FORMS_COLL: &str = "crm_forms";
const ENTITY_KIND: &str = "form_submission";

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

fn list_filter(scope: &TenantScope, status: Option<&str>, form_id: Option<ObjectId>) -> Document {
    let mut filter = scope.filter();
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "new" | "processed" | "spam" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(fid) = form_id {
        filter.insert("formId", fid);
    }
    filter
}

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut filter = scope.filter();
    filter.insert("_id", oid);
    filter
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn submission_from_create(
    input: CreateSubmissionInput,
    user_id: ObjectId,
    project_id: Option<ObjectId>,
) -> Result<CrmFormSubmission> {
    let form_id = ObjectId::parse_str(input.form_id.trim())
        .map_err(|_| ApiError::Validation("formId must be a valid ObjectId".to_owned()))?;
    Ok(CrmFormSubmission {
        id: None,
        user_id,
        project_id,
        form_id,
        data: input.data.unwrap_or_default(),
        source_url: input.source_url,
        ip_address: input.ip_address,
        user_agent: input.user_agent,
        referrer: input.referrer,
        status: "new".to_owned(),
        processed_at: None,
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSubmissionInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.data {
        set.insert("data", v);
    }
    if let Some(v) = patch.source_url {
        set.insert("sourceUrl", v);
    }
    if let Some(v) = patch.ip_address {
        set.insert("ipAddress", v);
    }
    if let Some(v) = patch.user_agent {
        set.insert("userAgent", v);
    }
    if let Some(v) = patch.referrer {
        set.insert("referrer", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.processed_at.as_deref().and_then(parse_date) {
        set.insert("processedAt", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmFormSubmission) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmFormSubmission>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_submissions(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let form_id = match q
        .form_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(raw) => Some(
            ObjectId::parse_str(raw)
                .map_err(|_| ApiError::Validation("formId must be a valid ObjectId".to_owned()))?,
        ),
        None => None,
    };
    let mut filter = list_filter(&scope, q.status.as_deref(), form_id);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["sourceUrl", "ipAddress", "userAgent", "notes"]);
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
    let coll = mongo.collection::<CrmFormSubmission>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.find"))
    })?;
    let mut rows: Vec<CrmFormSubmission> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.collect"))
    })?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %submission_id))]
pub async fn get_submission(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(submission_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<CrmFormSubmission>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&submission_id)?;
    let coll = mongo.collection::<CrmFormSubmission>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("form_submission".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_submission(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSubmissionInput>,
) -> Result<Json<CreateSubmissionResponse>> {
    let user_id = user_oid(&user)?;
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let project_id = match scope {
        TenantScope::Project(p) => Some(p),
        TenantScope::User(_) => None,
    };
    let mut entity = submission_from_create(input, user_id, project_id)?;
    let coll = mongo.collection::<CrmFormSubmission>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateSubmissionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %submission_id))]
pub async fn update_submission(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(submission_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(patch): Json<UpdateSubmissionInput>,
) -> Result<Json<CrmFormSubmission>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&submission_id)?;
    let coll = mongo.collection::<CrmFormSubmission>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("form_submission".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("form_submission".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("form_submission".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %submission_id))]
pub async fn delete_submission(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(submission_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<DeleteSubmissionResponse>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&submission_id)?;
    let coll = mongo.collection::<CrmFormSubmission>(COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("form_submission".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteSubmissionResponse { deleted: true }))
}

// =========================================================================
// Public (unauthenticated) — submit endpoint
// =========================================================================

/// Build the `{_id | slug}` lookup filter for a public id (24-char hex →
/// `_id`, anything else → `slug`); archived forms always excluded.
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

/// Webhook config resolved from the form's settings.
struct WebhookConfig {
    url: String,
    secret: String,
}

/// Read post-submit behaviour (success message / redirect URL / webhook)
/// from the form's `settings`, mirroring the legacy precedence:
/// `settings.postSubmit.*` first, bare `settings.*` as fallback.
fn post_submit_config(form: &Document) -> (String, Option<String>, Option<WebhookConfig>) {
    let settings = form.get_document("settings").ok();
    let post = settings.and_then(|s| s.get_document("postSubmit").ok());

    let message = post
        .and_then(|p| p.get_str("successMessage").ok())
        .filter(|s| !s.trim().is_empty())
        .or_else(|| {
            settings
                .and_then(|s| s.get_str("successMessage").ok())
                .filter(|s| !s.trim().is_empty())
        })
        .unwrap_or("Submission successful.")
        .to_owned();

    let redirect_url = post
        .and_then(|p| p.get_str("redirectUrl").ok())
        .filter(|s| !s.trim().is_empty())
        .or_else(|| {
            settings
                .and_then(|s| s.get_str("redirectUrl").ok())
                .filter(|s| !s.trim().is_empty())
        })
        .map(str::to_owned);

    let webhook = post
        .and_then(|p| p.get_document("webhook").ok())
        .or_else(|| settings.and_then(|s| s.get_document("webhook").ok()))
        .and_then(|w| {
            let enabled = w.get_bool("enabled").unwrap_or(false);
            let url = w.get_str("url").unwrap_or("").trim().to_owned();
            if !enabled || url.is_empty() {
                return None;
            }
            Some(WebhookConfig {
                url,
                secret: w.get_str("secret").unwrap_or("").to_owned(),
            })
        });

    (message, redirect_url, webhook)
}

/// HMAC-SHA256 hex signature over `payload` — the legacy
/// `X-Form-Webhook-Signature` contract (`createHmac('sha256', secret)`).
fn webhook_signature(secret: &str, payload: &str) -> Option<String> {
    if secret.is_empty() {
        return None;
    }
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(payload.as_bytes());
    Some(hex::encode(mac.finalize().into_bytes()))
}

/// Fire the form's webhook (best effort — failures are logged, never
/// surfaced to the submitter), preserving the legacy payload + signed
/// header behaviour.
async fn dispatch_webhook(webhook: WebhookConfig, form_id: &ObjectId, form_name: &str, data: &Document) {
    let payload = serde_json::json!({
        "formId": form_id.to_hex(),
        "formName": form_name,
        "submittedAt": Utc::now().to_rfc3339(),
        "data": Bson::Document(data.clone()).into_relaxed_extjson(),
    })
    .to_string();

    let client = reqwest::Client::new();
    let mut req = client
        .post(&webhook.url)
        .header("Content-Type", "application/json");
    if let Some(signature) = webhook_signature(&webhook.secret, &payload) {
        req = req.header("X-Form-Webhook-Signature", signature);
    }
    if let Err(e) = req.body(payload).send().await {
        warn!(error = %e, url = %webhook.url, "form webhook dispatch failed");
    }
}

/// `POST /v1/sabcrm/form-submissions/public/{publicId}` — UNauthenticated
/// public form submission. The tenant comes from the form document itself
/// (`userId` + optional `projectId`), never from the caller:
///
/// 1. resolve the form by `_id` / `slug` (archived → 404);
/// 2. insert the submission under the form's tenant scope;
/// 3. `$inc` the form's `submissionCount`;
/// 4. dispatch the configured webhook (HMAC-SHA256 signed, best effort);
/// 5. echo the configured success message / redirect URL.
#[instrument(skip_all, fields(public_id = %public_id))]
pub async fn public_submit(
    State(mongo): State<MongoHandle>,
    Path(public_id): Path<String>,
    Json(input): Json<PublicSubmitInput>,
) -> Result<Json<PublicSubmitResponse>> {
    let filter = public_lookup_filter(&public_id)?;
    let forms = mongo.collection::<Document>(FORMS_COLL);
    let form = forms
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.public_find")))?
        .ok_or_else(|| ApiError::NotFound("form".to_owned()))?;

    let form_id = form
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("form _id was not ObjectId")))?;
    // The form document carries its tenant — submissions inherit it.
    let owner_id = form
        .get_object_id("userId")
        .map_err(|_| ApiError::NotFound("form".to_owned()))?;
    let project_id = form.get_object_id("projectId").ok();

    let data = input.data.unwrap_or_default();
    let entity = CrmFormSubmission {
        id: None,
        user_id: owner_id,
        project_id,
        form_id,
        data: data.clone(),
        source_url: input.source_url,
        ip_address: None,
        user_agent: input.user_agent,
        referrer: input.referrer,
        status: "new".to_owned(),
        processed_at: None,
        notes: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<CrmFormSubmission>(COLL);
    coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.public_insert"))
    })?;

    // Bump the parent form's submission counter (best effort).
    if let Err(e) = forms
        .update_one(
            doc! { "_id": form_id },
            doc! { "$inc": { "submissionCount": 1 } },
        )
        .await
    {
        warn!(error = %e, "submissionCount increment failed");
    }

    let (message, redirect_url, webhook) = post_submit_config(&form);
    if let Some(webhook) = webhook {
        let form_name = form.get_str("name").unwrap_or("").to_owned();
        dispatch_webhook(webhook, &form_id, &form_name, &data).await;
    }

    Ok(Json(PublicSubmitResponse {
        success: true,
        message,
        redirect_url,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::User(oid), None, None);
        assert!(f.contains_key("status"));
        // Default branch sets `status: { $ne: "archived" }`, not a plain string.
        let status = f.get("status").and_then(|b| b.as_document()).unwrap();
        assert_eq!(status.get_str("$ne").unwrap(), "archived");
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
    }

    #[test]
    fn list_filter_scopes_by_form_id_when_provided() {
        let user = ObjectId::new();
        let form = ObjectId::new();
        let f = list_filter(&TenantScope::User(user), Some("new"), Some(form));
        assert_eq!(f.get_object_id("formId").unwrap(), form);
        assert_eq!(f.get_str("status").unwrap(), "new");
    }

    #[test]
    fn list_filter_project_scope_filters_project_id() {
        let project = ObjectId::new();
        let f = list_filter(&TenantScope::Project(project), None, None);
        assert_eq!(f.get_object_id("projectId").unwrap(), project);
        assert!(!f.contains_key("userId"));
    }

    #[test]
    fn submission_from_create_rejects_bad_form_id() {
        let user_id = ObjectId::new();
        let input = CreateSubmissionInput {
            form_id: "not-an-object-id".into(),
            ..Default::default()
        };
        assert!(submission_from_create(input, user_id, None).is_err());
    }

    #[test]
    fn submission_from_create_stamps_project_scope() {
        let user_id = ObjectId::new();
        let project_id = ObjectId::new();
        let input = CreateSubmissionInput {
            form_id: ObjectId::new().to_hex(),
            ..Default::default()
        };
        let s = submission_from_create(input, user_id, Some(project_id)).unwrap();
        assert_eq!(s.project_id, Some(project_id));
        assert_eq!(s.status, "new");
    }

    #[test]
    fn webhook_signature_is_hex_sha256_and_deterministic() {
        let sig = webhook_signature("secret", "payload").unwrap();
        assert_eq!(sig.len(), 64);
        assert!(sig.chars().all(|c| c.is_ascii_hexdigit()));
        assert_eq!(sig, webhook_signature("secret", "payload").unwrap());
        assert_ne!(sig, webhook_signature("other", "payload").unwrap());
        // Empty secret ⇒ unsigned dispatch, mirroring the legacy behaviour.
        assert!(webhook_signature("", "payload").is_none());
    }

    #[test]
    fn post_submit_config_reads_nested_then_flat() {
        let form = doc! {
            "settings": {
                "successMessage": "flat",
                "postSubmit": {
                    "successMessage": "nested",
                    "redirectUrl": "https://r",
                    "webhook": { "enabled": true, "url": "https://w", "secret": "s" },
                },
            },
        };
        let (msg, redirect, webhook) = post_submit_config(&form);
        assert_eq!(msg, "nested");
        assert_eq!(redirect.as_deref(), Some("https://r"));
        let w = webhook.unwrap();
        assert_eq!(w.url, "https://w");
        assert_eq!(w.secret, "s");
    }

    #[test]
    fn post_submit_config_defaults() {
        let form = doc! {};
        let (msg, redirect, webhook) = post_submit_config(&form);
        assert_eq!(msg, "Submission successful.");
        assert!(redirect.is_none());
        assert!(webhook.is_none());
    }

    #[test]
    fn public_lookup_filter_branches_on_id_shape() {
        let oid = ObjectId::new();
        let by_id = public_lookup_filter(&oid.to_hex()).unwrap();
        assert_eq!(by_id.get_object_id("_id").unwrap(), oid);
        let by_slug = public_lookup_filter("contact-us").unwrap();
        assert_eq!(by_slug.get_str("slug").unwrap(), "contact-us");
        assert!(public_lookup_filter("  ").is_err());
    }
}
