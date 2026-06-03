//! Mongo store for the `facebook_flows` collection.
//!
//! Each public function corresponds 1:1 to an `export async function` in
//! `src/app/actions/facebook-flow.actions.ts`. Side effects are limited to
//! the `facebook_flows` collection (insert / update / delete / find). No
//! external HTTP — Facebook Messenger flow-builder data is stored
//! locally; flows are dispatched at runtime by the bot router, not here.
//!
//! `revalidatePath` is intentionally NOT performed here — that's a Next.js
//! server-action concern. The TS shim that wraps these endpoints calls
//! `revalidatePath` itself after the network round-trip.

use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use futures::stream::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use wachat_types::Project;

use crate::dto::{
    FacebookFlowDoc, FacebookFlowRecord, FacebookFlowSummary, SaveFlowReq, SaveFlowResult,
};

const FLOWS_COLL: &str = "facebook_flows";
const PROJECTS_COLL: &str = "projects";

fn bson_dt_to_iso(dt: bson::DateTime) -> String {
    let chrono_dt: DateTime<Utc> = dt.into();
    chrono_dt.to_rfc3339()
}

fn parse_oid(hex: &str, label: &str) -> Result<ObjectId> {
    ObjectId::parse_str(hex).map_err(|_| ApiError::BadRequest(format!("Invalid {label}.")))
}

/// `getFacebookFlows(projectId)` — pure local read. Sorted by `updatedAt`
/// desc to match the TS. Mirrors the projection `{ name, triggerKeywords,
/// updatedAt }`.
pub async fn list_flows(
    mongo: &MongoHandle,
    project: &Project,
) -> Result<Vec<FacebookFlowSummary>> {
    let coll = mongo.collection::<Document>(FLOWS_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project.id })
        .projection(doc! { "name": 1, "triggerKeywords": 1, "updatedAt": 1 })
        .sort(doc! { "updatedAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let mut out: Vec<FacebookFlowSummary> = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        let id = match d.get_object_id("_id") {
            Ok(o) => o.to_hex(),
            Err(_) => continue,
        };
        let name = d.get_str("name").map(|s| s.to_owned()).unwrap_or_default();
        let trigger_keywords: Vec<String> = d
            .get_array("triggerKeywords")
            .map(|arr| {
                arr.iter()
                    .filter_map(|b| b.as_str().map(|s| s.to_owned()))
                    .collect()
            })
            .unwrap_or_default();
        let updated_at = d
            .get_datetime("updatedAt")
            .map(|dt| bson_dt_to_iso(*dt))
            .unwrap_or_default();
        out.push(FacebookFlowSummary {
            _id: id,
            name,
            trigger_keywords,
            updated_at,
        });
    }
    Ok(out)
}

/// `getFacebookFlowById(flowId)` — full document read. The owner project
/// is resolved via [`load_flow_with_project`] before the body is returned,
/// matching the TS access-check order.
pub async fn get_flow(
    mongo: &MongoHandle,
    user_tenant_id: &str,
    flow_id_hex: &str,
) -> Result<Option<FacebookFlowRecord>> {
    if ObjectId::parse_str(flow_id_hex).is_err() {
        return Ok(None);
    }
    match load_flow_with_project(mongo, user_tenant_id, flow_id_hex).await {
        Ok((flow, _project)) => Ok(Some(to_record(flow))),
        Err(ApiError::NotFound(_)) => Ok(None),
        Err(ApiError::Forbidden(_)) => Ok(None),
        Err(e) => Err(e),
    }
}

/// Resolve a flow + its owning project, with tenant check. Mirrors the
/// shape of `meta-flows::store::load_flow_with_project`.
pub async fn load_flow_with_project(
    mongo: &MongoHandle,
    user_tenant_id: &str,
    flow_id_hex: &str,
) -> Result<(FacebookFlowDoc, Project)> {
    let oid = parse_oid(flow_id_hex, "Flow ID")?;
    let flow = mongo
        .collection::<FacebookFlowDoc>(FLOWS_COLL)
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
        return Err(ApiError::Forbidden("Access denied".to_owned()));
    }
    Ok((flow, project))
}

/// `saveFacebookFlow` — upsert. When `flow_id` is omitted, inserts a new
/// row; otherwise updates the existing row in place. Caller has already
/// proved project ownership in the router via `load_project_for`.
pub async fn save_flow(
    mongo: &MongoHandle,
    project: &Project,
    req: SaveFlowReq,
) -> Result<SaveFlowResult> {
    if req.name.trim().is_empty() {
        return Ok(SaveFlowResult {
            error: Some("Project ID and Flow Name are required.".to_owned()),
            ..Default::default()
        });
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<Document>(FLOWS_COLL);

    let nodes_bson =
        bson::to_bson(&req.nodes).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let edges_bson =
        bson::to_bson(&req.edges).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let base_set = doc! {
        "name": &req.name,
        "projectId": project.id,
        "nodes": nodes_bson,
        "edges": edges_bson,
        "triggerKeywords": &req.trigger_keywords,
        "updatedAt": now,
    };

    match req.flow_id.as_deref() {
        // Insert path.
        None | Some("") => {
            let new_id = ObjectId::new();
            let mut insert = base_set.clone();
            insert.insert("_id", new_id);
            insert.insert("createdAt", now);
            coll.insert_one(insert)
                .await
                .map_err(|_e| ApiError::Internal(anyhow::anyhow!("Failed to save flow.")))?;
            Ok(SaveFlowResult {
                message: Some("Flow created successfully.".to_owned()),
                flow_id: Some(new_id.to_hex()),
                ..Default::default()
            })
        }
        // Update path.
        Some(hex) => {
            let oid = match ObjectId::parse_str(hex) {
                Ok(o) => o,
                Err(_) => {
                    return Ok(SaveFlowResult {
                        error: Some("Invalid Flow ID.".to_owned()),
                        ..Default::default()
                    });
                }
            };
            // Verify the flow belongs to the same project — defence in depth
            // (router already checked the project, but we don't want a
            // mismatched flowId to silently overwrite another tenant's row).
            let existing = coll
                .find_one(doc! { "_id": oid })
                .await
                .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
            if let Some(existing) = existing {
                let pid = existing.get_object_id("projectId").ok();
                if pid != Some(project.id) {
                    return Ok(SaveFlowResult {
                        error: Some("Access denied".to_owned()),
                        ..Default::default()
                    });
                }
            }

            coll.update_one(doc! { "_id": oid }, doc! { "$set": base_set })
                .await
                .map_err(|_e| ApiError::Internal(anyhow::anyhow!("Failed to save flow.")))?;
            Ok(SaveFlowResult {
                message: Some("Flow updated successfully.".to_owned()),
                flow_id: Some(oid.to_hex()),
                ..Default::default()
            })
        }
    }
}

/// `deleteFlow(flowId)` — hard delete. Tenant + project check happens
/// before the delete.
pub async fn delete_flow(
    mongo: &MongoHandle,
    user_tenant_id: &str,
    flow_id_hex: &str,
) -> Result<crate::dto::AckResult> {
    if ObjectId::parse_str(flow_id_hex).is_err() {
        return Ok(crate::dto::AckResult {
            error: Some("Invalid Flow ID.".to_owned()),
            ..Default::default()
        });
    }
    let (flow, _project) = match load_flow_with_project(mongo, user_tenant_id, flow_id_hex).await {
        Ok(t) => t,
        Err(ApiError::NotFound(_)) => {
            return Ok(crate::dto::AckResult {
                error: Some("Flow not found.".to_owned()),
                ..Default::default()
            });
        }
        Err(ApiError::Forbidden(_)) => {
            return Ok(crate::dto::AckResult {
                error: Some("Access denied".to_owned()),
                ..Default::default()
            });
        }
        Err(e) => return Err(e),
    };

    let id = flow.id.unwrap_or_else(ObjectId::new);
    mongo
        .collection::<Document>(FLOWS_COLL)
        .delete_one(doc! { "_id": id })
        .await
        .map_err(|_e| ApiError::Internal(anyhow::anyhow!("Failed to delete flow.")))?;

    Ok(crate::dto::AckResult {
        message: Some("Flow deleted.".to_owned()),
        ..Default::default()
    })
}

fn to_record(flow: FacebookFlowDoc) -> FacebookFlowRecord {
    FacebookFlowRecord {
        _id: flow.id.map(|o| o.to_hex()).unwrap_or_default(),
        name: flow.name,
        project_id: flow.project_id.to_hex(),
        nodes: flow.nodes,
        edges: flow.edges,
        trigger_keywords: flow.trigger_keywords,
        created_at: flow.created_at.map(bson_dt_to_iso),
        updated_at: bson_dt_to_iso(flow.updated_at),
    }
}

/// Mirror of `wachat-config::router::load_project_for` so the router can
/// resolve project context without depending on that crate.
pub async fn load_project_for(
    user_tenant_id: &str,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Project> {
    let oid = parse_oid(project_id_hex, "Project ID")?;
    let coll = mongo.collection::<Project>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;
    if user_tenant_id != project.user_id.to_hex() {
        return Err(ApiError::Forbidden("Access denied".to_owned()));
    }
    Ok(project)
}
