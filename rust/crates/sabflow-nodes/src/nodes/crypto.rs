//! Crypto node.
//!
//! Local hashing, HMAC, and random-string generation. No HTTP.
//!
//! - `hash`: MD5 / SHA1 / SHA256 / SHA384 / SHA512 digest of `value`.
//! - `hmac`: HMAC of `value` with `secret`, using the chosen algorithm.
//! - `randomString`: produces a pseudo-random string of `length` characters
//!   sourced from concatenated UUID v4 hex digits.

use async_trait::async_trait;
use base64::Engine;
use base64::engine::general_purpose;
use hmac::{Hmac, Mac};
use md5::{Digest as Md5Digest, Md5};
use serde_json::{Value, json};
use sha1::Sha1;
use sha2::{Sha256, Sha384, Sha512};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct CryptoNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

fn encode_bytes(bytes: &[u8], encoding: &str) -> String {
    match encoding {
        "base64" => general_purpose::STANDARD.encode(bytes),
        _ => hex_encode(bytes),
    }
}

fn hash_bytes(algorithm: &str, value: &[u8]) -> NodeResult<Vec<u8>> {
    match algorithm {
        "md5" => {
            let mut h = Md5::new();
            h.update(value);
            Ok(h.finalize().to_vec())
        }
        "sha1" => {
            let mut h = Sha1::new();
            h.update(value);
            Ok(h.finalize().to_vec())
        }
        "sha256" => {
            let mut h = Sha256::new();
            h.update(value);
            Ok(h.finalize().to_vec())
        }
        "sha384" => {
            let mut h = Sha384::new();
            h.update(value);
            Ok(h.finalize().to_vec())
        }
        "sha512" => {
            let mut h = Sha512::new();
            h.update(value);
            Ok(h.finalize().to_vec())
        }
        other => Err(NodeError::InvalidParameter {
            name: "algorithm".into(),
            reason: format!("unsupported algorithm: {other}"),
        }),
    }
}

fn hmac_bytes(algorithm: &str, secret: &[u8], value: &[u8]) -> NodeResult<Vec<u8>> {
    fn invalid_key(e: impl std::fmt::Display) -> NodeError {
        NodeError::InvalidParameter {
            name: "secret".into(),
            reason: format!("invalid HMAC key: {e}"),
        }
    }

    match algorithm {
        "md5" => {
            let mut mac = <Hmac<Md5> as Mac>::new_from_slice(secret).map_err(invalid_key)?;
            mac.update(value);
            Ok(mac.finalize().into_bytes().to_vec())
        }
        "sha1" => {
            let mut mac = <Hmac<Sha1> as Mac>::new_from_slice(secret).map_err(invalid_key)?;
            mac.update(value);
            Ok(mac.finalize().into_bytes().to_vec())
        }
        "sha256" => {
            let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret).map_err(invalid_key)?;
            mac.update(value);
            Ok(mac.finalize().into_bytes().to_vec())
        }
        "sha384" => {
            let mut mac = <Hmac<Sha384> as Mac>::new_from_slice(secret).map_err(invalid_key)?;
            mac.update(value);
            Ok(mac.finalize().into_bytes().to_vec())
        }
        "sha512" => {
            let mut mac = <Hmac<Sha512> as Mac>::new_from_slice(secret).map_err(invalid_key)?;
            mac.update(value);
            Ok(mac.finalize().into_bytes().to_vec())
        }
        other => Err(NodeError::InvalidParameter {
            name: "algorithm".into(),
            reason: format!("unsupported algorithm: {other}"),
        }),
    }
}

fn random_string(length: usize) -> String {
    let mut out = String::with_capacity(length);
    while out.len() < length {
        let uuid = uuid::Uuid::new_v4().simple().to_string();
        out.push_str(&uuid);
    }
    out.truncate(length);
    out
}

#[async_trait]
impl Node for CryptoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "crypto",
            "Crypto",
            "Hash, HMAC, and random string generation",
            NodeCategory::Transform,
        )
        .icon("lock")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Hash", "hash"),
                    opt("HMAC", "hmac"),
                    opt("Random String", "randomString"),
                ])
                .default(json!("hash"))
                .required(),
            NodeProperty::new("algorithm", "Algorithm", NodePropertyType::Options)
                .options(vec![
                    opt("MD5", "md5"),
                    opt("SHA1", "sha1"),
                    opt("SHA256", "sha256"),
                    opt("SHA384", "sha384"),
                    opt("SHA512", "sha512"),
                ])
                .default(json!("sha256"))
                .show_when("operation", &["hash", "hmac"]),
            NodeProperty::new("value", "Value", NodePropertyType::String)
                .description("Input string to hash or sign")
                .show_when("operation", &["hash", "hmac"])
                .required(),
            NodeProperty::new("encoding", "Output Encoding", NodePropertyType::Options)
                .options(vec![opt("Hex", "hex"), opt("Base64", "base64")])
                .default(json!("hex"))
                .show_when("operation", &["hash", "hmac"]),
            NodeProperty::new("secret", "Secret", NodePropertyType::String)
                .description("HMAC signing key")
                .show_when("operation", &["hmac"])
                .required(),
            NodeProperty::new("length", "Length", NodePropertyType::Number)
                .default(json!(32))
                .show_when("operation", &["randomString"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "hash" => {
                let algorithm = ctx
                    .param_str_opt(params, "algorithm")
                    .unwrap_or_else(|| "sha256".to_string());
                let value = ctx.param_str(params, "value")?;
                let encoding = ctx
                    .param_str_opt(params, "encoding")
                    .unwrap_or_else(|| "hex".to_string());

                let digest = hash_bytes(&algorithm, value.as_bytes())?;
                let encoded = encode_bytes(&digest, &encoding);
                json!({
                    "algorithm": algorithm,
                    "encoding": encoding,
                    "hash": encoded,
                })
            }
            "hmac" => {
                let algorithm = ctx
                    .param_str_opt(params, "algorithm")
                    .unwrap_or_else(|| "sha256".to_string());
                let value = ctx.param_str(params, "value")?;
                let secret = ctx.param_str(params, "secret")?;
                let encoding = ctx
                    .param_str_opt(params, "encoding")
                    .unwrap_or_else(|| "hex".to_string());

                let mac = hmac_bytes(&algorithm, secret.as_bytes(), value.as_bytes())?;
                let encoded = encode_bytes(&mac, &encoding);
                json!({
                    "algorithm": algorithm,
                    "encoding": encoding,
                    "hmac": encoded,
                })
            }
            "randomString" => {
                let length = ctx
                    .param_f64(params, "length")
                    .map(|n| n as i64)
                    .unwrap_or(32);
                if length <= 0 {
                    return Err(NodeError::InvalidParameter {
                        name: "length".into(),
                        reason: "must be greater than zero".into(),
                    });
                }
                if length > 4096 {
                    return Err(NodeError::InvalidParameter {
                        name: "length".into(),
                        reason: "must be 4096 or less".into(),
                    });
                }
                let value = random_string(length as usize);
                json!({
                    "value": value,
                    "length": length,
                })
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
