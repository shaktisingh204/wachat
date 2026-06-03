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
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use tracing::instrument;

use crate::dto::{
    ApplyDispositionBody, ApplyDispositionResponse, CreateDispositionBody,
    CreateDispositionResponse, DispositionPointer, DispositionStatRow, DispositionStatsQuery,
    DispositionStatsResponse, GetDispositionResponse, ListDispositionsQuery,
    ListDispositionsResponse, SuccessResponse, UpdateDispositionBody,
};
use crate::state::SabChatDispositionsState;

/// Parse the JWT tenant claim into an `ObjectId`.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

/// Parse the actor user claim into an `ObjectId`.
fn actor_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

// ===========================================================================
// POST /
// ===========================================================================
#[instrument(skip_all)]
pub async fn create_disposition(
    user: AuthUser,
    State(state): State<SabChatDispositionsState>,
    Json(body): Json<CreateDispositionBody>,
) -> Result<Json<CreateDispositionResponse>> {
    let tenant_id = tenant_oid(&user)?;

    if body.code.trim().is_empty() {
        return Err(ApiError::Validation("code is required".to_owned()));
    }
    if body.label.trim().is_empty() {
        return Err(ApiError::Validation("label is required".to_owned()));
    }

    let parent_code = body.parent_code.filter(|s| !s.trim().is_empty());
    let color = body.color.filter(|s| !s.trim().is_empty());

    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();

    let doc = doc! {
        "_id": new_oid,
        "tenantId": tenant_id,
        "code": &body.code,
        "label": &body.label,
        "parentCode": parent_code,
        "color": color,
        "requiredNote": body.required_note,
        "sortOrder": body.sort_order,
        "active": true,
        "createdAt": now,
        "updatedAt": now,
    };

    let coll = state.mongo.collection::<Document>("sabchat_dispositions");
    coll.insert_one(doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    Ok(Json(CreateDispositionResponse {
        disposition_id: new_oid.to_hex(),
        code: body.code,
    }))
}

// ===========================================================================
// GET /
// ===========================================================================
#[instrument(skip_all)]
pub async fn list_dispositions(
    user: AuthUser,
    State(state): State<SabChatDispositionsState>,
    Query(query): Query<ListDispositionsQuery>,
) -> Result<Json<ListDispositionsResponse>> {
    let tenant_id = tenant_oid(&user)?;

    let mut filter = doc! { "tenantId": tenant_id };

    if let Some(active) = query.active {
        filter.insert("active", active);
    }

    if let Some(parent_code) = query.parent_code {
        if parent_code.trim().is_empty() || parent_code == "null" {
            filter.insert("parentCode", Bson::Null);
        } else {
            filter.insert("parentCode", parent_code);
        }
    }

    let coll = state.mongo.collection::<Document>("sabchat_dispositions");
    let mut cursor = coll
        .find(filter)
        .with_options(
            FindOptions::builder()
                .sort(doc! { "sortOrder": 1, "code": 1 })
                .build(),
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let mut dispositions = Vec::new();
    while let Some(doc) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
    {
        dispositions.push(document_to_clean_json(doc));
    }

    Ok(Json(ListDispositionsResponse { dispositions }))
}

// ===========================================================================
// GET /{id}
// ===========================================================================
#[instrument(skip_all)]
pub async fn get_disposition(
    user: AuthUser,
    State(state): State<SabChatDispositionsState>,
    Path(id): Path<String>,
) -> Result<Json<GetDispositionResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>("sabchat_dispositions");
    let doc = coll
        .find_one(doc! { "_id": oid, "tenantId": tenant_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("Disposition not found".to_owned()))?;

    Ok(Json(GetDispositionResponse {
        disposition: document_to_clean_json(doc),
    }))
}

// ===========================================================================
// PATCH /{id}
// ===========================================================================
#[instrument(skip_all)]
pub async fn update_disposition(
    user: AuthUser,
    State(state): State<SabChatDispositionsState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateDispositionBody>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;

    let mut set_doc = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now())
    };

    if let Some(label) = body.label {
        if label.trim().is_empty() {
            return Err(ApiError::Validation("label cannot be empty".to_owned()));
        }
        set_doc.insert("label", label);
    }
    if let Some(parent_code) = body.parent_code {
        if parent_code.trim().is_empty() || parent_code == "null" {
            set_doc.insert("parentCode", Bson::Null);
        } else {
            set_doc.insert("parentCode", parent_code);
        }
    }
    if let Some(color) = body.color {
        if color.trim().is_empty() || color == "null" {
            set_doc.insert("color", Bson::Null);
        } else {
            set_doc.insert("color", color);
        }
    }
    if let Some(req_note) = body.required_note {
        set_doc.insert("requiredNote", req_note);
    }
    if let Some(active) = body.active {
        set_doc.insert("active", active);
    }
    if let Some(sort_order) = body.sort_order {
        set_doc.insert("sortOrder", sort_order);
    }

    let coll = state.mongo.collection::<Document>("sabchat_dispositions");
    let res = coll
        .update_one(
            doc! { "_id": oid, "tenantId": tenant_id },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Disposition not found".to_owned()));
    }

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /{id}
// ===========================================================================
#[instrument(skip_all)]
pub async fn delete_disposition(
    user: AuthUser,
    State(state): State<SabChatDispositionsState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>("sabchat_dispositions");
    let res = coll
        .update_one(
            doc! { "_id": oid, "tenantId": tenant_id },
            doc! {
                "$set": {
                    "active": false,
                    "updatedAt": bson::DateTime::from_chrono(Utc::now())
                }
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Disposition not found".to_owned()));
    }

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /apply/{conversationId}
// ===========================================================================
#[instrument(skip_all)]
pub async fn apply_disposition(
    user: AuthUser,
    State(state): State<SabChatDispositionsState>,
    Path(conversation_id): Path<String>,
    Json(body): Json<ApplyDispositionBody>,
) -> Result<Json<ApplyDispositionResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let actor_id = actor_oid(&user)?;
    let conv_oid = oid_from_str(&conversation_id)?;

    let db = &state.mongo;

    let disp_coll = db.collection::<Document>("sabchat_dispositions");
    let disposition = disp_coll
        .find_one(doc! { "code": &body.code, "tenantId": tenant_id, "active": true })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("Disposition code not found or inactive".to_owned()))?;

    let req_note = disposition.get_bool("requiredNote").unwrap_or(false);
    let note = body.note.filter(|n| !n.trim().is_empty());
    if req_note && note.is_none() {
        return Err(ApiError::Validation(
            "A note is required for this disposition".to_owned(),
        ));
    }

    let now_utc = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now_utc);

    let pointer = DispositionPointer {
        code: body.code.clone(),
        note: note.clone(),
        set_by: actor_id.to_hex(),
        set_at: now_utc,
    };

    let mut pointer_doc = doc! {
        "code": &pointer.code,
        "setBy": pointer.set_by.clone(),
        "setAt": now_bson,
    };
    if let Some(n) = &pointer.note {
        pointer_doc.insert("note", n);
    }

    let mut set_doc = doc! {
        "customAttrs.disposition": pointer_doc,
        "updatedAt": now_bson,
    };

    if body.also_resolve {
        set_doc.insert("status", "resolved");
        set_doc.insert("resolvedAt", now_bson);
    }

    let conv_coll = db.collection::<Document>("sabchat_conversations");
    let res = conv_coll
        .update_one(
            doc! { "_id": conv_oid, "tenantId": tenant_id },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Conversation not found".to_owned()));
    }

    if body.also_resolve {
        let audit_coll = db.collection::<Document>("sabchat_audit_log");
        let audit_doc = doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant_id,
            "entity": "conversation",
            "entityId": conv_oid,
            "event": "conversation_resolved",
            "actor": actor_id,
            "createdAt": now_bson,
            "metadata": {
                "reason": "disposition_applied",
                "dispositionCode": &body.code,
            }
        };
        let _ = audit_coll.insert_one(audit_doc).await;
    }

    Ok(Json(ApplyDispositionResponse {
        disposition: pointer,
    }))
}

// ===========================================================================
// GET /stats
// ===========================================================================
#[instrument(skip_all)]
pub async fn disposition_stats(
    user: AuthUser,
    State(state): State<SabChatDispositionsState>,
    Query(query): Query<DispositionStatsQuery>,
) -> Result<Json<DispositionStatsResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let db = &state.mongo;

    let mut match_stage = doc! {
        "tenantId": tenant_id,
        "customAttrs.disposition.code": { "$exists": true },
        "status": "resolved"
    };

    let mut date_filter = doc! {};
    if let Some(from) = query.from {
        date_filter.insert("$gte", bson::DateTime::from_chrono(from));
    }
    if let Some(to) = query.to {
        date_filter.insert("$lte", bson::DateTime::from_chrono(to));
    }

    if !date_filter.is_empty() {
        match_stage.insert("resolvedAt", date_filter);
    }

    let pipeline = vec![
        doc! { "$match": match_stage },
        doc! {
            "$group": {
                "_id": "$customAttrs.disposition.code",
                "count": { "$sum": 1 }
            }
        },
        doc! {
            "$lookup": {
                "from": "sabchat_dispositions",
                "let": { "code": "$_id" },
                "pipeline": [
                    { "$match": {
                        "$expr": { "$and": [
                            { "$eq": ["$code", "$$code"] },
                            { "$eq": ["$tenantId", tenant_id] }
                        ]}
                    }}
                ],
                "as": "dispInfo"
            }
        },
        doc! {
            "$unwind": {
                "path": "$dispInfo",
                "preserveNullAndEmptyArrays": true
            }
        },
        doc! {
            "$project": {
                "code": "$_id",
                "label": { "$ifNull": [ "$dispInfo.label", "$_id" ] },
                "count": 1,
                "_id": 0
            }
        },
        doc! { "$sort": { "count": -1, "code": 1 } },
    ];

    let conv_coll = db.collection::<Document>("sabchat_conversations");
    let mut cursor = conv_coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let mut stats = Vec::new();
    while let Some(doc) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
    {
        let code = doc.get_str("code").unwrap_or("").to_owned();
        let label = doc.get_str("label").unwrap_or(&code).to_owned();
        let count = match doc.get("count") {
            Some(Bson::Int32(c)) => *c as u64,
            Some(Bson::Int64(c)) => *c as u64,
            Some(Bson::Double(c)) => *c as u64,
            _ => 0,
        };
        stats.push(DispositionStatRow { code, label, count });
    }

    Ok(Json(DispositionStatsResponse { stats }))
}
