//! Google Cloud Storage (GCS) node.
//!
//! Implements the JSON API for the most common object-storage operations:
//!   - bucket list / get / create / delete
//!   - object list / get-metadata / download / delete
//!   - object upload (simple `media` upload, request body is the bytes)
//!
//! Authentication: pre-refreshed OAuth2 bearer token at
//! `cred.data["accessToken"]` with the
//! `https://www.googleapis.com/auth/devstorage.full_control` scope.
//!
//! Object bodies are exchanged as base64-encoded strings in the JSON I/O
//! envelope to keep the node trait pure JSON.

use async_trait::async_trait;
use base64::Engine as _;
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

pub struct GoogleCloudStorageNode;

const STORAGE_BASE: &str = "https://storage.googleapis.com/storage/v1";
const UPLOAD_BASE: &str = "https://storage.googleapis.com/upload/storage/v1";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for GoogleCloudStorageNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "googleCloudStorage",
            "Google Cloud Storage",
            "Manage buckets and objects in Google Cloud Storage",
            NodeCategory::Storage,
        )
        .icon("hard-drive")
        .color("#4285F4")
        .credentials(vec![CredentialBinding {
            name: "googleCloudStorageOAuth2".into(),
            display_name: "Google Cloud Storage OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![opt("Bucket", "bucket"), opt("Object", "object")])
                .default(json!("object"))
                .required(),
            // ── Bucket operations ──────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                    opt("Delete", "delete"),
                ])
                .default(json!("list"))
                .show_when("resource", &["bucket"])
                .required(),
            NodeProperty::new("projectId", "Project ID", NodePropertyType::String)
                .placeholder("my-gcp-project")
                .show_when("operation", &["list", "create"])
                .description("GCP project (only required for bucket list / create)."),
            NodeProperty::new("bucketName", "Bucket Name", NodePropertyType::String)
                .placeholder("my-bucket")
                .show_when(
                    "operation",
                    &["get", "create", "delete", "listObjects", "upload", "download", "getObject", "deleteObject"],
                ),
            // ── Object operations ──────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "listObjects"),
                    opt("Get Metadata", "getObject"),
                    opt("Download", "download"),
                    opt("Upload", "upload"),
                    opt("Delete", "deleteObject"),
                ])
                .default(json!("listObjects"))
                .show_when("resource", &["object"])
                .required(),
            NodeProperty::new("objectName", "Object Name", NodePropertyType::String)
                .placeholder("path/to/file.png")
                .show_when(
                    "operation",
                    &["getObject", "download", "upload", "deleteObject"],
                ),
            NodeProperty::new("contentType", "Content-Type", NodePropertyType::String)
                .default(json!("application/octet-stream"))
                .show_when("operation", &["upload"]),
            NodeProperty::new("dataBase64", "File Data (base64)", NodePropertyType::String)
                .placeholder("aGVsbG8=")
                .description("Base64-encoded payload to upload.")
                .show_when("operation", &["upload"]),
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

        let resource = ctx.param_str(params, "resource")?;
        let operation = ctx.param_str(params, "operation")?;

        match (resource.as_str(), operation.as_str()) {
            // ── Buckets ────────────────────────────────────────────────────
            ("bucket", "list") => {
                let project_id = ctx.param_str(params, "projectId")?;
                let url = format!(
                    "{STORAGE_BASE}/b?project={}",
                    urlencoding::encode(&project_id)
                );
                get_json(ctx, &token, &url).await
            }
            ("bucket", "get") => {
                let bucket = ctx.param_str(params, "bucketName")?;
                let url = format!("{STORAGE_BASE}/b/{}", urlencoding::encode(&bucket));
                get_json(ctx, &token, &url).await
            }
            ("bucket", "create") => {
                let project_id = ctx.param_str(params, "projectId")?;
                let bucket = ctx.param_str(params, "bucketName")?;
                let url = format!(
                    "{STORAGE_BASE}/b?project={}",
                    urlencoding::encode(&project_id)
                );
                let payload = json!({ "name": bucket });
                post_json(ctx, &token, &url, payload).await
            }
            ("bucket", "delete") => {
                let bucket = ctx.param_str(params, "bucketName")?;
                let url = format!("{STORAGE_BASE}/b/{}", urlencoding::encode(&bucket));
                delete_request(ctx, &token, &url).await
            }
            // ── Objects ────────────────────────────────────────────────────
            ("object", "listObjects") => {
                let bucket = ctx.param_str(params, "bucketName")?;
                let url = format!(
                    "{STORAGE_BASE}/b/{}/o",
                    urlencoding::encode(&bucket)
                );
                get_json(ctx, &token, &url).await
            }
            ("object", "getObject") => {
                let bucket = ctx.param_str(params, "bucketName")?;
                let object = ctx.param_str(params, "objectName")?;
                let url = format!(
                    "{STORAGE_BASE}/b/{}/o/{}",
                    urlencoding::encode(&bucket),
                    urlencoding::encode(&object)
                );
                get_json(ctx, &token, &url).await
            }
            ("object", "download") => {
                let bucket = ctx.param_str(params, "bucketName")?;
                let object = ctx.param_str(params, "objectName")?;
                let url = format!(
                    "{STORAGE_BASE}/b/{}/o/{}?alt=media",
                    urlencoding::encode(&bucket),
                    urlencoding::encode(&object)
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                let status = res.status();
                let content_type = res
                    .headers()
                    .get(reqwest::header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("application/octet-stream")
                    .to_string();
                let bytes = res.bytes().await?;
                if !status.is_success() {
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body: String::from_utf8_lossy(&bytes).into_owned(),
                    });
                }
                let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
                Ok(NodeOutput::single(vec![json!({
                    "name": object,
                    "bucket": bucket,
                    "contentType": content_type,
                    "size": bytes.len(),
                    "dataBase64": encoded,
                })]))
            }
            ("object", "upload") => {
                let bucket = ctx.param_str(params, "bucketName")?;
                let object = ctx.param_str(params, "objectName")?;
                let content_type = ctx
                    .param_str_opt(params, "contentType")
                    .unwrap_or_else(|| "application/octet-stream".to_string());
                let data_b64 = ctx.param_str(params, "dataBase64")?;
                let bytes = base64::engine::general_purpose::STANDARD
                    .decode(data_b64.trim())
                    .map_err(|e| NodeError::InvalidParameter {
                        name: "dataBase64".into(),
                        reason: format!("invalid base64: {e}"),
                    })?;
                let url = format!(
                    "{UPLOAD_BASE}/b/{}/o?uploadType=media&name={}",
                    urlencoding::encode(&bucket),
                    urlencoding::encode(&object)
                );
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .header(reqwest::header::CONTENT_TYPE, content_type)
                    .body(bytes)
                    .send()
                    .await?;
                emit(res).await
            }
            ("object", "deleteObject") => {
                let bucket = ctx.param_str(params, "bucketName")?;
                let object = ctx.param_str(params, "objectName")?;
                let url = format!(
                    "{STORAGE_BASE}/b/{}/o/{}",
                    urlencoding::encode(&bucket),
                    urlencoding::encode(&object)
                );
                delete_request(ctx, &token, &url).await
            }
            (res, op) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported GCS operation: {res}/{op}"),
            }),
        }
    }
}

async fn get_json(ctx: &ExecutionContext, token: &str, url: &str) -> NodeResult<NodeOutput> {
    emit(ctx.http.get(url).bearer_auth(token).send().await?).await
}

async fn post_json(
    ctx: &ExecutionContext,
    token: &str,
    url: &str,
    payload: Value,
) -> NodeResult<NodeOutput> {
    emit(
        ctx.http
            .post(url)
            .bearer_auth(token)
            .json(&payload)
            .send()
            .await?,
    )
    .await
}

async fn delete_request(
    ctx: &ExecutionContext,
    token: &str,
    url: &str,
) -> NodeResult<NodeOutput> {
    let res = ctx.http.delete(url).bearer_auth(token).send().await?;
    let status = res.status();
    if !status.is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    Ok(NodeOutput::single(vec![json!({ "deleted": true })]))
}

async fn emit(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let body: Value =
        serde_json::from_str(&text).unwrap_or_else(|_| json!({ "body": text.clone() }));
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(NodeOutput::single(vec![body]))
}
