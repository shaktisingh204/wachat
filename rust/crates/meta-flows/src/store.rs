//! Meta Flows store — Mongo + Meta Graph API operations.
//!
//! Each function corresponds 1:1 to an `export async function` in
//! `src/app/actions/meta-flow.actions.ts`. Side effects:
//! - `meta_flows` Mongo collection writes (insert / update / delete /
//!   bulkWrite for sync).
//! - Meta Graph API calls (`/{waba}/flows`, `/{flow}`, `/{flow}/assets`,
//!   `/{flow}/publish`, `/{flow}/deprecate`, etc).
//!
//! `revalidatePath` is intentionally NOT called here — it's a Next.js
//! server-action concept. The TS shim that calls into this crate calls
//! `revalidatePath` after the network round-trip if the underlying
//! response was successful.

use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::stream::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Deserialize;
use serde_json::{Value, json};
use wachat_types::Project;

use crate::dto::{
    ActionResult, CreateFlowOut, CreateFlowReq, MetaFlowDoc, MetaFlowOut, PreviewOut, PreviewReq,
    SaveDraftReq, SyncOutcome, UpdateMetadataReq, ValidationError,
};
use crate::meta_http::{self, Client as MetaHttp, MetaHttpError};

const FLOWS_COLL: &str = "meta_flows";
const PROJECTS_COLL: &str = "projects";
const FLOW_JSON_VERSION: &str = "7.3";
const DATA_API_VERSION: &str = "3.0";

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

/// Resolve the flow's owning project directly from the stored row.
///
/// Mirrors the TS `loadOwnedFlow` helper: read flow → project → tenant
/// check. Returns `(flow_doc, project)` so the caller has both halves.
pub async fn load_flow_with_project(
    mongo: &MongoHandle,
    user_tenant_id: &str,
    flow_id_hex: &str,
) -> Result<(MetaFlowDoc, Project)> {
    let oid = ObjectId::parse_str(flow_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid Flow ID.".to_owned()))?;
    let flow = mongo
        .collection::<MetaFlowDoc>(FLOWS_COLL)
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("Flow not found.".to_owned()))?;
    let project = mongo
        .collection::<Project>(PROJECTS_COLL)
        .find_one(doc! { "_id": flow.project_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("Project not found.".to_owned()))?;
    if user_tenant_id != project.user_id.to_hex() {
        return Err(ApiError::Forbidden("Project access denied.".to_owned()));
    }
    Ok((flow, project))
}

/// Look up the stored flow and confirm the caller's project context.
///
/// Returns `(flow_doc, project)` so the caller has the access token + waba
/// without re-fetching. The caller is expected to have already proved
/// project ownership via `load_project_for` in `router.rs`.
pub async fn load_flow(
    mongo: &MongoHandle,
    project: &Project,
    flow_id_hex: &str,
) -> Result<MetaFlowDoc> {
    let oid = ObjectId::parse_str(flow_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid Flow ID.".to_owned()))?;
    let flow = mongo
        .collection::<MetaFlowDoc>(FLOWS_COLL)
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("Flow not found.".to_owned()))?;
    if flow.project_id != project.id {
        return Err(ApiError::Forbidden("Flow not in this project.".to_owned()));
    }
    Ok(flow)
}

fn require_token(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .filter(|t| !t.is_empty())
        .ok_or_else(|| ApiError::BadRequest("Project access denied.".to_owned()))
}

fn require_waba(project: &Project) -> Result<&str> {
    project
        .waba_id
        .as_deref()
        .filter(|w| !w.is_empty())
        .ok_or_else(|| ApiError::BadRequest("Project is missing a WABA ID.".to_owned()))
}

/// Map a `MetaHttpError` into the failed-`ActionResult` envelope, preserving
/// `validation_errors` when Meta supplied them.
fn fail_result<T: serde::Serialize>(err: &MetaHttpError) -> ActionResult<T> {
    let mut out = ActionResult::<T> {
        success: false,
        message: None,
        error: Some(meta_http::message_for(err)),
        validation_errors: meta_http::validation_for(err),
        data: None,
    };
    // Make the typed envelope serializable when `T = ()` and `data: None`.
    let _ = &mut out;
    out
}

// ---------------------------------------------------------------------
// reads
// ---------------------------------------------------------------------

/// `getMetaFlows(projectId)` — pure local read, no Meta call. Sorted by
/// `createdAt` desc to match the TS.
pub async fn list_flows(mongo: &MongoHandle, project: &Project) -> Result<Vec<MetaFlowOut>> {
    let coll = mongo.collection::<MetaFlowDoc>(FLOWS_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project.id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let mut out = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        out.push(MetaFlowOut::from(d));
    }
    Ok(out)
}

/// `getMetaFlowById(flowId)` — pulls fresh state (status / preview /
/// health / validation_errors) from Meta plus the full Flow JSON via the
/// signed assets `download_url`, mirrors back into Mongo, and returns
/// the merged document. On Meta failure we fall back to the local copy
/// (matches the TS behaviour where flow editing must keep working when
/// Meta is degraded).
pub async fn get_flow(
    mongo: &MongoHandle,
    http: &MetaHttp,
    project: &Project,
    flow_id_hex: &str,
) -> Result<Option<MetaFlowOut>> {
    let flow = match load_flow(mongo, project, flow_id_hex).await {
        Ok(f) => f,
        Err(ApiError::NotFound(_)) => return Ok(None),
        Err(e) => return Err(e),
    };
    let token = require_token(project)?;

    // 1) Pull the metadata projection from Meta.
    let fields = "id,name,status,categories,validation_errors,json_version,endpoint_uri,preview,health_status";
    let meta_resp = http
        .get_json::<Value>(&flow.meta_id, token, &[("fields", fields.to_owned())])
        .await;

    let mut update = doc! { "updatedAt": bson::DateTime::from_chrono(Utc::now()) };
    let mut latest_doc = flow.clone();

    if let Ok(meta) = meta_resp {
        if let Some(name) = meta.get("name").and_then(|v| v.as_str()) {
            update.insert("name", name);
            latest_doc.name = name.to_owned();
        }
        if let Some(status) = meta.get("status").and_then(|v| v.as_str()) {
            update.insert("status", status);
            latest_doc.status = status.to_owned();
        }
        if let Some(jv) = meta.get("json_version").and_then(|v| v.as_str()) {
            update.insert("jsonVersion", jv);
            latest_doc.json_version = Some(jv.to_owned());
        }
        if let Some(eu) = meta.get("endpoint_uri").and_then(|v| v.as_str()) {
            update.insert("endpointUri", eu);
            latest_doc.endpoint_uri = Some(eu.to_owned());
        }
        if let Some(cats) = meta.get("categories").and_then(|v| v.as_array()) {
            let cats_str: Vec<String> = cats
                .iter()
                .filter_map(|c| c.as_str().map(|s| s.to_owned()))
                .collect();
            update.insert("categories", cats_str.clone());
            latest_doc.categories = cats_str;
        }
        let ve: Vec<ValidationError> = meta
            .get("validation_errors")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();
        update.insert(
            "validationErrors",
            bson::to_bson(&ve).unwrap_or(bson::Bson::Array(vec![])),
        );
        latest_doc.validation_errors = Some(ve);
        if let Some(hs) = meta.get("health_status") {
            update.insert(
                "healthStatus",
                bson::to_bson(hs).unwrap_or(bson::Bson::Null),
            );
            latest_doc.health_status = Some(hs.clone());
        }
        if let Some(prev) = meta.get("preview") {
            update.insert("preview", bson::to_bson(prev).unwrap_or(bson::Bson::Null));
            latest_doc.preview = Some(prev.clone());
        }

        // 2) Try to pull the full Flow JSON via /assets → download_url.
        if let Ok(assets_resp) = http
            .get_json::<Value>(&format!("{}/assets", flow.meta_id), token, &[])
            .await
        {
            let asset = assets_resp
                .get("data")
                .and_then(|d| d.as_array())
                .and_then(|arr| {
                    arr.iter()
                        .find(|a| a.get("asset_type").and_then(|t| t.as_str()) == Some("FLOW_JSON"))
                        .or_else(|| arr.first())
                });
            if let Some(asset) = asset {
                if let Some(url) = asset.get("download_url").and_then(|u| u.as_str()) {
                    if let Ok(raw) = http.get_url_text(url).await {
                        if let Ok(parsed) = serde_json::from_str::<Value>(&raw) {
                            update.insert(
                                "flowData",
                                bson::to_bson(&parsed).unwrap_or(bson::Bson::Null),
                            );
                            latest_doc.flow_data = parsed;
                        }
                    }
                } else if let Some(content) = asset.get("asset_content").and_then(|c| c.as_str()) {
                    if let Ok(parsed) = serde_json::from_str::<Value>(content) {
                        update.insert(
                            "flowData",
                            bson::to_bson(&parsed).unwrap_or(bson::Bson::Null),
                        );
                        latest_doc.flow_data = parsed;
                    }
                }
            }
        } else {
            tracing::warn!(meta_id = %flow.meta_id, "meta-flow assets fetch failed");
        }
    } else if let Err(e) = meta_resp {
        tracing::warn!(meta_id = %flow.meta_id, error = %e, "meta-flow sync failed");
        // Keep local copy — don't escalate.
        return Ok(Some(MetaFlowOut::from(flow)));
    }

    let coll = mongo.collection::<Document>(FLOWS_COLL);
    coll.update_one(doc! { "_id": flow.id }, doc! { "$set": update })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(Some(MetaFlowOut::from(latest_doc)))
}

// ---------------------------------------------------------------------
// writes: create / save / update
// ---------------------------------------------------------------------

pub async fn create_flow(
    mongo: &MongoHandle,
    http: &MetaHttp,
    project: &Project,
    req: CreateFlowReq,
) -> Result<ActionResult<CreateFlowOut>> {
    if req.name.is_empty() {
        return Ok(ActionResult::<CreateFlowOut> {
            success: false,
            error: Some("Flow name is required.".to_owned()),
            ..Default::default()
        });
    }
    if req.categories.is_empty() {
        return Ok(ActionResult::<CreateFlowOut> {
            success: false,
            error: Some("Select at least one category.".to_owned()),
            ..Default::default()
        });
    }
    let token = require_token(project)?;
    let waba = require_waba(project)?;

    // We deliberately do NOT post `flow_json` on create — Meta's strict
    // integrity check on `POST /flows` returns vague errors. The companion
    // saveMetaFlowDraft hits `/assets` which yields structured
    // `validation_errors`. The TS behaves the same way.
    let mut body = json!({ "name": req.name, "categories": req.categories });
    if let Some(eu) = req.endpoint_uri.as_deref() {
        body["endpoint_uri"] = json!(eu);
    }
    if let Some(clone) = req.clone_flow_id.as_deref() {
        body["clone_flow_id"] = json!(clone);
    }

    let resp = match http
        .post_json::<Value>(&format!("{waba}/flows"), token, &body)
        .await
    {
        Ok(v) => v,
        Err(e) => {
            return Ok(ActionResult::<CreateFlowOut> {
                success: false,
                error: Some(meta_http::message_for(&e)),
                validation_errors: meta_http::validation_for(&e),
                ..Default::default()
            });
        }
    };

    let new_meta_id = match resp.get("id").and_then(|v| v.as_str()) {
        Some(id) => id.to_owned(),
        None => {
            return Ok(ActionResult::<CreateFlowOut> {
                success: false,
                error: Some("Meta did not return a flow id.".to_owned()),
                ..Default::default()
            });
        }
    };
    let resp_validation: Vec<ValidationError> = resp
        .get("validation_errors")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    // Use whatever `flow_data` the caller supplied (already cleaned on the
    // TS side). When omitted, store a minimal scaffold matching the TS.
    let flow_data = req.flow_data.unwrap_or_else(|| {
        let mut v = json!({
            "version": FLOW_JSON_VERSION,
            "routing_model": {},
            "screens": [],
        });
        if req.endpoint_uri.is_some() {
            v["data_api_version"] = json!(DATA_API_VERSION);
        }
        v
    });
    let json_version = flow_data
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or(FLOW_JSON_VERSION)
        .to_owned();

    let now = bson::DateTime::from_chrono(Utc::now());
    let new_id = ObjectId::new();
    let mut insert = doc! {
        "_id": new_id,
        "name": &req.name,
        "projectId": project.id,
        "metaId": &new_meta_id,
        "status": "DRAFT",
        "jsonVersion": &json_version,
        "categories": &req.categories,
        "flowData": bson::to_bson(&flow_data).unwrap_or(bson::Bson::Null),
        "validationErrors": bson::to_bson(&resp_validation).unwrap_or(bson::Bson::Array(vec![])),
        "healthStatus": bson::Bson::Null,
        "preview": bson::Bson::Null,
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(eu) = req.endpoint_uri.as_deref() {
        insert.insert("endpointUri", eu);
    }
    mongo
        .collection::<Document>(FLOWS_COLL)
        .insert_one(insert)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(ActionResult::<CreateFlowOut> {
        success: true,
        message: Some(format!("Flow \"{}\" created as DRAFT.", req.name)),
        validation_errors: if resp_validation.is_empty() {
            Some(vec![])
        } else {
            Some(resp_validation)
        },
        data: Some(CreateFlowOut {
            flow_id: new_id.to_hex(),
            meta_id: new_meta_id,
        }),
        ..Default::default()
    })
}

pub async fn save_draft(
    mongo: &MongoHandle,
    http: &MetaHttp,
    project: &Project,
    flow_id_hex: &str,
    req: SaveDraftReq,
) -> Result<ActionResult<()>> {
    let flow = load_flow(mongo, project, flow_id_hex).await?;
    if flow.status != "DRAFT" {
        return Ok(ActionResult::fail(format!(
            "Cannot edit JSON while flow is {}. Create a new version or deprecate first.",
            flow.status
        )));
    }
    let token = require_token(project)?;

    // Caller has already cleaned the data on the TS side (cleanMetaFlowData).
    let bytes =
        serde_json::to_vec(&req.flow_data).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let resp = match http.post_assets(&flow.meta_id, token, bytes).await {
        Ok(v) => v,
        Err(e) => {
            return Ok(ActionResult {
                success: false,
                error: Some(meta_http::message_for(&e)),
                validation_errors: meta_http::validation_for(&e),
                ..Default::default()
            });
        }
    };

    let validation: Vec<ValidationError> = resp
        .get("validation_errors")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();
    let success_flag = resp
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    if !success_flag && !validation.is_empty() {
        // Mirror the validation_errors back to Mongo so the next read sees
        // them, then surface the failure.
        mongo
            .collection::<Document>(FLOWS_COLL)
            .update_one(
                doc! { "_id": flow.id },
                doc! {
                    "$set": {
                        "validationErrors":
                            bson::to_bson(&validation).unwrap_or(bson::Bson::Array(vec![])),
                        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
                    },
                },
            )
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
        return Ok(ActionResult::fail_with_validation(
            "Flow JSON validation failed.",
            validation,
        ));
    }

    let json_version = req
        .flow_data
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or(FLOW_JSON_VERSION)
        .to_owned();
    mongo
        .collection::<Document>(FLOWS_COLL)
        .update_one(
            doc! { "_id": flow.id },
            doc! {
                "$set": {
                    "flowData": bson::to_bson(&req.flow_data).unwrap_or(bson::Bson::Null),
                    "jsonVersion": json_version,
                    "validationErrors":
                        bson::to_bson(&validation).unwrap_or(bson::Bson::Array(vec![])),
                    "updatedAt": bson::DateTime::from_chrono(Utc::now()),
                },
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(ActionResult {
        success: true,
        message: Some("Draft saved.".to_owned()),
        validation_errors: Some(validation),
        ..Default::default()
    })
}

pub async fn update_metadata(
    mongo: &MongoHandle,
    http: &MetaHttp,
    project: &Project,
    flow_id_hex: &str,
    req: UpdateMetadataReq,
) -> Result<ActionResult<()>> {
    let flow = load_flow(mongo, project, flow_id_hex).await?;
    let token = require_token(project)?;

    let mut body = serde_json::Map::new();
    if let Some(name) = req.name.as_deref() {
        body.insert("name".into(), json!(name));
    }
    if let Some(cats) = req.categories.as_ref() {
        body.insert("categories".into(), json!(cats));
    }
    if let Some(eu) = req.endpoint_uri.as_ref() {
        // TS sends "" when clearing. Match exactly.
        body.insert("endpoint_uri".into(), json!(eu.clone().unwrap_or_default()));
    }
    if let Some(app_id) = req.application_id.as_deref() {
        body.insert("application_id".into(), json!(app_id));
    }
    if body.is_empty() {
        return Ok(ActionResult::just_msg("Nothing to update."));
    }

    if let Err(e) = http
        .post_json::<Value>(&flow.meta_id, token, &Value::Object(body))
        .await
    {
        return Ok(fail_result::<()>(&e));
    }

    let mut set = doc! { "updatedAt": bson::DateTime::from_chrono(Utc::now()) };
    if let Some(name) = req.name.as_deref() {
        set.insert("name", name);
    }
    if let Some(cats) = req.categories.as_ref() {
        set.insert("categories", cats);
    }
    if let Some(eu) = req.endpoint_uri.as_ref() {
        match eu {
            Some(s) => {
                set.insert("endpointUri", s);
            }
            None => {
                set.insert("endpointUri", bson::Bson::Null);
            }
        }
    }
    if let Some(app_id) = req.application_id.as_deref() {
        set.insert("applicationId", app_id);
    }
    mongo
        .collection::<Document>(FLOWS_COLL)
        .update_one(doc! { "_id": flow.id }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(ActionResult::just_msg("Metadata updated."))
}

// ---------------------------------------------------------------------
// publish / deprecate / delete
// ---------------------------------------------------------------------

pub async fn publish(
    mongo: &MongoHandle,
    http: &MetaHttp,
    project: &Project,
    flow_id_hex: &str,
) -> Result<ActionResult<()>> {
    let flow = load_flow(mongo, project, flow_id_hex).await?;
    let token = require_token(project)?;

    if let Err(e) = http
        .post_json::<Value>(&format!("{}/publish", flow.meta_id), token, &json!({}))
        .await
    {
        return Ok(fail_result::<()>(&e));
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    mongo
        .collection::<Document>(FLOWS_COLL)
        .update_one(
            doc! { "_id": flow.id },
            doc! {
                "$set": {
                    "status": "PUBLISHED",
                    "lastPublishedAt": now,
                    "updatedAt": now,
                }
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(ActionResult::just_msg("Flow published."))
}

pub async fn deprecate(
    mongo: &MongoHandle,
    http: &MetaHttp,
    project: &Project,
    flow_id_hex: &str,
) -> Result<ActionResult<()>> {
    let flow = load_flow(mongo, project, flow_id_hex).await?;
    let token = require_token(project)?;

    if let Err(e) = http
        .post_json::<Value>(&format!("{}/deprecate", flow.meta_id), token, &json!({}))
        .await
    {
        return Ok(ActionResult::fail(meta_http::message_for(&e)));
    }
    let now = bson::DateTime::from_chrono(Utc::now());
    mongo
        .collection::<Document>(FLOWS_COLL)
        .update_one(
            doc! { "_id": flow.id },
            doc! { "$set": { "status": "DEPRECATED", "updatedAt": now } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(ActionResult::just_msg("Flow deprecated."))
}

pub async fn delete_flow(
    mongo: &MongoHandle,
    http: &MetaHttp,
    project: &Project,
    flow_id_hex: &str,
    meta_id_override: Option<String>,
) -> Result<ActionResult<()>> {
    let flow = load_flow(mongo, project, flow_id_hex).await?;
    if flow.status != "DRAFT" {
        return Ok(ActionResult::fail(format!(
            "Only DRAFT flows can be deleted. Current status: {}.",
            flow.status
        )));
    }
    let token = require_token(project)?;
    let target = meta_id_override.unwrap_or_else(|| flow.meta_id.clone());

    if let Err(e) = http.delete(&target, token).await {
        // Tolerate "not found" so local cleanup still proceeds.
        let msg = meta_http::message_for(&e);
        if !meta_http::is_not_found(&msg) {
            return Ok(ActionResult::fail(msg));
        }
    }

    mongo
        .collection::<Document>(FLOWS_COLL)
        .delete_one(doc! { "_id": flow.id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(ActionResult::just_msg(format!(
        "Flow \"{}\" deleted.",
        flow.name
    )))
}

// ---------------------------------------------------------------------
// preview
// ---------------------------------------------------------------------

pub async fn get_preview(
    mongo: &MongoHandle,
    http: &MetaHttp,
    project: &Project,
    flow_id_hex: &str,
    req: PreviewReq,
) -> Result<ActionResult<PreviewOut>> {
    let flow = load_flow(mongo, project, flow_id_hex).await?;
    let token = require_token(project)?;

    let invalidate = if req.invalidate.unwrap_or(false) {
        "true"
    } else {
        "false"
    };
    let mut params: Vec<(&str, String)> =
        vec![("fields", format!("preview.invalidate({invalidate})"))];
    if let Some(t) = req.flow_token.as_deref() {
        params.push(("flow_token", t.to_owned()));
    }
    if let Some(a) = req.flow_action.as_deref() {
        params.push(("flow_action", a.to_owned()));
    }
    if let Some(payload) = req.flow_action_payload.as_ref() {
        params.push(("flow_action_payload", payload.to_string()));
    }
    if let Some(p) = req.phone_number.as_deref() {
        params.push(("phone_number", p.to_owned()));
    }
    if let Some(b) = req.interactive {
        params.push(("interactive", b.to_string()));
    }

    let resp = match http.get_json::<Value>(&flow.meta_id, token, &params).await {
        Ok(v) => v,
        Err(e) => return Ok(fail_result::<PreviewOut>(&e)),
    };

    let preview = match resp.get("preview") {
        Some(p) if p.is_object() => p.clone(),
        _ => {
            return Ok(ActionResult::<PreviewOut> {
                success: false,
                error: Some("Meta returned no preview URL.".to_owned()),
                ..Default::default()
            });
        }
    };
    let preview_url = preview
        .get("preview_url")
        .and_then(|v| v.as_str())
        .map(|s| s.to_owned());
    let expires_at = preview
        .get("expires_at")
        .and_then(|v| v.as_str())
        .map(|s| s.to_owned())
        .unwrap_or_default();
    let preview_url = match preview_url {
        Some(u) => u,
        None => {
            return Ok(ActionResult::<PreviewOut> {
                success: false,
                error: Some("Meta returned no preview URL.".to_owned()),
                ..Default::default()
            });
        }
    };

    mongo
        .collection::<Document>(FLOWS_COLL)
        .update_one(
            doc! { "_id": flow.id },
            doc! {
                "$set": {
                    "preview": bson::to_bson(&preview).unwrap_or(bson::Bson::Null),
                    "updatedAt": bson::DateTime::from_chrono(Utc::now()),
                }
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(ActionResult::<PreviewOut> {
        success: true,
        message: Some("Preview ready.".to_owned()),
        data: Some(PreviewOut {
            preview_url,
            expires_at,
        }),
        ..Default::default()
    })
}

// ---------------------------------------------------------------------
// bulk sync
// ---------------------------------------------------------------------

pub async fn sync_from_meta(
    mongo: &MongoHandle,
    http: &MetaHttp,
    project: &Project,
) -> Result<ActionResult<SyncOutcome>> {
    let token = require_token(project)?;
    let waba = require_waba(project)?;

    #[derive(Deserialize)]
    struct ListResp {
        #[serde(default)]
        data: Vec<Value>,
        #[serde(default)]
        paging: Option<Paging>,
    }
    #[derive(Deserialize)]
    struct Paging {
        #[serde(default)]
        next: Option<String>,
    }

    let mut all: Vec<Value> = Vec::new();
    let initial_path = format!(
        "{waba}/flows?fields=id,name,status,categories,validation_errors,json_version,endpoint_uri&limit=100",
    );
    // First page: relative path through the helper (Bearer auth applied).
    let first: ListResp = match http.get_json(&initial_path, token, &[]).await {
        Ok(v) => v,
        Err(e) => return Ok(fail_result::<SyncOutcome>(&e)),
    };
    all.extend(first.data);
    let mut next = first.paging.and_then(|p| p.next);

    // Subsequent pages: opaque fully-qualified URL.
    while let Some(url) = next {
        let resp: ListResp = match http
            .get_url(&url, Some(token))
            .await
            .and_then(|v| serde_json::from_value(v).map_err(MetaHttpError::Decode))
        {
            Ok(v) => v,
            Err(e) => return Ok(fail_result::<SyncOutcome>(&e)),
        };
        all.extend(resp.data);
        next = resp.paging.and_then(|p| p.next);
    }

    if all.is_empty() {
        return Ok(ActionResult::ok_msg(
            SyncOutcome { count: 0 },
            "No flows on Meta yet.",
        ));
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<Document>(FLOWS_COLL);
    let mut upserted: u64 = 0;
    let mut modified: u64 = 0;
    for f in all {
        let id = match f.get("id").and_then(|v| v.as_str()) {
            Some(s) => s.to_owned(),
            None => continue,
        };
        let mut set = doc! { "updatedAt": now };
        if let Some(v) = f.get("name").and_then(|x| x.as_str()) {
            set.insert("name", v);
        }
        if let Some(v) = f.get("status").and_then(|x| x.as_str()) {
            set.insert("status", v);
        }
        if let Some(arr) = f.get("categories").and_then(|x| x.as_array()) {
            let cats: Vec<String> = arr
                .iter()
                .filter_map(|c| c.as_str().map(|s| s.to_owned()))
                .collect();
            set.insert("categories", cats);
        }
        if let Some(v) = f.get("json_version").and_then(|x| x.as_str()) {
            set.insert("jsonVersion", v);
        }
        if let Some(v) = f.get("endpoint_uri").and_then(|x| x.as_str()) {
            set.insert("endpointUri", v);
        }
        let ve = f.get("validation_errors").cloned().unwrap_or(json!([]));
        set.insert(
            "validationErrors",
            bson::to_bson(&ve).unwrap_or(bson::Bson::Array(vec![])),
        );

        let res = coll
            .update_one(
                doc! { "metaId": &id, "projectId": project.id },
                doc! {
                    "$set": set,
                    "$setOnInsert": {
                        "metaId": &id,
                        "projectId": project.id,
                        "createdAt": now,
                        "flowData": bson::doc! {},
                    },
                },
            )
            .with_options(
                mongodb::options::UpdateOptions::builder()
                    .upsert(true)
                    .build(),
            )
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
        if res.upserted_id.is_some() {
            upserted += 1;
        }
        modified += res.modified_count;
    }

    let count = (upserted + modified) as usize;
    Ok(ActionResult::ok_msg(
        SyncOutcome { count },
        format!("Synced {count} flow(s) from Meta."),
    ))
}

// ---------------------------------------------------------------------
// Mirror of `wachat-config::router::load_project_for` so callers in the
// router can resolve project context without depending on that crate.
// ---------------------------------------------------------------------

pub async fn load_project_for(
    user_tenant_id: &str,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Project> {
    let oid = ObjectId::parse_str(project_id_hex)
        .map_err(|_| ApiError::BadRequest(format!("invalid project id {project_id_hex}")))?;
    let coll = mongo.collection::<Project>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;
    if user_tenant_id != project.user_id.to_hex() {
        return Err(ApiError::Forbidden("not your project".to_owned()));
    }
    Ok(project)
}
