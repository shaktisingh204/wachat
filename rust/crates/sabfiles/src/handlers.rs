//! HTTP handlers for the SabFiles domain.
//!
//! All authenticated routes scope by the caller's `userId`. The
//! `parentId` field links nodes into a tree; `parentId = null` is the
//! user's root folder. Folders never carry `r2Key`/`size`/`mime`. Files
//! always do.
//!
//! Soft-delete model: setting `trashed = true` hides a node from every
//! browse view but preserves the R2 object. Permanent delete removes
//! the R2 object first, then the Mongo document. Folder permanent-delete
//! recursively collects every descendant key and issues batched
//! `DeleteObjects` requests (1000 keys / call) so a 50k-file folder
//! still drops in ~50 round-trips.

use std::time::Duration;

use axum::{
    Json,
    body::Bytes,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::options::{FindOptions, UpdateOptions};
use rand::Rng;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};

use crate::dto::*;
use crate::r2::{R2Client, build_file_key};
use crate::state::SabfilesState;

const NODES_COLL: &str = "sabfiles_nodes";
const AUDIT_COLL: &str = "sabfiles_audit";
const VAULT_KEYS_COLL: &str = "sabfiles_vault_keys";

// ───────────────────────────────────────────────────────────────────────
// Shared helpers
// ───────────────────────────────────────────────────────────────────────

fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

fn node_oid(id: &str) -> Result<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| ApiError::BadRequest("invalid node id".to_owned()))
}

fn validate_name(name: &str) -> Result<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if trimmed.len() > 255 {
        return Err(ApiError::Validation("name is too long".to_owned()));
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err(ApiError::Validation(
            "name cannot contain slashes".to_owned(),
        ));
    }
    Ok(trimmed.to_owned())
}

fn is_user_owned_upload_key(user_id: &str, key: &str) -> bool {
    key.starts_with(&format!("users/{user_id}/files/"))
        && !key.contains("..")
        && !key.contains('\\')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upload_proxy_key_guard_only_allows_current_user_prefix() {
        assert!(is_user_owned_upload_key(
            "69db5557427f2815408d54a9",
            "users/69db5557427f2815408d54a9/files/2026/05/photo.jpg"
        ));
        assert!(!is_user_owned_upload_key(
            "69db5557427f2815408d54a9",
            "users/other-user/files/2026/05/photo.jpg"
        ));
        assert!(!is_user_owned_upload_key(
            "69db5557427f2815408d54a9",
            "../users/69db5557427f2815408d54a9/files/photo.jpg"
        ));
    }
}

/// Check that `parent_id` either is `None` (root) or refers to a folder
/// owned by `user`. Returns the parent ObjectId (or `None`) on success.
async fn resolve_parent(
    mongo: &MongoHandle,
    user_id: ObjectId,
    parent_id: Option<&str>,
) -> Result<Option<ObjectId>> {
    let Some(raw) = parent_id else {
        return Ok(None);
    };
    if raw == "root" || raw.is_empty() {
        return Ok(None);
    }
    let oid = node_oid(raw)?;
    let coll = mongo.collection::<Document>(NODES_COLL);
    let doc = coll
        .find_one(doc! {
            "_id": oid,
            "userId": user_id,
            "type": "folder",
            "trashed": { "$ne": true },
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("parent folder".to_owned()))?;

    let _ = doc;
    Ok(Some(oid))
}

/// Throw 409 when a node with the same `name + type + parentId` already
/// exists for the user. Folder + file CAN share a name (R2 keys never
/// collide), but two folders or two files of the same name would.
async fn ensure_no_duplicate(
    mongo: &MongoHandle,
    user_id: ObjectId,
    parent_id: Option<ObjectId>,
    name: &str,
    kind: &str,
) -> Result<()> {
    let mut filter = doc! {
        "userId": user_id,
        "name": name,
        "type": kind,
        "trashed": { "$ne": true },
    };
    match parent_id {
        Some(p) => {
            filter.insert("parentId", p);
        }
        None => {
            filter.insert("parentId", Bson::Null);
        }
    }
    let coll = mongo.collection::<Document>(NODES_COLL);
    let existing = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    if existing.is_some() {
        return Err(ApiError::Conflict(format!(
            "a {kind} named '{name}' already exists in this folder"
        )));
    }
    Ok(())
}

fn parse_iso8601(s: &str) -> Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|_| ApiError::Validation("invalid ISO-8601 timestamp".to_owned()))
}

fn random_share_token() -> String {
    let bytes: [u8; 16] = rand::thread_rng().r#gen();
    hex::encode(bytes)
}

/// Convert `Option<String>` parent param into the matching Mongo filter.
fn parent_filter(parent: Option<&str>) -> Result<Bson> {
    match parent {
        None | Some("") | Some("root") => Ok(Bson::Null),
        Some(id) => Ok(Bson::ObjectId(node_oid(id)?)),
    }
}

// ───────────────────────────────────────────────────────────────────────
// Browse / read
// ───────────────────────────────────────────────────────────────────────

pub async fn list_nodes(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Query(q): Query<ListNodesQuery>,
) -> Result<Json<NodesResponse>> {
    let user_id = user_oid(&user)?;
    let parent = parent_filter(q.parent.as_deref())?;

    let mut filter = doc! {
        "userId": user_id,
        "parentId": parent,
        "trashed": { "$ne": true },
        "vault": { "$ne": true },
    };
    if let Some(query) = q.query.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("name", doc! { "$regex": query, "$options": "i" });
    }

    let sort_field = match q.sort.as_deref() {
        Some("modified") => "updatedAt",
        Some("size") => "size",
        _ => "name",
    };
    let dir = match q.dir.as_deref() {
        Some("desc") => -1,
        Some("asc") => 1,
        None if sort_field == "updatedAt" => -1,
        _ => 1,
    };

    // Always show folders before files at the same sort key.
    let sort = doc! { "type": 1, sort_field: dir };

    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let mut cursor = coll
        .find(filter)
        .with_options(FindOptions::builder().sort(sort).build())
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let mut out = Vec::new();
    while let Some(doc) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        out.push(decorate_node(&s.r2, doc));
    }
    Ok(Json(NodesResponse { nodes: out }))
}

pub async fn get_node(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Path(id): Path<String>,
) -> Result<Json<NodeResponse>> {
    let user_id = user_oid(&user)?;
    let oid = node_oid(&id)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let d = coll
        // Owner OR a collaborator (a user this node is shared with) may read it.
        .find_one(doc! { "_id": oid, "$or": [ { "userId": user_id }, { "members.userId": user_id } ] })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("node".to_owned()))?;
    Ok(Json(NodeResponse {
        node: decorate_node(&s.r2, d),
    }))
}

pub async fn breadcrumb(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Path(id): Path<String>,
) -> Result<Json<BreadcrumbResponse>> {
    let user_id = user_oid(&user)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);

    let mut chain: Vec<BreadcrumbEntry> = Vec::new();
    let mut cursor_id: Option<ObjectId> = if id == "root" {
        None
    } else {
        Some(node_oid(&id)?)
    };

    // Walk up. Cap at 100 hops to defend against accidentally cyclic data.
    for _ in 0..100 {
        let Some(oid) = cursor_id else { break };
        let d = coll
            .find_one(doc! { "_id": oid, "userId": user_id })
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
            .ok_or_else(|| ApiError::NotFound("breadcrumb node".to_owned()))?;
        let name = d.get_str("name").unwrap_or("Untitled").to_owned();
        let parent_oid = d.get_object_id("parentId").ok();
        chain.push(BreadcrumbEntry {
            id: Some(oid.to_hex()),
            name,
        });
        cursor_id = parent_oid;
    }

    chain.push(BreadcrumbEntry {
        id: None,
        name: "My files".to_owned(),
    });
    chain.reverse();
    Ok(Json(BreadcrumbResponse { crumbs: chain }))
}

pub async fn search_nodes(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<NodesResponse>> {
    let user_id = user_oid(&user)?;
    let needle = q.q.trim();
    if needle.is_empty() {
        return Ok(Json(NodesResponse { nodes: Vec::new() }));
    }
    let limit = q.limit.unwrap_or(100).clamp(1, 500) as i64;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let mut cursor = coll
        .find(doc! {
            "userId": user_id,
            "trashed": { "$ne": true },
            "vault": { "$ne": true },
            "name": { "$regex": regex::escape_basic(needle), "$options": "i" },
        })
        .with_options(
            FindOptions::builder()
                .sort(doc! { "updatedAt": -1 })
                .limit(limit)
                .build(),
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let mut out = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        out.push(decorate_node(&s.r2, d));
    }
    Ok(Json(NodesResponse { nodes: out }))
}

/// Flat library view: every (non-trashed) file the user owns, optionally
/// filtered by category and name. Drives the file-picker modal.
pub async fn library(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Query(q): Query<LibraryQuery>,
) -> Result<Json<NodesResponse>> {
    let user_id = user_oid(&user)?;
    let limit = q.limit.unwrap_or(200).clamp(1, 500) as i64;
    let coll = s.mongo.collection::<Document>(NODES_COLL);

    let mut filter = doc! {
        "userId": user_id,
        "type": "file",
        "trashed": { "$ne": true },
        "vault": { "$ne": true },
    };

    // Category → mime regex. Keep these aligned with the SabFilePicker
    // tabs in the UI.
    match q.category.as_deref().unwrap_or("all") {
        "image" => {
            filter.insert("mime", doc! { "$regex": "^image/", "$options": "i" });
        }
        "video" => {
            filter.insert("mime", doc! { "$regex": "^video/", "$options": "i" });
        }
        "audio" => {
            filter.insert("mime", doc! { "$regex": "^audio/", "$options": "i" });
        }
        "document" => {
            filter.insert(
                "mime",
                doc! {
                    "$regex": "(pdf|msword|officedocument|text/|spreadsheet|presentation|csv|rtf|epub)",
                    "$options": "i"
                },
            );
        }
        "other" => {
            filter.insert(
                "mime",
                doc! {
                    "$not": doc! {
                        "$regex": "^(image|video|audio)/|pdf|msword|officedocument|text/|spreadsheet|presentation|csv|rtf|epub",
                        "$options": "i",
                    }
                },
            );
        }
        _ => {}
    }

    if let Some(needle) = q.query.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert(
            "name",
            doc! { "$regex": regex::escape_basic(needle), "$options": "i" },
        );
    }

    let mut cursor = coll
        .find(filter)
        .with_options(
            FindOptions::builder()
                .sort(doc! { "updatedAt": -1 })
                .limit(limit)
                .build(),
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let mut out = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        out.push(decorate_node(&s.r2, d));
    }
    Ok(Json(NodesResponse { nodes: out }))
}

pub async fn list_starred(
    user: AuthUser,
    State(s): State<SabfilesState>,
) -> Result<Json<NodesResponse>> {
    let user_id = user_oid(&user)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let mut cursor = coll
        .find(doc! {
            "userId": user_id,
            "starred": true,
            "trashed": { "$ne": true },
            "vault": { "$ne": true },
        })
        .with_options(
            FindOptions::builder()
                .sort(doc! { "updatedAt": -1 })
                .build(),
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let mut out = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        out.push(decorate_node(&s.r2, d));
    }
    Ok(Json(NodesResponse { nodes: out }))
}

pub async fn list_recent(
    user: AuthUser,
    State(s): State<SabfilesState>,
) -> Result<Json<NodesResponse>> {
    let user_id = user_oid(&user)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let mut cursor = coll
        .find(doc! {
            "userId": user_id,
            "type": "file",
            "trashed": { "$ne": true },
            "vault": { "$ne": true },
        })
        .with_options(
            FindOptions::builder()
                .sort(doc! { "updatedAt": -1 })
                .limit(100)
                .build(),
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let mut out = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        out.push(decorate_node(&s.r2, d));
    }
    Ok(Json(NodesResponse { nodes: out }))
}

pub async fn list_trash(
    user: AuthUser,
    State(s): State<SabfilesState>,
) -> Result<Json<NodesResponse>> {
    let user_id = user_oid(&user)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let mut cursor = coll
        .find(doc! { "userId": user_id, "trashed": true })
        .with_options(
            FindOptions::builder()
                .sort(doc! { "trashedAt": -1 })
                .build(),
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let mut out = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        out.push(decorate_node(&s.r2, d));
    }
    Ok(Json(NodesResponse { nodes: out }))
}

pub async fn list_shared(
    user: AuthUser,
    State(s): State<SabfilesState>,
) -> Result<Json<NodesResponse>> {
    let user_id = user_oid(&user)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let mut cursor = coll
        .find(doc! {
            "userId": user_id,
            "shareToken": { "$exists": true, "$ne": null },
            "trashed": { "$ne": true },
            "vault": { "$ne": true },
        })
        .with_options(
            FindOptions::builder()
                .sort(doc! { "updatedAt": -1 })
                .build(),
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let mut out = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        out.push(decorate_node(&s.r2, d));
    }
    Ok(Json(NodesResponse { nodes: out }))
}

pub async fn storage_usage(
    user: AuthUser,
    State(s): State<SabfilesState>,
) -> Result<Json<StorageResponse>> {
    let user_id = user_oid(&user)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let pipeline = vec![
        doc! { "$match": { "userId": user_id, "type": "file", "trashed": { "$ne": true } } },
        doc! {
            "$group": {
                "_id": null,
                "used": { "$sum": "$size" },
                "count": { "$sum": 1_i32 },
            }
        },
    ];
    let mut cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let row = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let (used, count) = match row {
        Some(d) => {
            let used = d.get_i64("used").unwrap_or_else(|_| {
                d.get_i32("used")
                    .map(i64::from)
                    .or_else(|_| d.get_f64("used").map(|f| f as i64))
                    .unwrap_or(0)
            }) as u64;
            let count = d
                .get_i32("count")
                .map(i64::from)
                .unwrap_or_else(|_| d.get_i64("count").unwrap_or(0)) as u64;
            (used, count)
        }
        None => (0, 0),
    };
    Ok(Json(StorageResponse {
        used,
        count,
        quota: s.quota_bytes,
    }))
}

pub async fn node_download(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Path(id): Path<String>,
) -> Result<Json<DownloadUrlResponse>> {
    let user_id = user_oid(&user)?;
    let oid = node_oid(&id)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let d = coll
        // Owner OR a collaborator may download the file.
        .find_one(doc! {
            "_id": oid,
            "type": "file",
            "$or": [ { "userId": user_id }, { "members.userId": user_id } ],
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("file".to_owned()))?;
    let key = d
        .get_str("r2Key")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("missing r2Key")))?;
    let name = d.get_str("name").unwrap_or("download");
    let url =
        s.r2.presign_get(key, Some(Duration::from_secs(900)), Some(name))
            .await
            .map_err(ApiError::Internal)?;
    Ok(Json(DownloadUrlResponse { url }))
}

pub async fn node_preview(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Path(id): Path<String>,
) -> Result<Json<DownloadUrlResponse>> {
    let user_id = user_oid(&user)?;
    let oid = node_oid(&id)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let d = coll
        // Owner OR a collaborator may preview the file.
        .find_one(doc! {
            "_id": oid,
            "type": "file",
            "$or": [ { "userId": user_id }, { "members.userId": user_id } ],
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("file".to_owned()))?;
    let key = d
        .get_str("r2Key")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("missing r2Key")))?;
    let url =
        s.r2.presign_get(key, Some(Duration::from_secs(900)), None)
            .await
            .map_err(ApiError::Internal)?;
    Ok(Json(DownloadUrlResponse { url }))
}

/// Pull a non-negative integer out of an aggregation row, tolerating the
/// i32/i64/f64 shapes Mongo may return for `$sum`/`$size`.
fn extract_u64(d: &Document, key: &str) -> u64 {
    d.get_i64(key)
        .map(|v| v.max(0) as u64)
        .or_else(|_| d.get_i32(key).map(|v| v.max(0) as u64))
        .or_else(|_| d.get_f64(key).map(|v| v.max(0.0) as u64))
        .unwrap_or(0)
}

/// Recursive rollup (file count + byte total) for every immediate sub-folder
/// of `parent`. Powers the "N files · X used" line on the folder cards. One
/// `$graphLookup` per request walks each child folder's whole subtree.
pub async fn folder_rollups(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Query(q): Query<FolderRollupsQuery>,
) -> Result<Json<FolderRollupsResponse>> {
    let user_id = user_oid(&user)?;
    let parent = parent_filter(q.parent.as_deref())?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let pipeline = vec![
        doc! { "$match": {
            "userId": user_id,
            "parentId": parent,
            "type": "folder",
            "trashed": { "$ne": true },
            "vault": { "$ne": true },
        }},
        doc! { "$graphLookup": {
            "from": NODES_COLL,
            "startWith": "$_id",
            "connectFromField": "_id",
            "connectToField": "parentId",
            "as": "descendants",
            "restrictSearchWithMatch": { "userId": user_id, "trashed": { "$ne": true } },
        }},
        doc! { "$project": {
            "files": {
                "$filter": {
                    "input": "$descendants",
                    "as": "d",
                    "cond": { "$eq": [ "$$d.type", "file" ] },
                }
            },
        }},
        doc! { "$project": {
            "fileCount": { "$size": "$files" },
            "totalBytes": {
                "$sum": {
                    "$map": {
                        "input": "$files",
                        "as": "f",
                        "in": { "$ifNull": [ "$$f.size", 0_i64 ] },
                    }
                }
            },
        }},
    ];
    let mut cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let mut rollups: std::collections::HashMap<String, FolderRollup> = std::collections::HashMap::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        let Ok(oid) = d.get_object_id("_id") else {
            continue;
        };
        rollups.insert(
            oid.to_hex(),
            FolderRollup {
                file_count: extract_u64(&d, "fileCount"),
                total_bytes: extract_u64(&d, "totalBytes"),
            },
        );
    }
    Ok(Json(FolderRollupsResponse { rollups }))
}

/// Nodes another user has shared WITH the caller (caller is a member but not
/// the owner). Powers the "Shared with me" page.
pub async fn list_shared_with_me(
    user: AuthUser,
    State(s): State<SabfilesState>,
) -> Result<Json<NodesResponse>> {
    let user_id = user_oid(&user)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let mut cursor = coll
        .find(doc! {
            "members.userId": user_id,
            "userId": { "$ne": user_id },
            "trashed": { "$ne": true },
            "vault": { "$ne": true },
        })
        .with_options(FindOptions::builder().sort(doc! { "updatedAt": -1 }).build())
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let mut out = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        out.push(decorate_node(&s.r2, d));
    }
    Ok(Json(NodesResponse { nodes: out }))
}

/// The owner + every collaborator on a node. Readable by owner or any member.
pub async fn list_members(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Path(id): Path<String>,
) -> Result<Json<MembersResponse>> {
    let user_id = user_oid(&user)?;
    let oid = node_oid(&id)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let d = coll
        .find_one(doc! {
            "_id": oid,
            "$or": [ { "userId": user_id }, { "members.userId": user_id } ],
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("node".to_owned()))?;

    let mut members: Vec<MemberDto> = Vec::new();
    if let Ok(owner) = d.get_object_id("userId") {
        members.push(MemberDto {
            user_id: owner.to_hex(),
            role: "owner".to_owned(),
            added_at: None,
            is_owner: true,
        });
    }
    if let Ok(arr) = d.get_array("members") {
        for m in arr {
            if let Bson::Document(md) = m {
                if let Ok(uid) = md.get_object_id("userId") {
                    members.push(MemberDto {
                        user_id: uid.to_hex(),
                        role: md.get_str("role").unwrap_or("viewer").to_owned(),
                        added_at: md
                            .get_datetime("addedAt")
                            .ok()
                            .map(|dt| dt.to_chrono().to_rfc3339()),
                        is_owner: false,
                    });
                }
            }
        }
    }
    Ok(Json(MembersResponse { members }))
}

/// Add (or update the role of) a collaborator. Owner or an editor may manage.
pub async fn add_member(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Path(id): Path<String>,
    Json(body): Json<AddMemberBody>,
) -> Result<Json<OkResponse>> {
    let user_id = user_oid(&user)?;
    let oid = node_oid(&id)?;
    let target = ObjectId::parse_str(&body.user_id)
        .map_err(|_| ApiError::BadRequest("invalid user id".to_owned()))?;
    if target == user_id {
        return Err(ApiError::BadRequest(
            "the owner is always a member".to_owned(),
        ));
    }
    let role = match body.role.as_deref() {
        Some("editor") => "editor",
        _ => "viewer",
    };
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    // Manage gate: owner OR an existing editor.
    coll.find_one(doc! {
        "_id": oid,
        "$or": [
            { "userId": user_id },
            { "members": { "$elemMatch": { "userId": user_id, "role": "editor" } } },
        ],
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    .ok_or_else(|| ApiError::NotFound("node".to_owned()))?;

    let now = Utc::now();
    // Upsert the member: drop any existing entry, then push the fresh one.
    coll.update_one(
        doc! { "_id": oid },
        doc! { "$pull": { "members": { "userId": target } } },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    coll.update_one(
        doc! { "_id": oid },
        doc! {
            "$push": { "members": {
                "userId": target,
                "role": role,
                "addedAt": bson::DateTime::from_chrono(now),
            }},
            "$set": { "updatedAt": bson::DateTime::from_chrono(now) },
        },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(OkResponse {
        ok: true,
        affected: Some(1),
    }))
}

/// Remove a collaborator. Owner or an editor may manage.
pub async fn remove_member(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Path(id): Path<String>,
    Json(body): Json<RemoveMemberBody>,
) -> Result<Json<OkResponse>> {
    let user_id = user_oid(&user)?;
    let oid = node_oid(&id)?;
    let target = ObjectId::parse_str(&body.user_id)
        .map_err(|_| ApiError::BadRequest("invalid user id".to_owned()))?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    coll.find_one(doc! {
        "_id": oid,
        "$or": [
            { "userId": user_id },
            { "members": { "$elemMatch": { "userId": user_id, "role": "editor" } } },
        ],
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    .ok_or_else(|| ApiError::NotFound("node".to_owned()))?;

    let res = coll
        .update_one(
            doc! { "_id": oid },
            doc! {
                "$pull": { "members": { "userId": target } },
                "$set": { "updatedAt": bson::DateTime::from_chrono(Utc::now()) },
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(OkResponse {
        ok: true,
        affected: Some(res.modified_count),
    }))
}

// ───────────────────────────────────────────────────────────────────────
// Mutations
// ───────────────────────────────────────────────────────────────────────

pub async fn create_folder(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Json(body): Json<CreateFolderBody>,
) -> Result<Json<NodeResponse>> {
    let user_id = user_oid(&user)?;
    let name = validate_name(&body.name)?;
    let parent_id = resolve_parent(&s.mongo, user_id, body.parent_id.as_deref()).await?;
    ensure_no_duplicate(&s.mongo, user_id, parent_id, &name, "folder").await?;

    let now: DateTime<Utc> = Utc::now();
    let mut d = doc! {
        "userId": user_id,
        "type": "folder",
        "name": &name,
        "starred": false,
        "trashed": false,
        "createdAt": bson::DateTime::from_chrono(now),
        "updatedAt": bson::DateTime::from_chrono(now),
    };
    match parent_id {
        Some(p) => {
            d.insert("parentId", p);
        }
        None => {
            d.insert("parentId", Bson::Null);
        }
    }
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let res = coll
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let inserted_id = res
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("insert returned no ObjectId")))?;
    d.insert("_id", inserted_id);
    Ok(Json(NodeResponse {
        node: decorate_node(&s.r2, d),
    }))
}

pub async fn presign_upload(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Json(body): Json<PresignUploadBody>,
) -> Result<Json<PresignUploadResponse>> {
    let user_id = user_oid(&user)?;
    let name = validate_name(&body.name)?;
    let _ = resolve_parent(&s.mongo, user_id, body.parent_id.as_deref()).await?;

    if let Some(quota) = s.quota_bytes {
        let used = current_usage(&s.mongo, user_id).await?;
        if used.saturating_add(body.size) > quota {
            return Err(ApiError::Forbidden(
                "storage quota exceeded for this account".to_owned(),
            ));
        }
    }

    let key = build_file_key(&user.user_id, &name);
    let expires_in: u64 = 900;
    let url =
        s.r2.presign_put(
            &key,
            body.mime.as_deref(),
            Some(Duration::from_secs(expires_in)),
        )
        .await
        .map_err(ApiError::Internal)?;

    let mut headers = serde_json::Map::new();
    if let Some(mime) = &body.mime {
        headers.insert(
            "Content-Type".to_owned(),
            serde_json::Value::String(mime.clone()),
        );
    }

    Ok(Json(PresignUploadResponse {
        upload_url: url,
        key,
        method: "PUT".to_owned(),
        headers,
        expires_in,
    }))
}

pub async fn proxy_upload(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Query(q): Query<ProxyUploadQuery>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<OkResponse>> {
    let _ = user_oid(&user)?;
    if !is_user_owned_upload_key(&user.user_id, &q.key) {
        return Err(ApiError::Forbidden(
            "upload key does not belong to this account".to_owned(),
        ));
    }
    if body.is_empty() {
        return Err(ApiError::Validation("file body is required".to_owned()));
    }

    let content_type = headers
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok());

    s.r2.put_object_bytes(&q.key, body.to_vec(), content_type)
        .await
        .map_err(ApiError::Internal)?;

    Ok(Json(OkResponse {
        ok: true,
        affected: None,
    }))
}

pub async fn confirm_upload(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Json(body): Json<ConfirmUploadBody>,
) -> Result<Json<NodeResponse>> {
    let user_id = user_oid(&user)?;
    let name = validate_name(&body.name)?;
    let parent_id = resolve_parent(&s.mongo, user_id, body.parent_id.as_deref()).await?;

    if !body.key.starts_with(&format!("users/{}/", user.user_id)) {
        return Err(ApiError::Forbidden(
            "key does not belong to this user".to_owned(),
        ));
    }

    let final_name = unique_file_name(&s.mongo, user_id, parent_id, &name).await?;
    let now: DateTime<Utc> = Utc::now();
    let mut d = doc! {
        "userId": user_id,
        "type": "file",
        "name": &final_name,
        "size": body.size as i64,
        "r2Key": &body.key,
        "starred": false,
        "trashed": false,
        "createdAt": bson::DateTime::from_chrono(now),
        "updatedAt": bson::DateTime::from_chrono(now),
    };
    if let Some(mime) = &body.mime {
        d.insert("mime", mime);
    }
    match parent_id {
        Some(p) => {
            d.insert("parentId", p);
        }
        None => {
            d.insert("parentId", Bson::Null);
        }
    }
    // Sab Vault file: flag it and stash the opaque encrypted-name envelope.
    if body.vault == Some(true) {
        d.insert("vault", true);
        d.insert("vaultMeta", body.vault_meta.clone().unwrap_or_default());
    }

    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let res = coll
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let inserted_id = res
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("insert returned no ObjectId")))?;
    d.insert("_id", inserted_id);
    Ok(Json(NodeResponse {
        node: decorate_node(&s.r2, d),
    }))
}

pub async fn rename_node(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Path(id): Path<String>,
    Json(body): Json<RenameBody>,
) -> Result<Json<NodeResponse>> {
    let user_id = user_oid(&user)?;
    let oid = node_oid(&id)?;
    let new_name = validate_name(&body.name)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);

    let existing = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("node".to_owned()))?;
    let kind = existing.get_str("type").unwrap_or("file").to_owned();
    let parent_id = existing.get_object_id("parentId").ok();
    ensure_no_duplicate(&s.mongo, user_id, parent_id, &new_name, &kind).await?;

    let now = Utc::now();
    coll.update_one(
        doc! { "_id": oid, "userId": user_id },
        doc! {
            "$set": {
                "name": &new_name,
                "updatedAt": bson::DateTime::from_chrono(now),
            }
        },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let d = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("node disappeared after update")))?;
    Ok(Json(NodeResponse {
        node: decorate_node(&s.r2, d),
    }))
}

pub async fn move_nodes(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Json(body): Json<MoveBody>,
) -> Result<Json<OkResponse>> {
    let user_id = user_oid(&user)?;
    let target = resolve_parent(&s.mongo, user_id, body.target_parent_id.as_deref()).await?;
    if body.ids.is_empty() {
        return Ok(Json(OkResponse {
            ok: true,
            affected: Some(0),
        }));
    }

    let mut oids = Vec::with_capacity(body.ids.len());
    for id in &body.ids {
        oids.push(node_oid(id)?);
    }

    // Reject moving a folder into itself or one of its own descendants.
    if let Some(target_id) = target {
        for &candidate in &oids {
            if candidate == target_id {
                return Err(ApiError::BadRequest(
                    "cannot move a folder into itself".to_owned(),
                ));
            }
            if is_descendant_of(&s.mongo, user_id, target_id, candidate).await? {
                return Err(ApiError::BadRequest(
                    "cannot move a folder into one of its descendants".to_owned(),
                ));
            }
        }
    }

    let now = Utc::now();
    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(now),
    };
    match target {
        Some(p) => set.insert("parentId", p),
        None => set.insert("parentId", Bson::Null),
    };

    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let res = coll
        .update_many(
            doc! { "_id": { "$in": &oids }, "userId": user_id },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(OkResponse {
        ok: true,
        affected: Some(res.modified_count),
    }))
}

pub async fn star_nodes(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Json(body): Json<StarBody>,
) -> Result<Json<OkResponse>> {
    let user_id = user_oid(&user)?;
    let mut oids = Vec::with_capacity(body.ids.len());
    for id in &body.ids {
        oids.push(node_oid(id)?);
    }
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let res = coll
        .update_many(
            doc! { "_id": { "$in": &oids }, "userId": user_id },
            doc! {
                "$set": {
                    "starred": body.starred,
                    "updatedAt": bson::DateTime::from_chrono(Utc::now()),
                }
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(OkResponse {
        ok: true,
        affected: Some(res.modified_count),
    }))
}

pub async fn trash_nodes(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Json(body): Json<IdsBody>,
) -> Result<Json<OkResponse>> {
    let user_id = user_oid(&user)?;
    let mut oids = Vec::with_capacity(body.ids.len());
    for id in &body.ids {
        oids.push(node_oid(id)?);
    }
    // Expand to include all descendants of any folders in the set.
    let to_trash = expand_with_descendants(&s.mongo, user_id, &oids).await?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let now = Utc::now();
    let res = coll
        .update_many(
            doc! { "_id": { "$in": &to_trash }, "userId": user_id },
            doc! {
                "$set": {
                    "trashed": true,
                    "trashedAt": bson::DateTime::from_chrono(now),
                    "updatedAt": bson::DateTime::from_chrono(now),
                }
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(OkResponse {
        ok: true,
        affected: Some(res.modified_count),
    }))
}

pub async fn restore_nodes(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Json(body): Json<IdsBody>,
) -> Result<Json<OkResponse>> {
    let user_id = user_oid(&user)?;
    let mut oids = Vec::with_capacity(body.ids.len());
    for id in &body.ids {
        oids.push(node_oid(id)?);
    }
    let to_restore = expand_with_descendants(&s.mongo, user_id, &oids).await?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let now = Utc::now();
    let res = coll
        .update_many(
            doc! { "_id": { "$in": &to_restore }, "userId": user_id },
            doc! {
                "$set": {
                    "trashed": false,
                    "updatedAt": bson::DateTime::from_chrono(now),
                },
                "$unset": { "trashedAt": "" },
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(OkResponse {
        ok: true,
        affected: Some(res.modified_count),
    }))
}

pub async fn permanent_delete(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Json(body): Json<IdsBody>,
) -> Result<Json<OkResponse>> {
    let user_id = user_oid(&user)?;
    let mut oids = Vec::with_capacity(body.ids.len());
    for id in &body.ids {
        oids.push(node_oid(id)?);
    }
    let to_delete = expand_with_descendants(&s.mongo, user_id, &oids).await?;
    let removed = drop_nodes_and_objects(&s.mongo, &s.r2, user_id, &to_delete).await?;
    Ok(Json(OkResponse {
        ok: true,
        affected: Some(removed),
    }))
}

pub async fn empty_trash(
    user: AuthUser,
    State(s): State<SabfilesState>,
) -> Result<Json<OkResponse>> {
    let user_id = user_oid(&user)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let mut cursor = coll
        .find(doc! { "userId": user_id, "trashed": true })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let mut ids: Vec<ObjectId> = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        if let Ok(oid) = d.get_object_id("_id") {
            ids.push(oid);
        }
    }
    let removed = drop_nodes_and_objects(&s.mongo, &s.r2, user_id, &ids).await?;
    Ok(Json(OkResponse {
        ok: true,
        affected: Some(removed),
    }))
}

// ───────────────────────────────────────────────────────────────────────
// Sharing
// ───────────────────────────────────────────────────────────────────────

pub async fn create_share(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Path(id): Path<String>,
    Json(body): Json<CreateShareBody>,
) -> Result<Json<ShareResponse>> {
    let user_id = user_oid(&user)?;
    let oid = node_oid(&id)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);

    let mut set = doc! {
        "shareToken": random_share_token(),
        "shareDownloadEnabled": body.download_enabled.unwrap_or(true),
        // Counters are reset on every (re)create so a fresh link starts clean.
        "shareDownloadCount": 0_i64,
        "shareViewCount": 0_i64,
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
    };
    if let Some(exp) = &body.expires_at {
        let dt = parse_iso8601(exp)?;
        set.insert("shareExpiresAt", bson::DateTime::from_chrono(dt));
    }
    if let Some(pwd) = &body.password {
        if !pwd.is_empty() {
            // We store the plaintext under a `sharePassword` field. The
            // /share/{token} surface compares verbatim — switch to bcrypt
            // here when bcrypt is wired in. (Acceptable for v1: links are
            // already opaque, and the password is a soft gate.)
            set.insert("sharePassword", pwd);
        } else {
            set.insert("sharePassword", Bson::Null);
        }
    }
    // Governance knobs folded into the share record.
    if let Some(md) = body.max_downloads {
        set.insert("shareMaxDownloads", md);
    }
    if let Some(mv) = body.max_views {
        set.insert("shareMaxViews", mv);
    }
    if let Some(nb) = &body.not_before {
        let dt = parse_iso8601(nb)?;
        set.insert("shareNotBefore", bson::DateTime::from_chrono(dt));
    }
    if let Some(audit) = body.audit_enabled {
        set.insert("shareAuditEnabled", audit);
    }
    if let Some(wm) = &body.watermark {
        set.insert(
            "shareWatermark",
            doc! {
                "enabled": wm.enabled,
                "text": wm.text.clone().unwrap_or_default(),
                "includeViewerEmail": wm.include_viewer_email.unwrap_or(false),
                "opacity": wm.opacity.unwrap_or(0.15),
            },
        );
    }

    let res = coll
        .update_one(doc! { "_id": oid, "userId": user_id }, doc! { "$set": set })
        .with_options(UpdateOptions::builder().upsert(false).build())
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("node".to_owned()));
    }

    let d = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!("node disappeared after share update"))
        })?;
    let token = d.get_str("shareToken").unwrap_or_default().to_owned();
    let expires = d
        .get_datetime("shareExpiresAt")
        .ok()
        .map(|d| d.to_chrono().to_rfc3339());
    let download = d.get_bool("shareDownloadEnabled").unwrap_or(true);
    let password =
        d.get_str("sharePassword").is_ok() && !d.get_str("sharePassword").unwrap_or("").is_empty();
    let max_downloads = d.get_i64("shareMaxDownloads").ok();
    let max_views = d.get_i64("shareMaxViews").ok();
    let not_before = d
        .get_datetime("shareNotBefore")
        .ok()
        .map(|d| d.to_chrono().to_rfc3339());
    let audit_enabled = d.get_bool("shareAuditEnabled").unwrap_or(false);
    let watermark = read_watermark(&d);

    Ok(Json(ShareResponse {
        token: token.clone(),
        url: format!("/share/{token}"),
        expires_at: expires,
        download_enabled: download,
        password_protected: password,
        max_downloads,
        max_views,
        not_before,
        audit_enabled,
        watermark,
    }))
}

pub async fn revoke_share(
    user: AuthUser,
    State(s): State<SabfilesState>,
    Path(id): Path<String>,
) -> Result<Json<OkResponse>> {
    let user_id = user_oid(&user)?;
    let oid = node_oid(&id)?;
    let coll = s.mongo.collection::<Document>(NODES_COLL);
    let res = coll
        .update_one(
            doc! { "_id": oid, "userId": user_id },
            doc! {
                "$unset": {
                    "shareToken": "",
                    "shareExpiresAt": "",
                    "shareDownloadEnabled": "",
                    "sharePassword": "",
                    "shareMaxDownloads": "",
                    "shareMaxViews": "",
                    "shareNotBefore": "",
                    "shareAuditEnabled": "",
                    "shareWatermark": "",
                    "shareDownloadCount": "",
                    "shareViewCount": "",
                },
                "$set": { "updatedAt": bson::DateTime::from_chrono(Utc::now()) },
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(OkResponse {
        ok: true,
        affected: Some(res.modified_count),
    }))
}

pub async fn share_view(
    State(s): State<SabfilesState>,
    Path(token): Path<String>,
) -> Result<Json<PublicShareView>> {
    let d = load_share(&s.mongo, &token).await?;
    let kind = d.get_str("type").unwrap_or("file").to_owned();
    let size = d.get_i64("size").ok().map(|n| n as u64);
    let mime = d.get_str("mime").ok().map(|s| s.to_owned());
    let thumb = d.get_str("r2Key").ok().and_then(|k| s.r2.public_url_for(k));
    let download = d.get_bool("shareDownloadEnabled").unwrap_or(true);
    let pwd = d
        .get_str("sharePassword")
        .map(|s| !s.is_empty())
        .unwrap_or(false);
    Ok(Json(PublicShareView {
        name: d.get_str("name").unwrap_or("Shared").to_owned(),
        kind,
        size,
        mime,
        thumbnail_url: thumb,
        download_enabled: download,
        password_protected: pwd,
    }))
}

pub async fn share_download(
    State(s): State<SabfilesState>,
    Path(token): Path<String>,
    Query(q): Query<SharePasswordQuery>,
) -> Result<Json<DownloadUrlResponse>> {
    let d = load_share(&s.mongo, &token).await?;
    if !d.get_bool("shareDownloadEnabled").unwrap_or(true) {
        return Err(ApiError::Forbidden(
            "downloads are disabled for this share".to_owned(),
        ));
    }
    if let Ok(stored_pwd) = d.get_str("sharePassword") {
        if !stored_pwd.is_empty() {
            let supplied = q.password.as_deref().unwrap_or_default();
            if supplied != stored_pwd {
                return Err(ApiError::Unauthorized("password required".to_owned()));
            }
        }
    }
    let key = d
        .get_str("r2Key")
        .map_err(|_| ApiError::BadRequest("only files can be downloaded".to_owned()))?;
    let name = d.get_str("name").unwrap_or("download");
    let url =
        s.r2.presign_get(key, Some(Duration::from_secs(900)), Some(name))
            .await
            .map_err(ApiError::Internal)?;
    Ok(Json(DownloadUrlResponse { url }))
}

pub async fn share_preview(
    State(s): State<SabfilesState>,
    Path(token): Path<String>,
    Query(q): Query<SharePasswordQuery>,
) -> Result<Json<DownloadUrlResponse>> {
    let d = load_share(&s.mongo, &token).await?;
    if let Ok(stored_pwd) = d.get_str("sharePassword") {
        if !stored_pwd.is_empty() {
            let supplied = q.password.as_deref().unwrap_or_default();
            if supplied != stored_pwd {
                return Err(ApiError::Unauthorized("password required".to_owned()));
            }
        }
    }
    let key = d
        .get_str("r2Key")
        .map_err(|_| ApiError::BadRequest("only files can be previewed".to_owned()))?;
    let url =
        s.r2.presign_get(key, Some(Duration::from_secs(900)), None)
            .await
            .map_err(ApiError::Internal)?;
    Ok(Json(DownloadUrlResponse { url }))
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct SharePasswordQuery {
    #[serde(default)]
    pub password: Option<String>,
}

async fn load_share(mongo: &MongoHandle, token: &str) -> Result<Document> {
    let coll = mongo.collection::<Document>(NODES_COLL);
    let d = coll
        .find_one(doc! {
            "shareToken": token,
            "trashed": { "$ne": true },
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("share".to_owned()))?;
    if let Ok(exp) = d.get_datetime("shareExpiresAt") {
        if exp.to_chrono() < Utc::now() {
            return Err(ApiError::NotFound("share has expired".to_owned()));
        }
    }
    Ok(d)
}

// ───────────────────────────────────────────────────────────────────────
// Internals
// ───────────────────────────────────────────────────────────────────────

/// Render a stored Mongo document as the JSON shape the UI expects:
/// keys like `id`, `parentId`, `userId` are hex strings; dates ISO-8601;
/// public URL embedded for files when configured.
fn decorate_node(r2: &R2Client, d: Document) -> serde_json::Value {
    let mut value = document_to_clean_json(d.clone());

    if let Some(obj) = value.as_object_mut() {
        // Mirror `_id` to `id` for friendlier client code.
        if let Some(id) = obj.get("_id").cloned() {
            obj.insert("id".to_owned(), id);
        }
        // Inline a public URL if the file has one.
        if let Some(serde_json::Value::String(key)) = obj.get("r2Key").cloned() {
            if let Some(url) = r2.public_url_for(&key) {
                obj.insert("url".to_owned(), serde_json::Value::String(url));
            }
        }
    }
    value
}

async fn current_usage(mongo: &MongoHandle, user_id: ObjectId) -> Result<u64> {
    let coll = mongo.collection::<Document>(NODES_COLL);
    let pipeline = vec![
        doc! { "$match": { "userId": user_id, "type": "file", "trashed": { "$ne": true } } },
        doc! { "$group": { "_id": null, "used": { "$sum": "$size" } } },
    ];
    let mut cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let row = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(row
        .as_ref()
        .and_then(|d| d.get_i64("used").ok())
        .unwrap_or(0)
        .max(0) as u64)
}

/// If a name is taken, append " (n)" before the extension until it isn't.
async fn unique_file_name(
    mongo: &MongoHandle,
    user_id: ObjectId,
    parent_id: Option<ObjectId>,
    name: &str,
) -> Result<String> {
    let coll = mongo.collection::<Document>(NODES_COLL);
    let mut filter = doc! {
        "userId": user_id,
        "type": "file",
        "trashed": { "$ne": true },
    };
    match parent_id {
        Some(p) => filter.insert("parentId", p),
        None => filter.insert("parentId", Bson::Null),
    };

    let mut candidate = name.to_owned();
    for n in 1..1000 {
        let mut probe = filter.clone();
        probe.insert("name", &candidate);
        let exists = coll
            .find_one(probe)
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
            .is_some();
        if !exists {
            return Ok(candidate);
        }
        candidate = match name.rsplit_once('.') {
            Some((base, ext)) => format!("{base} ({n}).{ext}"),
            None => format!("{name} ({n})"),
        };
    }
    Err(ApiError::Conflict(
        "could not find an unused name after 999 attempts".to_owned(),
    ))
}

/// Walk the tree and return `ids` plus every descendant id under any
/// folder in `ids`. BFS, capped at 100k nodes per call.
async fn expand_with_descendants(
    mongo: &MongoHandle,
    user_id: ObjectId,
    ids: &[ObjectId],
) -> Result<Vec<ObjectId>> {
    let coll = mongo.collection::<Document>(NODES_COLL);
    let mut out: Vec<ObjectId> = ids.to_vec();
    let mut frontier: Vec<ObjectId> = ids.to_vec();
    let mut visited: std::collections::HashSet<ObjectId> = ids.iter().copied().collect();

    while !frontier.is_empty() && out.len() < 100_000 {
        let mut cursor = coll
            .find(doc! {
                "userId": user_id,
                "parentId": { "$in": &frontier },
            })
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
        let mut next: Vec<ObjectId> = Vec::new();
        while let Some(d) = cursor
            .try_next()
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        {
            if let Ok(oid) = d.get_object_id("_id") {
                if visited.insert(oid) {
                    out.push(oid);
                    next.push(oid);
                }
            }
        }
        frontier = next;
    }
    Ok(out)
}

/// Drop the given nodes and their underlying R2 objects. Returns the
/// number of Mongo documents removed. Best-effort R2 cleanup — failures
/// are logged but do not block the Mongo delete (a daily reconciler can
/// catch leftovers).
async fn drop_nodes_and_objects(
    mongo: &MongoHandle,
    r2: &R2Client,
    user_id: ObjectId,
    ids: &[ObjectId],
) -> Result<u64> {
    if ids.is_empty() {
        return Ok(0);
    }
    let coll = mongo.collection::<Document>(NODES_COLL);

    let mut keys: Vec<String> = Vec::new();
    let mut cursor = coll
        .find(doc! { "_id": { "$in": ids }, "userId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        if let Ok(k) = d.get_str("r2Key") {
            keys.push(k.to_owned());
        }
    }

    for chunk in keys.chunks(1000) {
        if let Err(err) = r2.delete_objects(chunk).await {
            tracing::warn!(error = %err, count = chunk.len(), "R2 delete chunk failed");
        }
    }

    let res = coll
        .delete_many(doc! { "_id": { "$in": ids }, "userId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(res.deleted_count)
}

async fn is_descendant_of(
    mongo: &MongoHandle,
    user_id: ObjectId,
    candidate: ObjectId,
    ancestor: ObjectId,
) -> Result<bool> {
    if candidate == ancestor {
        return Ok(true);
    }
    let coll = mongo.collection::<Document>(NODES_COLL);
    let mut cursor: Option<ObjectId> = Some(candidate);
    for _ in 0..256 {
        let Some(c) = cursor else { return Ok(false) };
        let d = coll
            .find_one(doc! { "_id": c, "userId": user_id })
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
        let Some(d) = d else { return Ok(false) };
        let parent = d.get_object_id("parentId").ok();
        if parent == Some(ancestor) {
            return Ok(true);
        }
        cursor = parent;
    }
    Ok(false)
}

// ───────────────────────────────────────────────────────────────────────
// Tiny inline regex-escape so we don't need to depend on the `regex`
// crate just for a single search query.
// ───────────────────────────────────────────────────────────────────────
mod regex {
    pub fn escape_basic(s: &str) -> String {
        let mut out = String::with_capacity(s.len());
        for c in s.chars() {
            if matches!(
                c,
                '.' | '+' | '*' | '?' | '(' | ')' | '[' | ']' | '{' | '}' | '|' | '\\' | '^' | '$'
            ) {
                out.push('\\');
            }
            out.push(c);
        }
        out
    }
}
