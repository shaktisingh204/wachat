//! Box node.
//!
//! Implements file/folder operations against the Box Content API v2.0.
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

const BOX_BASE: &str = "https://api.box.com/2.0";

pub struct BoxNode;

#[async_trait]
impl Node for BoxNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "box",
            "Box",
            "Box cloud content management",
            NodeCategory::Storage,
        )
        .icon("box")
        .color("#0061D5")
        .credentials(vec![CredentialBinding {
            name: "boxOAuth2".into(),
            display_name: "Box OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Get Folder".into(),
                        value: json!("getFolder"),
                        description: Some("Get folder metadata (use \"0\" for root)".into()),
                    },
                    NodePropertyOption {
                        name: "List Folder Items".into(),
                        value: json!("listFolderItems"),
                        description: Some("List items in a folder".into()),
                    },
                    NodePropertyOption {
                        name: "Create Folder".into(),
                        value: json!("createFolder"),
                        description: Some("Create a new folder under a parent".into()),
                    },
                    NodePropertyOption {
                        name: "Delete Folder".into(),
                        value: json!("deleteFolder"),
                        description: Some("Delete a folder".into()),
                    },
                    NodePropertyOption {
                        name: "Get File".into(),
                        value: json!("getFile"),
                        description: Some("Get file metadata".into()),
                    },
                    NodePropertyOption {
                        name: "Delete File".into(),
                        value: json!("deleteFile"),
                        description: Some("Delete a file".into()),
                    },
                    NodePropertyOption {
                        name: "Search".into(),
                        value: json!("search"),
                        description: Some("Search across files and folders".into()),
                    },
                    NodePropertyOption {
                        name: "Create Shared Link".into(),
                        value: json!("createSharedLink"),
                        description: Some("Create a shared link for a file".into()),
                    },
                ])
                .default(json!("getFolder"))
                .required(),
            NodeProperty::new("folderId", "Folder ID", NodePropertyType::String)
                .placeholder("0")
                .description("Folder ID. Use \"0\" for the root folder.")
                .show_when(
                    "operation",
                    &["getFolder", "listFolderItems", "deleteFolder"],
                )
                .required(),
            NodeProperty::new("parentId", "Parent Folder ID", NodePropertyType::String)
                .placeholder("0")
                .description("Parent folder ID. Use \"0\" for the root folder.")
                .show_when("operation", &["createFolder"])
                .required(),
            NodeProperty::new("name", "Folder Name", NodePropertyType::String)
                .placeholder("New Folder")
                .show_when("operation", &["createFolder"])
                .required(),
            NodeProperty::new("fileId", "File ID", NodePropertyType::String)
                .placeholder("123456789")
                .show_when("operation", &["getFile", "deleteFile", "createSharedLink"])
                .required(),
            NodeProperty::new("query", "Query", NodePropertyType::String)
                .placeholder("quarterly report")
                .show_when("operation", &["search"])
                .required(),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .description("Maximum number of search results to return")
                .default(json!(30))
                .show_when("operation", &["search"]),
            NodeProperty::new("access", "Access Level", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Open (anyone with the link)".into(),
                        value: json!("open"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Company".into(),
                        value: json!("company"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Collaborators only".into(),
                        value: json!("collaborators"),
                        description: None,
                    },
                ])
                .default(json!("open"))
                .show_when("operation", &["createSharedLink"])
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
        let token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        let res = match operation.as_str() {
            "getFolder" => {
                let folder_id = substituted(ctx, params, "folderId")?;
                let url = format!("{BOX_BASE}/folders/{}", encode_path(&folder_id));
                ctx.http.get(&url).bearer_auth(&token).send().await?
            }
            "listFolderItems" => {
                let folder_id = substituted(ctx, params, "folderId")?;
                let url = format!("{BOX_BASE}/folders/{}/items", encode_path(&folder_id));
                ctx.http.get(&url).bearer_auth(&token).send().await?
            }
            "createFolder" => {
                let parent_id = substituted(ctx, params, "parentId")?;
                let name = substituted(ctx, params, "name")?;
                let url = format!("{BOX_BASE}/folders");
                let body = json!({ "name": name, "parent": { "id": parent_id } });
                ctx.http
                    .post(&url)
                    .bearer_auth(&token)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
                    .await?
            }
            "deleteFolder" => {
                let folder_id = substituted(ctx, params, "folderId")?;
                let url = format!("{BOX_BASE}/folders/{}", encode_path(&folder_id));
                ctx.http.delete(&url).bearer_auth(&token).send().await?
            }
            "getFile" => {
                let file_id = substituted(ctx, params, "fileId")?;
                let url = format!("{BOX_BASE}/files/{}", encode_path(&file_id));
                ctx.http.get(&url).bearer_auth(&token).send().await?
            }
            "deleteFile" => {
                let file_id = substituted(ctx, params, "fileId")?;
                let url = format!("{BOX_BASE}/files/{}", encode_path(&file_id));
                ctx.http.delete(&url).bearer_auth(&token).send().await?
            }
            "search" => {
                let query = substituted(ctx, params, "query")?;
                let mut q: Vec<(String, String)> = vec![("query".into(), query)];
                if let Some(limit) = ctx.param_f64(params, "limit") {
                    q.push(("limit".into(), (limit as i64).to_string()));
                }
                let url = format!("{BOX_BASE}/search");
                ctx.http
                    .get(&url)
                    .bearer_auth(&token)
                    .query(&q)
                    .send()
                    .await?
            }
            "createSharedLink" => {
                let file_id = substituted(ctx, params, "fileId")?;
                let access = substituted(ctx, params, "access")?;
                match access.as_str() {
                    "open" | "company" | "collaborators" => {}
                    other => {
                        return Err(NodeError::InvalidParameter {
                            name: "access".into(),
                            reason: format!(
                                "must be one of open|company|collaborators, got: {other}"
                            ),
                        });
                    }
                }
                let url = format!("{BOX_BASE}/files/{}", encode_path(&file_id));
                let body = json!({ "shared_link": { "access": access } });
                ctx.http
                    .put(&url)
                    .bearer_auth(&token)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
                    .await?
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
    }
}

/// Read a string parameter and run `{{var}}` substitution on it.
fn substituted(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let raw = ctx.param_str(params, key)?;
    Ok(ctx.substitute(&raw))
}

/// Percent-encode a single path segment.
fn encode_path(segment: &str) -> String {
    urlencoding::encode(segment).into_owned()
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
