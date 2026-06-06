//! Mongo store for the `flows` collection.
//!
//! Each helper here corresponds 1:1 to an `export async function` in
//! `src/app/actions/flow.actions.ts`. The TS file is the source of truth —
//! when in doubt, match its query and return shapes exactly.
//!
//! Notes:
//! - `revalidatePath` is intentionally NOT performed here; it's a Next.js
//!   server-action concern. The TS shim that wraps these endpoints calls
//!   `revalidatePath` itself after the network round-trip.
//! - Project access (owner-or-agent) lives in [`load_project_for`]. We do
//!   the check here rather than in a shared crate because `wachat-config`'s
//!   `load_project_for` is owner-only and the TS `getProjectById` allows
//!   agents through.

use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::stream::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;

use crate::cycle::detect_cycle;
use crate::dto::{
    AckResult, BulkDeleteResult, BulkStatusResult, CloneFlowResult, SaveFlowReq, SaveFlowResult,
};

const FLOWS_COLL: &str = "flows";
const PROJECTS_COLL: &str = "projects";
const CONTACTS_COLL: &str = "contacts";

/// Load a project document and verify the caller is owner-or-agent.
///
/// Returns the **raw `Document`** (rather than the typed `wachat_types::Project`)
/// so we can inspect the dynamic `agents` array without coupling this crate to
/// a richer schema. `agents[].userId` is the field the TS `getProjectById`
/// matches against.
pub async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Document> {
    let oid = ObjectId::parse_str(project_id_hex)
        .map_err(|_| ApiError::BadRequest("invalid project id".to_owned()))?;
    let user_oid = ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))?;

    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;

    let is_owner = project
        .get_object_id("userId")
        .map(|o| o == user_oid)
        .unwrap_or(false);
    let is_agent = project
        .get_array("agents")
        .ok()
        .map(|agents| {
            agents.iter().any(|a| {
                a.as_document()
                    .and_then(|d| d.get_object_id("userId").ok())
                    .map(|o| o == user_oid)
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false);

    if !is_owner && !is_agent {
        // Match the TS shape: `getProjectById` returns null on access deny,
        // and the callers translate that to `Access denied`. Surface it here
        // as `NotFound` so we don't leak project existence to non-members.
        return Err(ApiError::NotFound(format!("project {project_id_hex}")));
    }

    Ok(project)
}

/// `getFlowsForProject(projectId)` — list summaries for the project.
///
/// Mirrors the TS projection `{ _id, name, triggerKeywords, updatedAt,
/// status }` (the `_id` is implicit in Mongo's projection rules) and the
/// `{ updatedAt: -1 }` sort.
///
/// Caller must already have run [`load_project_for`] for access.
pub async fn list_flows_for_project(
    mongo: &MongoHandle,
    project_id: ObjectId,
) -> Result<Vec<Value>> {
    let coll = mongo.collection::<Document>(FLOWS_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project_id })
        .projection(doc! {
            "name": 1,
            "triggerKeywords": 1,
            "updatedAt": 1,
            "status": 1,
        })
        .sort(doc! { "updatedAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let mut out: Vec<Value> = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        out.push(document_to_clean_json(d));
    }
    Ok(out)
}

/// `getFlowById(flowId)` — load the full flow document, then enforce
/// project access via the project the flow belongs to.
///
/// Returns `Ok(None)` for invalid id / missing flow / access denied to
/// match the TS nullable return.
pub async fn get_flow_by_id(
    user: &AuthUser,
    mongo: &MongoHandle,
    flow_id_hex: &str,
) -> Result<Option<Value>> {
    let oid = match ObjectId::parse_str(flow_id_hex) {
        Ok(o) => o,
        Err(_) => return Ok(None),
    };
    let coll = mongo.collection::<Document>(FLOWS_COLL);
    let flow = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let Some(flow) = flow else {
        return Ok(None);
    };

    let project_id = flow.get_object_id("projectId").ok();
    let Some(project_id) = project_id else {
        return Ok(None);
    };

    // Access guard via the project the flow belongs to. Treat any access
    // failure (forbidden / not found) as a `null` return — matches the TS
    // contract.
    match load_project_for(user, mongo, &project_id.to_hex()).await {
        Ok(_) => Ok(Some(document_to_clean_json(flow))),
        Err(ApiError::NotFound(_)) | Err(ApiError::Forbidden(_)) => Ok(None),
        Err(e) => Err(e),
    }
}

/// `saveFlow(...)` — upsert. Validates the graph for cycles BEFORE writing.
///
/// Caller has already proved project access via [`load_project_for`] in the
/// router. We re-resolve the project oid from the `req.project_id` for the
/// write, but trust the router's tenant check.
pub async fn save_flow(
    mongo: &MongoHandle,
    project_id: ObjectId,
    req: SaveFlowReq,
) -> Result<SaveFlowResult> {
    if req.name.trim().is_empty() {
        return Ok(SaveFlowResult {
            error: Some("Project ID and Flow Name are required.".to_owned()),
            ..Default::default()
        });
    }

    // Cycle detection — port of the TS pre-write check. Returning the
    // result envelope keeps the wire shape identical to legacy.
    if detect_cycle(&req.nodes, &req.edges).has_cycle {
        return Ok(SaveFlowResult {
            error: Some("Infinite loop detected in flow. Please remove the cycle.".to_owned()),
            ..Default::default()
        });
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<Document>(FLOWS_COLL);

    let nodes_bson =
        bson::to_bson(&req.nodes).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let edges_bson =
        bson::to_bson(&req.edges).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let status = req
        .status
        .as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("ACTIVE")
        .to_owned();

    let base_set = doc! {
        "name": &req.name,
        "projectId": project_id,
        "nodes": nodes_bson,
        "edges": edges_bson,
        "triggerKeywords": &req.trigger_keywords,
        "status": status,
        "updatedAt": now,
    };

    match req.flow_id.as_deref() {
        // ----- Insert path. -----
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
        // ----- Update path. -----
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
            // Filter scopes the update to (flow_id, project_id) — matches
            // the TS so a stale `flowId` against a different project can't
            // overwrite that project's row.
            coll.update_one(
                doc! { "_id": oid, "projectId": project_id },
                doc! { "$set": base_set },
            )
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

/// `deleteFlow(flowId)` — delete + cleanup. Performs the project access
/// check via the project the flow belongs to BEFORE deleting, then unsets
/// `activeFlow` on every contact pointing at this flow id (matches TS).
pub async fn delete_flow(
    user: &AuthUser,
    mongo: &MongoHandle,
    flow_id_hex: &str,
) -> Result<AckResult> {
    let oid = match ObjectId::parse_str(flow_id_hex) {
        Ok(o) => o,
        Err(_) => {
            return Ok(AckResult {
                error: Some("Invalid Flow ID.".to_owned()),
                ..Default::default()
            });
        }
    };

    let flows = mongo.collection::<Document>(FLOWS_COLL);
    let flow = flows
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let Some(flow) = flow else {
        return Ok(AckResult {
            error: Some("Flow not found.".to_owned()),
            ..Default::default()
        });
    };

    let project_id = match flow.get_object_id("projectId") {
        Ok(p) => p,
        Err(_) => {
            return Ok(AckResult {
                error: Some("Flow not found.".to_owned()),
                ..Default::default()
            });
        }
    };

    // Owner-or-agent access check via the owning project.
    match load_project_for(user, mongo, &project_id.to_hex()).await {
        Ok(_) => {}
        Err(ApiError::NotFound(_)) | Err(ApiError::Forbidden(_)) => {
            return Ok(AckResult {
                error: Some("Access denied".to_owned()),
                ..Default::default()
            });
        }
        Err(e) => return Err(e),
    }

    // Cleanup active executions on contacts. TS stores `activeFlow.flowId`
    // as a string (the hex), not an ObjectId, so we match on the hex form.
    let contacts = mongo.collection::<Document>(CONTACTS_COLL);
    contacts
        .update_many(
            doc! { "activeFlow.flowId": flow_id_hex },
            doc! { "$unset": { "activeFlow": "" } },
        )
        .await
        .map_err(|_e| ApiError::Internal(anyhow::anyhow!("Failed to delete flow.")))?;

    flows
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|_e| ApiError::Internal(anyhow::anyhow!("Failed to delete flow.")))?;

    Ok(AckResult {
        message: Some("Flow deleted.".to_owned()),
        ..Default::default()
    })
}

/// Resolve the `_id` of the first flow in a summary list (used by the
/// `builder-data` composer to decide which flow to load full).
pub fn first_flow_id(summaries: &[Value]) -> Option<String> {
    summaries
        .first()
        .and_then(|v| v.get("_id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_owned())
}

/// `cloneFlow(flowId)` — deep-copy an existing flow document.
///
/// Loads the source flow, enforces owner-or-agent access via its owning
/// project, then inserts a brand-new row with a fresh `_id`, the duplicated
/// `nodes`/`edges`/`triggerKeywords`, `name` suffixed with ` (Copy)`, and
/// `status = "PAUSED"`. Returns the new flow's hex id.
///
/// Mirrors the legacy `cloneFlow` server action but as a single Mongo-only
/// round-trip (no get-then-save N+1 across the network).
pub async fn clone_flow(
    user: &AuthUser,
    mongo: &MongoHandle,
    flow_id_hex: &str,
) -> Result<CloneFlowResult> {
    let oid = match ObjectId::parse_str(flow_id_hex) {
        Ok(o) => o,
        Err(_) => {
            return Ok(CloneFlowResult {
                error: Some("Invalid Flow ID.".to_owned()),
                ..Default::default()
            });
        }
    };

    let flows = mongo.collection::<Document>(FLOWS_COLL);
    let source = flows
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let Some(source) = source else {
        return Ok(CloneFlowResult {
            error: Some("Source flow not found.".to_owned()),
            ..Default::default()
        });
    };

    let project_id = match source.get_object_id("projectId") {
        Ok(p) => p,
        Err(_) => {
            return Ok(CloneFlowResult {
                error: Some("Source flow not found.".to_owned()),
                ..Default::default()
            });
        }
    };

    // Owner-or-agent access check via the owning project.
    match load_project_for(user, mongo, &project_id.to_hex()).await {
        Ok(_) => {}
        Err(ApiError::NotFound(_)) | Err(ApiError::Forbidden(_)) => {
            return Ok(CloneFlowResult {
                error: Some("Access denied".to_owned()),
                ..Default::default()
            });
        }
        Err(e) => return Err(e),
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    let new_id = ObjectId::new();

    // Duplicate the graph payload verbatim. `name` gets the legacy ` (Copy)`
    // suffix and the clone always starts `PAUSED` so it doesn't fire until the
    // operator reviews it.
    let source_name = source.get_str("name").unwrap_or("Untitled Flow");
    let nodes = source.get("nodes").cloned().unwrap_or(bson::Bson::Array(Vec::new()));
    let edges = source.get("edges").cloned().unwrap_or(bson::Bson::Array(Vec::new()));
    let trigger_keywords = source
        .get("triggerKeywords")
        .cloned()
        .unwrap_or(bson::Bson::Array(Vec::new()));

    let copy = doc! {
        "_id": new_id,
        "name": format!("{source_name} (Copy)"),
        "projectId": project_id,
        "nodes": nodes,
        "edges": edges,
        "triggerKeywords": trigger_keywords,
        "status": "PAUSED",
        "createdAt": now,
        "updatedAt": now,
    };

    flows
        .insert_one(copy)
        .await
        .map_err(|_e| ApiError::Internal(anyhow::anyhow!("Failed to clone flow.")))?;

    Ok(CloneFlowResult {
        flow_id: Some(new_id.to_hex()),
        message: Some("Flow duplicated successfully.".to_owned()),
        ..Default::default()
    })
}

/// Resolve the subset of `flow_id_hex` values the caller may act on.
///
/// Parses each hex id, loads the matching flow rows in one query, then keeps
/// only the ids whose owning project passes the owner-or-agent guard. Project
/// access decisions are memoised so a bulk op over many flows in the same
/// project costs one project read, not one per flow. Inaccessible / missing /
/// malformed ids are silently dropped — bulk ops are best-effort over the
/// caller's own rows (a stale id from another tenant simply doesn't count).
async fn accessible_flow_oids(
    user: &AuthUser,
    mongo: &MongoHandle,
    flow_id_hexes: &[String],
) -> Result<Vec<ObjectId>> {
    let oids: Vec<ObjectId> = flow_id_hexes
        .iter()
        .filter_map(|h| ObjectId::parse_str(h).ok())
        .collect();
    if oids.is_empty() {
        return Ok(Vec::new());
    }

    let flows = mongo.collection::<Document>(FLOWS_COLL);
    let mut cursor = flows
        .find(doc! { "_id": { "$in": &oids } })
        .projection(doc! { "_id": 1, "projectId": 1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    // project oid -> whether the caller may touch its flows.
    let mut access: std::collections::HashMap<ObjectId, bool> = std::collections::HashMap::new();
    let mut allowed: Vec<ObjectId> = Vec::new();

    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        let (Ok(id), Ok(pid)) = (d.get_object_id("_id"), d.get_object_id("projectId")) else {
            continue;
        };
        let ok = match access.get(&pid) {
            Some(&v) => v,
            None => {
                let v = match load_project_for(user, mongo, &pid.to_hex()).await {
                    Ok(_) => true,
                    Err(ApiError::NotFound(_)) | Err(ApiError::Forbidden(_)) => false,
                    Err(e) => return Err(e),
                };
                access.insert(pid, v);
                v
            }
        };
        if ok {
            allowed.push(id);
        }
    }

    Ok(allowed)
}

/// `bulkDeleteFlows(flowIds)` — delete every accessible flow in `flow_ids`,
/// scoped to the caller, in one `delete_many`. Also unsets
/// `contacts.activeFlow` for any contact actively running one of the deleted
/// flows. Returns the count actually removed.
pub async fn bulk_delete_flows(
    user: &AuthUser,
    mongo: &MongoHandle,
    flow_id_hexes: &[String],
) -> Result<BulkDeleteResult> {
    let allowed = accessible_flow_oids(user, mongo, flow_id_hexes).await?;
    if allowed.is_empty() {
        return Ok(BulkDeleteResult { deleted: 0 });
    }

    // Cleanup active executions on contacts first. TS stores
    // `activeFlow.flowId` as the hex string (not an ObjectId).
    let allowed_hexes: Vec<String> = allowed.iter().map(|o| o.to_hex()).collect();
    let contacts = mongo.collection::<Document>(CONTACTS_COLL);
    contacts
        .update_many(
            doc! { "activeFlow.flowId": { "$in": &allowed_hexes } },
            doc! { "$unset": { "activeFlow": "" } },
        )
        .await
        .map_err(|_e| ApiError::Internal(anyhow::anyhow!("Failed to delete flows.")))?;

    let flows = mongo.collection::<Document>(FLOWS_COLL);
    let res = flows
        .delete_many(doc! { "_id": { "$in": &allowed } })
        .await
        .map_err(|_e| ApiError::Internal(anyhow::anyhow!("Failed to delete flows.")))?;

    Ok(BulkDeleteResult {
        deleted: res.deleted_count,
    })
}

/// `bulkUpdateFlowStatus(flowIds, status)` — set `status` on every accessible
/// flow in `flow_ids`, scoped to the caller, in one `update_many`. Returns the
/// count actually modified.
pub async fn bulk_status_flows(
    user: &AuthUser,
    mongo: &MongoHandle,
    flow_id_hexes: &[String],
    status: &str,
) -> Result<BulkStatusResult> {
    let allowed = accessible_flow_oids(user, mongo, flow_id_hexes).await?;
    if allowed.is_empty() {
        return Ok(BulkStatusResult { modified: 0 });
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    let flows = mongo.collection::<Document>(FLOWS_COLL);
    let res = flows
        .update_many(
            doc! { "_id": { "$in": &allowed } },
            doc! { "$set": { "status": status, "updatedAt": now } },
        )
        .await
        .map_err(|_e| ApiError::Internal(anyhow::anyhow!("Failed to update flows.")))?;

    Ok(BulkStatusResult {
        modified: res.modified_count,
    })
}
