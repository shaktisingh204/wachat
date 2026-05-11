//! Dropbox node.
//!
//! Implements file/folder operations against the Dropbox v2 REST API.
//!
//! Auth: OAuth2 access token — `Authorization: Bearer <token>` where the
//! token is stored on the linked credential under `data["accessToken"]`.

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

const DROPBOX_BASE: &str = "https://api.dropboxapi.com/2";

pub struct DropboxNode;

#[async_trait]
impl Node for DropboxNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "dropbox",
            "Dropbox",
            "Dropbox cloud storage",
            NodeCategory::Storage,
        )
        .icon("folder")
        .color("#0061FF")
        .credentials(vec![CredentialBinding {
            name: "dropboxOAuth2".into(),
            display_name: "Dropbox OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "List Folder".into(),
                        value: json!("listFolder"),
                        description: Some("List the contents of a folder".into()),
                    },
                    NodePropertyOption {
                        name: "Get Metadata".into(),
                        value: json!("getMetadata"),
                        description: Some("Get metadata for a file or folder".into()),
                    },
                    NodePropertyOption {
                        name: "Create Folder".into(),
                        value: json!("createFolder"),
                        description: Some("Create a new folder".into()),
                    },
                    NodePropertyOption {
                        name: "Delete".into(),
                        value: json!("delete"),
                        description: Some("Delete a file or folder".into()),
                    },
                    NodePropertyOption {
                        name: "Move".into(),
                        value: json!("move"),
                        description: Some("Move a file or folder".into()),
                    },
                    NodePropertyOption {
                        name: "Copy".into(),
                        value: json!("copy"),
                        description: Some("Copy a file or folder".into()),
                    },
                    NodePropertyOption {
                        name: "Search".into(),
                        value: json!("search"),
                        description: Some("Search for files and folders".into()),
                    },
                    NodePropertyOption {
                        name: "Get Shared Link".into(),
                        value: json!("getSharedLink"),
                        description: Some("Create a shared link with settings".into()),
                    },
                ])
                .default(json!("listFolder"))
                .required(),
            NodeProperty::new("path", "Path", NodePropertyType::String)
                .placeholder("/folder/file.txt")
                .description("Path to the file or folder, e.g. /reports/2024")
                .show_when(
                    "operation",
                    &["listFolder", "getMetadata", "createFolder", "delete", "getSharedLink"],
                )
                .required(),
            NodeProperty::new("fromPath", "From Path", NodePropertyType::String)
                .placeholder("/source/file.txt")
                .show_when("operation", &["move", "copy"])
                .required(),
            NodeProperty::new("toPath", "To Path", NodePropertyType::String)
                .placeholder("/destination/file.txt")
                .show_when("operation", &["move", "copy"])
                .required(),
            NodeProperty::new("query", "Query", NodePropertyType::String)
                .placeholder("annual report")
                .show_when("operation", &["search"])
                .required(),
            NodeProperty::new("maxResults", "Max Results", NodePropertyType::Number)
                .description("Maximum number of search results to return")
                .default(json!(100))
                .show_when("operation", &["search"]),
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
        let token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        let (url, body) = match operation.as_str() {
            "listFolder" => {
                let path = substituted(ctx, params, "path")?;
                (
                    format!("{DROPBOX_BASE}/files/list_folder"),
                    json!({ "path": path }),
                )
            }
            "getMetadata" => {
                let path = substituted(ctx, params, "path")?;
                (
                    format!("{DROPBOX_BASE}/files/get_metadata"),
                    json!({ "path": path }),
                )
            }
            "createFolder" => {
                let path = substituted(ctx, params, "path")?;
                (
                    format!("{DROPBOX_BASE}/files/create_folder_v2"),
                    json!({ "path": path }),
                )
            }
            "delete" => {
                let path = substituted(ctx, params, "path")?;
                (
                    format!("{DROPBOX_BASE}/files/delete_v2"),
                    json!({ "path": path }),
                )
            }
            "move" => {
                let from_path = substituted(ctx, params, "fromPath")?;
                let to_path = substituted(ctx, params, "toPath")?;
                (
                    format!("{DROPBOX_BASE}/files/move_v2"),
                    json!({ "from_path": from_path, "to_path": to_path }),
                )
            }
            "copy" => {
                let from_path = substituted(ctx, params, "fromPath")?;
                let to_path = substituted(ctx, params, "toPath")?;
                (
                    format!("{DROPBOX_BASE}/files/copy_v2"),
                    json!({ "from_path": from_path, "to_path": to_path }),
                )
            }
            "search" => {
                let query = substituted(ctx, params, "query")?;
                let mut options = serde_json::Map::new();
                if let Some(max) = ctx.param_f64(params, "maxResults") {
                    options.insert("max_results".into(), json!(max as i64));
                }
                let body = if options.is_empty() {
                    json!({ "query": query })
                } else {
                    json!({ "query": query, "options": Value::Object(options) })
                };
                (format!("{DROPBOX_BASE}/files/search_v2"), body)
            }
            "getSharedLink" => {
                let path = substituted(ctx, params, "path")?;
                (
                    format!("{DROPBOX_BASE}/sharing/create_shared_link_with_settings"),
                    json!({ "path": path }),
                )
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        let res = ctx
            .http
            .post(&url)
            .bearer_auth(&token)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
    }
}

/// Read a string parameter and run `{{var}}` substitution on it.
fn substituted(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let raw = ctx.param_str(params, key)?;
    Ok(ctx.substitute(&raw))
}

/// Parse the response body as JSON and return an `UpstreamError` for non-2xx.
async fn json_or_err(res: reqwest::Response) -> NodeResult<Value> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    if text.is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str(&text).map_err(NodeError::from)
}
