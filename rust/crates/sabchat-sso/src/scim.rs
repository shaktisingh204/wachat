use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use mongodb::bson::{doc, oid::ObjectId, Document};
use futures::stream::StreamExt;
use serde_json::Value;
use chrono::Utc;

use sabnode_common::error::{ApiError, Result};
use sabnode_db::document_to_clean_json;

use crate::state::SabChatSsoState;
use crate::dto::{
    ScimUserCreate, ScimPatchBody, ScimGroupCreate, ScimListResponse,
};

/// Authenticates the SCIM request using the Authorization Bearer token.
/// Looks up the token in `sabchat_scim_tokens` and returns the `tenant_id`
/// (as a parsed `ObjectId`).
async fn authenticate_scim_token(
    state: &SabChatSsoState,
    headers: &HeaderMap,
) -> Result<ObjectId> {
    let auth_header = headers.get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| ApiError::Unauthorized("missing authorization header".into()))?;

    let token = if auth_header.starts_with("Bearer ") {
        &auth_header["Bearer ".len()..]
    } else {
        return Err(ApiError::Unauthorized("invalid authorization scheme".into()));
    };

    let coll = state.mongo.collection::<Document>("sabchat_scim_tokens");
    let doc = coll.find_one(doc! { "token": token }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::Unauthorized("invalid token".into()))?;

    let tenant_id_str = doc.get_str("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("token missing tenant_id")))?;

    // Update last_used_at
    let now = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    if let Ok(id) = doc.get_object_id("_id") {
        let _ = coll.update_one(doc! { "_id": id }, doc! { "$set": { "lastUsedAt": now } }).await;
    }

    ObjectId::parse_str(tenant_id_str)
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("invalid tenant oid")))
}

// ===========================================================================
// Users CRUD
// ===========================================================================

pub async fn list_users(
    State(state): State<SabChatSsoState>,
    headers: HeaderMap,
) -> Result<Json<ScimListResponse>> {
    let tenant_id = authenticate_scim_token(&state, &headers).await?;
    let coll = state.mongo.collection::<Document>("users");
    
    let mut cursor = coll.find(doc! { "tenantId": tenant_id }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let mut resources = vec![];
    while let Some(res) = cursor.next().await {
        let doc = res.map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
        resources.push(map_user_to_scim(&doc));
    }

    Ok(Json(ScimListResponse {
        schemas: vec!["urn:ietf:params:scim:api:messages:2.0:ListResponse".into()],
        total_results: resources.len(),
        start_index: 1,
        items_per_page: resources.len(),
        resources,
    }))
}

pub async fn create_user(
    State(state): State<SabChatSsoState>,
    headers: HeaderMap,
    Json(body): Json<ScimUserCreate>,
) -> Result<Json<Value>> {
    let tenant_id = authenticate_scim_token(&state, &headers).await?;
    let coll = state.mongo.collection::<Document>("users");

    let oid = ObjectId::new();
    let email = body.emails.and_then(|mut e| e.pop()).map(|e| e.value).unwrap_or_default();

    let mut doc = doc! {
        "_id": oid,
        "tenantId": tenant_id,
        "email": email,
        "username": body.user_name,
        "createdAt": Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        "active": body.active.unwrap_or(true),
    };

    if let Some(name) = body.name {
        if let Some(gn) = name.given_name { doc.insert("firstName", gn); }
        if let Some(fn_) = name.family_name { doc.insert("lastName", fn_); }
    }

    if let Some(ext) = body.external_id {
        doc.insert("externalId", ext);
    }

    coll.insert_one(&doc).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    Ok(Json(map_user_to_scim(&doc)))
}

pub async fn get_user(
    State(state): State<SabChatSsoState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let tenant_id = authenticate_scim_token(&state, &headers).await?;
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::NotFound("user not found".into()))?;

    let coll = state.mongo.collection::<Document>("users");
    let doc = coll.find_one(doc! { "_id": oid, "tenantId": tenant_id }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    Ok(Json(map_user_to_scim(&doc)))
}

pub async fn patch_user(
    State(state): State<SabChatSsoState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<ScimPatchBody>,
) -> Result<Json<Value>> {
    let tenant_id = authenticate_scim_token(&state, &headers).await?;
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::NotFound("user not found".into()))?;

    let mut set_doc = doc! {};
    for op in body.operations {
        if op.op.to_lowercase() == "replace" {
            let path_opt = op.path;
            let value_opt = op.value;
            if let (Some(path), Some(value)) = (path_opt.as_ref(), value_opt.as_ref()) {
                if let Ok(bson_val) = mongodb::bson::to_bson(value) {
                    set_doc.insert(path.clone(), bson_val);
                }
            } else if let Some(value) = value_opt {
                // If path is omitted, value is an object with updates
                if let Some(obj) = value.as_object() {
                    for (k, v) in obj {
                        if let Ok(bson_val) = mongodb::bson::to_bson(v) {
                            set_doc.insert(k, bson_val);
                        }
                    }
                }
            }
        }
    }

    if set_doc.is_empty() {
        return get_user(State(state), headers, Path(id)).await;
    }

    let coll = state.mongo.collection::<Document>("users");
    let res = coll.find_one_and_update(
        doc! { "_id": oid, "tenantId": tenant_id },
        doc! { "$set": set_doc }
    ).return_document(mongodb::options::ReturnDocument::After).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    Ok(Json(map_user_to_scim(&res)))
}

pub async fn replace_user(
    State(state): State<SabChatSsoState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<ScimUserCreate>,
) -> Result<Json<Value>> {
    let tenant_id = authenticate_scim_token(&state, &headers).await?;
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::NotFound("user not found".into()))?;

    let coll = state.mongo.collection::<Document>("users");
    
    let mut set_doc = doc! {
        "username": body.user_name,
        "active": body.active.unwrap_or(true),
    };
    if let Some(mut emails) = body.emails {
        if let Some(e) = emails.pop() {
            set_doc.insert("email", e.value);
        }
    }
    if let Some(name) = body.name {
        if let Some(gn) = name.given_name { set_doc.insert("firstName", gn); }
        if let Some(fn_) = name.family_name { set_doc.insert("lastName", fn_); }
    }
    if let Some(ext) = body.external_id {
        set_doc.insert("externalId", ext);
    }

    let res = coll.find_one_and_update(
        doc! { "_id": oid, "tenantId": tenant_id },
        doc! { "$set": set_doc }
    ).return_document(mongodb::options::ReturnDocument::After).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    Ok(Json(map_user_to_scim(&res)))
}

pub async fn delete_user(
    State(state): State<SabChatSsoState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let tenant_id = authenticate_scim_token(&state, &headers).await?;
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::NotFound("user not found".into()))?;

    let coll = state.mongo.collection::<Document>("users");
    let res = coll.delete_one(doc! { "_id": oid, "tenantId": tenant_id }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("user not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

fn map_user_to_scim(doc: &Document) -> Value {
    let mut val = document_to_clean_json(doc.clone());
    let mut obj = serde_json::Map::new();

    obj.insert("schemas".into(), serde_json::json!(["urn:ietf:params:scim:schemas:core:2.0:User"]));
    obj.insert("id".into(), val.get("_id").cloned().unwrap_or_default());
    
    if let Some(username) = val.get("username").or_else(|| val.get("email")) {
        obj.insert("userName".into(), username.clone());
    }

    if let Some(email) = val.get("email").and_then(|v| v.as_str()) {
        obj.insert("emails".into(), serde_json::json!([{
            "value": email,
            "type": "work",
            "primary": true
        }]));
    }

    let fn_str = val.get("firstName").and_then(|v| v.as_str()).unwrap_or("");
    let ln_str = val.get("lastName").and_then(|v| v.as_str()).unwrap_or("");
    if !fn_str.is_empty() || !ln_str.is_empty() {
        obj.insert("name".into(), serde_json::json!({
            "givenName": fn_str,
            "familyName": ln_str,
            "formatted": format!("{} {}", fn_str, ln_str).trim(),
        }));
    }

    if let Some(active) = val.get("active") {
        obj.insert("active".into(), active.clone());
    } else {
        obj.insert("active".into(), serde_json::json!(true));
    }

    if let Some(ext) = val.get("externalId") {
        obj.insert("externalId".into(), ext.clone());
    }

    serde_json::Value::Object(obj)
}

// ===========================================================================
// Groups CRUD
// ===========================================================================

pub async fn list_groups(
    State(state): State<SabChatSsoState>,
    headers: HeaderMap,
) -> Result<Json<ScimListResponse>> {
    let tenant_id = authenticate_scim_token(&state, &headers).await?;
    let coll = state.mongo.collection::<Document>("sabchat_teams");
    
    let mut cursor = coll.find(doc! { "tenantId": tenant_id }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let mut resources = vec![];
    while let Some(res) = cursor.next().await {
        let doc = res.map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
        resources.push(map_group_to_scim(&doc));
    }

    Ok(Json(ScimListResponse {
        schemas: vec!["urn:ietf:params:scim:api:messages:2.0:ListResponse".into()],
        total_results: resources.len(),
        start_index: 1,
        items_per_page: resources.len(),
        resources,
    }))
}

pub async fn create_group(
    State(state): State<SabChatSsoState>,
    headers: HeaderMap,
    Json(body): Json<ScimGroupCreate>,
) -> Result<Json<Value>> {
    let tenant_id = authenticate_scim_token(&state, &headers).await?;
    let coll = state.mongo.collection::<Document>("sabchat_teams");

    let oid = ObjectId::new();
    let members = body.members.unwrap_or_default().into_iter()
        .filter_map(|m| ObjectId::parse_str(&m.value).ok())
        .collect::<Vec<_>>();

    let mut doc = doc! {
        "_id": oid,
        "tenantId": tenant_id,
        "name": body.display_name,
        "memberIds": members,
        "createdAt": Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    };

    if let Some(ext) = body.external_id {
        doc.insert("externalId", ext);
    }

    coll.insert_one(&doc).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    Ok(Json(map_group_to_scim(&doc)))
}

pub async fn get_group(
    State(state): State<SabChatSsoState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let tenant_id = authenticate_scim_token(&state, &headers).await?;
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::NotFound("group not found".into()))?;

    let coll = state.mongo.collection::<Document>("sabchat_teams");
    let doc = coll.find_one(doc! { "_id": oid, "tenantId": tenant_id }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("group not found".into()))?;

    Ok(Json(map_group_to_scim(&doc)))
}

pub async fn patch_group(
    State(state): State<SabChatSsoState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<ScimPatchBody>,
) -> Result<Json<Value>> {
    let tenant_id = authenticate_scim_token(&state, &headers).await?;
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::NotFound("group not found".into()))?;

    // Naive implementation for patch group: just fetch, apply in memory, replace
    // Better: use MongoDB updates but SCIM operations can be complex for members
    let coll = state.mongo.collection::<Document>("sabchat_teams");
    let mut doc = coll.find_one(doc! { "_id": oid, "tenantId": tenant_id }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("group not found".into()))?;

    let mut member_ids = doc.get_array("memberIds").cloned().unwrap_or_default();

    for op in body.operations {
        let op_type = op.op.to_lowercase();
        if op_type == "add" && op.path.as_deref() == Some("members") {
            if let Some(val) = op.value {
                if let Some(arr) = val.as_array() {
                    for m in arr {
                        if let Some(v_str) = m.get("value").and_then(|v| v.as_str()) {
                            if let Ok(m_oid) = ObjectId::parse_str(v_str) {
                                let m_bson = mongodb::bson::Bson::ObjectId(m_oid);
                                if !member_ids.contains(&m_bson) {
                                    member_ids.push(m_bson);
                                }
                            }
                        }
                    }
                }
            }
        } else if op_type == "remove" && op.path.as_deref() == Some("members") {
            // we omit removing specific members for brevity unless implemented,
            // standard SCIM removes would specify `members[value eq "2819c223..."]`
        } else if op_type == "replace" {
            if let Some(path) = op.path {
                if path == "displayName" {
                    if let Some(val) = op.value.and_then(|v| v.as_str().map(|s| s.to_string())) {
                        doc.insert("name", val);
                    }
                }
            } else if let Some(val) = op.value {
                if let Some(dn) = val.get("displayName").and_then(|v| v.as_str()) {
                    doc.insert("name", dn);
                }
            }
        }
    }

    doc.insert("memberIds", member_ids);

    let res = coll.find_one_and_replace(
        doc! { "_id": oid, "tenantId": tenant_id },
        doc.clone()
    ).return_document(mongodb::options::ReturnDocument::After).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("group not found".into()))?;

    Ok(Json(map_group_to_scim(&res)))
}

pub async fn replace_group(
    State(state): State<SabChatSsoState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<ScimGroupCreate>,
) -> Result<Json<Value>> {
    let tenant_id = authenticate_scim_token(&state, &headers).await?;
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::NotFound("group not found".into()))?;

    let members = body.members.unwrap_or_default().into_iter()
        .filter_map(|m| ObjectId::parse_str(&m.value).ok())
        .collect::<Vec<_>>();

    let coll = state.mongo.collection::<Document>("sabchat_teams");
    let mut set_doc = doc! {
        "name": body.display_name,
        "memberIds": members,
    };
    if let Some(ext) = body.external_id {
        set_doc.insert("externalId", ext);
    }

    let res = coll.find_one_and_update(
        doc! { "_id": oid, "tenantId": tenant_id },
        doc! { "$set": set_doc }
    ).return_document(mongodb::options::ReturnDocument::After).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("group not found".into()))?;

    Ok(Json(map_group_to_scim(&res)))
}

pub async fn delete_group(
    State(state): State<SabChatSsoState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let tenant_id = authenticate_scim_token(&state, &headers).await?;
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::NotFound("group not found".into()))?;

    let coll = state.mongo.collection::<Document>("sabchat_teams");
    let res = coll.delete_one(doc! { "_id": oid, "tenantId": tenant_id }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("group not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

fn map_group_to_scim(doc: &Document) -> Value {
    let val = document_to_clean_json(doc.clone());
    let mut obj = serde_json::Map::new();

    obj.insert("schemas".into(), serde_json::json!(["urn:ietf:params:scim:schemas:core:2.0:Group"]));
    obj.insert("id".into(), val.get("_id").cloned().unwrap_or_default());
    
    if let Some(name) = val.get("name") {
        obj.insert("displayName".into(), name.clone());
    }

    if let Some(ext) = val.get("externalId") {
        obj.insert("externalId".into(), ext.clone());
    }

    if let Some(members) = doc.get_array("memberIds").ok() {
        let scim_members: Vec<_> = members.iter().filter_map(|m| {
            m.as_object_id().map(|oid| {
                serde_json::json!({ "value": oid.to_hex() })
            })
        }).collect();
        obj.insert("members".into(), serde_json::json!(scim_members));
    } else {
        obj.insert("members".into(), serde_json::json!([]));
    }

    serde_json::Value::Object(obj)
}
