//! Read/Write File node — `n8n-nodes-base.readWriteFile`.
//!
//! Replaces n8n's older "Read Binary File" / "Write Binary File" pair with a
//! single node that can either read a file into a binary item or write a
//! binary item back to disk.
//!
//! TODO(sabflow): swap inline `dataBase64` for `crate::binary::BinaryDataRef`
//! once the store-backed binary type is available. The current shape matches
//! every other node in the runtime (S3, HTTP, readBinaryFile, moveBinaryData).

use async_trait::async_trait;
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct ReadWriteFileNode;

fn opt(name: &str, value: &str, description: Option<&str>) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: description.map(|s| s.to_string()),
    }
}

#[async_trait]
impl Node for ReadWriteFileNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "readWriteFile",
            "Read/Write File",
            "Read a file from disk into binary data, or write binary data to disk",
            NodeCategory::Files,
        )
        .icon("hard-drive")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Read From File", "read", Some("Read a file from disk")),
                    opt("Write To File", "write", Some("Write a binary item to disk")),
                ])
                .default(json!("read"))
                .required(),
            NodeProperty::new("filePath", "File Path", NodePropertyType::String)
                .placeholder("/tmp/report.pdf")
                .description("Absolute path to the file")
                .required(),
            NodeProperty::new(
                "dataPropertyName",
                "Binary Property Name",
                NodePropertyType::String,
            )
            .default(json!("data"))
            .description("Key under the item's `binary` map. Read uses it as the target; write uses it as the source."),
            NodeProperty::new("mimeType", "MIME Type", NodePropertyType::String)
                .placeholder("application/octet-stream")
                .show_when("operation", &["read"])
                .description("Optional MIME type recorded on the new binary entry"),
            NodeProperty::new("append", "Append", NodePropertyType::Boolean)
                .default(json!(false))
                .show_when("operation", &["write"])
                .description("Append to the file instead of overwriting"),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let operation = ctx.param_str(params, "operation")?;
        let path = ctx.param_str(params, "filePath")?;
        let data_prop = ctx
            .param_str_opt(params, "dataPropertyName")
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "data".to_string());

        match operation.as_str() {
            "read" => {
                let mime_type = ctx.param_str_opt(params, "mimeType");
                let read_path = path.clone();
                let bytes = tokio::task::spawn_blocking(move || std::fs::read(&read_path))
                    .await
                    .map_err(|e| NodeError::Other(format!("readWriteFile join error: {e}")))?
                    .map_err(|e| NodeError::Other(format!("readWriteFile read: {e}")))?;
                let size = bytes.len();
                let file_name = std::path::Path::new(&path)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .map(|s| s.to_string());

                let mut entry = Map::new();
                entry.insert("dataBase64".to_string(), Value::String(B64.encode(&bytes)));
                if let Some(name) = file_name.as_ref() {
                    entry.insert("fileName".to_string(), Value::String(name.clone()));
                }
                if let Some(mt) = mime_type.as_ref().filter(|s| !s.is_empty()) {
                    entry.insert("mimeType".to_string(), Value::String(mt.clone()));
                }

                let mut binary_map = Map::new();
                binary_map.insert(data_prop.clone(), Value::Object(entry));

                let item = json!({
                    "json": {
                        "filePath": path,
                        "fileName": file_name,
                        "size": size,
                        "mimeType": mime_type,
                    },
                    "binary": Value::Object(binary_map),
                });
                Ok(NodeOutput::single(vec![item]))
            }
            "write" => {
                let append = ctx.param_bool(params, "append", false);
                let items = if input.items.is_empty() {
                    vec![json!({})]
                } else {
                    input.items
                };
                let mut out_items: Vec<Value> = Vec::with_capacity(items.len());
                for (idx, item) in items.into_iter().enumerate() {
                    let data_b64 = item
                        .get("binary")
                        .and_then(|b| b.get(&data_prop))
                        .and_then(|e| e.get("dataBase64"))
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| NodeError::InvalidParameter {
                            name: "dataPropertyName".into(),
                            reason: format!(
                                "item[{idx}] has no binary.{data_prop}.dataBase64 to write"
                            ),
                        })?;
                    let bytes = B64.decode(data_b64.as_bytes()).map_err(|e| {
                        NodeError::InvalidParameter {
                            name: "dataPropertyName".into(),
                            reason: format!("binary entry is not valid base64: {e}"),
                        }
                    })?;
                    let write_path = path.clone();
                    let bytes_len = bytes.len();
                    tokio::task::spawn_blocking(move || -> std::io::Result<()> {
                        use std::fs::OpenOptions;
                        use std::io::Write;
                        let mut f = OpenOptions::new()
                            .write(true)
                            .create(true)
                            .truncate(!append)
                            .append(append)
                            .open(&write_path)?;
                        f.write_all(&bytes)?;
                        Ok(())
                    })
                    .await
                    .map_err(|e| NodeError::Other(format!("readWriteFile join error: {e}")))?
                    .map_err(|e| NodeError::Other(format!("readWriteFile write: {e}")))?;
                    out_items.push(json!({
                        "json": {
                            "filePath": path,
                            "bytesWritten": bytes_len,
                            "appended": append,
                        }
                    }));
                }
                Ok(NodeOutput::single(out_items))
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}
