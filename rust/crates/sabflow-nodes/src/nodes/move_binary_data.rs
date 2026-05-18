//! Move Binary Data node — `n8n-nodes-base.moveBinaryData`.
//!
//! Pure transform: swap a JSON field's value with a per-item "binary" slot,
//! or vice versa. The shape we keep on the wire is the same one used by the
//! `readBinaryFile` / `readWriteFile` / S3 / HTTP-Request binary modes — a
//! per-item `binary` map of `{ key: { dataBase64, mimeType?, fileName? } }`.
//!
//! n8n offers two modes:
//!   - `binaryToJson` — read bytes from `binaryPropertyName` and write them
//!     into a JSON field as a UTF-8 (or base64) string.
//!   - `jsonToBinary` — pull a JSON field and stash it as a binary entry.
//!
//! TODO(sabflow): once `crate::binary::BinaryStore` lands, swap the inline
//! base64 representation for a `BinaryDataRef` (CAS-backed) so large items
//! don't bloat each item's JSON. Today the rest of the pipeline already
//! exchanges base64 strings, so this implementation matches that contract.

use async_trait::async_trait;
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct MoveBinaryDataNode;

fn opt(name: &str, value: &str, description: Option<&str>) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: description.map(|s| s.to_string()),
    }
}

#[async_trait]
impl Node for MoveBinaryDataNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "moveBinaryData",
            "Move Binary Data",
            "Convert binary <-> JSON fields on each item",
            NodeCategory::Transform,
        )
        .icon("shuffle")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("mode", "Mode", NodePropertyType::Options)
                .options(vec![
                    opt(
                        "Binary to JSON",
                        "binaryToJson",
                        Some("Read a binary entry and write it as a JSON field"),
                    ),
                    opt(
                        "JSON to Binary",
                        "jsonToBinary",
                        Some("Read a JSON field and store it as a binary entry"),
                    ),
                ])
                .default(json!("binaryToJson"))
                .required(),
            NodeProperty::new(
                "binaryPropertyName",
                "Binary Property Name",
                NodePropertyType::String,
            )
            .default(json!("data"))
            .description("Key inside the item's `binary` map (e.g. `data`, `attachment`)")
            .required(),
            NodeProperty::new(
                "jsonPropertyName",
                "JSON Property Name",
                NodePropertyType::String,
            )
            .default(json!("data"))
            .description("Top-level JSON field to read from / write to")
            .required(),
            NodeProperty::new("encoding", "Encoding", NodePropertyType::Options)
                .options(vec![
                    opt("UTF-8", "utf8", Some("Treat bytes as UTF-8 text")),
                    opt("Base64", "base64", Some("Keep bytes as a base64 string")),
                ])
                .default(json!("utf8"))
                .description(
                    "How to decode bytes into JSON (binaryToJson) or how the JSON value is \
                     encoded before storing as bytes (jsonToBinary)",
                ),
            NodeProperty::new("mimeType", "MIME Type", NodePropertyType::String)
                .placeholder("application/octet-stream")
                .description("Set on the binary entry when running `jsonToBinary`")
                .show_when("mode", &["jsonToBinary"]),
            NodeProperty::new("fileName", "File Name", NodePropertyType::String)
                .placeholder("output.bin")
                .description("Set on the binary entry when running `jsonToBinary`")
                .show_when("mode", &["jsonToBinary"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let mode = ctx.param_str(params, "mode")?;
        let binary_prop = ctx.param_str(params, "binaryPropertyName")?;
        let json_prop = ctx.param_str(params, "jsonPropertyName")?;
        let encoding = ctx
            .param_str_opt(params, "encoding")
            .unwrap_or_else(|| "utf8".to_string());
        let mime_type = ctx.param_str_opt(params, "mimeType");
        let file_name = ctx.param_str_opt(params, "fileName");

        let items = if input.items.is_empty() {
            vec![json!({})]
        } else {
            input.items
        };

        let mut out_items: Vec<Value> = Vec::with_capacity(items.len());

        for item in items {
            let mut item_obj = match item {
                Value::Object(m) => m,
                other => {
                    // Wrap non-object items under `json`.
                    let mut m = Map::new();
                    m.insert("json".to_string(), other);
                    m
                }
            };

            match mode.as_str() {
                "binaryToJson" => {
                    let bin_entry = item_obj
                        .get("binary")
                        .and_then(|b| b.get(&binary_prop))
                        .cloned();
                    let data_b64 = bin_entry
                        .as_ref()
                        .and_then(|e| e.get("dataBase64"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let bytes = B64.decode(data_b64.as_bytes()).map_err(|e| {
                        NodeError::InvalidParameter {
                            name: "binaryPropertyName".into(),
                            reason: format!("entry is not valid base64: {e}"),
                        }
                    })?;
                    let json_value = match encoding.as_str() {
                        "utf8" => Value::String(
                            String::from_utf8(bytes).map_err(|e| NodeError::InvalidParameter {
                                name: "encoding".into(),
                                reason: format!("bytes are not valid UTF-8: {e}"),
                            })?,
                        ),
                        _ => Value::String(data_b64.to_string()),
                    };
                    let json_slot = item_obj
                        .entry("json".to_string())
                        .or_insert_with(|| Value::Object(Map::new()));
                    if !json_slot.is_object() {
                        *json_slot = Value::Object(Map::new());
                    }
                    if let Some(map) = json_slot.as_object_mut() {
                        map.insert(json_prop.clone(), json_value);
                    }
                    // Drop the binary entry once it has been hoisted.
                    let mut binary_now_empty = false;
                    if let Some(bin_val) = item_obj.get_mut("binary") {
                        if let Some(bin_map) = bin_val.as_object_mut() {
                            bin_map.remove(&binary_prop);
                            binary_now_empty = bin_map.is_empty();
                        }
                    }
                    if binary_now_empty {
                        item_obj.remove("binary");
                    }
                }
                "jsonToBinary" => {
                    let value = item_obj
                        .get("json")
                        .and_then(|j| j.get(&json_prop))
                        .cloned()
                        .unwrap_or(Value::Null);
                    let bytes: Vec<u8> = match (encoding.as_str(), &value) {
                        ("base64", Value::String(s)) => B64.decode(s.as_bytes()).map_err(|e| {
                            NodeError::InvalidParameter {
                                name: "jsonPropertyName".into(),
                                reason: format!("value is not valid base64: {e}"),
                            }
                        })?,
                        (_, Value::String(s)) => s.as_bytes().to_vec(),
                        (_, Value::Null) => Vec::new(),
                        (_, other) => other.to_string().into_bytes(),
                    };
                    let mut entry = Map::new();
                    entry.insert("dataBase64".to_string(), Value::String(B64.encode(&bytes)));
                    if let Some(mt) = mime_type.as_ref().filter(|s| !s.is_empty()) {
                        entry.insert("mimeType".to_string(), Value::String(mt.clone()));
                    }
                    if let Some(fn_) = file_name.as_ref().filter(|s| !s.is_empty()) {
                        entry.insert("fileName".to_string(), Value::String(fn_.clone()));
                    }
                    let bin_slot = item_obj
                        .entry("binary".to_string())
                        .or_insert_with(|| Value::Object(Map::new()));
                    if !bin_slot.is_object() {
                        *bin_slot = Value::Object(Map::new());
                    }
                    if let Some(map) = bin_slot.as_object_mut() {
                        map.insert(binary_prop.clone(), Value::Object(entry));
                    }
                    // Optionally null out the json field so the same payload isn't carried twice.
                    if let Some(j) = item_obj.get_mut("json") {
                        if let Some(jmap) = j.as_object_mut() {
                            jmap.remove(&json_prop);
                        }
                    }
                }
                other => {
                    return Err(NodeError::InvalidParameter {
                        name: "mode".into(),
                        reason: format!("unknown mode: {other}"),
                    });
                }
            }

            out_items.push(Value::Object(item_obj));
        }

        Ok(NodeOutput::single(out_items))
    }
}
