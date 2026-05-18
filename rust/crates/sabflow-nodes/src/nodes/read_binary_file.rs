//! Read Binary File node — `n8n-nodes-base.readBinaryFile`.
//!
//! Reads a single file from disk and emits one item whose `binary` map carries
//! the bytes (base64-encoded so the value is JSON-safe). On Vercel/Fluid we
//! generally do not have a writable disk, so most production flows will point
//! this at a temp path produced by an earlier node, or at a mounted volume.
//!
//! TODO(sabflow): once `crate::binary::BinaryStore` lands, stream the file
//! into the store and emit a `BinaryDataRef` instead of inlining base64.
//! Today the rest of the engine consumes inline `dataBase64`, so we match
//! that contract here.

use async_trait::async_trait;
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct ReadBinaryFileNode;

#[async_trait]
impl Node for ReadBinaryFileNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "readBinaryFile",
            "Read Binary File",
            "Read a file from disk into a binary item",
            NodeCategory::Files,
        )
        .icon("file")
        .color("#10b981")
        .properties(vec![
            NodeProperty::new("filePath", "File Path", NodePropertyType::String)
                .placeholder("/tmp/report.pdf")
                .description("Absolute path to the file to read")
                .required(),
            NodeProperty::new(
                "dataPropertyName",
                "Binary Property Name",
                NodePropertyType::String,
            )
            .default(json!("data"))
            .description("Key under the item's `binary` map where the bytes are stored"),
            NodeProperty::new("mimeType", "MIME Type", NodePropertyType::String)
                .placeholder("application/octet-stream")
                .description("Optional MIME type to record on the binary entry"),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let path = ctx.param_str(params, "filePath")?;
        let data_prop = ctx
            .param_str_opt(params, "dataPropertyName")
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "data".to_string());
        let mime_type = ctx.param_str_opt(params, "mimeType");

        let file_path = path.clone();
        let bytes = tokio::task::spawn_blocking(move || std::fs::read(&file_path))
            .await
            .map_err(|e| NodeError::Other(format!("readBinaryFile join error: {e}")))?
            .map_err(|e| NodeError::Other(format!("readBinaryFile: {e}")))?;

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
}
