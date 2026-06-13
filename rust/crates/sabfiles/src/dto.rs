//! Wire-format DTOs for the sabfiles HTTP surface.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Deserialize)]
pub struct ListNodesQuery {
    /// `"root"` or a node id. Defaults to root.
    #[serde(default)]
    pub parent: Option<String>,
    /// `name` (default), `modified`, `size`.
    #[serde(default)]
    pub sort: Option<String>,
    /// `asc` or `desc`. Defaults to `asc` for name, `desc` for modified.
    #[serde(default)]
    pub dir: Option<String>,
    /// Optional substring filter on name.
    #[serde(default)]
    pub query: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NodesResponse {
    pub nodes: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NodeResponse {
    pub node: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct BreadcrumbResponse {
    /// Root → ... → current. Always at least one entry (the root marker).
    pub crumbs: Vec<BreadcrumbEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BreadcrumbEntry {
    /// `null` for the synthetic root entry.
    pub id: Option<String>,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateFolderBody {
    pub name: String,
    /// Parent folder id, or `None` for the user's root.
    #[serde(default)]
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PresignUploadBody {
    pub name: String,
    pub size: u64,
    #[serde(default)]
    pub mime: Option<String>,
    #[serde(default)]
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PresignUploadResponse {
    pub upload_url: String,
    pub key: String,
    /// HTTP method the browser must use (always `PUT`).
    pub method: String,
    /// Headers the browser must send. Today: only `Content-Type` when set.
    pub headers: serde_json::Map<String, Value>,
    /// Seconds until the URL expires.
    pub expires_in: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProxyUploadQuery {
    pub key: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConfirmUploadBody {
    pub key: String,
    pub name: String,
    pub size: u64,
    #[serde(default)]
    pub mime: Option<String>,
    #[serde(default)]
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RenameBody {
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct IdsBody {
    pub ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StarBody {
    pub ids: Vec<String>,
    pub starred: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MoveBody {
    pub ids: Vec<String>,
    /// Target folder id, or `None` to move to root.
    #[serde(default)]
    pub target_parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OkResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub affected: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StorageResponse {
    pub used: u64,
    pub count: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quota: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateShareBody {
    /// ISO-8601 UTC timestamp at which the share expires, or `None`.
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub download_enabled: Option<bool>,
    /// Optional plaintext password (will be stored as bcrypt hash).
    #[serde(default)]
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ShareResponse {
    pub token: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    pub download_enabled: bool,
    pub password_protected: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicShareView {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail_url: Option<String>,
    pub download_enabled: bool,
    pub password_protected: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadUrlResponse {
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default)]
    pub limit: Option<u32>,
}

/// Query for the flat library view used by the file-picker modal.
#[derive(Debug, Clone, Deserialize)]
pub struct LibraryQuery {
    /// `image` | `video` | `audio` | `document` | `other` | `all`. Defaults to `all`.
    #[serde(default)]
    pub category: Option<String>,
    /// Optional case-insensitive name substring filter.
    #[serde(default)]
    pub query: Option<String>,
    /// Max items, default 200, capped at 500.
    #[serde(default)]
    pub limit: Option<u32>,
}

// ───────────────────────────────────────────────────────────────────────
// Folder rollups (recursive file count + byte total per child folder)
// ───────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct FolderRollupsQuery {
    /// `"root"` or a folder id whose immediate sub-folders are rolled up.
    #[serde(default)]
    pub parent: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FolderRollup {
    pub file_count: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FolderRollupsResponse {
    /// Folder id (hex) → its recursive rollup.
    pub rollups: std::collections::HashMap<String, FolderRollup>,
}

// ───────────────────────────────────────────────────────────────────────
// Collaborators (people a node is shared with)
// ───────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct AddMemberBody {
    /// Target user id (hex). The Next.js action resolves email → user id.
    pub user_id: String,
    /// `"viewer"` (default) or `"editor"`.
    #[serde(default)]
    pub role: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RemoveMemberBody {
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MemberDto {
    pub user_id: String,
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub added_at: Option<String>,
    pub is_owner: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct MembersResponse {
    pub members: Vec<MemberDto>,
}
