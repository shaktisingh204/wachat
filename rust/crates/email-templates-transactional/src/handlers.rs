//! HTTP handlers for the transactional templates surface.
//!
//! Conventions (mirrored from `email-campaigns::handlers`):
//!
//! - Every handler returns `Result<Json<T>, ApiError>`.
//! - Every handler takes [`AuthUser`] — no anonymous access.
//! - Every Mongo filter pins `userId = ObjectId(AuthUser.tenant_id)` so
//!   tenant scoping is enforced at the query layer.
//!
//! The `test-send` and full `dispatch` paths intentionally do not enqueue
//! here yet — the orchestrating `api` crate will inject a queue producer
//! once we settle on a queue name shared with `email-sender`. The
//! placeholder returns `202 Accepted` with `{ queued: 0 }` so the UI can
//! still wire the button.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use regex::Regex;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::bson_helpers::oid_from_str;
use serde_json::{Value, json};
use tracing::{instrument, warn};

use crate::dto::{
    CreateTransactionalTemplateBody, ListResponse, MessageResponse, PreviewBody, PreviewResponse,
    TestSendBody, TransactionalTemplatesQuery, UpdateTransactionalTemplateBody,
};
use crate::state::EmailTemplatesTransactionalState;

/// Mongo collection name. New, distinct from `email_templates` (which is
/// the marketing-side builder collection).
const COLL: &str = "email_transactional_templates";

// ===========================================================================
// Helpers
// ===========================================================================

fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    oid_from_str(&user.tenant_id)
}

fn doc_to_json(d: Document) -> Result<Value> {
    serde_json::to_value(d)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("doc → json")))
}

/// Lightweight `{{ var }}` substitution. Production rendering should
/// move to a real template engine (handlebars / liquid) — for now this
/// is enough to power the editor preview and matches what the existing
/// marketing template render does for inline merges.
fn render_merge(template: &str, vars: &Value) -> (String, Vec<String>) {
    // matches {{ name }} or {{name}} — name = ident-ish characters.
    let re = Regex::new(r"\{\{\s*([A-Za-z0-9_.]+)\s*\}\}").expect("static regex");
    let mut missing: Vec<String> = Vec::new();
    let out = re
        .replace_all(template, |caps: &regex::Captures<'_>| {
            let key = &caps[1];
            match vars.get(key) {
                Some(Value::Null) | None => {
                    missing.push(key.to_string());
                    String::new()
                }
                Some(Value::String(s)) => s.clone(),
                Some(other) => other.to_string(),
            }
        })
        .into_owned();
    missing.sort();
    missing.dedup();
    (out, missing)
}

async fn load_one(
    state: &EmailTemplatesTransactionalState,
    user: &AuthUser,
    id_hex: &str,
) -> Result<Document> {
    let tenant = tenant_oid(user)?;
    let oid = oid_from_str(id_hex)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.find_one(doc! { "_id": oid, "userId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("transactional_templates.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound(format!("transactional template {id_hex}")))
}

// ===========================================================================
// LIST / GET / CREATE / UPDATE / DELETE
// ===========================================================================

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_templates(
    State(state): State<EmailTemplatesTransactionalState>,
    user: AuthUser,
    Query(q): Query<TransactionalTemplatesQuery>,
) -> Result<Json<ListResponse<Value>>> {
    let tenant = tenant_oid(&user)?;
    let mut filter = doc! { "userId": tenant };

    if !q.archived.unwrap_or(false) {
        filter.insert("archived", doc! { "$ne": true });
    } else {
        filter.insert("archived", true);
    }

    if let Some(needle) = q.q.as_deref().filter(|s| !s.is_empty()) {
        let pat = regex::escape(needle);
        filter.insert(
            "$or",
            vec![
                doc! { "name": { "$regex": &pat, "$options": "i" } },
                doc! { "key":  { "$regex": &pat, "$options": "i" } },
            ],
        );
    }

    let coll = state.mongo.collection::<Document>(COLL);

    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("count_documents")))?;

    let skip = (q.page.saturating_sub(1)) * q.limit;
    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1 })
        .skip(skip)
        .limit(q.limit as i64)
        .build();

    let mut cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("find")))?;

    let mut items = Vec::with_capacity(q.limit as usize);
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("cursor")))?
    {
        items.push(doc_to_json(d)?);
    }

    let has_more = skip + (items.len() as u64) < total;
    Ok(Json(ListResponse {
        items,
        total,
        page: q.page,
        limit: q.limit,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn get_template(
    State(state): State<EmailTemplatesTransactionalState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let d = load_one(&state, &user, &id).await?;
    Ok(Json(doc_to_json(d)?))
}

#[instrument(skip_all, fields(user_id = %user.user_id, key = %body.key))]
pub async fn create_template(
    State(state): State<EmailTemplatesTransactionalState>,
    user: AuthUser,
    Json(body): Json<CreateTransactionalTemplateBody>,
) -> Result<(StatusCode, Json<Value>)> {
    let tenant = tenant_oid(&user)?;
    let coll = state.mongo.collection::<Document>(COLL);

    // Guard: key must be unique per tenant.
    let dup = coll
        .find_one(doc! { "userId": &tenant, "key": &body.key })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("dup-check")))?;
    if dup.is_some() {
        return Err(ApiError::BadRequest(format!(
            "transactional template key `{}` already in use",
            body.key
        )));
    }

    let now = Utc::now();
    let new_id = ObjectId::new();
    let vars_bson = bson::to_bson(&body.vars).unwrap_or(bson::Bson::Array(vec![]));

    let mut d = doc! {
        "_id": new_id,
        "userId": tenant,
        "name": &body.name,
        "key": &body.key,
        "subject": &body.subject,
        "htmlBody": &body.html_body,
        "vars": vars_bson,
        "archived": false,
        "version": 1u32,
        "keyHistory": Vec::<String>::new(),
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(v) = body.preheader { d.insert("preheader", v); }
    if let Some(v) = body.text_body { d.insert("textBody", v); }
    if let Some(v) = body.from_name { d.insert("fromName", v); }
    if let Some(v) = body.from_email { d.insert("fromEmail", v); }
    if let Some(v) = body.reply_to { d.insert("replyTo", v); }

    coll.insert_one(d.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("insert_one")))?;

    Ok((StatusCode::CREATED, Json(doc_to_json(d)?)))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_template(
    State(state): State<EmailTemplatesTransactionalState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateTransactionalTemplateBody>,
) -> Result<Json<Value>> {
    let existing = load_one(&state, &user, &id).await?;

    let mut set = doc! { "updatedAt": Utc::now() };
    let mut inc_version = false;

    if let Some(v) = body.name { set.insert("name", v); }
    if let Some(v) = body.subject { set.insert("subject", v); inc_version = true; }
    if let Some(v) = body.preheader { set.insert("preheader", v); }
    if let Some(v) = body.html_body { set.insert("htmlBody", v); inc_version = true; }
    if let Some(v) = body.text_body { set.insert("textBody", v); inc_version = true; }
    if let Some(v) = body.from_name { set.insert("fromName", v); }
    if let Some(v) = body.from_email { set.insert("fromEmail", v); }
    if let Some(v) = body.reply_to { set.insert("replyTo", v); }
    if let Some(v) = body.archived { set.insert("archived", v); }
    if let Some(v) = body.vars {
        let vars_bson = bson::to_bson(&v).unwrap_or(bson::Bson::Array(vec![]));
        set.insert("vars", vars_bson);
        inc_version = true;
    }

    // Key change — record old key in history, ensure new uniqueness.
    if let Some(new_key) = body.key {
        let old_key = existing.get_str("key").unwrap_or_default().to_string();
        if new_key != old_key {
            let tenant = tenant_oid(&user)?;
            let coll = state.mongo.collection::<Document>(COLL);
            let dup = coll
                .find_one(doc! { "userId": &tenant, "key": &new_key })
                .await
                .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("dup-check")))?;
            if dup.is_some() {
                return Err(ApiError::BadRequest(format!(
                    "transactional template key `{new_key}` already in use"
                )));
            }
            set.insert("key", &new_key);
        }
    }

    let oid = oid_from_str(&id)?;
    let tenant = tenant_oid(&user)?;
    let mut update = doc! { "$set": set };
    if inc_version {
        update.insert("$inc", doc! { "version": 1u32 });
    }
    if let Ok(old_key) = existing.get_str("key") {
        if let Some(new_key) = update
            .get_document("$set")
            .ok()
            .and_then(|s| s.get_str("key").ok())
        {
            if new_key != old_key {
                update.insert("$push", doc! { "keyHistory": old_key });
            }
        }
    }

    let coll = state.mongo.collection::<Document>(COLL);
    let updated = coll
        .find_one_and_update(doc! { "_id": oid, "userId": tenant }, update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("find_one_and_update")))?
        .ok_or_else(|| ApiError::NotFound(format!("transactional template {id}")))?;

    // Re-read to get the post-update document.
    let fresh = load_one(&state, &user, &id).await.unwrap_or(updated);
    Ok(Json(doc_to_json(fresh)?))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_template(
    State(state): State<EmailTemplatesTransactionalState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<MessageResponse>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    let res = coll
        .delete_one(doc! { "_id": oid, "userId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound(format!("transactional template {id}")));
    }
    Ok(Json(MessageResponse {
        message: format!("deleted {id}"),
    }))
}

// ===========================================================================
// Preview + test-send
// ===========================================================================

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn preview(
    State(state): State<EmailTemplatesTransactionalState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PreviewBody>,
) -> Result<Json<PreviewResponse>> {
    let d = load_one(&state, &user, &id).await?;
    let subject_src = d.get_str("subject").unwrap_or_default();
    let html_src = d.get_str("htmlBody").unwrap_or_default();
    let text_src = d.get_str("textBody").ok();

    let (subject, mut missing_a) = render_merge(subject_src, &body.vars);
    let (html, mut missing_b) = render_merge(html_src, &body.vars);
    let text = text_src.map(|t| render_merge(t, &body.vars).0);

    missing_a.append(&mut missing_b);
    missing_a.sort();
    missing_a.dedup();

    Ok(Json(PreviewResponse {
        subject,
        html,
        text,
        missing_vars: missing_a,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn test_send(
    State(state): State<EmailTemplatesTransactionalState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<TestSendBody>,
) -> Result<(StatusCode, Json<Value>)> {
    // Validate the template exists and is tenant-owned. The actual
    // enqueue is wired by the orchestrating `api` crate via a future
    // shared producer — see lib.rs TODO.
    let _d = load_one(&state, &user, &id).await?;
    if body.to_emails.is_empty() {
        return Err(ApiError::BadRequest("toEmails cannot be empty".into()));
    }
    warn!(
        target: "email-templates-transactional",
        "test-send placeholder: queue producer not yet wired"
    );
    Ok((
        StatusCode::ACCEPTED,
        Json(json!({ "queued": 0, "note": "queue producer pending wiring" })),
    ))
}
