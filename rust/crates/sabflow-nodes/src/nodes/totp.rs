//! TOTP node — RFC 6238 time-based one-time passwords.
//!
//! Crypto-adjacent sibling to the `Crypto` node. Generates and verifies
//! TOTP codes from a base32-encoded shared secret using HMAC-SHA1 by default
//! (the algorithm Google Authenticator and most providers ship). HMAC-SHA256
//! and HMAC-SHA512 are also supported.
//!
//! Operations:
//! - `generate`: derive the current TOTP for `secret` (base32). Returns the
//!   code, the step counter, and seconds until the next rotation.
//! - `verify`:   compare a user-supplied `token` against the expected value
//!   for the current step, with a `window` of ± steps for clock skew.
//!
//! Pure local computation; no HTTP.

use std::time::{SystemTime, UNIX_EPOCH};

use async_trait::async_trait;
use hmac::{Hmac, Mac};
use serde_json::{Value, json};
use sha1::Sha1;
use sha2::{Sha256, Sha512};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct TotpNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

/// Decode an RFC 4648 base32 (uppercase, optional `=` padding) string into
/// raw bytes. Whitespace and dashes are stripped. The TOTP spec mandates
/// base32 for `secret` because it's case-insensitive and avoids ambiguous
/// characters in QR codes.
fn base32_decode(input: &str) -> NodeResult<Vec<u8>> {
    // RFC 4648 alphabet
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    let cleaned: String = input
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .flat_map(|c| c.to_uppercase())
        .collect();
    let trimmed = cleaned.trim_end_matches('=');

    let mut out = Vec::with_capacity(trimmed.len() * 5 / 8);
    let mut buffer: u32 = 0;
    let mut bits: u32 = 0;

    for ch in trimmed.bytes() {
        let val = ALPHABET
            .iter()
            .position(|&c| c == ch)
            .ok_or_else(|| NodeError::InvalidParameter {
                name: "secret".into(),
                reason: format!("invalid base32 character: {}", ch as char),
            })? as u32;

        buffer = (buffer << 5) | val;
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            out.push(((buffer >> bits) & 0xff) as u8);
        }
    }

    Ok(out)
}

fn hmac_sign(algorithm: &str, key: &[u8], counter_bytes: &[u8]) -> NodeResult<Vec<u8>> {
    fn key_err(e: impl std::fmt::Display) -> NodeError {
        NodeError::InvalidParameter {
            name: "secret".into(),
            reason: format!("invalid HMAC key: {e}"),
        }
    }
    match algorithm {
        "SHA1" => {
            let mut mac = <Hmac<Sha1> as Mac>::new_from_slice(key).map_err(key_err)?;
            mac.update(counter_bytes);
            Ok(mac.finalize().into_bytes().to_vec())
        }
        "SHA256" => {
            let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(key).map_err(key_err)?;
            mac.update(counter_bytes);
            Ok(mac.finalize().into_bytes().to_vec())
        }
        "SHA512" => {
            let mut mac = <Hmac<Sha512> as Mac>::new_from_slice(key).map_err(key_err)?;
            mac.update(counter_bytes);
            Ok(mac.finalize().into_bytes().to_vec())
        }
        other => Err(NodeError::InvalidParameter {
            name: "algorithm".into(),
            reason: format!("unsupported TOTP algorithm: {other}"),
        }),
    }
}

/// HOTP truncation per RFC 4226 § 5.3, returned as a zero-padded decimal
/// string of `digits` characters.
fn truncate(mac: &[u8], digits: u32) -> String {
    let offset = (mac[mac.len() - 1] & 0x0f) as usize;
    let bin_code = (u32::from(mac[offset] & 0x7f) << 24)
        | (u32::from(mac[offset + 1]) << 16)
        | (u32::from(mac[offset + 2]) << 8)
        | u32::from(mac[offset + 3]);
    let modulus = 10_u32.pow(digits);
    format!("{:0width$}", bin_code % modulus, width = digits as usize)
}

fn current_step(step_seconds: u64) -> (u64, u64) {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let counter = now / step_seconds.max(1);
    let seconds_remaining = step_seconds.max(1) - (now % step_seconds.max(1));
    (counter, seconds_remaining)
}

fn compute_code(
    algorithm: &str,
    key: &[u8],
    counter: u64,
    digits: u32,
) -> NodeResult<String> {
    let counter_bytes = counter.to_be_bytes();
    let mac = hmac_sign(algorithm, key, &counter_bytes)?;
    Ok(truncate(&mac, digits))
}

#[async_trait]
impl Node for TotpNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "totp",
            "TOTP",
            "Generate and verify time-based one-time passwords (RFC 6238)",
            NodeCategory::Developer,
        )
        .icon("shield")
        .color("#10b981")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Generate", "generate"),
                    opt("Verify", "verify"),
                ])
                .default(json!("generate"))
                .required(),
            NodeProperty::new("secret", "Secret (Base32)", NodePropertyType::String)
                .description("Shared secret encoded as base32 (e.g. JBSWY3DPEHPK3PXP)")
                .required(),
            NodeProperty::new("algorithm", "Algorithm", NodePropertyType::Options)
                .options(vec![
                    opt("SHA1", "SHA1"),
                    opt("SHA256", "SHA256"),
                    opt("SHA512", "SHA512"),
                ])
                .default(json!("SHA1")),
            NodeProperty::new("digits", "Digits", NodePropertyType::Number)
                .description("Number of digits in the generated code (typically 6 or 8)")
                .default(json!(6)),
            NodeProperty::new("step", "Step (Seconds)", NodePropertyType::Number)
                .description("Time step in seconds (typically 30)")
                .default(json!(30)),
            NodeProperty::new("token", "Token", NodePropertyType::String)
                .description("Code to verify")
                .show_when("operation", &["verify"])
                .required(),
            NodeProperty::new("window", "Window", NodePropertyType::Number)
                .description("Steps of clock-skew tolerance (default 1 = ±30 s)")
                .show_when("operation", &["verify"])
                .default(json!(1)),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let operation = ctx.param_str(params, "operation")?;
        let secret = ctx.param_str(params, "secret")?;
        let algorithm = ctx
            .param_str_opt(params, "algorithm")
            .unwrap_or_else(|| "SHA1".to_string());
        let digits = ctx
            .param_f64(params, "digits")
            .map(|n| n as u32)
            .unwrap_or(6)
            .clamp(4, 10);
        let step_seconds = ctx
            .param_f64(params, "step")
            .map(|n| n as u64)
            .unwrap_or(30)
            .max(1);

        let key = base32_decode(&secret)?;
        let (counter, seconds_remaining) = current_step(step_seconds);

        let body: Value = match operation.as_str() {
            "generate" => {
                let code = compute_code(&algorithm, &key, counter, digits)?;
                json!({
                    "token": code,
                    "algorithm": algorithm,
                    "digits": digits,
                    "step": step_seconds,
                    "counter": counter,
                    "secondsRemaining": seconds_remaining,
                })
            }
            "verify" => {
                let supplied = ctx.param_str(params, "token")?;
                let window = ctx
                    .param_f64(params, "window")
                    .map(|n| n as i64)
                    .unwrap_or(1)
                    .clamp(0, 10);

                let mut valid = false;
                let mut matched_delta: Option<i64> = None;
                for delta in -window..=window {
                    let c = (counter as i64).wrapping_add(delta) as u64;
                    let expected = compute_code(&algorithm, &key, c, digits)?;
                    if expected == supplied {
                        valid = true;
                        matched_delta = Some(delta);
                        break;
                    }
                }

                json!({
                    "valid": valid,
                    "delta": matched_delta,
                    "algorithm": algorithm,
                    "digits": digits,
                    "step": step_seconds,
                    "counter": counter,
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
