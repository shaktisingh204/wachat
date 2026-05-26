use axum::{
    extract::{Path, State},
    Json,
};
use mongodb::bson::{doc, oid::ObjectId, Document};
use futures::stream::StreamExt;
use chrono::Utc;
use serde_json::Value;

use sabnode_common::error::{ApiError, Result};
use sabnode_db::document_to_clean_json;
use sabnode_auth::AuthUser;

use crate::state::SabChatSsoState;
use crate::dto::{
    CreateSsoConfigBody, UpdateSsoConfigBody,
    CreateScimTokenBody, CreateScimTokenResponse,
    TestSamlResponseBody, TestSamlResponseResult,
};

// ===========================================================================
// SSO Configs
// ===========================================================================

pub async fn list_sso_configs(
    State(state): State<SabChatSsoState>,
    auth: AuthUser,
) -> Result<Json<Vec<Value>>> {
    let tenant_id = ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Internal("invalid tenant oid".into()))?;

    let coll = state.mongo.db.collection::<Document>("sabchat_sso_configs");
    let mut cursor = coll.find(doc! { "tenantId": tenant_id }).await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    let mut out = vec![];
    while let Some(res) = cursor.next().await {
        let doc = res.map_err(|e| ApiError::Internal(e.to_string()))?;
        out.push(document_to_clean_json(&doc));
    }

    Ok(Json(out))
}

pub async fn create_sso_config(
    State(state): State<SabChatSsoState>,
    auth: AuthUser,
    Json(body): Json<CreateSsoConfigBody>,
) -> Result<Json<Value>> {
    let tenant_id = ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Internal("invalid tenant oid".into()))?;

    let coll = state.mongo.db.collection::<Document>("sabchat_sso_configs");
    let active = body.active.unwrap_or(true);
    let now = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);

    let oid = ObjectId::new();
    let mut doc = doc! {
        "_id": oid,
        "tenantId": tenant_id,
        "kind": body.kind,
        "issuer": body.issuer,
        "active": active,
        "createdAt": now.clone(),
        "updatedAt": now,
    };
    if let Some(val) = body.sso_url { doc.insert("ssoUrl", val); }
    if let Some(val) = body.certificate_pem { doc.insert("certificatePem", val); }
    if let Some(val) = body.client_id { doc.insert("clientId", val); }
    if let Some(val) = body.client_secret { doc.insert("clientSecret", val); }
    if let Some(val) = body.domain { doc.insert("domain", val); }

    coll.insert_one(&doc).await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    Ok(Json(document_to_clean_json(&doc)))
}

pub async fn get_sso_config(
    State(state): State<SabChatSsoState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let tenant_id = ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Internal("invalid tenant oid".into()))?;
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::NotFound("config not found".into()))?;

    let coll = state.mongo.db.collection::<Document>("sabchat_sso_configs");
    let doc = coll.find_one(doc! { "_id": oid, "tenantId": tenant_id }).await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("config not found".into()))?;

    Ok(Json(document_to_clean_json(&doc)))
}

pub async fn update_sso_config(
    State(state): State<SabChatSsoState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateSsoConfigBody>,
) -> Result<Json<Value>> {
    let tenant_id = ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Internal("invalid tenant oid".into()))?;
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::NotFound("config not found".into()))?;

    let mut set_doc = doc! {
        "updatedAt": Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
    };
    if let Some(v) = body.kind { set_doc.insert("kind", v); }
    if let Some(v) = body.issuer { set_doc.insert("issuer", v); }
    if let Some(v) = body.sso_url { set_doc.insert("ssoUrl", v); }
    if let Some(v) = body.certificate_pem { set_doc.insert("certificatePem", v); }
    if let Some(v) = body.client_id { set_doc.insert("clientId", v); }
    if let Some(v) = body.client_secret { set_doc.insert("clientSecret", v); }
    if let Some(v) = body.domain { set_doc.insert("domain", v); }
    if let Some(v) = body.active { set_doc.insert("active", v); }

    let coll = state.mongo.db.collection::<Document>("sabchat_sso_configs");
    let res = coll.find_one_and_update(
        doc! { "_id": oid, "tenantId": tenant_id },
        doc! { "$set": set_doc }
    ).return_document(mongodb::options::ReturnDocument::After).await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("config not found".into()))?;

    Ok(Json(document_to_clean_json(&res)))
}

pub async fn delete_sso_config(
    State(state): State<SabChatSsoState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let tenant_id = ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Internal("invalid tenant oid".into()))?;
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::NotFound("config not found".into()))?;

    let coll = state.mongo.db.collection::<Document>("sabchat_sso_configs");
    let res = coll.delete_one(doc! { "_id": oid, "tenantId": tenant_id }).await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("config not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ===========================================================================
// SCIM Tokens
// ===========================================================================

fn generate_scim_token() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

fn redact_token(token: &str) -> String {
    if token.len() > 8 {
        format!("{}...{}", &token[..4], &token[token.len() - 4..])
    } else {
        "***".into()
    }
}

pub async fn list_scim_tokens(
    State(state): State<SabChatSsoState>,
    auth: AuthUser,
) -> Result<Json<Vec<Value>>> {
    let tenant_id = ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Internal("invalid tenant oid".into()))?;

    let coll = state.mongo.db.collection::<Document>("sabchat_scim_tokens");
    let mut cursor = coll.find(doc! { "tenantId": tenant_id }).await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    let mut out = vec![];
    while let Some(res) = cursor.next().await {
        let mut doc = res.map_err(|e| ApiError::Internal(e.to_string()))?;
        if let Ok(token) = doc.get_str("token") {
            doc.insert("token", redact_token(token));
        }
        out.push(document_to_clean_json(&doc));
    }

    Ok(Json(out))
}

pub async fn create_scim_token(
    State(state): State<SabChatSsoState>,
    auth: AuthUser,
    Json(body): Json<CreateScimTokenBody>,
) -> Result<Json<CreateScimTokenResponse>> {
    let tenant_id = ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Internal("invalid tenant oid".into()))?;

    let coll = state.mongo.db.collection::<Document>("sabchat_scim_tokens");
    let token = generate_scim_token();
    let now = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let oid = ObjectId::new();

    let doc = doc! {
        "_id": oid,
        "tenantId": tenant_id,
        "token": &token,
        "name": &body.name,
        "scopes": &body.scopes,
        "createdAt": now,
    };

    coll.insert_one(&doc).await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    Ok(Json(CreateScimTokenResponse {
        id: oid.to_hex(),
        name: body.name,
        scopes: body.scopes,
        token,
    }))
}

pub async fn delete_scim_token(
    State(state): State<SabChatSsoState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let tenant_id = ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Internal("invalid tenant oid".into()))?;
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::NotFound("token not found".into()))?;

    let coll = state.mongo.db.collection::<Document>("sabchat_scim_tokens");
    let res = coll.delete_one(doc! { "_id": oid, "tenantId": tenant_id }).await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("token not found".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ===========================================================================
// Test SAML Response Stub
// ===========================================================================

pub async fn test_saml_response(
    State(_state): State<SabChatSsoState>,
    auth: AuthUser,
    Json(_body): Json<TestSamlResponseBody>,
) -> Result<Json<TestSamlResponseResult>> {
    let _tenant_id = ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Internal("invalid tenant oid".into()))?;

    // Stub response for the happy path.
    Ok(Json(TestSamlResponseResult {
        ok: true,
        claims: serde_json::json!({
            "email": "test@example.com",
            "firstName": "Test",
            "lastName": "User"
        }),
    }))
}
