//! Figma node — Figma REST API (`https://api.figma.com/v1`).
//!
//! Auth: a personal access token from *Figma → Settings → Personal access
//! tokens*, sent in the `X-Figma-Token` header.  The linked credential's
//! `data["accessToken"]` holds the secret.
//!
//! Supported operations:
//!   - `file.get`              → fetch a full file document
//!   - `file.nodes`            → fetch specific nodes from a file
//!   - `file.images`           → render PNG/SVG/PDF for nodes
//!   - `file.comments`         → list comments on a file
//!   - `file.comment.post`     → add a comment to a file
//!   - `me`                    → authenticated user info
//!   - `team.projects`         → projects in a team
//!   - `project.files`         → files in a project

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

const FIGMA_BASE: &str = "https://api.figma.com/v1";

pub struct FigmaNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for FigmaNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new("figma", "Figma", "Figma design files", NodeCategory::Productivity)
            .icon("figma")
            .color("#A259FF")
            .credentials(vec![CredentialBinding {
                name: "figmaApi".into(),
                display_name: "Figma Access Token".into(),
                required: true,
            }])
            .properties(vec![
                NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                    .required(),
                NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                    .options(vec![
                        opt("Get File", "file.get"),
                        opt("Get File Nodes", "file.nodes"),
                        opt("Render Images", "file.images"),
                        opt("List Comments", "file.comments"),
                        opt("Post Comment", "file.comment.post"),
                        opt("Get Authenticated User", "me"),
                        opt("List Team Projects", "team.projects"),
                        opt("List Project Files", "project.files"),
                    ])
                    .default(json!("file.get"))
                    .required(),
                NodeProperty::new("fileKey", "File Key", NodePropertyType::String)
                    .placeholder("4mO2WhA1XO5pZUJG2gXz")
                    .show_when(
                        "operation",
                        &[
                            "file.get",
                            "file.nodes",
                            "file.images",
                            "file.comments",
                            "file.comment.post",
                        ],
                    ),
                NodeProperty::new("nodeIds", "Node IDs", NodePropertyType::String)
                    .show_when("operation", &["file.nodes", "file.images"])
                    .description("Comma-separated Figma node ids (e.g. `0:1,12:34`)"),
                NodeProperty::new("format", "Image Format", NodePropertyType::Options)
                    .options(vec![
                        opt("PNG", "png"),
                        opt("JPG", "jpg"),
                        opt("SVG", "svg"),
                        opt("PDF", "pdf"),
                    ])
                    .default(json!("png"))
                    .show_when("operation", &["file.images"]),
                NodeProperty::new("scale", "Scale", NodePropertyType::Number)
                    .default(json!(1))
                    .show_when("operation", &["file.images"]),
                NodeProperty::new("message", "Message", NodePropertyType::String)
                    .show_when("operation", &["file.comment.post"]),
                NodeProperty::new("teamId", "Team ID", NodePropertyType::String)
                    .show_when("operation", &["team.projects"]),
                NodeProperty::new("projectId", "Project ID", NodePropertyType::String)
                    .show_when("operation", &["project.files"]),
            ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let token = ctx
            .credential(&cred_id)?
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "me" => {
                let url = format!("{FIGMA_BASE}/me");
                let res = ctx.http.get(&url).header("X-Figma-Token", &token).send().await?;
                wrap(res).await
            }
            "file.get" => {
                let key = sub(ctx, params, "fileKey")?;
                let url = format!("{FIGMA_BASE}/files/{}", urlencoding::encode(&key));
                let res = ctx.http.get(&url).header("X-Figma-Token", &token).send().await?;
                wrap(res).await
            }
            "file.nodes" => {
                let key = sub(ctx, params, "fileKey")?;
                let ids = sub(ctx, params, "nodeIds")?;
                let url = format!("{FIGMA_BASE}/files/{}/nodes", urlencoding::encode(&key));
                let res = ctx
                    .http
                    .get(&url)
                    .header("X-Figma-Token", &token)
                    .query(&[("ids", ids.as_str())])
                    .send()
                    .await?;
                wrap(res).await
            }
            "file.images" => {
                let key = sub(ctx, params, "fileKey")?;
                let ids = sub(ctx, params, "nodeIds")?;
                let format = ctx
                    .param_str_opt(params, "format")
                    .unwrap_or_else(|| "png".into());
                let scale = ctx.param_f64(params, "scale").unwrap_or(1.0);
                let url = format!("{FIGMA_BASE}/images/{}", urlencoding::encode(&key));
                let res = ctx
                    .http
                    .get(&url)
                    .header("X-Figma-Token", &token)
                    .query(&[
                        ("ids", ids.as_str()),
                        ("format", format.as_str()),
                        ("scale", &format!("{scale}")),
                    ])
                    .send()
                    .await?;
                wrap(res).await
            }
            "file.comments" => {
                let key = sub(ctx, params, "fileKey")?;
                let url = format!(
                    "{FIGMA_BASE}/files/{}/comments",
                    urlencoding::encode(&key)
                );
                let res = ctx.http.get(&url).header("X-Figma-Token", &token).send().await?;
                wrap(res).await
            }
            "file.comment.post" => {
                let key = sub(ctx, params, "fileKey")?;
                let message = sub(ctx, params, "message")?;
                let url = format!(
                    "{FIGMA_BASE}/files/{}/comments",
                    urlencoding::encode(&key)
                );
                let mut body = Map::new();
                body.insert("message".into(), json!(message));
                let res = ctx
                    .http
                    .post(&url)
                    .header("X-Figma-Token", &token)
                    .json(&Value::Object(body))
                    .send()
                    .await?;
                wrap(res).await
            }
            "team.projects" => {
                let team = sub(ctx, params, "teamId")?;
                let url = format!(
                    "{FIGMA_BASE}/teams/{}/projects",
                    urlencoding::encode(&team)
                );
                let res = ctx.http.get(&url).header("X-Figma-Token", &token).send().await?;
                wrap(res).await
            }
            "project.files" => {
                let project = sub(ctx, params, "projectId")?;
                let url = format!(
                    "{FIGMA_BASE}/projects/{}/files",
                    urlencoding::encode(&project)
                );
                let res = ctx.http.get(&url).header("X-Figma-Token", &token).send().await?;
                wrap(res).await
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

fn sub(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let raw = ctx.param_str(params, key)?;
    let v = ctx.substitute(&raw);
    if v.trim().is_empty() {
        return Err(NodeError::MissingParameter(key.to_string()));
    }
    Ok(v)
}

async fn wrap(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    let value: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text))
    };
    Ok(NodeOutput::single(vec![value]))
}
