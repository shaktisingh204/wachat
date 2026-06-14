//! HTTP handlers for the SabSign envelopes API (`/v1/sabsign/envelopes`).
//!
//! Authenticated CRUD + lifecycle (`send`, `void`) is tenant-scoped by the
//! JWT `tid`. The public sign endpoints (`/{id}/sign`, `/{id}/submit`) carry
//! no session — the external signer is authenticated by a per-signer
//! `accessToken` that this module verifies against the stored envelope.
//!
//! Completion side-effects that need tenant context (signed-PDF generation,
//! SabFiles upload, e-mail) are intentionally NOT done here — the public
//! submit only advances the state machine + appends audit; the authed
//! Next.js `finalizeEnvelope` action performs the PDF/e-mail work.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::json;
use tracing::{instrument, warn};
use uuid::Uuid;

use crate::dto::{
    CreateEnvelopeInput, CreateResponse, DeleteResponse, ListQuery, ListResponse, SendBody,
    SignSubmissionInput, SignSubmissionResponse, SignViewQuery, SignViewResponse,
    UpdateEnvelopeInput, VoidBody,
};
use crate::types::{
    EnvelopeSigner, SabSignEnvelope, VALID_AUTH_METHODS, VALID_FIELD_TYPES, VALID_ROUTING_ORDERS,
    VALID_STATUSES,
};

const COLL: &str = "esign_envelopes";

// ── small helpers ────────────────────────────────────────────────────

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn gen_id() -> String {
    bson::oid::ObjectId::new().to_hex()
}

fn gen_token() -> String {
    format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple())
}

fn validate_routing_order(s: &str) -> Result<()> {
    if VALID_ROUTING_ORDERS.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "routingOrder must be one of {VALID_ROUTING_ORDERS:?}"
        )))
    }
}

fn validate_status(s: &str) -> Result<()> {
    if VALID_STATUSES.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "status must be one of {VALID_STATUSES:?}"
        )))
    }
}

/// Normalise + validate the signer list at create time: ensure every signer
/// has an id + access token + order + status, and a known auth method.
fn normalise_signers(signers: Option<Vec<EnvelopeSigner>>) -> Result<Vec<EnvelopeSigner>> {
    let mut out = Vec::new();
    for (i, mut s) in signers.unwrap_or_default().into_iter().enumerate() {
        if s.email.trim().is_empty() {
            return Err(ApiError::Validation("every signer needs an email".into()));
        }
        if s.id.trim().is_empty() {
            s.id = gen_token();
        }
        if s.access_token.as_deref().unwrap_or("").is_empty() {
            s.access_token = Some(gen_token());
        }
        if s.order == 0 {
            s.order = (i as i32) + 1;
        }
        if s.status.trim().is_empty() {
            s.status = "pending".into();
        }
        if s.auth_method.trim().is_empty() {
            s.auth_method = "email".into();
        }
        if !VALID_AUTH_METHODS.contains(&s.auth_method.as_str()) {
            return Err(ApiError::Validation(format!(
                "authMethod must be one of {VALID_AUTH_METHODS:?}"
            )));
        }
        out.push(s);
    }
    Ok(out)
}

fn validate_field_types(env: &SabSignEnvelope) -> Result<()> {
    for f in &env.fields {
        if !VALID_FIELD_TYPES.contains(&f.field_type.as_str()) {
            return Err(ApiError::Validation(format!(
                "unknown fieldType `{}` (expected one of {VALID_FIELD_TYPES:?})",
                f.field_type
            )));
        }
    }
    Ok(())
}

async fn load_scoped(mongo: &MongoHandle, tenant: &str, id: &str) -> Result<SabSignEnvelope> {
    mongo
        .collection::<SabSignEnvelope>(COLL)
        .find_one(doc! { "_id": id, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("envelope".into()))
}

async fn load_public(mongo: &MongoHandle, id: &str) -> Result<SabSignEnvelope> {
    mongo
        .collection::<SabSignEnvelope>(COLL)
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.find_pub")))?
        .ok_or_else(|| ApiError::NotFound("envelope".into()))
}

async fn replace_scoped(mongo: &MongoHandle, tenant: &str, env: &SabSignEnvelope) -> Result<()> {
    mongo
        .collection::<SabSignEnvelope>(COLL)
        .replace_one(doc! { "_id": &env.id, "tenantId": tenant }, env)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.replace")))?;
    Ok(())
}

async fn replace_public(mongo: &MongoHandle, env: &SabSignEnvelope) -> Result<()> {
    mongo
        .collection::<SabSignEnvelope>(COLL)
        .replace_one(doc! { "_id": &env.id }, env)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.replace_pub"))
        })?;
    Ok(())
}

async fn audit(
    mongo: &MongoHandle,
    env: &SabSignEnvelope,
    signer_id: Option<&str>,
    event_type: &str,
    ip: Option<&str>,
    data: Option<serde_json::Value>,
) {
    let actor = env.user_id.as_deref().unwrap_or(env.tenant_id.as_str());
    if let Err(e) = sabsign_audit::append_event(
        mongo,
        &env.tenant_id,
        &env.id,
        actor,
        signer_id,
        event_type,
        ip,
        data,
    )
    .await
    {
        warn!("[sabsign] audit append failed for {}: {}", env.id, e);
    }
}

/// Next signer to act, given `current` just completed. `None` ⇒ no one left.
fn next_signer(env: &SabSignEnvelope, current: &str) -> Option<String> {
    let pending: Vec<&EnvelopeSigner> = env
        .signers
        .iter()
        .filter(|s| s.id != current && s.status != "completed" && s.status != "declined")
        .collect();
    if pending.is_empty() {
        return None;
    }
    if env.routing_order == "sequential" {
        pending.iter().min_by_key(|s| s.order).map(|s| s.id.clone())
    } else {
        pending.first().map(|s| s.id.clone())
    }
}

// ── authenticated CRUD ───────────────────────────────────────────────

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_envelopes(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let mut filter = doc! { "tenantId": &user.tenant_id };
    if let Some(s) = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        if s != "all" {
            filter.insert("status", s);
        }
    }
    if let Some(t) = q
        .template_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("templateId", t);
    }
    if let Some(b) = q
        .bulk_batch_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("bulkBatchId", b);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "docName", "subject"]);
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
    let coll = mongo.collection::<SabSignEnvelope>(COLL);
    let mut rows: Vec<SabSignEnvelope> = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.find")))?
        .try_collect()
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.collect"))
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

#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn get_envelope(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabSignEnvelope>> {
    Ok(Json(load_scoped(&mongo, &user.tenant_id, &id).await?))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn create_envelope(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateEnvelopeInput>,
) -> Result<Json<CreateResponse>> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".into()));
    }
    if input.doc_id.trim().is_empty() {
        return Err(ApiError::Validation("docId is required".into()));
    }
    let routing_order = input.routing_order.unwrap_or_else(|| "sequential".into());
    validate_routing_order(&routing_order)?;

    let now = now_iso();
    let env = SabSignEnvelope {
        id: gen_id(),
        user_id: Some(user.user_id.clone()),
        tenant_id: user.tenant_id.clone(),
        name: input.name.trim().to_owned(),
        subject: input.subject,
        message: input.message,
        doc_id: input.doc_id,
        doc_url: input.doc_url,
        doc_name: input.doc_name,
        status: "draft".into(),
        routing_order,
        routing_rules: input.routing_rules,
        signers: normalise_signers(input.signers)?,
        fields: input.fields.unwrap_or_default(),
        expires_at: input.expires_at,
        reminder_days: input.reminder_days,
        completed_at: None,
        signed_doc_id: None,
        audit_trail_pdf_id: None,
        bulk_batch_id: input.bulk_batch_id,
        template_id: input.template_id,
        in_person: input.in_person,
        void_reason: None,
        created_at: now,
        updated_at: None,
    };
    validate_field_types(&env)?;

    mongo
        .collection::<SabSignEnvelope>(COLL)
        .insert_one(&env)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.insert")))?;
    audit(
        &mongo,
        &env,
        None,
        "submission.created",
        None,
        Some(json!({ "name": env.name, "signers": env.signers.len() })),
    )
    .await;

    Ok(Json(CreateResponse {
        id: env.id.clone(),
        entity: env,
    }))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn update_envelope(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateEnvelopeInput>,
) -> Result<Json<SabSignEnvelope>> {
    // Ensure it exists + is in this tenant.
    let _ = load_scoped(&mongo, &user.tenant_id, &id).await?;

    let mut set = doc! { "updatedAt": now_iso() };
    if let Some(v) = patch.name {
        set.insert("name", v.trim().to_owned());
    }
    if let Some(v) = patch.subject {
        set.insert("subject", v);
    }
    if let Some(v) = patch.message {
        set.insert("message", v);
    }
    if let Some(v) = patch.routing_order {
        validate_routing_order(&v)?;
        set.insert("routingOrder", v);
    }
    if let Some(v) = patch.status {
        validate_status(&v)?;
        set.insert("status", v);
    }
    if let Some(v) = patch.expires_at {
        set.insert("expiresAt", v);
    }
    if let Some(v) = patch.reminder_days {
        set.insert("reminderDays", v);
    }
    if let Some(v) = patch.routing_rules {
        set.insert(
            "routingRules",
            bson::to_bson(&v).map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?,
        );
    }
    if let Some(v) = patch.signers {
        let v = normalise_signers(Some(v))?;
        set.insert(
            "signers",
            bson::to_bson(&v).map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?,
        );
    }
    if let Some(v) = patch.fields {
        set.insert(
            "fields",
            bson::to_bson(&v).map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?,
        );
    }

    let update: Document = doc! { "$set": set };
    mongo
        .collection::<SabSignEnvelope>(COLL)
        .update_one(doc! { "_id": &id, "tenantId": &user.tenant_id }, update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.update")))?;

    Ok(Json(load_scoped(&mongo, &user.tenant_id, &id).await?))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn delete_envelope(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteResponse>> {
    let res = mongo
        .collection::<SabSignEnvelope>(COLL)
        .delete_one(doc! { "_id": &id, "tenantId": &user.tenant_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.delete")))?;
    Ok(Json(DeleteResponse {
        deleted: res.deleted_count > 0,
    }))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn send_envelope(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<SendBody>,
) -> Result<Json<SabSignEnvelope>> {
    let mut env = load_scoped(&mongo, &user.tenant_id, &id).await?;
    if env.status == "voided" {
        return Err(ApiError::Validation("a voided envelope cannot be sent".into()));
    }
    if env.signers.is_empty() {
        return Err(ApiError::Validation("envelope has no signers".into()));
    }
    let now = now_iso();
    // W0.1: notify ALL signers up-front so the Next.js action e-mails everyone.
    // (Sequential next-signer-only e-mailing is a W1 automation concern.)
    for s in &mut env.signers {
        if body.rotate_tokens || s.access_token.as_deref().unwrap_or("").is_empty() {
            s.access_token = Some(gen_token());
        }
        if s.status == "pending" {
            s.status = "notified".into();
            s.notified_at = Some(now.clone());
        }
    }
    env.status = "sent".into();
    env.updated_at = Some(now.clone());
    replace_scoped(&mongo, &user.tenant_id, &env).await?;
    audit(&mongo, &env, None, "submission.sent", None, None).await;
    Ok(Json(env))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn void_envelope(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<VoidBody>,
) -> Result<Json<SabSignEnvelope>> {
    let mut env = load_scoped(&mongo, &user.tenant_id, &id).await?;
    env.status = "voided".into();
    env.void_reason = body.reason.clone();
    env.updated_at = Some(now_iso());
    replace_scoped(&mongo, &user.tenant_id, &env).await?;
    audit(
        &mongo,
        &env,
        None,
        "submission.voided",
        None,
        body.reason.map(|r| json!({ "reason": r })),
    )
    .await;
    Ok(Json(env))
}

// ── public signer endpoints (no session) ─────────────────────────────

#[instrument(skip_all, fields(id = %id))]
pub async fn sign_view(
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(q): Query<SignViewQuery>,
) -> Result<Json<SignViewResponse>> {
    let mut env = load_public(&mongo, &id).await?;
    let ok = env
        .signers
        .iter()
        .any(|s| s.id == q.signer_id && s.access_token.as_deref() == Some(q.token.as_str()));
    if !ok {
        return Err(ApiError::Unauthorized("invalid signer or token".into()));
    }
    if env.status == "voided" || env.status == "expired" {
        return Err(ApiError::Validation(
            "this envelope is no longer available".into(),
        ));
    }

    let now = now_iso();
    if let Some(s) = env.signers.iter_mut().find(|s| s.id == q.signer_id) {
        if s.viewed_at.is_none() {
            s.viewed_at = Some(now.clone());
        }
        if s.status == "pending" || s.status == "notified" {
            s.status = "viewed".into();
        }
    }
    if env.status == "sent" {
        env.status = "in_progress".into();
    }
    env.updated_at = Some(now);
    replace_public(&mongo, &env).await?;
    let signer_id = q.signer_id.clone();
    audit(&mongo, &env, Some(&signer_id), "form.viewed", None, None).await;

    Ok(Json(SignViewResponse {
        envelope: env.sanitized_for_public(),
        signer_id,
    }))
}

#[instrument(skip_all, fields(id = %id))]
pub async fn submit_envelope(
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(input): Json<SignSubmissionInput>,
) -> Result<Json<SignSubmissionResponse>> {
    let mut env = load_public(&mongo, &id).await?;
    let signer_idx = env
        .signers
        .iter()
        .position(|s| s.id == input.signer_id)
        .ok_or_else(|| ApiError::NotFound("signer".into()))?;
    if env.signers[signer_idx].access_token.as_deref() != Some(input.access_token.as_str()) {
        return Err(ApiError::Unauthorized("invalid access token".into()));
    }
    if matches!(env.status.as_str(), "voided" | "expired" | "completed") {
        return Err(ApiError::Validation(
            "this envelope is no longer signable".into(),
        ));
    }
    if env.signers[signer_idx].status == "completed" {
        return Err(ApiError::Validation("you have already signed".into()));
    }

    let now = now_iso();
    let ip = input.ip.clone();

    // ── decline path ─────────────────────────────────────────────
    if input.decline.unwrap_or(false) {
        {
            let s = &mut env.signers[signer_idx];
            s.status = "declined".into();
            s.declined_at = Some(now.clone());
            s.decline_reason = input.decline_reason.clone();
            s.ip_address = ip.clone();
            s.user_agent = input.user_agent.clone();
        }
        env.status = "declined".into();
        env.updated_at = Some(now.clone());
        replace_public(&mongo, &env).await?;
        audit(
            &mongo,
            &env,
            Some(&input.signer_id),
            "form.declined",
            ip.as_deref(),
            input.decline_reason.map(|r| json!({ "reason": r })),
        )
        .await;
        return Ok(Json(SignSubmissionResponse {
            ok: true,
            envelope_status: "declined".into(),
            next_signer_id: None,
        }));
    }

    // ── completion path ──────────────────────────────────────────
    if let Some(fvs) = &input.field_values {
        for fv in fvs {
            if let Some(f) = env.fields.iter_mut().find(|f| f.id == fv.field_id) {
                f.value = Some(fv.value.clone());
                f.filled_at = Some(now.clone());
            }
        }
    }
    {
        let s = &mut env.signers[signer_idx];
        s.status = "completed".into();
        s.completed_at = Some(now.clone());
        s.ip_address = ip.clone();
        s.user_agent = input.user_agent.clone();
    }

    let all_done = env.signers.iter().all(|s| s.status == "completed");
    let next = if all_done {
        None
    } else {
        next_signer(&env, &input.signer_id)
    };
    if all_done {
        env.status = "completed".into();
        env.completed_at = Some(now.clone());
    } else {
        env.status = "in_progress".into();
        if let Some(nid) = &next {
            if let Some(ns) = env.signers.iter_mut().find(|s| &s.id == nid) {
                if ns.status == "pending" {
                    ns.status = "notified".into();
                    ns.notified_at = Some(now.clone());
                }
            }
        }
    }
    env.updated_at = Some(now.clone());
    replace_public(&mongo, &env).await?;

    audit(
        &mongo,
        &env,
        Some(&input.signer_id),
        "form.completed",
        ip.as_deref(),
        None,
    )
    .await;
    if all_done {
        audit(&mongo, &env, None, "submission.completed", None, None).await;
    }

    Ok(Json(SignSubmissionResponse {
        ok: true,
        envelope_status: env.status.clone(),
        next_signer_id: next,
    }))
}
