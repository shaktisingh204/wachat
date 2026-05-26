//! HTTP handlers for sabsign-templates.

use axum::{
    Json,
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
use sabsign_envelopes::types::{EnvelopeStatus, EsignEnvelope, RoutingOrder, SignerStatus};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateTemplateInput, CreateTemplateResponse, DeleteTemplateResponse, InstantiateInput,
    InstantiateResponse, ListQuery, ListResponse, UpdateTemplateInput,
};
use crate::types::EsignTemplate;

const COLL: &str = "esign_templates";
const ENVELOPES_COLL: &str = "esign_envelopes";
const ENTITY_KIND: &str = "esign_template";

fn now_bson() -> BsonDateTime {
    BsonDateTime::from_chrono(Utc::now())
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut f = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            f.insert("status", "archived");
        }
        _ => {
            f.insert("status", "active");
        }
    }
    f
}

fn template_from_create(input: CreateTemplateInput, user_id: ObjectId) -> Result<EsignTemplate> {
    let name = input.name.trim().to_owned();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let doc_id = input.doc_id.trim().to_owned();
    if doc_id.is_empty() {
        return Err(ApiError::Validation("docId is required".to_owned()));
    }
    Ok(EsignTemplate {
        id: None,
        user_id,
        name,
        description: input.description,
        doc_id,
        doc_url: input.doc_url,
        doc_name: input.doc_name,
        routing_order: input.routing_order.unwrap_or(RoutingOrder::Sequential),
        routing_rules: input.routing_rules,
        recipient_slots: input.recipient_slots,
        fields: input.fields,
        status: "active".into(),
        created_at: now_bson(),
        updated_at: None,
    })
}

fn doc_for_audit(t: &EsignTemplate) -> Document {
    bson::to_document(t).unwrap_or_default()
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_templates(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
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

    let coll = mongo.collection::<EsignTemplate>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_templates.find")))?;
    let mut rows: Vec<EsignTemplate> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_templates.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %template_id))]
pub async fn get_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(template_id): Path<String>,
) -> Result<Json<EsignTemplate>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let coll = mongo.collection::<EsignTemplate>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_templates.find_one")))?
        .ok_or_else(|| ApiError::NotFound("esign_template".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTemplateInput>,
) -> Result<Json<CreateTemplateResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = template_from_create(input, user_id)?;
    let coll = mongo.collection::<EsignTemplate>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_templates.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity))) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateTemplateResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %template_id))]
pub async fn update_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(template_id): Path<String>,
    Json(patch): Json<UpdateTemplateInput>,
) -> Result<Json<EsignTemplate>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let coll = mongo.collection::<EsignTemplate>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_templates.find_one")))?
        .ok_or_else(|| ApiError::NotFound("esign_template".to_owned()))?;

    let mut set = doc! { "updatedAt": now_bson() };
    if let Some(v) = patch.name {
        set.insert("name", v);
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
        let s = match v {
            RoutingOrder::Sequential => "sequential",
            RoutingOrder::Parallel => "parallel",
            RoutingOrder::Conditional => "conditional",
        };
        set.insert("routingOrder", s);
    }
    if let Some(v) = patch.routing_rules {
        set.insert("routingRules", bson::to_bson(&v).unwrap_or(bson::Bson::Array(vec![])));
    }
    if let Some(v) = patch.recipient_slots {
        set.insert("recipientSlots", bson::to_bson(&v).unwrap_or(bson::Bson::Array(vec![])));
    }
    if let Some(v) = patch.fields {
        set.insert("fields", bson::to_bson(&v).unwrap_or(bson::Bson::Array(vec![])));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    coll.update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_templates.update")))?;
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_templates.refetch")))?
        .ok_or_else(|| ApiError::NotFound("esign_template".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %template_id))]
pub async fn delete_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(template_id): Path<String>,
) -> Result<Json<DeleteTemplateResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let coll = mongo.collection::<EsignTemplate>(COLL);
    let res = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": { "status": "archived", "updatedAt": now_bson() }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_templates.archive")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("esign_template".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteTemplateResponse { deleted: true }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %template_id))]
pub async fn instantiate_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(template_id): Path<String>,
    Json(input): Json<InstantiateInput>,
) -> Result<Json<InstantiateResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let coll = mongo.collection::<EsignTemplate>(COLL);
    let tmpl = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_templates.find_one")))?
        .ok_or_else(|| ApiError::NotFound("esign_template".to_owned()))?;

    // Build the new envelope from template + supplied signers.
    let mut signers = input.signers;
    for s in signers.iter_mut() {
        if s.access_token.is_none() {
            s.access_token = Some(format!("{:x}", ::rand::random::<u128>()));
        }
        if s.id.trim().is_empty() {
            s.id = format!("{:x}", ::rand::random::<u64>());
        }
        s.status = SignerStatus::Pending;
    }

    let env = EsignEnvelope {
        id: None,
        user_id,
        project_id: None,
        tenant_id: None,
        name: input.envelope_name.unwrap_or_else(|| tmpl.name.clone()),
        subject: input.subject,
        message: input.message,
        doc_id: tmpl.doc_id.clone(),
        doc_url: tmpl.doc_url.clone(),
        doc_name: tmpl.doc_name.clone(),
        status: EnvelopeStatus::Draft,
        routing_order: tmpl.routing_order.clone(),
        routing_rules: tmpl.routing_rules.clone(),
        signers,
        fields: tmpl.fields.clone(),
        expires_at: None,
        reminder_days: 0,
        completed_at: None,
        signed_doc_id: None,
        audit_trail_pdf_id: None,
        bulk_batch_id: None,
        template_id: Some(oid.to_hex()),
        in_person: false,
        created_at: now_bson(),
        updated_at: None,
        created_by: None,
    };

    let env_coll = mongo.collection::<EsignEnvelope>(ENVELOPES_COLL);
    let inserted = env_coll
        .insert_one(&env)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;

    Ok(Json(InstantiateResponse {
        envelope_id: new_id.to_hex(),
    }))
}

