//! Microsoft OneDrive node — files and folders via Microsoft Graph v1.0.
//!
//! Endpoint base: <https://graph.microsoft.com/v1.0>
//! Auth: `microsoftOAuth2Api` credential (Bearer accessToken).
//!
//! Resources / operations implemented:
//!   - file.upload    PUT  `/me/drive/root:/{path}:/content` (base64-encoded body)
//!   - file.get       GET  `/me/drive/items/{id}`
//!   - file.list      GET  `/me/drive/root/children`
//!   - file.delete    DELETE `/me/drive/items/{id}`
//!   - folder.create  POST `/me/drive/items/{parent-id}/children`
//!   - folder.list    GET  `/me/drive/items/{parent-id}/children`

use async_trait::async_trait;
use base64::Engine;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
    nodes::microsoft_outlook::{emit, emit_or_ack, ms_bearer_token, urlencode_path},
};

const GRAPH_BASE: &str = "https://graph.microsoft.com/v1.0";

pub struct MicrosoftOneDriveNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MicrosoftOneDriveNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "microsoftOneDrive",
            "Microsoft OneDrive",
            "Upload, download, and manage OneDrive files",
            NodeCategory::Storage,
        )
        .icon("cloud")
        .color("#0364B8")
        .credentials(vec![CredentialBinding {
            name: "microsoftOAuth2Api".into(),
            display_name: "Microsoft OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![opt("File", "file"), opt("Folder", "folder")])
                .default(json!("file"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Upload", "upload"),
                    opt("Get", "get"),
                    opt("List", "list"),
                    opt("Delete", "delete"),
                    opt("Create", "create"),
                ])
                .default(json!("upload"))
                .required(),
            NodeProperty::new("path", "Path (incl. filename)", NodePropertyType::String)
                .placeholder("reports/2026/q2.pdf")
                .show_when("operation", &["upload"]),
            NodeProperty::new(
                "fileContentBase64",
                "File Content (base64)",
                NodePropertyType::String,
            )
            .show_when("operation", &["upload"]),
            NodeProperty::new("itemId", "Item ID", NodePropertyType::String)
                .show_when("operation", &["get", "delete"]),
            NodeProperty::new("parentId", "Parent Folder ID", NodePropertyType::String)
                .default(json!("root"))
                .description("Defaults to 'root' if omitted"),
            NodeProperty::new("folderName", "Folder Name", NodePropertyType::String)
                .show_when("operation", &["create"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let token = ms_bearer_token(ctx, params)?;
        let resource = ctx.param_str(params, "resource")?;
        let operation = ctx.param_str(params, "operation")?;

        match (resource.as_str(), operation.as_str()) {
            ("file", "upload") => {
                let path = ctx.param_str(params, "path")?;
                let body_b64 = ctx.param_str(params, "fileContentBase64")?;
                let bytes = base64::engine::general_purpose::STANDARD
                    .decode(body_b64.as_bytes())
                    .map_err(|e| NodeError::InvalidParameter {
                        name: "fileContentBase64".into(),
                        reason: format!("invalid base64: {e}"),
                    })?;
                // OneDrive path-relative upload: encode segments individually.
                let encoded_path = path
                    .split('/')
                    .map(urlencode_path)
                    .collect::<Vec<_>>()
                    .join("/");
                let url = format!(
                    "{GRAPH_BASE}/me/drive/root:/{encoded_path}:/content"
                );
                let res = ctx
                    .http
                    .put(&url)
                    .bearer_auth(&token)
                    .header(
                        reqwest::header::CONTENT_TYPE,
                        "application/octet-stream",
                    )
                    .body(bytes)
                    .send()
                    .await?;
                emit(res).await
            }
            ("file", "get") => {
                let id = ctx.param_str(params, "itemId")?;
                let url =
                    format!("{GRAPH_BASE}/me/drive/items/{}", urlencode_path(&id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("file", "list") => {
                let parent = ctx
                    .param_str_opt(params, "parentId")
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "root".to_string());
                let url = if parent == "root" {
                    format!("{GRAPH_BASE}/me/drive/root/children")
                } else {
                    format!(
                        "{GRAPH_BASE}/me/drive/items/{}/children",
                        urlencode_path(&parent)
                    )
                };
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("file", "delete") => {
                let id = ctx.param_str(params, "itemId")?;
                let url =
                    format!("{GRAPH_BASE}/me/drive/items/{}", urlencode_path(&id));
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                emit_or_ack(res, json!({ "deleted": true, "id": id })).await
            }
            ("folder", "create") => {
                let parent = ctx
                    .param_str_opt(params, "parentId")
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "root".to_string());
                let folder_name = ctx.param_str(params, "folderName")?;
                let url = if parent == "root" {
                    format!("{GRAPH_BASE}/me/drive/root/children")
                } else {
                    format!(
                        "{GRAPH_BASE}/me/drive/items/{}/children",
                        urlencode_path(&parent)
                    )
                };
                let payload = json!({
                    "name": folder_name,
                    "folder": {},
                    "@microsoft.graph.conflictBehavior": "rename",
                });
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&payload)
                    .send()
                    .await?;
                emit(res).await
            }
            ("folder", "list") => {
                let parent = ctx
                    .param_str_opt(params, "parentId")
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "root".to_string());
                let url = if parent == "root" {
                    format!("{GRAPH_BASE}/me/drive/root/children")
                } else {
                    format!(
                        "{GRAPH_BASE}/me/drive/items/{}/children",
                        urlencode_path(&parent)
                    )
                };
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            (r, o) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported resource/operation combination: {r}/{o}"),
            }),
        }
    }
}
