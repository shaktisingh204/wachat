//! Compression node.
//!
//! Local compress / decompress against the `gzip` and `deflate` codecs.
//! Brotli is not bundled — `flate2` covers both required formats, and the
//! workspace already pulls it in transitively via `reqwest`'s `gzip` feature
//! so we add no new top-level dependency.
//!
//! Operations:
//! - `compress`   : gzip / deflate the `value` bytes; emits base64.
//! - `decompress` : reverse, emits UTF-8 text (or base64 when the payload is
//!                  not valid UTF-8).
//!
//! Input shape: `value` is treated as UTF-8 text by default. When the caller
//! sets `inputEncoding` to `base64` the value is decoded first so we can
//! round-trip arbitrary binary payloads — the same envelope the Forge TS
//! block uses (see `src/lib/sabflow/forge/blocks/n8n/utilities/compression.ts`).

use std::io::{Read, Write};

use async_trait::async_trait;
use base64::Engine;
use base64::engine::general_purpose;
use flate2::Compression as Flate2Level;
use flate2::read::{DeflateDecoder, GzDecoder};
use flate2::write::{DeflateEncoder, GzEncoder};
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct CompressionNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

fn decode_input(value: &str, encoding: &str) -> NodeResult<Vec<u8>> {
    match encoding {
        "base64" => general_purpose::STANDARD
            .decode(value.trim())
            .map_err(|e| NodeError::InvalidParameter {
                name: "value".into(),
                reason: format!("invalid base64: {e}"),
            }),
        // default is utf8 text
        _ => Ok(value.as_bytes().to_vec()),
    }
}

fn compression_level(raw: Option<f64>) -> Flate2Level {
    match raw {
        Some(n) if n.is_finite() => {
            // Clamp into flate2's accepted 0..=9 range. `as u32` saturates at 0
            // for negatives, so floor + clamp explicitly.
            let clamped = n.clamp(0.0, 9.0) as u32;
            Flate2Level::new(clamped)
        }
        _ => Flate2Level::default(),
    }
}

fn compress_bytes(algorithm: &str, level: Flate2Level, input: &[u8]) -> NodeResult<Vec<u8>> {
    match algorithm {
        "gzip" => {
            let mut enc = GzEncoder::new(Vec::with_capacity(input.len()), level);
            enc.write_all(input)
                .map_err(|e| NodeError::Other(format!("gzip write failed: {e}")))?;
            enc.finish()
                .map_err(|e| NodeError::Other(format!("gzip finish failed: {e}")))
        }
        "deflate" => {
            let mut enc = DeflateEncoder::new(Vec::with_capacity(input.len()), level);
            enc.write_all(input)
                .map_err(|e| NodeError::Other(format!("deflate write failed: {e}")))?;
            enc.finish()
                .map_err(|e| NodeError::Other(format!("deflate finish failed: {e}")))
        }
        other => Err(NodeError::InvalidParameter {
            name: "algorithm".into(),
            reason: format!("unsupported algorithm: {other} (gzip, deflate)"),
        }),
    }
}

fn decompress_bytes(algorithm: &str, input: &[u8]) -> NodeResult<Vec<u8>> {
    let mut out = Vec::with_capacity(input.len() * 2);
    match algorithm {
        "gzip" => {
            let mut dec = GzDecoder::new(input);
            dec.read_to_end(&mut out)
                .map_err(|e| NodeError::Other(format!("gzip decode failed: {e}")))?;
        }
        "deflate" => {
            let mut dec = DeflateDecoder::new(input);
            dec.read_to_end(&mut out)
                .map_err(|e| NodeError::Other(format!("deflate decode failed: {e}")))?;
        }
        other => {
            return Err(NodeError::InvalidParameter {
                name: "algorithm".into(),
                reason: format!("unsupported algorithm: {other} (gzip, deflate)"),
            });
        }
    }
    Ok(out)
}

#[async_trait]
impl Node for CompressionNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "compression",
            "Compression",
            "Compress and decompress payloads (gzip, deflate)",
            NodeCategory::Transform,
        )
        .icon("archive")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Compress", "compress"),
                    opt("Decompress", "decompress"),
                ])
                .default(json!("compress"))
                .required(),
            NodeProperty::new("algorithm", "Algorithm", NodePropertyType::Options)
                .options(vec![opt("gzip", "gzip"), opt("deflate", "deflate")])
                .default(json!("gzip"))
                .required(),
            NodeProperty::new("value", "Value", NodePropertyType::String)
                .placeholder("text or base64 payload")
                .description("Input data. Text by default; set `inputEncoding=base64` for binary input.")
                .required(),
            NodeProperty::new("inputEncoding", "Input encoding", NodePropertyType::Options)
                .options(vec![opt("UTF-8 text", "utf8"), opt("base64", "base64")])
                .default(json!("utf8"))
                .description("How `value` is encoded before compress/decompress."),
            NodeProperty::new("level", "Compression level", NodePropertyType::Number)
                .default(json!(6))
                .description("0 (store) to 9 (best). Only used when operation=compress.")
                .show_when("operation", &["compress"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let operation = ctx.param_str(params, "operation")?;
        let algorithm = ctx.param_str(params, "algorithm")?;
        let value = ctx.param_str(params, "value")?;
        let input_encoding = ctx
            .param_str_opt(params, "inputEncoding")
            .unwrap_or_else(|| "utf8".to_string());

        let body: Value = match operation.as_str() {
            "compress" => {
                let level = compression_level(ctx.param_f64(params, "level"));
                let input_bytes = decode_input(&value, &input_encoding)?;
                let compressed = compress_bytes(&algorithm, level, &input_bytes)?;
                let ratio = if input_bytes.is_empty() {
                    0.0
                } else {
                    compressed.len() as f64 / input_bytes.len() as f64
                };
                json!({
                    "algorithm": algorithm,
                    "operation": "compress",
                    "base64": general_purpose::STANDARD.encode(&compressed),
                    "bytesIn": input_bytes.len(),
                    "bytesOut": compressed.len(),
                    "ratio": ratio,
                })
            }
            "decompress" => {
                // Compressed payload is always base64 on the wire — the wire
                // format never carries raw binary in a JSON string.
                let compressed = general_purpose::STANDARD
                    .decode(value.trim())
                    .map_err(|e| NodeError::InvalidParameter {
                        name: "value".into(),
                        reason: format!("decompress requires base64-encoded input: {e}"),
                    })?;
                let plain = decompress_bytes(&algorithm, &compressed)?;
                let mut out = json!({
                    "algorithm": algorithm,
                    "operation": "decompress",
                    "bytesIn": compressed.len(),
                    "bytesOut": plain.len(),
                });
                // Surface text when the payload is valid UTF-8; otherwise pass
                // through as base64 so binary content survives the round-trip.
                match std::str::from_utf8(&plain) {
                    Ok(text) => {
                        out["text"] = json!(text);
                    }
                    Err(_) => {
                        out["base64"] = json!(general_purpose::STANDARD.encode(&plain));
                    }
                }
                out
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn ctx() -> ExecutionContext {
        ExecutionContext::new(
            "test-exec".to_string(),
            Arc::new(reqwest::Client::new()),
        )
    }

    #[tokio::test]
    async fn gzip_round_trip_text() {
        let node = CompressionNode;
        let mut c = ctx();

        // Compress.
        let params = json!({
            "operation": "compress",
            "algorithm": "gzip",
            "value": "hello sabflow",
            "inputEncoding": "utf8",
            "level": 6,
        });
        let out = node
            .execute(&mut c, NodeInput::empty(), &params)
            .await
            .expect("compress should succeed");
        let item = &out.branches[0].items[0];
        let b64 = item["base64"].as_str().unwrap().to_string();
        assert!(!b64.is_empty());

        // Decompress.
        let params = json!({
            "operation": "decompress",
            "algorithm": "gzip",
            "value": b64,
        });
        let out = node
            .execute(&mut c, NodeInput::empty(), &params)
            .await
            .expect("decompress should succeed");
        let item = &out.branches[0].items[0];
        assert_eq!(item["text"], json!("hello sabflow"));
    }

    #[tokio::test]
    async fn deflate_round_trip_text() {
        let node = CompressionNode;
        let mut c = ctx();

        let params = json!({
            "operation": "compress",
            "algorithm": "deflate",
            "value": "deflate me please",
        });
        let out = node
            .execute(&mut c, NodeInput::empty(), &params)
            .await
            .unwrap();
        let b64 = out.branches[0].items[0]["base64"]
            .as_str()
            .unwrap()
            .to_string();

        let params = json!({
            "operation": "decompress",
            "algorithm": "deflate",
            "value": b64,
        });
        let out = node
            .execute(&mut c, NodeInput::empty(), &params)
            .await
            .unwrap();
        assert_eq!(
            out.branches[0].items[0]["text"],
            json!("deflate me please")
        );
    }

    #[tokio::test]
    async fn rejects_unknown_algorithm() {
        let node = CompressionNode;
        let mut c = ctx();
        let params = json!({
            "operation": "compress",
            "algorithm": "brotli",
            "value": "abc",
        });
        let err = node
            .execute(&mut c, NodeInput::empty(), &params)
            .await
            .unwrap_err();
        match err {
            NodeError::InvalidParameter { name, .. } => assert_eq!(name, "algorithm"),
            other => panic!("expected InvalidParameter, got {other:?}"),
        }
    }
}
