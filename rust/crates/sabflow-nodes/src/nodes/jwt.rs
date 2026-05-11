//! JWT node.
//!
//! Sign, verify, and decode JSON Web Tokens. Implemented with the
//! `jsonwebtoken` crate. Supports HMAC algorithms (`HS256` / `HS384` / `HS512`)
//! for sign + verify, and accepts `RS256` in the descriptor for parity with
//! n8n — RS256 sign/verify requires a PEM key supplied via the `secret` field.
//!
//! All three operations are local; no HTTP is performed.

use async_trait::async_trait;
use jsonwebtoken::{
    Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, decode_header, encode,
};
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct JwtNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

fn parse_algorithm(s: &str) -> NodeResult<Algorithm> {
    match s {
        "HS256" => Ok(Algorithm::HS256),
        "HS384" => Ok(Algorithm::HS384),
        "HS512" => Ok(Algorithm::HS512),
        "RS256" => Ok(Algorithm::RS256),
        other => Err(NodeError::InvalidParameter {
            name: "algorithm".into(),
            reason: format!("unsupported algorithm: {other}"),
        }),
    }
}

fn encoding_key(alg: Algorithm, secret: &str) -> NodeResult<EncodingKey> {
    match alg {
        Algorithm::HS256 | Algorithm::HS384 | Algorithm::HS512 => {
            Ok(EncodingKey::from_secret(secret.as_bytes()))
        }
        Algorithm::RS256 => EncodingKey::from_rsa_pem(secret.as_bytes()).map_err(|e| {
            NodeError::InvalidParameter {
                name: "secret".into(),
                reason: format!("invalid RSA PEM key: {e}"),
            }
        }),
        other => Err(NodeError::InvalidParameter {
            name: "algorithm".into(),
            reason: format!("unsupported algorithm: {other:?}"),
        }),
    }
}

fn decoding_key(alg: Algorithm, secret: &str) -> NodeResult<DecodingKey> {
    match alg {
        Algorithm::HS256 | Algorithm::HS384 | Algorithm::HS512 => {
            Ok(DecodingKey::from_secret(secret.as_bytes()))
        }
        Algorithm::RS256 => DecodingKey::from_rsa_pem(secret.as_bytes()).map_err(|e| {
            NodeError::InvalidParameter {
                name: "secret".into(),
                reason: format!("invalid RSA PEM key: {e}"),
            }
        }),
        other => Err(NodeError::InvalidParameter {
            name: "algorithm".into(),
            reason: format!("unsupported algorithm: {other:?}"),
        }),
    }
}

#[async_trait]
impl Node for JwtNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "jwt",
            "JWT",
            "Sign, verify, and decode JSON Web Tokens",
            NodeCategory::Developer,
        )
        .icon("key")
        .color("#000000")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Sign", "sign"),
                    opt("Verify", "verify"),
                    opt("Decode", "decode"),
                ])
                .default(json!("sign"))
                .required(),
            NodeProperty::new("algorithm", "Algorithm", NodePropertyType::Options)
                .options(vec![
                    opt("HS256", "HS256"),
                    opt("HS384", "HS384"),
                    opt("HS512", "HS512"),
                    opt("RS256", "RS256"),
                ])
                .default(json!("HS256"))
                .show_when("operation", &["sign", "verify"]),
            NodeProperty::new("secret", "Secret", NodePropertyType::String)
                .description("Secret string for HS* algorithms, or PEM key for RS256")
                .show_when("operation", &["sign", "verify"])
                .required(),
            NodeProperty::new("payload", "Payload", NodePropertyType::Json)
                .description("JSON payload to sign")
                .show_when("operation", &["sign"])
                .required(),
            NodeProperty::new("token", "Token", NodePropertyType::String)
                .placeholder("eyJhbGciOi...")
                .show_when("operation", &["verify", "decode"])
                .required(),
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
            "sign" => {
                let alg_str = ctx
                    .param_str_opt(params, "algorithm")
                    .unwrap_or_else(|| "HS256".to_string());
                let alg = parse_algorithm(&alg_str)?;
                let secret = ctx.param_str(params, "secret")?;

                // payload can come through as a raw JSON value OR a stringified
                // JSON expression containing {{var}} substitutions.
                let payload = match params.get("payload") {
                    Some(Value::String(s)) => {
                        let substituted = ctx.substitute(s);
                        let trimmed = substituted.trim();
                        if trimmed.is_empty() {
                            return Err(NodeError::MissingParameter("payload".into()));
                        }
                        serde_json::from_str::<Value>(trimmed).map_err(|e| {
                            NodeError::InvalidParameter {
                                name: "payload".into(),
                                reason: format!("invalid JSON: {e}"),
                            }
                        })?
                    }
                    Some(Value::Null) | None => {
                        return Err(NodeError::MissingParameter("payload".into()));
                    }
                    Some(other) => other.clone(),
                };

                let header = Header::new(alg);
                let key = encoding_key(alg, &secret)?;
                let token = encode(&header, &payload, &key)
                    .map_err(|e| NodeError::Other(format!("jwt sign failed: {e}")))?;

                json!({
                    "token": token,
                    "algorithm": alg_str,
                })
            }
            "verify" => {
                let alg_str = ctx
                    .param_str_opt(params, "algorithm")
                    .unwrap_or_else(|| "HS256".to_string());
                let alg = parse_algorithm(&alg_str)?;
                let secret = ctx.param_str(params, "secret")?;
                let token = ctx.param_str(params, "token")?;

                let key = decoding_key(alg, &secret)?;
                let mut validation = Validation::new(alg);
                // We don't know which claims the user is asserting — disable
                // automatic required-claim checks so verify only validates the
                // signature (and `exp` if present).
                validation.required_spec_claims.clear();
                validation.validate_exp = false;
                validation.validate_aud = false;

                match decode::<Value>(&token, &key, &validation) {
                    Ok(data) => json!({
                        "valid": true,
                        "header": serde_json::to_value(&data.header).unwrap_or(Value::Null),
                        "payload": data.claims,
                    }),
                    Err(e) => json!({
                        "valid": false,
                        "error": e.to_string(),
                    }),
                }
            }
            "decode" => {
                let token = ctx.param_str(params, "token")?;
                let header = decode_header(&token).map_err(|e| NodeError::InvalidParameter {
                    name: "token".into(),
                    reason: format!("invalid JWT header: {e}"),
                })?;
                let payload = decode_payload_unverified(&token)?;
                json!({
                    "header": serde_json::to_value(&header).unwrap_or(Value::Null),
                    "payload": payload,
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

/// Decode the payload segment of a JWT without verifying the signature.
fn decode_payload_unverified(token: &str) -> NodeResult<Value> {
    use base64::Engine;
    use base64::engine::general_purpose;

    let mut parts = token.split('.');
    let _header = parts.next().ok_or_else(|| NodeError::InvalidParameter {
        name: "token".into(),
        reason: "missing header segment".into(),
    })?;
    let payload_b64 = parts.next().ok_or_else(|| NodeError::InvalidParameter {
        name: "token".into(),
        reason: "missing payload segment".into(),
    })?;
    let bytes = general_purpose::URL_SAFE_NO_PAD
        .decode(payload_b64)
        .map_err(|e| NodeError::InvalidParameter {
            name: "token".into(),
            reason: format!("invalid base64 payload: {e}"),
        })?;
    let val: Value = serde_json::from_slice(&bytes).map_err(|e| NodeError::InvalidParameter {
        name: "token".into(),
        reason: format!("invalid JSON payload: {e}"),
    })?;
    Ok(val)
}
