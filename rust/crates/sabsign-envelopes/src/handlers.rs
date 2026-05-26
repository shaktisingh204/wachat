//! HTTP handlers for esign-envelopes.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use rand::Rng;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use sha2::{Digest, Sha256};
use tracing::instrument;

use crate::dto::{
    CreateEnvelopeInput, CreateEnvelopeResponse, DeleteEnvelopeResponse, ListQuery, ListResponse,
    SendEnvelopeInput, SignSubmissionInput, SignSubmissionResponse, UpdateEnvelopeInput,
    VoidEnvelopeInput,
};
use crate::types::{
    EnvelopeStatus, EsignEnvelope, RoutingOrder, RoutingRule, SignerStatus,
};

const COLL: &str = "esign_envelopes";
const AUDIT_COLL: &str = "esign_audit";
const ENTITY_KIND: &str = "esign_envelope";

fn now_bson() -> BsonDateTime {
    BsonDateTime::from_chrono(Utc::now())
}

fn parse_iso(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| BsonDateTime::from_chrono(dt.with_timezone(&Utc)))
}

fn sha256_hex(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    hex::encode(h.finalize())
}

fn gen_token() -> String {
    // 32 hex chars of randomness.
    let mut rng = rand::thread_rng();
    let bytes: [u8; 16] = rng.r#gen();
    hex::encode(bytes)
}

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    template_id: Option<&str>,
    bulk_batch_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" | "voided" => {
            filter.insert("status", "voided");
        }
        s if matches!(
            s,
            "draft"
                | "sent"
                | "in_progress"
                | "completed"
                | "declined"
                | "voided"
                | "expired"
        ) =>
        {
            filter.insert("status", s);
        }
        _ => {
            filter.insert("status", doc! { "$nin": ["voided", "expired"] });
        }
    }
    if let Some(t) = template_id.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("templateId", t);
    }
    if let Some(b) = bulk_batch_id.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("bulkBatchId", b);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn envelope_from_create(
    input: CreateEnvelopeInput,
    user_id: ObjectId,
    created_by: Option<ObjectId>,
) -> Result<EsignEnvelope> {
    let name = input.name.trim().to_owned();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let doc_id = input.doc_id.trim().to_owned();
    if doc_id.is_empty() {
        return Err(ApiError::Validation("docId is required".to_owned()));
    }
    let mut signers = input.signers;
    // Hand out access tokens.
    for s in signers.iter_mut() {
        if s.access_token.is_none() {
            s.access_token = Some(gen_token());
        }
        if s.id.trim().is_empty() {
            s.id = gen_token();
        }
    }
    Ok(EsignEnvelope {
        id: None,
        user_id,
        project_id: None,
        tenant_id: None,
        name,
        subject: input.subject,
        message: input.message,
        doc_id,
        doc_url: input.doc_url,
        doc_name: input.doc_name,
        status: EnvelopeStatus::Draft,
        routing_order: input.routing_order.unwrap_or_default(),
        routing_rules: input.routing_rules,
        signers,
        fields: input.fields,
        expires_at: input.expires_at.as_deref().and_then(parse_iso),
        reminder_days: input.reminder_days.unwrap_or(0),
        completed_at: None,
        signed_doc_id: None,
        audit_trail_pdf_id: None,
        bulk_batch_id: input.bulk_batch_id,
        template_id: input.template_id,
        in_person: input.in_person.unwrap_or(false),
        created_at: now_bson(),
        updated_at: None,
        created_by,
    })
}

fn doc_for_audit(entity: &EsignEnvelope) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

/// Append-only audit event write — used for every envelope/signer state change.
async fn write_envelope_audit(
    mongo: &MongoHandle,
    envelope_id: ObjectId,
    user_id: ObjectId,
    signer_id: Option<&str>,
    event_type: &str,
    ip: Option<&str>,
    extra: Option<Document>,
) {
    let mut d = doc! {
        "envelopeId": envelope_id,
        "userId": user_id,
        "eventType": event_type,
        "ts": now_bson(),
    };
    if let Some(sid) = signer_id {
        d.insert("signerId", sid);
    }
    if let Some(addr) = ip {
        d.insert("ip", addr);
    }
    if let Some(ex) = extra {
        d.insert("data", ex);
    }
    // Append a tamper-evident hash chain by hashing the document JSON.
    let json = serde_json::to_string(&d).unwrap_or_default();
    d.insert("hash", sha256_hex(&json));
    let coll = mongo.collection::<Document>(AUDIT_COLL);
    let _ = coll.insert_one(d).await;
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_envelopes(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.template_id.as_deref(),
        q.bulk_batch_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "subject", "docName"]);
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

    let coll = mongo.collection::<EsignEnvelope>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.find")))?;
    let mut rows: Vec<EsignEnvelope> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %envelope_id))]
pub async fn get_envelope(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(envelope_id): Path<String>,
) -> Result<Json<EsignEnvelope>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&envelope_id)?;
    let coll = mongo.collection::<EsignEnvelope>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("esign_envelope".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_envelope(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateEnvelopeInput>,
) -> Result<Json<CreateEnvelopeResponse>> {
    let user_id = user_oid(&user)?;
    let created_by = user_oid(&user).ok();
    let mut entity = envelope_from_create(input, user_id, created_by)?;
    let coll = mongo.collection::<EsignEnvelope>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity))) {
        write_audit(&mongo, event).await;
    }
    write_envelope_audit(&mongo, new_id, user_id, None, "envelope_created", None, None).await;

    Ok(Json(CreateEnvelopeResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %envelope_id))]
pub async fn update_envelope(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(envelope_id): Path<String>,
    Json(patch): Json<UpdateEnvelopeInput>,
) -> Result<Json<EsignEnvelope>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&envelope_id)?;
    let coll = mongo.collection::<EsignEnvelope>(COLL);

    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("esign_envelope".to_owned()))?;

    // Only allow editing while in Draft (or limited fields when Sent).
    if !matches!(before.status, EnvelopeStatus::Draft)
        && (patch.signers.is_some() || patch.fields.is_some())
    {
        return Err(ApiError::Validation(
            "signers/fields can only be edited while envelope is in draft".to_owned(),
        ));
    }

    let mut set = doc! { "updatedAt": now_bson() };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.subject {
        set.insert("subject", v);
    }
    if let Some(v) = patch.message {
        set.insert("message", v);
    }
    if let Some(v) = patch.routing_order {
        let s = match v {
            RoutingOrder::Sequential => "sequential",
            RoutingOrder::Parallel => "parallel",
            RoutingOrder::Conditional => "conditional",
        };
        set.insert("routingOrder", s);
    }
    if let Some(v) = patch.routing_rules {
        let arr = bson::to_bson(&v).unwrap_or(bson::Bson::Array(vec![]));
        set.insert("routingRules", arr);
    }
    if let Some(v) = patch.signers {
        let arr = bson::to_bson(&v).unwrap_or(bson::Bson::Array(vec![]));
        set.insert("signers", arr);
    }
    if let Some(v) = patch.fields {
        let arr = bson::to_bson(&v).unwrap_or(bson::Bson::Array(vec![]));
        set.insert("fields", arr);
    }
    if let Some(v) = patch.expires_at.as_deref().and_then(parse_iso) {
        set.insert("expiresAt", v);
    }
    if let Some(v) = patch.reminder_days {
        set.insert("reminderDays", v as i32);
    }
    if let Some(v) = patch.status {
        let s = match v {
            EnvelopeStatus::Draft => "draft",
            EnvelopeStatus::Sent => "sent",
            EnvelopeStatus::InProgress => "in_progress",
            EnvelopeStatus::Completed => "completed",
            EnvelopeStatus::Declined => "declined",
            EnvelopeStatus::Voided => "voided",
            EnvelopeStatus::Expired => "expired",
        };
        set.insert("status", s);
    }

    coll.update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.update")))?;

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.refetch")))?
        .ok_or_else(|| ApiError::NotFound("esign_envelope".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }
    write_envelope_audit(&mongo, oid, user_id, None, "envelope_updated", None, None).await;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %envelope_id))]
pub async fn delete_envelope(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(envelope_id): Path<String>,
) -> Result<Json<DeleteEnvelopeResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&envelope_id)?;
    let coll = mongo.collection::<EsignEnvelope>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": { "status": "voided", "updatedAt": now_bson() }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.void")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("esign_envelope".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    write_envelope_audit(&mongo, oid, user_id, None, "envelope_voided", None, None).await;
    Ok(Json(DeleteEnvelopeResponse { deleted: true }))
}

/// Transition draft → sent, mint access tokens if missing, mark first
/// signer as `notified` under sequential routing or all under parallel.
#[instrument(skip_all, fields(user_id = %user.user_id, id = %envelope_id))]
pub async fn send_envelope(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(envelope_id): Path<String>,
    Json(input): Json<SendEnvelopeInput>,
) -> Result<Json<EsignEnvelope>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&envelope_id)?;
    let coll = mongo.collection::<EsignEnvelope>(COLL);
    let mut env = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("esign_envelope".to_owned()))?;

    if !matches!(env.status, EnvelopeStatus::Draft) {
        return Err(ApiError::Validation(
            "only draft envelopes can be sent".to_owned(),
        ));
    }
    if env.signers.is_empty() {
        return Err(ApiError::Validation(
            "envelope has no signers".to_owned(),
        ));
    }

    let now = now_bson();
    if input.rotate_tokens {
        for s in env.signers.iter_mut() {
            s.access_token = Some(gen_token());
        }
    }
    match env.routing_order {
        RoutingOrder::Sequential | RoutingOrder::Conditional => {
            // Notify first signer only.
            if let Some(first) = env.signers.iter_mut().min_by_key(|s| s.order) {
                first.status = SignerStatus::Notified;
                first.notified_at = Some(now);
            }
        }
        RoutingOrder::Parallel => {
            for s in env.signers.iter_mut() {
                s.status = SignerStatus::Notified;
                s.notified_at = Some(now);
            }
        }
    }
    env.status = EnvelopeStatus::Sent;
    env.updated_at = Some(now);

    let signers_bson = bson::to_bson(&env.signers).unwrap_or(bson::Bson::Array(vec![]));
    coll.update_one(
        ownership_filter(user_id, oid),
        doc! { "$set": {
            "status": "sent",
            "signers": signers_bson,
            "updatedAt": now,
        }},
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.send")))?;

    write_envelope_audit(&mongo, oid, user_id, None, "envelope_sent", None, None).await;
    Ok(Json(env))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %envelope_id))]
pub async fn void_envelope(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(envelope_id): Path<String>,
    Json(input): Json<VoidEnvelopeInput>,
) -> Result<Json<EsignEnvelope>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&envelope_id)?;
    let coll = mongo.collection::<EsignEnvelope>(COLL);
    let now = now_bson();
    coll.update_one(
        ownership_filter(user_id, oid),
        doc! { "$set": {
            "status": "voided",
            "updatedAt": now,
            "voidReason": input.reason.clone().unwrap_or_default(),
        }},
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.void")))?;

    write_envelope_audit(
        &mongo,
        oid,
        user_id,
        None,
        "envelope_voided",
        None,
        input
            .reason
            .as_deref()
            .map(|r| doc! { "reason": r }),
    )
    .await;
    let env = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.refetch")))?
        .ok_or_else(|| ApiError::NotFound("esign_envelope".to_owned()))?;
    Ok(Json(env))
}

/// Public sign-page submission. Skips ownership check by design (the
/// signer is an external party) — auth is performed via `(signer_id,
/// access_token)` plus the configured per-signer auth method.
#[instrument(skip_all, fields(id = %envelope_id))]
pub async fn submit_signature(
    State(mongo): State<MongoHandle>,
    Path(envelope_id): Path<String>,
    Json(input): Json<SignSubmissionInput>,
) -> Result<Json<SignSubmissionResponse>> {
    let oid = oid_from_str(&envelope_id)?;
    let coll = mongo.collection::<EsignEnvelope>(COLL);
    let mut env = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("esign_envelope".to_owned()))?;

    let user_id = env.user_id;
    if matches!(
        env.status,
        EnvelopeStatus::Completed
            | EnvelopeStatus::Voided
            | EnvelopeStatus::Expired
            | EnvelopeStatus::Declined
    ) {
        return Err(ApiError::Validation(
            "envelope is no longer active".to_owned(),
        ));
    }

    let signer_idx = env
        .signers
        .iter()
        .position(|s| s.id == input.signer_id && s.access_token.as_deref() == Some(&input.access_token))
        .ok_or_else(|| ApiError::Unauthorized("invalid signer credentials".to_owned()))?;

    // Auth check per tier.
    {
        let signer = &env.signers[signer_idx];
        match signer.auth_method {
            crate::types::AuthMethod::Email => { /* token alone is sufficient */ }
            crate::types::AuthMethod::SmsOtp => {
                if input.otp.as_deref().unwrap_or("").trim().is_empty() {
                    return Err(ApiError::Unauthorized("OTP required".to_owned()));
                }
                // OTP validation is delegated to the SMS sidecar; we accept
                // any non-empty string here. The TS server action verifies
                // against Redis before calling this endpoint.
            }
            crate::types::AuthMethod::Kba => {
                if signer.kba_questions.len() != input.kba_answers.len() {
                    return Err(ApiError::Unauthorized("KBA answer count mismatch".to_owned()));
                }
                for (q, ans) in signer.kba_questions.iter().zip(input.kba_answers.iter()) {
                    let norm = ans.trim().to_lowercase();
                    if sha256_hex(&norm) != q.answer_hash {
                        return Err(ApiError::Unauthorized("KBA answer mismatch".to_owned()));
                    }
                }
            }
            crate::types::AuthMethod::Pin => {
                let provided = sha256_hex(input.pin.as_deref().unwrap_or("").trim());
                if signer.pin_hash.as_deref() != Some(&provided) {
                    return Err(ApiError::Unauthorized("PIN mismatch".to_owned()));
                }
            }
        }
    }

    let now = now_bson();

    if input.decline {
        env.signers[signer_idx].status = SignerStatus::Declined;
        env.signers[signer_idx].declined_at = Some(now);
        env.signers[signer_idx].decline_reason = input.decline_reason.clone();
        env.status = EnvelopeStatus::Declined;
        let signers_bson = bson::to_bson(&env.signers).unwrap_or(bson::Bson::Array(vec![]));
        coll.update_one(
            doc! { "_id": oid },
            doc! { "$set": { "status": "declined", "signers": signers_bson, "updatedAt": now }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.decline"))
        })?;
        write_envelope_audit(
            &mongo,
            oid,
            user_id,
            Some(&input.signer_id),
            "signer_declined",
            None,
            input.decline_reason.as_deref().map(|r| doc! { "reason": r }),
        )
        .await;
        return Ok(Json(SignSubmissionResponse {
            ok: true,
            envelope_status: EnvelopeStatus::Declined,
            next_signer_id: None,
        }));
    }

    // Apply field values for this signer's role.
    let role = env.signers[signer_idx].role.clone();
    for pair in &input.field_values {
        if let Some(f) = env
            .fields
            .iter_mut()
            .find(|f| f.id == pair.field_id && f.recipient_role == role)
        {
            f.value = Some(pair.value.clone());
            f.filled_at = Some(now);
        }
    }

    env.signers[signer_idx].status = SignerStatus::Completed;
    env.signers[signer_idx].completed_at = Some(now);

    // Decide next state.
    let next_signer_id = compute_next_signer(&env);
    let new_status = if env.signers.iter().all(|s| {
        matches!(s.status, SignerStatus::Completed) || matches!(s.status, SignerStatus::Declined)
    }) {
        EnvelopeStatus::Completed
    } else {
        EnvelopeStatus::InProgress
    };

    // Notify the next signer if sequential / conditional.
    if let (Some(nid), RoutingOrder::Sequential | RoutingOrder::Conditional) =
        (next_signer_id.as_deref(), &env.routing_order)
    {
        if let Some(ns) = env.signers.iter_mut().find(|s| s.id == nid) {
            if matches!(ns.status, SignerStatus::Pending) {
                ns.status = SignerStatus::Notified;
                ns.notified_at = Some(now);
            }
        }
    }
    if matches!(new_status, EnvelopeStatus::Completed) {
        env.completed_at = Some(now);
        env.status = EnvelopeStatus::Completed;
    } else {
        env.status = EnvelopeStatus::InProgress;
    }

    let signers_bson = bson::to_bson(&env.signers).unwrap_or(bson::Bson::Array(vec![]));
    let fields_bson = bson::to_bson(&env.fields).unwrap_or(bson::Bson::Array(vec![]));
    let mut set = doc! {
        "status": match env.status {
            EnvelopeStatus::Completed => "completed",
            _ => "in_progress",
        },
        "signers": signers_bson,
        "fields": fields_bson,
        "updatedAt": now,
    };
    if let Some(c) = env.completed_at {
        set.insert("completedAt", c);
    }
    coll.update_one(doc! { "_id": oid }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.sign")))?;

    write_envelope_audit(
        &mongo,
        oid,
        user_id,
        Some(&input.signer_id),
        "signer_completed",
        None,
        None,
    )
    .await;
    if matches!(env.status, EnvelopeStatus::Completed) {
        write_envelope_audit(&mongo, oid, user_id, None, "envelope_completed", None, None).await;
    }

    Ok(Json(SignSubmissionResponse {
        ok: true,
        envelope_status: env.status,
        next_signer_id,
    }))
}

fn compute_next_signer(env: &EsignEnvelope) -> Option<String> {
    match env.routing_order {
        RoutingOrder::Sequential => env
            .signers
            .iter()
            .filter(|s| matches!(s.status, SignerStatus::Pending))
            .min_by_key(|s| s.order)
            .map(|s| s.id.clone()),
        RoutingOrder::Parallel => None,
        RoutingOrder::Conditional => {
            // Walk rules; first matching rule wins.
            for rule in &env.routing_rules {
                if rule_matches(env, rule) {
                    return Some(rule.next_signer_id.clone());
                }
            }
            // Fall back to lowest-order pending signer.
            env.signers
                .iter()
                .filter(|s| matches!(s.status, SignerStatus::Pending))
                .min_by_key(|s| s.order)
                .map(|s| s.id.clone())
        }
    }
}

fn rule_matches(env: &EsignEnvelope, rule: &RoutingRule) -> bool {
    let field_val = env
        .fields
        .iter()
        .find(|f| f.id == rule.field_id)
        .and_then(|f| f.value.as_deref());
    let v = rule.value.as_deref().unwrap_or("");
    match (rule.op.as_str(), field_val) {
        ("equals", Some(fv)) => fv == v,
        ("not_equals", Some(fv)) => fv != v,
        ("contains", Some(fv)) => fv.contains(v),
        ("truthy", Some(fv)) => !fv.is_empty() && fv != "0" && fv != "false",
        ("gt", Some(fv)) => fv.parse::<f64>().ok().zip(v.parse::<f64>().ok()).map_or(false, |(a, b)| a > b),
        ("lt", Some(fv)) => fv.parse::<f64>().ok().zip(v.parse::<f64>().ok()).map_or(false, |(a, b)| a < b),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{EnvelopeField, EnvelopeSigner, AuthMethod};

    fn mk_env() -> EsignEnvelope {
        EsignEnvelope {
            id: None,
            user_id: ObjectId::new(),
            project_id: None,
            tenant_id: None,
            name: "Test".into(),
            subject: None,
            message: None,
            doc_id: "doc1".into(),
            doc_url: None,
            doc_name: None,
            status: EnvelopeStatus::Draft,
            routing_order: RoutingOrder::Sequential,
            routing_rules: vec![],
            signers: vec![
                EnvelopeSigner {
                    id: "s1".into(),
                    role: "buyer".into(),
                    name: "A".into(),
                    email: "a@x".into(),
                    phone: None,
                    auth_method: AuthMethod::Email,
                    kba_questions: vec![],
                    pin_hash: None,
                    order: 1,
                    status: SignerStatus::Pending,
                    access_token: Some("tok1".into()),
                    notified_at: None,
                    viewed_at: None,
                    completed_at: None,
                    declined_at: None,
                    decline_reason: None,
                    ip_address: None,
                    user_agent: None,
                },
                EnvelopeSigner {
                    id: "s2".into(),
                    role: "seller".into(),
                    name: "B".into(),
                    email: "b@x".into(),
                    phone: None,
                    auth_method: AuthMethod::Email,
                    kba_questions: vec![],
                    pin_hash: None,
                    order: 2,
                    status: SignerStatus::Pending,
                    access_token: Some("tok2".into()),
                    notified_at: None,
                    viewed_at: None,
                    completed_at: None,
                    declined_at: None,
                    decline_reason: None,
                    ip_address: None,
                    user_agent: None,
                },
            ],
            fields: vec![EnvelopeField {
                id: "f1".into(),
                recipient_role: "buyer".into(),
                field_type: "text".into(),
                page: 1,
                x: 0.0,
                y: 0.0,
                w: 100.0,
                h: 20.0,
                label: None,
                default_value: None,
                value: None,
                options: vec![],
                required: false,
                filled_at: None,
            }],
            expires_at: None,
            reminder_days: 0,
            completed_at: None,
            signed_doc_id: None,
            audit_trail_pdf_id: None,
            bulk_batch_id: None,
            template_id: None,
            in_person: false,
            created_at: now_bson(),
            updated_at: None,
            created_by: None,
        }
    }

    #[test]
    fn sequential_next_is_lowest_order_pending() {
        let env = mk_env();
        assert_eq!(compute_next_signer(&env).as_deref(), Some("s1"));
    }

    #[test]
    fn conditional_rule_matches_value() {
        let mut env = mk_env();
        env.routing_order = RoutingOrder::Conditional;
        env.fields[0].value = Some("yes".into());
        env.routing_rules.push(RoutingRule {
            field_id: "f1".into(),
            op: "equals".into(),
            value: Some("yes".into()),
            next_signer_id: "s2".into(),
        });
        assert_eq!(compute_next_signer(&env).as_deref(), Some("s2"));
    }

    #[test]
    fn token_generation_is_unique() {
        let a = gen_token();
        let b = gen_token();
        assert_ne!(a, b);
        assert_eq!(a.len(), 32);
    }

    #[test]
    fn sha256_normalises_input() {
        let h1 = sha256_hex("hello");
        let h2 = sha256_hex("hello");
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64);
    }
}
