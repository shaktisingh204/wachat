//! NextCloud node.
//!
//! Implements file/folder operations against a NextCloud server over WebDAV.
//!
//! Auth: HTTP Basic with a username + app password stored on the linked
//! credential (`nextCloudApi`) under `data["baseUrl"]`, `data["username"]`,
//! and `data["password"]`.
//!
//! Base endpoint:
//!     {baseUrl}/remote.php/dav/files/{username}/
//!
//! For PROPFIND we return the raw multistatus XML response as a string —
//! callers can post-process it with the XML node. Good enough for v0.

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct NextCloudNode;

#[async_trait]
impl Node for NextCloudNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "nextCloud",
            "NextCloud",
            "NextCloud cloud storage (WebDAV)",
            NodeCategory::Storage,
        )
        .icon("cloud")
        .color("#0082C9")
        .credentials(vec![CredentialBinding {
            name: "nextCloudApi".into(),
            display_name: "NextCloud API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "List Directory".into(),
                        value: json!("listDirectory"),
                        description: Some("List the contents of a directory (PROPFIND)".into()),
                    },
                    NodePropertyOption {
                        name: "Upload File".into(),
                        value: json!("upload"),
                        description: Some("Upload a file (PUT). Content is base64.".into()),
                    },
                    NodePropertyOption {
                        name: "Download File".into(),
                        value: json!("download"),
                        description: Some("Download a file (GET). Returns base64.".into()),
                    },
                    NodePropertyOption {
                        name: "Delete".into(),
                        value: json!("delete"),
                        description: Some("Delete a file or directory".into()),
                    },
                    NodePropertyOption {
                        name: "Create Directory".into(),
                        value: json!("createDirectory"),
                        description: Some("Create a directory (MKCOL)".into()),
                    },
                    NodePropertyOption {
                        name: "Copy".into(),
                        value: json!("copy"),
                        description: Some("Copy a file or directory".into()),
                    },
                    NodePropertyOption {
                        name: "Move".into(),
                        value: json!("move"),
                        description: Some("Move a file or directory".into()),
                    },
                ])
                .default(json!("listDirectory"))
                .required(),
            NodeProperty::new("path", "Path", NodePropertyType::String)
                .placeholder("/Documents/report.pdf")
                .description("Path relative to the user's WebDAV root, e.g. /Photos")
                .show_when(
                    "operation",
                    &[
                        "listDirectory",
                        "upload",
                        "download",
                        "delete",
                        "createDirectory",
                    ],
                )
                .required(),
            NodeProperty::new("content", "Content (base64)", NodePropertyType::String)
                .description("File contents encoded as base64")
                .show_when("operation", &["upload"])
                .required(),
            NodeProperty::new("sourcePath", "Source Path", NodePropertyType::String)
                .placeholder("/Documents/source.pdf")
                .show_when("operation", &["copy", "move"])
                .required(),
            NodeProperty::new("destPath", "Destination Path", NodePropertyType::String)
                .placeholder("/Archive/source.pdf")
                .show_when("operation", &["copy", "move"])
                .required(),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let cred = ctx.credential(&cred_id)?;
        let base_url = cred
            .data
            .get("baseUrl")
            .ok_or_else(|| NodeError::MissingParameter("baseUrl".into()))?
            .trim_end_matches('/')
            .to_string();
        let username = cred
            .data
            .get("username")
            .ok_or_else(|| NodeError::MissingParameter("username".into()))?
            .clone();
        let password = cred
            .data
            .get("password")
            .ok_or_else(|| NodeError::MissingParameter("password".into()))?
            .clone();

        let dav_root = format!(
            "{}/remote.php/dav/files/{}",
            base_url,
            urlencoding::encode(&username)
        );

        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "listDirectory" => {
                let path = substituted(ctx, params, "path")?;
                let url = join_dav(&dav_root, &path);
                let method = reqwest::Method::from_bytes(b"PROPFIND")
                    .map_err(|e| NodeError::Other(format!("invalid method: {e}")))?;
                let res = ctx
                    .http
                    .request(method, &url)
                    .basic_auth(&username, Some(&password))
                    .header("Depth", "1")
                    .header("Content-Type", "application/xml")
                    .send()
                    .await?;
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                if !status.is_success() {
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body: text,
                    });
                }
                Ok(NodeOutput::single(vec![json!({
                    "path": path,
                    "status": status.as_u16(),
                    "xml": text,
                })]))
            }
            "upload" => {
                let path = substituted(ctx, params, "path")?;
                let content_b64 = ctx.param_str(params, "content")?;
                let content_b64 = ctx.substitute(&content_b64);
                let bytes = base64::Engine::decode(
                    &base64::engine::general_purpose::STANDARD,
                    content_b64.as_bytes(),
                )
                .map_err(|e| NodeError::InvalidParameter {
                    name: "content".into(),
                    reason: format!("invalid base64 content: {e}"),
                })?;
                let url = join_dav(&dav_root, &path);
                let res = ctx
                    .http
                    .put(&url)
                    .basic_auth(&username, Some(&password))
                    .header("Content-Type", "application/octet-stream")
                    .body(bytes.clone())
                    .send()
                    .await?;
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                if !status.is_success() {
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body: text,
                    });
                }
                Ok(NodeOutput::single(vec![json!({
                    "path": path,
                    "status": status.as_u16(),
                    "bytesWritten": bytes.len(),
                })]))
            }
            "download" => {
                let path = substituted(ctx, params, "path")?;
                let url = join_dav(&dav_root, &path);
                let res = ctx
                    .http
                    .get(&url)
                    .basic_auth(&username, Some(&password))
                    .send()
                    .await?;
                let status = res.status();
                if !status.is_success() {
                    let body = res.text().await.unwrap_or_default();
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body,
                    });
                }
                let bytes = res.bytes().await?;
                let encoded = base64::Engine::encode(
                    &base64::engine::general_purpose::STANDARD,
                    &bytes,
                );
                Ok(NodeOutput::single(vec![json!({
                    "path": path,
                    "status": status.as_u16(),
                    "size": bytes.len(),
                    "content": encoded,
                })]))
            }
            "delete" => {
                let path = substituted(ctx, params, "path")?;
                let url = join_dav(&dav_root, &path);
                let res = ctx
                    .http
                    .delete(&url)
                    .basic_auth(&username, Some(&password))
                    .send()
                    .await?;
                let status = res.status();
                if !status.is_success() {
                    let body = res.text().await.unwrap_or_default();
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body,
                    });
                }
                Ok(NodeOutput::single(vec![json!({
                    "path": path,
                    "status": status.as_u16(),
                    "deleted": true,
                })]))
            }
            "createDirectory" => {
                let path = substituted(ctx, params, "path")?;
                let url = join_dav(&dav_root, &path);
                let method = reqwest::Method::from_bytes(b"MKCOL")
                    .map_err(|e| NodeError::Other(format!("invalid method: {e}")))?;
                let res = ctx
                    .http
                    .request(method, &url)
                    .basic_auth(&username, Some(&password))
                    .send()
                    .await?;
                let status = res.status();
                if !status.is_success() {
                    let body = res.text().await.unwrap_or_default();
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body,
                    });
                }
                Ok(NodeOutput::single(vec![json!({
                    "path": path,
                    "status": status.as_u16(),
                    "created": true,
                })]))
            }
            "copy" => {
                let source_path = substituted(ctx, params, "sourcePath")?;
                let dest_path = substituted(ctx, params, "destPath")?;
                let url = join_dav(&dav_root, &source_path);
                let destination = join_dav(&dav_root, &dest_path);
                let method = reqwest::Method::from_bytes(b"COPY")
                    .map_err(|e| NodeError::Other(format!("invalid method: {e}")))?;
                let res = ctx
                    .http
                    .request(method, &url)
                    .basic_auth(&username, Some(&password))
                    .header("Destination", destination)
                    .header("Overwrite", "T")
                    .send()
                    .await?;
                let status = res.status();
                if !status.is_success() {
                    let body = res.text().await.unwrap_or_default();
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body,
                    });
                }
                Ok(NodeOutput::single(vec![json!({
                    "sourcePath": source_path,
                    "destPath": dest_path,
                    "status": status.as_u16(),
                    "copied": true,
                })]))
            }
            "move" => {
                let source_path = substituted(ctx, params, "sourcePath")?;
                let dest_path = substituted(ctx, params, "destPath")?;
                let url = join_dav(&dav_root, &source_path);
                let destination = join_dav(&dav_root, &dest_path);
                let method = reqwest::Method::from_bytes(b"MOVE")
                    .map_err(|e| NodeError::Other(format!("invalid method: {e}")))?;
                let res = ctx
                    .http
                    .request(method, &url)
                    .basic_auth(&username, Some(&password))
                    .header("Destination", destination)
                    .header("Overwrite", "T")
                    .send()
                    .await?;
                let status = res.status();
                if !status.is_success() {
                    let body = res.text().await.unwrap_or_default();
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body,
                    });
                }
                Ok(NodeOutput::single(vec![json!({
                    "sourcePath": source_path,
                    "destPath": dest_path,
                    "status": status.as_u16(),
                    "moved": true,
                })]))
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

/// Read a string parameter and run `{{var}}` substitution on it.
fn substituted(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let raw = ctx.param_str(params, key)?;
    Ok(ctx.substitute(&raw))
}

/// Join the WebDAV root (already URL-encoded for the username segment) with a
/// user-supplied path. The path is normalised to start with exactly one `/`
/// and each segment is percent-encoded so spaces and special chars survive.
fn join_dav(dav_root: &str, path: &str) -> String {
    let trimmed = path.trim_start_matches('/');
    if trimmed.is_empty() {
        return format!("{dav_root}/");
    }
    let encoded: Vec<String> = trimmed
        .split('/')
        .map(|seg| urlencoding::encode(seg).into_owned())
        .collect();
    format!("{}/{}", dav_root, encoded.join("/"))
}
