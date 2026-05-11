//! S3 node — S3-compatible object storage.
//!
//! Uses `aws-sdk-s3` under the hood so this works against AWS, MinIO,
//! Cloudflare R2, DigitalOcean Spaces, Backblaze B2, Wasabi, or any other
//! S3-compatible endpoint.
//!
//! Credential: `s3Api` with fields:
//!   - `accessKeyId`     — required
//!   - `secretAccessKey` — required
//!   - `region`          — required (e.g. `us-east-1`; use `auto` for R2)
//!   - `endpoint`        — optional, defaults to `https://s3.{region}.amazonaws.com`

use std::time::Duration;

use async_trait::async_trait;
use aws_config::{BehaviorVersion, Region};
use aws_credential_types::Credentials;
use aws_sdk_s3::{
    Client,
    config::Builder as S3ConfigBuilder,
    presigning::PresigningConfig,
    primitives::ByteStream,
};
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use serde_json::{Value, json};

use crate::{
    context::{Credential, ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct S3Node;

#[async_trait]
impl Node for S3Node {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "s3",
            "S3",
            "S3-compatible object storage",
            NodeCategory::Storage,
        )
        .icon("hard-drive")
        .color("#FF9900")
        .credentials(vec![CredentialBinding {
            name: "s3Api".into(),
            display_name: "S3 API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "List Buckets".into(),
                        value: json!("listBuckets"),
                        description: Some("List all buckets owned by the account".into()),
                    },
                    NodePropertyOption {
                        name: "Create Bucket".into(),
                        value: json!("createBucket"),
                        description: Some("Create a new bucket".into()),
                    },
                    NodePropertyOption {
                        name: "Delete Bucket".into(),
                        value: json!("deleteBucket"),
                        description: Some("Delete an empty bucket".into()),
                    },
                    NodePropertyOption {
                        name: "List Objects".into(),
                        value: json!("listObjects"),
                        description: Some("List objects under an optional prefix".into()),
                    },
                    NodePropertyOption {
                        name: "Get Object".into(),
                        value: json!("getObject"),
                        description: Some("Download an object (returned as base64)".into()),
                    },
                    NodePropertyOption {
                        name: "Put Object".into(),
                        value: json!("putObject"),
                        description: Some("Upload an object (raw string or base64 body)".into()),
                    },
                    NodePropertyOption {
                        name: "Delete Object".into(),
                        value: json!("deleteObject"),
                        description: Some("Delete a single object".into()),
                    },
                    NodePropertyOption {
                        name: "Copy Object".into(),
                        value: json!("copyObject"),
                        description: Some("Copy one object to another key/bucket".into()),
                    },
                    NodePropertyOption {
                        name: "Get Presigned URL".into(),
                        value: json!("getPresignedUrl"),
                        description: Some("Generate a time-limited presigned GET URL".into()),
                    },
                ])
                .default(json!("listObjects"))
                .required(),
            // Bucket — used by most ops.
            NodeProperty::new("bucket", "Bucket", NodePropertyType::String)
                .placeholder("my-bucket")
                .show_when(
                    "operation",
                    &[
                        "createBucket",
                        "deleteBucket",
                        "listObjects",
                        "getObject",
                        "putObject",
                        "deleteObject",
                        "getPresignedUrl",
                    ],
                )
                .required(),
            NodeProperty::new("prefix", "Prefix", NodePropertyType::String)
                .placeholder("folder/")
                .description("Restrict results to keys starting with this prefix")
                .show_when("operation", &["listObjects"]),
            NodeProperty::new("key", "Key", NodePropertyType::String)
                .placeholder("path/to/object.txt")
                .show_when(
                    "operation",
                    &["getObject", "putObject", "deleteObject", "getPresignedUrl"],
                )
                .required(),
            NodeProperty::new("body", "Body", NodePropertyType::String)
                .placeholder("file contents or base64-encoded bytes")
                .description(
                    "Object body. Treated as base64 when `bodyIsBase64` is true, otherwise raw text.",
                )
                .show_when("operation", &["putObject"])
                .required(),
            NodeProperty::new("bodyIsBase64", "Body Is Base64", NodePropertyType::Boolean)
                .description("When enabled, decode the body as base64 before upload")
                .default(json!(false))
                .show_when("operation", &["putObject"]),
            NodeProperty::new("contentType", "Content Type", NodePropertyType::String)
                .placeholder("application/octet-stream")
                .show_when("operation", &["putObject"]),
            // Copy
            NodeProperty::new("sourceBucket", "Source Bucket", NodePropertyType::String)
                .show_when("operation", &["copyObject"])
                .required(),
            NodeProperty::new("sourceKey", "Source Key", NodePropertyType::String)
                .show_when("operation", &["copyObject"])
                .required(),
            NodeProperty::new("destBucket", "Destination Bucket", NodePropertyType::String)
                .show_when("operation", &["copyObject"])
                .required(),
            NodeProperty::new("destKey", "Destination Key", NodePropertyType::String)
                .show_when("operation", &["copyObject"])
                .required(),
            // Presign
            NodeProperty::new("expiresIn", "Expires In (seconds)", NodePropertyType::Number)
                .description("Presigned URL TTL in seconds (default 3600)")
                .default(json!(3600))
                .show_when("operation", &["getPresignedUrl"]),
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
        let client = build_client(cred).await?;

        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "listBuckets" => {
                let out = client
                    .list_buckets()
                    .send()
                    .await
                    .map_err(s3_err)?;
                let buckets: Vec<Value> = out
                    .buckets()
                    .iter()
                    .map(|b| {
                        json!({
                            "name": b.name(),
                            "creationDate": b.creation_date().map(|d| d.to_string()),
                        })
                    })
                    .collect();
                Ok(NodeOutput::single(vec![json!({ "buckets": buckets })]))
            }
            "createBucket" => {
                let bucket = substituted(ctx, params, "bucket")?;
                client
                    .create_bucket()
                    .bucket(&bucket)
                    .send()
                    .await
                    .map_err(s3_err)?;
                Ok(NodeOutput::single(vec![json!({
                    "bucket": bucket,
                    "created": true
                })]))
            }
            "deleteBucket" => {
                let bucket = substituted(ctx, params, "bucket")?;
                client
                    .delete_bucket()
                    .bucket(&bucket)
                    .send()
                    .await
                    .map_err(s3_err)?;
                Ok(NodeOutput::single(vec![json!({
                    "bucket": bucket,
                    "deleted": true
                })]))
            }
            "listObjects" => {
                let bucket = substituted(ctx, params, "bucket")?;
                let mut req = client.list_objects_v2().bucket(&bucket);
                if let Some(prefix) = ctx.param_str_opt(params, "prefix") {
                    if !prefix.is_empty() {
                        req = req.prefix(prefix);
                    }
                }
                let out = req.send().await.map_err(s3_err)?;
                let objects: Vec<Value> = out
                    .contents()
                    .iter()
                    .map(|o| {
                        json!({
                            "key": o.key(),
                            "size": o.size(),
                            "lastModified": o.last_modified().map(|d| d.to_string()),
                            "eTag": o.e_tag(),
                            "storageClass": o.storage_class().map(|s| s.as_str().to_string()),
                        })
                    })
                    .collect();
                Ok(NodeOutput::single(vec![json!({
                    "bucket": bucket,
                    "keyCount": out.key_count().unwrap_or(0),
                    "isTruncated": out.is_truncated().unwrap_or(false),
                    "objects": objects,
                })]))
            }
            "getObject" => {
                let bucket = substituted(ctx, params, "bucket")?;
                let key = substituted(ctx, params, "key")?;
                let out = client
                    .get_object()
                    .bucket(&bucket)
                    .key(&key)
                    .send()
                    .await
                    .map_err(s3_err)?;
                let content_type = out.content_type().map(|s| s.to_string());
                let content_length = out.content_length();
                let e_tag = out.e_tag().map(|s| s.to_string());
                let bytes = out
                    .body
                    .collect()
                    .await
                    .map_err(|e| NodeError::Other(format!("S3: {e}")))?
                    .into_bytes();
                let body_b64 = B64.encode(&bytes);
                Ok(NodeOutput::single(vec![json!({
                    "bucket": bucket,
                    "key": key,
                    "contentType": content_type,
                    "contentLength": content_length,
                    "eTag": e_tag,
                    "bodyBase64": body_b64,
                })]))
            }
            "putObject" => {
                let bucket = substituted(ctx, params, "bucket")?;
                let key = substituted(ctx, params, "key")?;
                let body_raw = substituted(ctx, params, "body")?;
                let is_b64 = ctx.param_bool(params, "bodyIsBase64", false);
                let bytes = if is_b64 {
                    B64.decode(body_raw.as_bytes()).map_err(|e| {
                        NodeError::InvalidParameter {
                            name: "body".into(),
                            reason: format!("invalid base64: {e}"),
                        }
                    })?
                } else {
                    body_raw.into_bytes()
                };
                let size = bytes.len();
                let mut req = client
                    .put_object()
                    .bucket(&bucket)
                    .key(&key)
                    .body(ByteStream::from(bytes));
                if let Some(ct) = ctx.param_str_opt(params, "contentType") {
                    if !ct.is_empty() {
                        req = req.content_type(ct);
                    }
                }
                let out = req.send().await.map_err(s3_err)?;
                Ok(NodeOutput::single(vec![json!({
                    "bucket": bucket,
                    "key": key,
                    "size": size,
                    "eTag": out.e_tag(),
                    "versionId": out.version_id(),
                })]))
            }
            "deleteObject" => {
                let bucket = substituted(ctx, params, "bucket")?;
                let key = substituted(ctx, params, "key")?;
                client
                    .delete_object()
                    .bucket(&bucket)
                    .key(&key)
                    .send()
                    .await
                    .map_err(s3_err)?;
                Ok(NodeOutput::single(vec![json!({
                    "bucket": bucket,
                    "key": key,
                    "deleted": true,
                })]))
            }
            "copyObject" => {
                let source_bucket = substituted(ctx, params, "sourceBucket")?;
                let source_key = substituted(ctx, params, "sourceKey")?;
                let dest_bucket = substituted(ctx, params, "destBucket")?;
                let dest_key = substituted(ctx, params, "destKey")?;
                // CopySource expects "<bucket>/<key>" (key may contain slashes).
                let copy_source = format!("{source_bucket}/{source_key}");
                let out = client
                    .copy_object()
                    .copy_source(&copy_source)
                    .bucket(&dest_bucket)
                    .key(&dest_key)
                    .send()
                    .await
                    .map_err(s3_err)?;
                let copy_result = out.copy_object_result();
                Ok(NodeOutput::single(vec![json!({
                    "sourceBucket": source_bucket,
                    "sourceKey": source_key,
                    "destBucket": dest_bucket,
                    "destKey": dest_key,
                    "eTag": copy_result.and_then(|r| r.e_tag()),
                    "lastModified": copy_result
                        .and_then(|r| r.last_modified())
                        .map(|d| d.to_string()),
                })]))
            }
            "getPresignedUrl" => {
                let bucket = substituted(ctx, params, "bucket")?;
                let key = substituted(ctx, params, "key")?;
                let expires_in_secs = ctx
                    .param_f64(params, "expiresIn")
                    .map(|n| n as u64)
                    .unwrap_or(3600);
                let presigning_cfg =
                    PresigningConfig::expires_in(Duration::from_secs(expires_in_secs))
                        .map_err(|e| NodeError::InvalidParameter {
                            name: "expiresIn".into(),
                            reason: format!("{e}"),
                        })?;
                let presigned = client
                    .get_object()
                    .bucket(&bucket)
                    .key(&key)
                    .presigned(presigning_cfg)
                    .await
                    .map_err(s3_err)?;
                Ok(NodeOutput::single(vec![json!({
                    "bucket": bucket,
                    "key": key,
                    "url": presigned.uri().to_string(),
                    "expiresIn": expires_in_secs,
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

/// Build an S3 client from a credential. Endpoint defaults to the standard
/// AWS pattern when not provided, enabling 1-credential support for any
/// S3-compatible service.
async fn build_client(cred: &Credential) -> NodeResult<Client> {
    let access_key_id = cred
        .data
        .get("accessKeyId")
        .ok_or_else(|| NodeError::MissingParameter("accessKeyId".into()))?
        .clone();
    let secret_access_key = cred
        .data
        .get("secretAccessKey")
        .ok_or_else(|| NodeError::MissingParameter("secretAccessKey".into()))?
        .clone();
    let region = cred
        .data
        .get("region")
        .ok_or_else(|| NodeError::MissingParameter("region".into()))?
        .clone();
    let endpoint = cred
        .data
        .get("endpoint")
        .filter(|s| !s.is_empty())
        .cloned()
        .unwrap_or_else(|| format!("https://s3.{region}.amazonaws.com"));

    let creds = Credentials::new(
        access_key_id,
        secret_access_key,
        None,
        None,
        "sabflow-s3-node",
    );

    let shared = aws_config::defaults(BehaviorVersion::latest())
        .region(Region::new(region))
        .credentials_provider(creds)
        .load()
        .await;

    let s3_cfg = S3ConfigBuilder::from(&shared)
        .endpoint_url(endpoint)
        .force_path_style(true)
        .build();

    Ok(Client::from_conf(s3_cfg))
}

/// Map any SDK service error to `NodeError::Other("S3: ...")`.
fn s3_err<E: std::fmt::Display>(e: E) -> NodeError {
    NodeError::Other(format!("S3: {e}"))
}
