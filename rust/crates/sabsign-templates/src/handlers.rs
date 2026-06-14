//! HTTP handlers for the SabSign templates API (`/v1/sabsign/templates`).
//!
//! Tenant-scoped CRUD over `esign_templates`. `instantiate` binds concrete
//! signers to a template's recipient slots and writes a fresh draft envelope
//! into `esign_envelopes` (the same collection the envelopes crate owns).

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
use sabsign_envelopes::types::{EnvelopeSigner, SabSignEnvelope};
use serde_json::json;
use tracing::{instrument, warn};
use uuid::Uuid;

use crate::dto::{
    CreateTemplateInput, CreateTemplateResponse, DeleteTemplateResponse, InstantiateInput,
    InstantiateResponse, ListQuery, ListResponse, UpdateTemplateInput,
};
use crate::types::{SabSignTemplate, VALID_STATUSES};

const COLL: &str = "esign_templates";
const ENVELOPES_COLL: &str = "esign_envelopes";
const VALID_ROUTING_ORDERS: &[&str] = &["sequential", "parallel", "conditional"];

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn gen_id() -> String {
    bson::oid::ObjectId::new().to_hex()
}

fn gen_token() -> String {
    format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple())
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

fn validate_routing_order(s: &str) -> Result<()> {
    if VALID_ROUTING_ORDERS.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "routingOrder must be one of {VALID_ROUTING_ORDERS:?}"
        )))
    }
}

/// Ensure each instantiated signer carries an id + access token + order +
/// status + auth method.
fn normalise_signers(signers: Vec<EnvelopeSigner>) -> Result<Vec<EnvelopeSigner>> {
    let mut out = Vec::new();
    for (i, mut s) in signers.into_iter().enumerate() {
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
        out.push(s);
    }
    Ok(out)
}

async fn load_scoped(mongo: &MongoHandle, tenant: &str, id: &str) -> Result<SabSignTemplate> {
    mongo
        .collection::<SabSignTemplate>(COLL)
        .find_one(doc! { "_id": id, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_templates.find_one")))?
        .ok_or_else(|| ApiError::NotFound("template".into()))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_templates(
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
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description", "docName"]);
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
    let coll = mongo.collection::<SabSignTemplate>(COLL);
    let mut rows: Vec<SabSignTemplate> = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_templates.find")))?
        .try_collect()
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("esign_templates.collect"))
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
pub async fn get_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabSignTemplate>> {
    Ok(Json(load_scoped(&mongo, &user.tenant_id, &id).await?))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn create_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTemplateInput>,
) -> Result<Json<CreateTemplateResponse>> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".into()));
    }
    if input.doc_id.trim().is_empty() {
        return Err(ApiError::Validation("docId is required".into()));
    }
    let routing_order = input.routing_order.unwrap_or_else(|| "sequential".into());
    validate_routing_order(&routing_order)?;

    let tmpl = SabSignTemplate {
        id: gen_id(),
        user_id: Some(user.user_id.clone()),
        tenant_id: user.tenant_id.clone(),
        name: input.name.trim().to_owned(),
        description: input.description,
        doc_id: input.doc_id,
        doc_url: input.doc_url,
        doc_name: input.doc_name,
        routing_order,
        routing_rules: input.routing_rules,
        recipient_slots: input.recipient_slots.unwrap_or_default(),
        fields: input.fields.unwrap_or_default(),
        status: "active".into(),
        created_at: now_iso(),
        updated_at: None,
    };
    mongo
        .collection::<SabSignTemplate>(COLL)
        .insert_one(&tmpl)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_templates.insert")))?;
    Ok(Json(CreateTemplateResponse {
        id: tmpl.id.clone(),
        entity: tmpl,
    }))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn update_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateTemplateInput>,
) -> Result<Json<SabSignTemplate>> {
    let _ = load_scoped(&mongo, &user.tenant_id, &id).await?;

    let mut set = doc! { "updatedAt": now_iso() };
    if let Some(v) = patch.name {
        set.insert("name", v.trim().to_owned());
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.doc_id {
        set.insert("docId", v);
    }
    if let Some(v) = patch.doc_url {
        set.insert("docUrl", v);
    }
    if let Some(v) = patch.doc_name {
        set.insert("docName", v);
    }
    if let Some(v) = patch.routing_order {
        validate_routing_order(&v)?;
        set.insert("routingOrder", v);
    }
    if let Some(v) = patch.status {
        validate_status(&v)?;
        set.insert("status", v);
    }
    if let Some(v) = patch.routing_rules {
        set.insert(
            "routingRules",
            bson::to_bson(&v).map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?,
        );
    }
    if let Some(v) = patch.recipient_slots {
        set.insert(
            "recipientSlots",
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
        .collection::<SabSignTemplate>(COLL)
        .update_one(doc! { "_id": &id, "tenantId": &user.tenant_id }, update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_templates.update")))?;
    Ok(Json(load_scoped(&mongo, &user.tenant_id, &id).await?))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn delete_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteTemplateResponse>> {
    let res = mongo
        .collection::<SabSignTemplate>(COLL)
        .delete_one(doc! { "_id": &id, "tenantId": &user.tenant_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_templates.delete")))?;
    Ok(Json(DeleteTemplateResponse {
        deleted: res.deleted_count > 0,
    }))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn instantiate_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(input): Json<InstantiateInput>,
) -> Result<Json<InstantiateResponse>> {
    let tmpl = load_scoped(&mongo, &user.tenant_id, &id).await?;
    let now = now_iso();
    let env = SabSignEnvelope {
        id: gen_id(),
        user_id: Some(user.user_id.clone()),
        tenant_id: user.tenant_id.clone(),
        name: input.envelope_name.unwrap_or_else(|| tmpl.name.clone()),
        subject: input.subject,
        message: input.message,
        doc_id: tmpl.doc_id.clone(),
        doc_url: tmpl.doc_url.clone(),
        doc_name: tmpl.doc_name.clone(),
        status: "draft".into(),
        routing_order: tmpl.routing_order.clone(),
        routing_rules: tmpl.routing_rules.clone(),
        signers: normalise_signers(input.signers)?,
        fields: tmpl.fields.clone(),
        expires_at: None,
        reminder_days: None,
        completed_at: None,
        signed_doc_id: None,
        audit_trail_pdf_id: None,
        bulk_batch_id: None,
        template_id: Some(tmpl.id.clone()),
        in_person: None,
        void_reason: None,
        created_at: now,
        updated_at: None,
    };
    mongo
        .collection::<SabSignEnvelope>(ENVELOPES_COLL)
        .insert_one(&env)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("esign_templates.instantiate.insert"))
        })?;

    let actor = env.user_id.as_deref().unwrap_or(env.tenant_id.as_str());
    if let Err(e) = sabsign_audit::append_event(
        &mongo,
        &env.tenant_id,
        &env.id,
        actor,
        None,
        "submission.created",
        None,
        Some(json!({ "templateId": tmpl.id, "name": env.name })),
    )
    .await
    {
        warn!("[sabsign] instantiate audit failed for {}: {}", env.id, e);
    }

    Ok(Json(InstantiateResponse {
        envelope_id: env.id,
    }))
}
