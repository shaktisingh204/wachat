//! Mongo + Meta-Graph store helpers for wachat-facebook-crm.
//!
//! Each public function corresponds 1:1 to one of the 12 ported actions
//! from `src/app/actions/facebook.actions.ts`. Side effects are limited to
//! the `facebook_subscribers` collection (read/write), the `projects`
//! collection (config read/write) and Meta page-scoped Graph API for label
//! CRUD + page block list mutations.

use bson::{Bson, Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde_json::{Value, json};
use wachat_meta_client::MetaClient;

const FACEBOOK_SUBSCRIBERS_COLL: &str = "facebook_subscribers";
const PROJECTS_COLL: &str = "projects";

const DEFAULT_KANBAN_STATUSES: [&str; 3] = ["new", "open", "resolved"];

/// Inlined twin of `wachat-config::router::load_project_for` — fetches a
/// project document with a tenant check.
///
/// Returns the raw Mongo document (rather than `wachat_types::Project`)
/// because the CRM slice needs facebook-specific fields (`facebookPageId`,
/// `facebookKanbanStatuses`, `accessToken`) that aren't modeled in the
/// strongly-typed struct.
pub async fn load_project_for(
    user_tenant_id: &str,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Document> {
    let oid = ObjectId::parse_str(project_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid project id.".to_owned()))?;
    let user_oid = ObjectId::parse_str(user_tenant_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))?;

    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;

    // Owner OR agent — match the legacy `getProjectById` access check.
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
        return Err(ApiError::Forbidden("Access denied".to_owned()));
    }
    Ok(project)
}

fn project_id_of(project: &Document) -> Result<ObjectId> {
    project
        .get_object_id("_id")
        .map(|o| o.to_owned())
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project document missing _id")))
}

fn project_str(project: &Document, key: &str) -> Option<String> {
    project.get_str(key).ok().map(|s| s.to_owned())
}

/// `getFacebookSubscribers(projectId)` — list page subscribers stored in
/// the `facebook_subscribers` collection. Sorted by `createdAt` desc to
/// match the TS.
pub async fn list_subscribers(mongo: &MongoHandle, project: &Document) -> Result<Vec<Value>> {
    if project_str(project, "facebookPageId").is_none()
        || project_str(project, "accessToken").is_none()
    {
        return Err(ApiError::BadRequest(
            "Project not found or is not configured for Facebook.".to_owned(),
        ));
    }
    let project_id = project_id_of(project)?;
    let coll = mongo.collection::<Document>(FACEBOOK_SUBSCRIBERS_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project_id })
        .sort(doc! { "createdAt": -1 })
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

/// `getFacebookKanbanData(projectId)` — full kanban view: every default
/// + custom status, with the matching subscriber documents grouped under
/// each column (status defaults to `"new"` when absent).
///
/// Sorted by `updated_time` desc to match the TS.
pub async fn get_kanban_data(
    mongo: &MongoHandle,
    project: &Document,
) -> Result<crate::dto::KanbanResult> {
    let project_id = project_id_of(project)?;
    let coll = mongo.collection::<Document>(FACEBOOK_SUBSCRIBERS_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project_id })
        .sort(doc! { "updated_time": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let mut subs: Vec<Document> = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        subs.push(d);
    }

    // Build the ordered status list: defaults first, then any custom
    // statuses on the project, deduped while preserving order.
    let mut all_statuses: Vec<String> = DEFAULT_KANBAN_STATUSES
        .iter()
        .map(|s| (*s).to_owned())
        .collect();
    if let Ok(arr) = project.get_array("facebookKanbanStatuses") {
        for v in arr {
            if let Some(s) = v.as_str() {
                if !all_statuses.iter().any(|x| x == s) {
                    all_statuses.push(s.to_owned());
                }
            }
        }
    }

    let columns = all_statuses
        .into_iter()
        .map(|name| {
            let convs: Vec<Value> = subs
                .iter()
                .filter(|c| {
                    let status = c.get_str("status").unwrap_or("new");
                    status == name
                })
                .cloned()
                .map(document_to_clean_json)
                .collect();
            crate::dto::KanbanColumn {
                name,
                conversations: convs,
            }
        })
        .collect();

    Ok(crate::dto::KanbanResult {
        project: Some(document_to_clean_json(project.clone())),
        columns,
    })
}

/// `handleUpdateFacebookSubscriberStatus(subscriberId, status)` — flips a
/// subscriber's `status` field. Performs an explicit access check via the
/// subscriber's `projectId` so callers can't poke another tenant's row.
pub async fn update_subscriber_status(
    mongo: &MongoHandle,
    user_tenant_id: &str,
    subscriber_id_hex: &str,
    status: &str,
) -> Result<crate::dto::SuccessResult> {
    let oid = match ObjectId::parse_str(subscriber_id_hex) {
        Ok(o) => o,
        Err(_) => {
            return Ok(crate::dto::SuccessResult {
                success: false,
                error: Some("Invalid subscriber ID.".to_owned()),
            });
        }
    };
    let coll = mongo.collection::<Document>(FACEBOOK_SUBSCRIBERS_COLL);
    let subscriber = match coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        Some(s) => s,
        None => {
            return Ok(crate::dto::SuccessResult {
                success: false,
                error: Some("Subscriber not found.".to_owned()),
            });
        }
    };
    let proj_oid = match subscriber.get_object_id("projectId") {
        Ok(o) => o,
        Err(_) => {
            return Ok(crate::dto::SuccessResult {
                success: false,
                error: Some("Subscriber has no project.".to_owned()),
            });
        }
    };
    if load_project_for(user_tenant_id, mongo, &proj_oid.to_hex())
        .await
        .is_err()
    {
        return Ok(crate::dto::SuccessResult {
            success: false,
            error: Some("Access denied".to_owned()),
        });
    }

    if let Err(_e) = coll
        .update_one(doc! { "_id": oid }, doc! { "$set": { "status": status } })
        .await
    {
        return Ok(crate::dto::SuccessResult {
            success: false,
            error: Some("Failed to update conversation status.".to_owned()),
        });
    }
    Ok(crate::dto::SuccessResult {
        success: true,
        error: None,
    })
}

/// `saveFacebookKanbanStatuses(projectId, statuses)` — persists the
/// project-level `facebookKanbanStatuses` array, filtering out the
/// always-present default columns so they don't get duplicated on disk.
pub async fn save_kanban_statuses(
    mongo: &MongoHandle,
    project: &Document,
    statuses: Vec<String>,
) -> Result<crate::dto::SuccessResult> {
    let project_id = project_id_of(project)?;
    let custom: Vec<String> = statuses
        .into_iter()
        .filter(|s| !DEFAULT_KANBAN_STATUSES.iter().any(|d| *d == s.as_str()))
        .collect();

    let bson_arr: Vec<Bson> = custom.iter().map(|s| Bson::String(s.clone())).collect();
    if let Err(_e) = mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(
            doc! { "_id": project_id },
            doc! { "$set": { "facebookKanbanStatuses": bson_arr } },
        )
        .await
    {
        return Ok(crate::dto::SuccessResult {
            success: false,
            error: Some("Failed to save Kanban lists.".to_owned()),
        });
    }
    Ok(crate::dto::SuccessResult {
        success: true,
        error: None,
    })
}

// ---------------------------------------------------------------------
// Meta Graph API — custom labels (page-scoped) + block list
// ---------------------------------------------------------------------

fn require_token<'a>(project: &'a Document) -> Result<&'a str> {
    project
        .get_str("accessToken")
        .map_err(|_| ApiError::BadRequest("Project missing access token.".to_owned()))
}

fn require_page_id<'a>(project: &'a Document) -> Result<&'a str> {
    project
        .get_str("facebookPageId")
        .map_err(|_| ApiError::BadRequest("Project missing facebookPageId.".to_owned()))
}

/// `getCustomLabels(projectId)` — list the Meta page's custom labels.
pub async fn list_custom_labels(meta: &MetaClient, project: &Document) -> Result<Vec<Value>> {
    let token = require_token(project)?;
    let page_id = require_page_id(project)?;
    let path = format!("{page_id}/custom_labels?fields=name&limit=100");
    let resp: Value = meta.get_json(&path, token).await?;
    Ok(resp
        .get("data")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default())
}

/// `createCustomLabel(projectId, name)` — POST a new label and return its id.
pub async fn create_custom_label(
    meta: &MetaClient,
    project: &Document,
    name: &str,
) -> Result<crate::dto::CreateLabelResult> {
    let token = require_token(project)?;
    let page_id = require_page_id(project)?;
    let path = format!("{page_id}/custom_labels");
    let body = json!({ "name": name });
    match meta.post_json::<_, Value>(&path, token, &body).await {
        Ok(resp) => {
            let id = resp
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_owned());
            Ok(crate::dto::CreateLabelResult {
                label_id: id,
                error: None,
            })
        }
        Err(e) => Ok(crate::dto::CreateLabelResult {
            label_id: None,
            error: Some(e.to_string()),
        }),
    }
}

/// `deleteCustomLabel(labelId, projectId)` — DELETE the label node.
pub async fn delete_custom_label(
    meta: &MetaClient,
    project: &Document,
    label_id: &str,
) -> Result<crate::dto::SuccessResult> {
    let token = require_token(project)?;
    match meta.delete(label_id, token).await {
        Ok(_) => Ok(crate::dto::SuccessResult {
            success: true,
            error: None,
        }),
        Err(e) => Ok(crate::dto::SuccessResult {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

/// `assignLabelToUser(labelId, psid, projectId)` — POST `{ user: psid }` to
/// `/{labelId}/label`.
pub async fn assign_label_to_user(
    meta: &MetaClient,
    project: &Document,
    label_id: &str,
    psid: &str,
) -> Result<crate::dto::SuccessResult> {
    let token = require_token(project)?;
    let path = format!("{label_id}/label");
    let body = json!({ "user": psid });
    match meta.post_json::<_, Value>(&path, token, &body).await {
        Ok(_) => Ok(crate::dto::SuccessResult {
            success: true,
            error: None,
        }),
        Err(e) => Ok(crate::dto::SuccessResult {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

/// `removeLabelFromUser(labelId, psid, projectId)` — DELETE the label
/// assignment.
///
/// The legacy TS sent `{ user: psid }` in the body; `MetaClient::delete`
/// doesn't expose a body parameter, so we route through the
/// `?user=<psid>` query-string form which the Graph API accepts.
pub async fn remove_label_from_user(
    meta: &MetaClient,
    project: &Document,
    label_id: &str,
    psid: &str,
) -> Result<crate::dto::SuccessResult> {
    let token = require_token(project)?;
    let path = format!("{label_id}/label?user={}", urlencode(psid));
    match meta.delete(&path, token).await {
        Ok(_) => Ok(crate::dto::SuccessResult {
            success: true,
            error: None,
        }),
        Err(e) => Ok(crate::dto::SuccessResult {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

/// `getLabelsForUser(psid, projectId)` — labels currently assigned to a
/// PSID.
pub async fn get_labels_for_user(
    meta: &MetaClient,
    project: &Document,
    psid: &str,
) -> Result<Vec<Value>> {
    let token = require_token(project)?;
    let path = format!("{psid}/custom_labels?fields=name");
    let resp: Value = meta.get_json(&path, token).await?;
    Ok(resp
        .get("data")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default())
}

/// `blockProfile(profileId, projectId)` — page-scoped block list add.
pub async fn block_profile(
    meta: &MetaClient,
    project: &Document,
    profile_id: &str,
) -> Result<crate::dto::SuccessResult> {
    let token = require_token(project)?;
    let page_id = require_page_id(project)?;
    let path = format!("{page_id}/blocked");
    let body = json!({ "user": profile_id });
    match meta.post_json::<_, Value>(&path, token, &body).await {
        Ok(_) => Ok(crate::dto::SuccessResult {
            success: true,
            error: None,
        }),
        Err(e) => Ok(crate::dto::SuccessResult {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

/// `unblockProfile(profileId, projectId)` — page-scoped block list remove.
/// Same query-string workaround as `remove_label_from_user`.
pub async fn unblock_profile(
    meta: &MetaClient,
    project: &Document,
    profile_id: &str,
) -> Result<crate::dto::SuccessResult> {
    let token = require_token(project)?;
    let page_id = require_page_id(project)?;
    let path = format!("{page_id}/blocked?user={}", urlencode(profile_id));
    match meta.delete(&path, token).await {
        Ok(_) => Ok(crate::dto::SuccessResult {
            success: true,
            error: None,
        }),
        Err(e) => Ok(crate::dto::SuccessResult {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

/// Minimal percent-encoder for the small set of characters that show up
/// in PSIDs / profile ids (digits + hyphen). Falls through to a generic
/// unreserved/encoded form when other characters appear so we don't ship
/// raw `?user=` payloads with embedded `&` or spaces.
fn urlencode(input: &str) -> String {
    const HEX: &[u8] = b"0123456789ABCDEF";
    let mut out = String::with_capacity(input.len());
    for &b in input.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push('%');
                out.push(HEX[(b >> 4) as usize] as char);
                out.push(HEX[(b & 0xf) as usize] as char);
            }
        }
    }
    out
}
