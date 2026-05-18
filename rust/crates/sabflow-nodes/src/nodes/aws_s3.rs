//! AWS S3 node — `n8n-nodes-base.awsS3`.
//!
//! Sibling of the generic `s3` node but pinned to AWS. The generic `s3` node
//! supports any S3-compatible endpoint (MinIO / R2 / Spaces / Wasabi) via
//! `endpoint` and `force_path_style`. This `awsS3` variant intentionally
//! omits those knobs — credentials are an `awsApi` binding (accessKeyId /
//! secretAccessKey / region) and the SDK picks the right virtual-hosted
//! endpoint automatically.
//!
//! TODO(sabflow): once `crate::binary::BinaryStore` lands, swap object bodies
//! to stream into / out of the store instead of carrying base64 strings.

use std::time::Duration;

use async_trait::async_trait;
use aws_config::{BehaviorVersion, Region};
use aws_credential_types::Credentials;
use aws_sdk_s3::{Client, primitives::ByteStream, presigning::PresigningConfig};
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

pub struct AwsS3Node;

fn opt(name: &str, value: &str, description: Option<&str>) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: description.map(|s| s.to_string()),
    }
}

#[async_trait]
impl Node for AwsS3Node {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "awsS3",
            "AWS S3",
            "AWS S3 object storage (buckets, objects, presigned URLs)",
            NodeCategory::Storage,
        )
        .icon("hard-drive")
        .color("#FF9900")
        .credentials(vec![CredentialBinding {
            name: "awsApi".into(),
            display_name: "AWS API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List Buckets", "listBuckets", Some("List all buckets")),
                    opt("Create Bucket", "createBucket", Some("Create a new bucket")),
                    opt("Delete Bucket", "deleteBucket", Some("Delete an empty bucket")),
                    opt(
                        "List Objects",
                        "listObjects",
                        Some("List objects in a bucket"),
                    ),
                    opt("Get Object", "getObject", Some("Download an object")),
                    opt("Put Object", "putObject", Some("Upload an object")),
                    opt("Delete Object", "deleteObject", Some("Delete an object")),
                    opt("Copy Object", "copyObject", Some("Copy an object")),
                    opt(
                        "Get Presigned URL",
                        "getPresignedUrl",
                        Some("Generate a time-limited presigned GET URL"),
                    ),
                ])
                .default(json!("listObjects"))
                .required(),
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
            NodeProperty::new(
                "binaryPropertyName",
                "Binary Property Name",
                NodePropertyType::String,
            )
            .default(json!("data"))
            .description("Source binary key on the incoming item (for putObject)")
            .show_when("operation", &["putObject"]),
            NodeProperty::new("contentType", "Content Type", NodePropertyType::String)
                .placeholder("application/octet-stream")
                .show_when("operation", &["putObject"]),
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
            NodeProperty::new("expiresIn", "Expires In (seconds)", NodePropertyType::Number)
                .description("Presigned URL TTL in seconds (default 3600)")
                .default(json!(3600))
                .show_when("operation", &["getPresignedUrl"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let cred = ctx.credential(&cred_id)?;
        let client = build_aws_client(cred).await?;

        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "listBuckets" => {
                let out = client.list_buckets().send().await.map_err(aws_err)?;
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
                let bucket = ctx.param_str(params, "bucket")?;
                client
                    .create_bucket()
                    .bucket(&bucket)
                    .send()
                    .await
                    .map_err(aws_err)?;
                Ok(NodeOutput::single(vec![json!({
                    "bucket": bucket,
                    "created": true,
                })]))
            }
            "deleteBucket" => {
                let bucket = ctx.param_str(params, "bucket")?;
                client
                    .delete_bucket()
                    .bucket(&bucket)
                    .send()
                    .await
                    .map_err(aws_err)?;
                Ok(NodeOutput::single(vec![json!({
                    "bucket": bucket,
                    "deleted": true,
                })]))
            }
            "listObjects" => {
                let bucket = ctx.param_str(params, "bucket")?;
                let mut req = client.list_objects_v2().bucket(&bucket);
                if let Some(prefix) = ctx.param_str_opt(params, "prefix") {
                    if !prefix.is_empty() {
                        req = req.prefix(prefix);
                    }
                }
                let out = req.send().await.map_err(aws_err)?;
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
                let bucket = ctx.param_str(params, "bucket")?;
                let key = ctx.param_str(params, "key")?;
                let out = client
                    .get_object()
                    .bucket(&bucket)
                    .key(&key)
                    .send()
                    .await
                    .map_err(aws_err)?;
                let content_type = out.content_type().map(|s| s.to_string());
                let content_length = out.content_length();
                let e_tag = out.e_tag().map(|s| s.to_string());
                let bytes = out
                    .body
                    .collect()
                    .await
                    .map_err(|e| NodeError::Other(format!("awsS3: {e}")))?
                    .into_bytes();
                let body_b64 = B64.encode(&bytes);
                Ok(NodeOutput::single(vec![json!({
                    "bucket": bucket,
                    "key": key,
                    "contentType": content_type,
                    "contentLength": content_length,
                    "eTag": e_tag,
                    // TODO(sabflow): emit as `binary.<dataPropertyName>` BinaryDataRef.
                    "bodyBase64": body_b64,
                })]))
            }
            "putObject" => {
                let bucket = ctx.param_str(params, "bucket")?;
                let key = ctx.param_str(params, "key")?;
                let bin_prop = ctx
                    .param_str_opt(params, "binaryPropertyName")
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "data".to_string());
                // Pick up the bytes from the first item's binary slot.
                let first = input.items.first().cloned().unwrap_or(Value::Null);
                let data_b64 = first
                    .get("binary")
                    .and_then(|b| b.get(&bin_prop))
                    .and_then(|e| e.get("dataBase64"))
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| NodeError::InvalidParameter {
                        name: "binaryPropertyName".into(),
                        reason: format!(
                            "incoming item has no binary.{bin_prop}.dataBase64 to upload"
                        ),
                    })?
                    .to_string();
                let bytes = B64.decode(data_b64.as_bytes()).map_err(|e| {
                    NodeError::InvalidParameter {
                        name: "binaryPropertyName".into(),
                        reason: format!("binary entry is not valid base64: {e}"),
                    }
                })?;
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
                let out = req.send().await.map_err(aws_err)?;
                Ok(NodeOutput::single(vec![json!({
                    "bucket": bucket,
                    "key": key,
                    "size": size,
                    "eTag": out.e_tag(),
                    "versionId": out.version_id(),
                })]))
            }
            "deleteObject" => {
                let bucket = ctx.param_str(params, "bucket")?;
                let key = ctx.param_str(params, "key")?;
                client
                    .delete_object()
                    .bucket(&bucket)
                    .key(&key)
                    .send()
                    .await
                    .map_err(aws_err)?;
                Ok(NodeOutput::single(vec![json!({
                    "bucket": bucket,
                    "key": key,
                    "deleted": true,
                })]))
            }
            "copyObject" => {
                let source_bucket = ctx.param_str(params, "sourceBucket")?;
                let source_key = ctx.param_str(params, "sourceKey")?;
                let dest_bucket = ctx.param_str(params, "destBucket")?;
                let dest_key = ctx.param_str(params, "destKey")?;
                let copy_source = format!("{source_bucket}/{source_key}");
                let out = client
                    .copy_object()
                    .copy_source(&copy_source)
                    .bucket(&dest_bucket)
                    .key(&dest_key)
                    .send()
                    .await
                    .map_err(aws_err)?;
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
                let bucket = ctx.param_str(params, "bucket")?;
                let key = ctx.param_str(params, "key")?;
                let expires_in_secs = ctx
                    .param_f64(params, "expiresIn")
                    .map(|n| n as u64)
                    .unwrap_or(3600);
                let presigning_cfg =
                    PresigningConfig::expires_in(Duration::from_secs(expires_in_secs)).map_err(
                        |e| NodeError::InvalidParameter {
                            name: "expiresIn".into(),
                            reason: format!("{e}"),
                        },
                    )?;
                let presigned = client
                    .get_object()
                    .bucket(&bucket)
                    .key(&key)
                    .presigned(presigning_cfg)
                    .await
                    .map_err(aws_err)?;
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

/// Build an AWS-only S3 client. Endpoint is whatever the SDK selects for the
/// region; we do not expose an `endpoint` override here (the generic `s3`
/// node already covers S3-compatible third parties).
async fn build_aws_client(cred: &Credential) -> NodeResult<Client> {
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
        .cloned()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "us-east-1".to_string());

    let creds = Credentials::new(
        access_key_id,
        secret_access_key,
        None,
        None,
        "sabflow-aws-s3-node",
    );

    let shared = aws_config::defaults(BehaviorVersion::latest())
        .region(Region::new(region))
        .credentials_provider(creds)
        .load()
        .await;

    Ok(Client::new(&shared))
}

fn aws_err<E: std::fmt::Display>(e: E) -> NodeError {
    NodeError::Other(format!("awsS3: {e}"))
}
