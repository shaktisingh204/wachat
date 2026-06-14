//! HTTP handlers for the SabChat **action-taking AI** domain.
//!
//! | Collection                | Direction | Notes                            |
//! |---------------------------|-----------|----------------------------------|
//! | `sabchat_ai_connectors`   | r/w       | tool definitions                 |
//! | `sabchat_ai_action_runs`  | r/w       | invocation audit log             |
//!
//! Every read and write filters on `tenant_id = ObjectId(auth.tenant_id)`.
//!
//! ## SSRF note
//!
//! The `http_webhook` executor calls a tenant-configured URL. Connectors are
//! created by an authenticated admin of that tenant (their own endpoint), and
//! the feature is flag-gated, so this is an authorized egress — but operators
//! should still front it with an allow-list / network egress policy before
//! exposing it broadly.

use std::time::Duration;

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::{Value, json};
use tracing::instrument;

use crate::dto::{
    ConnectorConfig, CreateConnectorBody, IdResponse, InvokeBody, InvokeResponse,
    ListConnectorsResponse, ListRunsResponse, SuccessResponse, UpdateConnectorBody,
    VALID_CONNECTOR_KINDS, VALID_HTTP_METHODS,
};
use crate::state::SabChatAiActionsState;

const CONNECTORS_COLL: &str = "sabchat_ai_connectors";
const RUNS_COLL: &str = "sabchat_ai_action_runs";
const INVOKE_TIMEOUT_SECS: u64 = 15;

// ===========================================================================
// Helpers
// ===========================================================================

fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

fn now_bson() -> bson::DateTime {
    bson::DateTime::from_chrono(Utc::now())
}

fn internal(ctx: &'static str) -> impl Fn(mongodb::error::Error) -> ApiError {
    move |e| ApiError::Internal(anyhow::Error::new(e).context(ctx))
}

fn config_to_bson(cfg: &ConnectorConfig) -> Result<Bson> {
    bson::to_bson(cfg).map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("config.to_bson")))
}

fn value_to_bson(v: &Value) -> Bson {
    bson::to_bson(v).unwrap_or(Bson::Null)
}

// ===========================================================================
// POST /connectors — create_connector
// ===========================================================================

#[instrument(skip_all)]
pub async fn create_connector(
    user: AuthUser,
    State(state): State<SabChatAiActionsState>,
    Json(body): Json<CreateConnectorBody>,
) -> Result<Json<IdResponse>> {
    let name = body.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let kind = body.kind.as_deref().map(str::trim).filter(|s| !s.is_empty()).unwrap_or("http_webhook");
    if !VALID_CONNECTOR_KINDS.contains(&kind) {
        return Err(ApiError::BadRequest(format!(
            "invalid kind `{kind}`; expected one of: {}",
            VALID_CONNECTOR_KINDS.join(", "),
        )));
    }
    if kind == "http_webhook"
        && body.config.url.as_deref().map(str::trim).unwrap_or("").is_empty()
    {
        return Err(ApiError::BadRequest("an http_webhook connector needs a url".to_owned()));
    }

    let tenant_id = tenant_oid(&user)?;
    let now = now_bson();
    let new_oid = ObjectId::new();
    let doc = doc! {
        "_id": new_oid,
        "tenant_id": tenant_id,
        "name": name,
        "description": body.description.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        "kind": kind,
        "config": config_to_bson(&body.config)?,
        "input_schema": body.input_schema.as_ref().map(value_to_bson).unwrap_or(Bson::Null),
        "enabled": body.enabled,
        "created_at": now,
        "updated_at": now,
    };
    state
        .mongo
        .collection::<Document>(CONNECTORS_COLL)
        .insert_one(doc)
        .await
        .map_err(internal("sabchat_ai_connectors.insert_one"))?;
    Ok(Json(IdResponse {
        id: new_oid.to_hex(),
    }))
}

// ===========================================================================
// GET /connectors — list_connectors
// ===========================================================================

#[instrument(skip_all)]
pub async fn list_connectors(
    user: AuthUser,
    State(state): State<SabChatAiActionsState>,
) -> Result<Json<ListConnectorsResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let opts = FindOptions::builder().sort(doc! { "created_at": -1 }).build();
    let cursor = state
        .mongo
        .collection::<Document>(CONNECTORS_COLL)
        .find(doc! { "tenant_id": tenant_id })
        .with_options(opts)
        .await
        .map_err(internal("sabchat_ai_connectors.find"))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(internal("sabchat_ai_connectors.collect"))?;
    Ok(Json(ListConnectorsResponse {
        connectors: docs.into_iter().map(document_to_clean_json).collect(),
    }))
}

// ===========================================================================
// PATCH /connectors/{id} — update_connector
// ===========================================================================

#[instrument(skip_all, fields(connector_id = %connector_id))]
pub async fn update_connector(
    user: AuthUser,
    State(state): State<SabChatAiActionsState>,
    Path(connector_id): Path<String>,
    Json(body): Json<UpdateConnectorBody>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let cid = oid_from_str(&connector_id)
        .map_err(|_| ApiError::BadRequest("invalid connector id".to_owned()))?;

    let mut set = doc! { "updated_at": now_bson() };
    if let Some(name) = body.name.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        set.insert("name", name);
    }
    if let Some(desc) = body.description.as_ref() {
        set.insert("description", desc.trim());
    }
    if let Some(cfg) = body.config.as_ref() {
        set.insert("config", config_to_bson(cfg)?);
    }
    if let Some(schema) = body.input_schema.as_ref() {
        set.insert("input_schema", value_to_bson(schema));
    }
    if let Some(enabled) = body.enabled {
        set.insert("enabled", enabled);
    }
    if set.len() <= 1 {
        return Err(ApiError::BadRequest("no updatable fields supplied".to_owned()));
    }

    let res = state
        .mongo
        .collection::<Document>(CONNECTORS_COLL)
        .update_one(
            doc! { "_id": cid, "tenant_id": tenant_id },
            doc! { "$set": set },
        )
        .await
        .map_err(internal("sabchat_ai_connectors.update_one"))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("connector not found".to_owned()));
    }
    Ok(Json(SuccessResponse {
        message: "connector updated".to_owned(),
    }))
}

// ===========================================================================
// DELETE /connectors/{id} — delete_connector
// ===========================================================================

#[instrument(skip_all, fields(connector_id = %connector_id))]
pub async fn delete_connector(
    user: AuthUser,
    State(state): State<SabChatAiActionsState>,
    Path(connector_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let cid = oid_from_str(&connector_id)
        .map_err(|_| ApiError::BadRequest("invalid connector id".to_owned()))?;
    let res = state
        .mongo
        .collection::<Document>(CONNECTORS_COLL)
        .delete_one(doc! { "_id": cid, "tenant_id": tenant_id })
        .await
        .map_err(internal("sabchat_ai_connectors.delete_one"))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("connector not found".to_owned()));
    }
    Ok(Json(SuccessResponse {
        message: "connector deleted".to_owned(),
    }))
}

// ===========================================================================
// POST /connectors/{id}/invoke — execute the connector
// ===========================================================================

#[instrument(skip_all, fields(connector_id = %connector_id))]
pub async fn invoke_connector(
    user: AuthUser,
    State(state): State<SabChatAiActionsState>,
    Path(connector_id): Path<String>,
    Json(body): Json<InvokeBody>,
) -> Result<Json<InvokeResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let cid = oid_from_str(&connector_id)
        .map_err(|_| ApiError::BadRequest("invalid connector id".to_owned()))?;

    let connector = state
        .mongo
        .collection::<Document>(CONNECTORS_COLL)
        .find_one(doc! { "_id": cid, "tenant_id": tenant_id })
        .await
        .map_err(internal("sabchat_ai_connectors.find_one"))?
        .ok_or_else(|| ApiError::NotFound("connector not found".to_owned()))?;

    if !connector.get_bool("enabled").unwrap_or(true) {
        return Err(ApiError::BadRequest("connector is disabled".to_owned()));
    }

    let cfg: ConnectorConfig = connector
        .get_document("config")
        .ok()
        .and_then(|d| bson::from_bson(Bson::Document(d.clone())).ok())
        .unwrap_or_default();

    // Execute the http_webhook (the only kind in v1).
    let (status, http_status, output, error) =
        execute_http(&state.http, &cfg, &body.input).await;

    // Record the run for audit.
    let run_oid = ObjectId::new();
    let now = now_bson();
    let run_doc = doc! {
        "_id": run_oid,
        "tenant_id": tenant_id,
        "connector_id": cid,
        "conversation_id": body.conversation_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        "input": value_to_bson(&body.input),
        "output": value_to_bson(&output),
        "status": &status,
        "http_status": http_status.map(|c| c as i64),
        "error": error.clone(),
        "created_at": now,
    };
    let _ = state
        .mongo
        .collection::<Document>(RUNS_COLL)
        .insert_one(run_doc)
        .await;

    Ok(Json(InvokeResponse {
        run_id: run_oid.to_hex(),
        status,
        http_status,
        output,
        error,
    }))
}

/// Run the `http_webhook` executor. Returns `(status, http_status, output,
/// error)`. Never returns `Err` — a connector failure is recorded data, not
/// a request error.
async fn execute_http(
    client: &reqwest::Client,
    cfg: &ConnectorConfig,
    input: &Value,
) -> (String, Option<u16>, Value, Option<String>) {
    let url = match cfg.url.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(u) => u.to_owned(),
        None => return ("error".to_owned(), None, Value::Null, Some("connector has no url".to_owned())),
    };
    let method_str = cfg
        .method
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("POST")
        .to_uppercase();
    if !VALID_HTTP_METHODS.contains(&method_str.as_str()) {
        return ("error".to_owned(), None, Value::Null, Some(format!("unsupported method `{method_str}`")));
    }
    let method = match reqwest::Method::from_bytes(method_str.as_bytes()) {
        Ok(m) => m,
        Err(_) => return ("error".to_owned(), None, Value::Null, Some("bad method".to_owned())),
    };

    let mut req = client
        .request(method.clone(), &url)
        .timeout(Duration::from_secs(INVOKE_TIMEOUT_SECS));
    if let Some(headers) = &cfg.headers {
        for (k, v) in headers {
            req = req.header(k, v);
        }
    }
    if method != reqwest::Method::GET {
        req = req.json(input);
    }

    match req.send().await {
        Ok(resp) => {
            let code = resp.status().as_u16();
            let ok = resp.status().is_success();
            let text = resp.text().await.unwrap_or_default();
            let output = serde_json::from_str::<Value>(&text).unwrap_or_else(|_| json!({ "raw": text }));
            (
                if ok { "ok".to_owned() } else { "error".to_owned() },
                Some(code),
                output,
                if ok { None } else { Some(format!("connector returned HTTP {code}")) },
            )
        }
        Err(e) => ("error".to_owned(), None, Value::Null, Some(e.to_string())),
    }
}

// ===========================================================================
// GET /runs — list_runs (audit)
// ===========================================================================

#[instrument(skip_all)]
pub async fn list_runs(
    user: AuthUser,
    State(state): State<SabChatAiActionsState>,
) -> Result<Json<ListRunsResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let opts = FindOptions::builder()
        .sort(doc! { "created_at": -1 })
        .limit(100)
        .build();
    let cursor = state
        .mongo
        .collection::<Document>(RUNS_COLL)
        .find(doc! { "tenant_id": tenant_id })
        .with_options(opts)
        .await
        .map_err(internal("sabchat_ai_action_runs.find"))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(internal("sabchat_ai_action_runs.collect"))?;
    Ok(Json(ListRunsResponse {
        runs: docs.into_iter().map(document_to_clean_json).collect(),
    }))
}
