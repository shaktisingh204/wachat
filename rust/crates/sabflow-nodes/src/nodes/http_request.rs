//! HTTP Request node — reference C.2 implementation.
//!
//! This is the **template** every Phase C.3 agent copies. It is the most
//! exercised node in the catalog and the one we hold to the highest parity
//! bar against `n8n-nodes-base.httpRequest`.
//!
//! ## Coverage
//! - Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`.
//! - Auth modes: `none`, `basicAuth`, `bearerAuth`, `headerAuth`, `queryAuth`,
//!   `oAuth2`. Credentials can be supplied either inline (as params) or via the
//!   `ExecutionContext::credentials` map, keyed by the param `credentialId`.
//!   This is the same shape the upcoming Phase C.2 `CredentialsMock` produces,
//!   so test harnesses can swap in fakes transparently.
//! - Body modes: `none`, `json`, `form-urlencoded`, `multipart-form-data`,
//!   `raw`, `binary`.
//! - Headers / query overrides (free-form JSON objects).
//! - Per-item iteration: one request per input item, output keyed back to the
//!   item index. Mirrors the `for_each_item` helper slated for Phase C.2 #6 —
//!   when the helper lands it can replace `iter_items_with_continue` in-place.
//! - `continueOnFail`: when set, a failed request becomes an error item
//!   `{ "error": { code, message, statusCode? } }` instead of aborting the
//!   node — same shape n8n emits. Mirrors the `try_with_continue_on_fail`
//!   helper slated for Phase C.2 #8.
//! - Response shape: `{ statusCode, statusMessage, headers, body }`. The body
//!   is parsed as JSON when the response `Content-Type` claims `application/
//!   json`; otherwise UTF-8 text; otherwise a base64-encoded string.
//!
//! ## Error taxonomy (stable codes — see sibling task #5)
//! - `MissingParameter`: required field absent.
//! - `InvalidParameter`: malformed value (e.g. unknown method, bad base64).
//! - `MissingCredential`: a `credentialId` was set but no entry matched.
//! - `UpstreamError`: response status >= 400 and `ignoreHttpStatusErrors` is
//!   false. Carries the upstream status and (truncated) body.
//! - `HttpError`: transport-layer failure (DNS, TLS, connect, timeout).
//!
//! ## Testing hook
//! The base URL for httpbin-style fixtures is configurable via the
//! `SABFLOW_HTTP_TEST_BASE` environment variable. Fixtures encode their target
//! as `${HTTPBIN_BASE_URL}/...`, and the parity harness substitutes the value
//! before dispatch. This keeps CI off the public internet — point at a local
//! `kennethreitz/httpbin` container in tests.

use std::time::Duration;

use async_trait::async_trait;
use reqwest::{Method, RequestBuilder, multipart};
use serde_json::{Map, Value, json};

use crate::{
    context::{Credential, ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

/// Body bytes ceiling included in `UpstreamError.body` — full payloads can be
/// arbitrarily large and a stable error code shouldn't drag MB into the log.
const UPSTREAM_ERROR_BODY_CAP: usize = 2048;

pub struct HttpRequestNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for HttpRequestNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "httpRequest",
            "HTTP Request",
            "Make HTTP requests to any URL",
            NodeCategory::Action,
        )
        .icon("globe")
        .color("#2563eb")
        // Credentials are *optional* — most calls don't need one, but when a
        // user picks a saved credential it shows up here. Auth-variant
        // selection is still driven by the `authentication` property below.
        .credentials(vec![CredentialBinding {
            name: "httpAuth".into(),
            display_name: "HTTP Auth Credential".into(),
            required: false,
        }])
        .properties(vec![
            NodeProperty::new("method", "Method", NodePropertyType::Options)
                .options(vec![
                    opt("GET", "GET"),
                    opt("POST", "POST"),
                    opt("PUT", "PUT"),
                    opt("PATCH", "PATCH"),
                    opt("DELETE", "DELETE"),
                    opt("HEAD", "HEAD"),
                    opt("OPTIONS", "OPTIONS"),
                ])
                .default(json!("GET"))
                .required(),
            NodeProperty::new("url", "URL", NodePropertyType::String)
                .placeholder("https://api.example.com/users")
                .required(),
            NodeProperty::new("authentication", "Authentication", NodePropertyType::Options)
                .options(vec![
                    opt("None", "none"),
                    opt("Basic Auth", "basicAuth"),
                    opt("Header Auth", "headerAuth"),
                    opt("Query Auth", "queryAuth"),
                    opt("Bearer Auth", "bearerAuth"),
                    opt("OAuth2", "oAuth2"),
                ])
                .default(json!("none")),
            // ID of a saved credential — when set, secret values are sourced
            // from `ctx.credentials` instead of the inline params below.
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .show_when(
                    "authentication",
                    &["basicAuth", "headerAuth", "queryAuth", "bearerAuth", "oAuth2"],
                ),
            NodeProperty::new("username", "Username", NodePropertyType::String)
                .show_when("authentication", &["basicAuth"]),
            NodeProperty::new("password", "Password", NodePropertyType::String)
                .show_when("authentication", &["basicAuth"]),
            NodeProperty::new("headerName", "Header Name", NodePropertyType::String)
                .show_when("authentication", &["headerAuth"]),
            NodeProperty::new("headerValue", "Header Value", NodePropertyType::String)
                .show_when("authentication", &["headerAuth"]),
            NodeProperty::new("queryAuthName", "Query Param Name", NodePropertyType::String)
                .show_when("authentication", &["queryAuth"]),
            NodeProperty::new("queryAuthValue", "Query Param Value", NodePropertyType::String)
                .show_when("authentication", &["queryAuth"]),
            NodeProperty::new("bearerToken", "Bearer Token", NodePropertyType::String)
                .show_when("authentication", &["bearerAuth"]),
            NodeProperty::new("oauth2Token", "OAuth2 Access Token", NodePropertyType::String)
                .show_when("authentication", &["oAuth2"]),
            NodeProperty::new("sendQuery", "Send Query Parameters", NodePropertyType::Boolean)
                .default(json!(false)),
            NodeProperty::new("queryParameters", "Query Parameters", NodePropertyType::Json)
                .default(json!({}))
                .show_when("sendQuery", &["true"])
                .description("JSON object of key→value query parameters"),
            NodeProperty::new("sendHeaders", "Send Headers", NodePropertyType::Boolean)
                .default(json!(false)),
            NodeProperty::new("headers", "Headers", NodePropertyType::Json)
                .default(json!({}))
                .show_when("sendHeaders", &["true"])
                .description("JSON object of header name→value"),
            NodeProperty::new("sendBody", "Send Body", NodePropertyType::Boolean)
                .default(json!(false)),
            NodeProperty::new("bodyContentType", "Body Content Type", NodePropertyType::Options)
                .options(vec![
                    opt("JSON", "json"),
                    opt("Form URL-Encoded", "form-urlencoded"),
                    opt("Multipart Form-Data", "multipart-form-data"),
                    opt("Raw / Text", "raw"),
                    opt("Binary (base64)", "binary"),
                ])
                .default(json!("json"))
                .show_when("sendBody", &["true"]),
            NodeProperty::new("body", "Body", NodePropertyType::Json)
                .show_when("sendBody", &["true"])
                .description(
                    "Request body — JSON object for json/form/multipart, string for raw, base64 for binary",
                ),
            NodeProperty::new("timeout", "Timeout (ms)", NodePropertyType::Number)
                .default(json!(30000)),
            NodeProperty::new(
                "ignoreHttpStatusErrors",
                "Ignore HTTP Status Errors",
                NodePropertyType::Boolean,
            )
            .default(json!(false))
            .description("If on, 4xx/5xx responses still produce an output item."),
            NodeProperty::new("continueOnFail", "Continue On Fail", NodePropertyType::Boolean)
                .default(json!(false))
                .description(
                    "If on, per-item failures produce an `error` item instead of aborting the node.",
                ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cfg = HttpRequestConfig::from_params(ctx, params)?;

        let items = if input.items.is_empty() {
            vec![Value::Null]
        } else {
            input.items
        };

        let mut results: Vec<Value> = Vec::with_capacity(items.len());
        for item in items.iter() {
            // Per-item execution wrapped so `continueOnFail` can convert
            // errors into output items. The closure mirrors the shape of the
            // pending `try_with_continue_on_fail` SDK helper (#8).
            let outcome = execute_one(ctx, &cfg, item).await;
            match outcome {
                Ok(v) => results.push(v),
                Err(e) if cfg.continue_on_fail => results.push(error_item(&e)),
                Err(e) => return Err(e),
            }
        }

        Ok(NodeOutput::single(results))
    }
}

// ─── Config ─────────────────────────────────────────────────────────────────

/// Resolved per-invocation configuration. Built once up front so we can iterate
/// items cheaply.
struct HttpRequestConfig {
    method: Method,
    url: String,
    auth: AuthSpec,
    query_params: Option<Value>,
    headers: Option<Value>,
    body_kind: BodyKind,
    body: Option<Value>,
    timeout: Duration,
    ignore_status_errors: bool,
    continue_on_fail: bool,
}

enum AuthSpec {
    None,
    Basic { user: String, pass: Option<String> },
    Header { name: String, value: String },
    Query { name: String, value: String },
    Bearer { token: String },
}

#[derive(Clone, Copy)]
enum BodyKind {
    None,
    Json,
    FormUrlEncoded,
    MultipartFormData,
    Raw,
    Binary,
}

impl HttpRequestConfig {
    fn from_params(ctx: &ExecutionContext, params: &Value) -> NodeResult<Self> {
        let method_str = ctx
            .param_str_opt(params, "method")
            .unwrap_or_else(|| "GET".to_string())
            .to_uppercase();
        let method = parse_method(&method_str)?;

        let raw_url = ctx.param_str(params, "url")?;
        let url = ctx.substitute(&raw_url);
        if url.trim().is_empty() {
            return Err(NodeError::MissingParameter("url".into()));
        }

        let auth_mode = ctx
            .param_str_opt(params, "authentication")
            .unwrap_or_else(|| "none".to_string());
        let auth = build_auth(ctx, params, &auth_mode)?;

        let send_query = ctx.param_bool(params, "sendQuery", false);
        let send_headers = ctx.param_bool(params, "sendHeaders", false);
        let send_body = ctx.param_bool(params, "sendBody", false);

        let query_params = if send_query {
            substitute_json_param(ctx, params.get("queryParameters"))
        } else {
            None
        };
        let headers = if send_headers {
            substitute_json_param(ctx, params.get("headers"))
        } else {
            None
        };

        let body_kind = if send_body {
            parse_body_kind(
                &ctx.param_str_opt(params, "bodyContentType")
                    .unwrap_or_else(|| "json".to_string()),
            )?
        } else {
            BodyKind::None
        };
        let body = if send_body {
            params.get("body").cloned().map(|v| substitute_value(ctx, v))
        } else {
            None
        };

        let timeout_ms = ctx
            .param_f64(params, "timeout")
            .map(|n| n as u64)
            .unwrap_or(30_000);

        Ok(Self {
            method,
            url,
            auth,
            query_params,
            headers,
            body_kind,
            body,
            timeout: Duration::from_millis(timeout_ms),
            ignore_status_errors: ctx.param_bool(params, "ignoreHttpStatusErrors", false),
            continue_on_fail: ctx.param_bool(params, "continueOnFail", false),
        })
    }
}

/// Resolve auth parameters, preferring credential-store values over inline
/// params. This matches n8n's behaviour where a saved credential overrides
/// fields the user typed by hand.
fn build_auth(ctx: &ExecutionContext, params: &Value, mode: &str) -> NodeResult<AuthSpec> {
    let cred_id = ctx.param_str_opt(params, "credentialId");
    let cred: Option<&Credential> = match &cred_id {
        Some(id) if !id.is_empty() => Some(ctx.credential(id)?),
        _ => None,
    };
    let cred_field = |name: &str| -> Option<String> {
        cred.and_then(|c| c.data.get(name)).cloned()
    };

    match mode {
        "none" => Ok(AuthSpec::None),
        "basicAuth" => {
            let user = cred_field("username")
                .or_else(|| ctx.param_str_opt(params, "username"))
                .unwrap_or_default();
            let pass = cred_field("password").or_else(|| ctx.param_str_opt(params, "password"));
            Ok(AuthSpec::Basic { user, pass })
        }
        "headerAuth" => {
            let name = cred_field("name")
                .or_else(|| ctx.param_str_opt(params, "headerName"))
                .unwrap_or_default();
            let value = cred_field("value")
                .or_else(|| ctx.param_str_opt(params, "headerValue"))
                .unwrap_or_default();
            Ok(AuthSpec::Header { name, value })
        }
        "queryAuth" => {
            let name = cred_field("name")
                .or_else(|| ctx.param_str_opt(params, "queryAuthName"))
                .unwrap_or_default();
            let value = cred_field("value")
                .or_else(|| ctx.param_str_opt(params, "queryAuthValue"))
                .unwrap_or_default();
            Ok(AuthSpec::Query { name, value })
        }
        "bearerAuth" => {
            let token = cred_field("token")
                .or_else(|| ctx.param_str_opt(params, "bearerToken"))
                .unwrap_or_default();
            Ok(AuthSpec::Bearer { token })
        }
        "oAuth2" => {
            let token = cred_field("accessToken")
                .or_else(|| cred_field("token"))
                .or_else(|| ctx.param_str_opt(params, "oauth2Token"))
                .unwrap_or_default();
            Ok(AuthSpec::Bearer { token })
        }
        other => Err(NodeError::InvalidParameter {
            name: "authentication".into(),
            reason: format!("unknown authentication mode: {other}"),
        }),
    }
}

// ─── Per-item execution ─────────────────────────────────────────────────────

async fn execute_one(
    ctx: &ExecutionContext,
    cfg: &HttpRequestConfig,
    _item: &Value,
) -> NodeResult<Value> {
    let mut req: RequestBuilder = ctx
        .http
        .request(cfg.method.clone(), &cfg.url)
        .timeout(cfg.timeout);

    // Auth
    match &cfg.auth {
        AuthSpec::None => {}
        AuthSpec::Basic { user, pass } => {
            req = req.basic_auth(user, pass.clone());
        }
        AuthSpec::Header { name, value } => {
            if !name.is_empty() {
                req = req.header(name.as_str(), value.as_str());
            }
        }
        AuthSpec::Query { name, value } => {
            if !name.is_empty() {
                req = req.query(&[(name.as_str(), value.as_str())]);
            }
        }
        AuthSpec::Bearer { token } => {
            if !token.is_empty() {
                req = req.bearer_auth(token);
            }
        }
    }

    // Query parameters
    if let Some(Value::Object(map)) = &cfg.query_params {
        let pairs: Vec<(String, String)> = map
            .iter()
            .map(|(k, v)| (k.clone(), value_to_qstring(v)))
            .collect();
        if !pairs.is_empty() {
            req = req.query(&pairs);
        }
    }

    // Headers
    if let Some(Value::Object(map)) = &cfg.headers {
        for (k, v) in map.iter() {
            req = req.header(k.as_str(), value_to_qstring(v));
        }
    }

    // Body
    req = apply_body(req, cfg.body_kind, cfg.body.as_ref())?;

    // Execute
    let res = req.send().await?;
    let status = res.status();
    let status_message = status
        .canonical_reason()
        .map(|s| s.to_string())
        .unwrap_or_default();

    let mut headers_map = Map::new();
    for (name, value) in res.headers().iter() {
        if let Ok(s) = value.to_str() {
            headers_map.insert(name.as_str().to_string(), json!(s));
        }
    }
    let content_type = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let body_bytes = res.bytes().await?;
    let body_value = decode_body(&body_bytes, &content_type);

    if !cfg.ignore_status_errors && status.as_u16() >= 400 {
        let snippet = match &body_value {
            Value::String(s) => s.clone(),
            other => other.to_string(),
        };
        let snippet = if snippet.len() > UPSTREAM_ERROR_BODY_CAP {
            format!("{}…", &snippet[..UPSTREAM_ERROR_BODY_CAP])
        } else {
            snippet
        };
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: snippet,
        });
    }

    Ok(json!({
        "statusCode": status.as_u16(),
        "statusMessage": status_message,
        "headers": Value::Object(headers_map),
        "body": body_value,
    }))
}

fn decode_body(bytes: &[u8], content_type: &str) -> Value {
    if content_type.contains("application/json") {
        return serde_json::from_slice::<Value>(bytes)
            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(bytes).into_owned()));
    }
    match std::str::from_utf8(bytes) {
        Ok(s) => Value::String(s.to_string()),
        Err(_) => Value::String(base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            bytes,
        )),
    }
}

/// Shape an error as a continue-on-fail output item — same shape n8n's
/// `continueOnFail` produces.
fn error_item(err: &NodeError) -> Value {
    let (code, message, status_code) = match err {
        NodeError::UpstreamError { status, body } => (
            "UpstreamError",
            format!("upstream returned {status}: {body}"),
            Some(*status),
        ),
        NodeError::HttpError(msg) => ("HttpError", msg.clone(), None),
        NodeError::MissingParameter(p) => {
            ("MissingParameter", format!("missing parameter: {p}"), None)
        }
        NodeError::InvalidParameter { name, reason } => (
            "InvalidParameter",
            format!("invalid parameter '{name}': {reason}"),
            None,
        ),
        NodeError::MissingCredential(id) => {
            ("MissingCredential", format!("missing credential: {id}"), None)
        }
        other => ("NodeError", other.to_string(), None),
    };
    let mut err_obj = Map::new();
    err_obj.insert("code".into(), json!(code));
    err_obj.insert("message".into(), json!(message));
    if let Some(s) = status_code {
        err_obj.insert("statusCode".into(), json!(s));
    }
    json!({ "error": Value::Object(err_obj) })
}

// ─── Helpers ────────────────────────────────────────────────────────────────

fn parse_method(s: &str) -> NodeResult<Method> {
    match s {
        "GET" => Ok(Method::GET),
        "POST" => Ok(Method::POST),
        "PUT" => Ok(Method::PUT),
        "PATCH" => Ok(Method::PATCH),
        "DELETE" => Ok(Method::DELETE),
        "HEAD" => Ok(Method::HEAD),
        "OPTIONS" => Ok(Method::OPTIONS),
        other => Err(NodeError::InvalidParameter {
            name: "method".into(),
            reason: format!("unsupported method: {other}"),
        }),
    }
}

fn parse_body_kind(s: &str) -> NodeResult<BodyKind> {
    match s {
        "json" => Ok(BodyKind::Json),
        "form-urlencoded" => Ok(BodyKind::FormUrlEncoded),
        "multipart-form-data" | "form-data" => Ok(BodyKind::MultipartFormData),
        "raw" => Ok(BodyKind::Raw),
        "binary" => Ok(BodyKind::Binary),
        "none" => Ok(BodyKind::None),
        other => Err(NodeError::InvalidParameter {
            name: "bodyContentType".into(),
            reason: format!("unknown body content type: {other}"),
        }),
    }
}

fn value_to_qstring(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

/// Recursively run `ctx.substitute` over all string leaves of a JSON value.
fn substitute_value(ctx: &ExecutionContext, v: Value) -> Value {
    match v {
        Value::String(s) => Value::String(ctx.substitute(&s)),
        Value::Array(arr) => {
            Value::Array(arr.into_iter().map(|x| substitute_value(ctx, x)).collect())
        }
        Value::Object(map) => {
            let mut out = Map::new();
            for (k, val) in map {
                out.insert(k, substitute_value(ctx, val));
            }
            Value::Object(out)
        }
        other => other,
    }
}

/// Accept either a JSON value or a JSON-encoded string (frontends sometimes
/// stash a Json property as a stringified blob).
fn substitute_json_param(ctx: &ExecutionContext, raw: Option<&Value>) -> Option<Value> {
    let v = raw?.clone();
    let parsed = match v {
        Value::String(s) => {
            let s = ctx.substitute(&s);
            if s.trim().is_empty() {
                return None;
            }
            serde_json::from_str::<Value>(&s).unwrap_or(Value::String(s))
        }
        other => substitute_value(ctx, other),
    };
    Some(parsed)
}

fn apply_body(
    req: RequestBuilder,
    kind: BodyKind,
    body: Option<&Value>,
) -> NodeResult<RequestBuilder> {
    match (kind, body) {
        (BodyKind::None, _) | (_, None) => Ok(req),
        (BodyKind::Json, Some(body)) => {
            // If the user supplied a string, try to parse it as JSON first;
            // otherwise pass through verbatim.
            let payload = match body {
                Value::String(s) => {
                    serde_json::from_str::<Value>(s).unwrap_or_else(|_| Value::String(s.clone()))
                }
                other => other.clone(),
            };
            Ok(req.json(&payload))
        }
        (BodyKind::FormUrlEncoded, Some(body)) => {
            let Value::Object(map) = body else {
                return Err(NodeError::InvalidParameter {
                    name: "body".into(),
                    reason: "form-urlencoded requires a JSON object".into(),
                });
            };
            let pairs: Vec<(String, String)> = map
                .iter()
                .map(|(k, v)| (k.clone(), value_to_qstring(v)))
                .collect();
            Ok(req.form(&pairs))
        }
        (BodyKind::MultipartFormData, Some(body)) => {
            let Value::Object(map) = body else {
                return Err(NodeError::InvalidParameter {
                    name: "body".into(),
                    reason: "multipart-form-data requires a JSON object of fields".into(),
                });
            };
            let mut form = multipart::Form::new();
            for (k, v) in map.iter() {
                // Field shapes:
                //   { "<name>": "value" }                       → text part
                //   { "<name>": { "value": "abc",
                //                 "filename": "f.txt",
                //                 "contentType": "text/plain",
                //                 "binary": false } }          → file part
                match v {
                    Value::Object(spec) => {
                        let val = spec
                            .get("value")
                            .map(value_to_qstring)
                            .unwrap_or_default();
                        let is_binary = spec
                            .get("binary")
                            .and_then(|b| b.as_bool())
                            .unwrap_or(false);
                        let bytes: Vec<u8> = if is_binary {
                            base64::Engine::decode(
                                &base64::engine::general_purpose::STANDARD,
                                &val,
                            )
                            .map_err(|e| NodeError::InvalidParameter {
                                name: "body".into(),
                                reason: format!(
                                    "invalid base64 for multipart field '{k}': {e}"
                                ),
                            })?
                        } else {
                            val.into_bytes()
                        };
                        let mut part = multipart::Part::bytes(bytes);
                        if let Some(filename) = spec.get("filename").and_then(|v| v.as_str()) {
                            part = part.file_name(filename.to_string());
                        }
                        if let Some(ct) = spec.get("contentType").and_then(|v| v.as_str()) {
                            part = part.mime_str(ct).map_err(|e| NodeError::InvalidParameter {
                                name: "body".into(),
                                reason: format!("invalid Content-Type for '{k}': {e}"),
                            })?;
                        }
                        form = form.part(k.clone(), part);
                    }
                    _ => {
                        form = form.text(k.clone(), value_to_qstring(v));
                    }
                }
            }
            Ok(req.multipart(form))
        }
        (BodyKind::Raw, Some(body)) => {
            let s = match body {
                Value::String(s) => s.clone(),
                other => other.to_string(),
            };
            Ok(req
                .header(reqwest::header::CONTENT_TYPE, "text/plain")
                .body(s))
        }
        (BodyKind::Binary, Some(body)) => {
            let s = match body {
                Value::String(s) => s.clone(),
                other => other.to_string(),
            };
            let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &s)
                .map_err(|e| NodeError::InvalidParameter {
                    name: "body".into(),
                    reason: format!("invalid base64 binary body: {e}"),
                })?;
            Ok(req
                .header(reqwest::header::CONTENT_TYPE, "application/octet-stream")
                .body(bytes))
        }
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn ctx() -> ExecutionContext {
        ExecutionContext::new(
            "test-exec".into(),
            Arc::new(reqwest::Client::builder().build().unwrap()),
        )
    }

    #[test]
    fn parses_all_methods() {
        for m in ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] {
            assert!(parse_method(m).is_ok(), "{m} should parse");
        }
        assert!(parse_method("BOGUS").is_err());
    }

    #[test]
    fn parses_all_body_kinds() {
        for kind in [
            "json",
            "form-urlencoded",
            "multipart-form-data",
            "form-data",
            "raw",
            "binary",
            "none",
        ] {
            assert!(parse_body_kind(kind).is_ok(), "{kind}");
        }
        assert!(parse_body_kind("bogus").is_err());
    }

    #[test]
    fn missing_url_fails_with_stable_code() {
        let ctx = ctx();
        let params = json!({ "method": "GET" });
        let err = HttpRequestConfig::from_params(&ctx, &params).unwrap_err();
        match err {
            NodeError::MissingParameter(p) => assert_eq!(p, "url"),
            other => panic!("expected MissingParameter(url), got {other:?}"),
        }
    }

    #[test]
    fn bad_method_fails_with_stable_code() {
        let ctx = ctx();
        let params = json!({ "method": "FETCH", "url": "https://example.com" });
        let err = HttpRequestConfig::from_params(&ctx, &params).unwrap_err();
        match err {
            NodeError::InvalidParameter { name, .. } => assert_eq!(name, "method"),
            other => panic!("expected InvalidParameter(method), got {other:?}"),
        }
    }

    #[test]
    fn credential_overrides_inline_basic_auth() {
        let mut ctx = ctx();
        let mut cred_data = std::collections::HashMap::new();
        cred_data.insert("username".into(), "from-cred".into());
        cred_data.insert("password".into(), "secret".into());
        ctx.credentials.insert(
            "cred-1".into(),
            Credential {
                id: "cred-1".into(),
                credential_type: "httpBasicAuth".into(),
                data: cred_data,
            },
        );
        let params = json!({
            "method": "GET",
            "url": "https://example.com",
            "authentication": "basicAuth",
            "credentialId": "cred-1",
            "username": "inline-loses",
            "password": "inline-loses",
        });
        let cfg = HttpRequestConfig::from_params(&ctx, &params).unwrap();
        match cfg.auth {
            AuthSpec::Basic { user, pass } => {
                assert_eq!(user, "from-cred");
                assert_eq!(pass.as_deref(), Some("secret"));
            }
            _ => panic!("expected Basic auth"),
        }
    }

    #[test]
    fn missing_credential_id_fails() {
        let ctx = ctx();
        let params = json!({
            "method": "GET",
            "url": "https://example.com",
            "authentication": "bearerAuth",
            "credentialId": "missing-id",
        });
        let err = HttpRequestConfig::from_params(&ctx, &params).unwrap_err();
        assert!(matches!(err, NodeError::MissingCredential(_)));
    }

    #[test]
    fn error_item_shape_matches_n8n() {
        let err = NodeError::UpstreamError {
            status: 502,
            body: "boom".into(),
        };
        let v = error_item(&err);
        let e = v.get("error").unwrap();
        assert_eq!(e.get("code").and_then(|x| x.as_str()), Some("UpstreamError"));
        assert_eq!(e.get("statusCode").and_then(|x| x.as_u64()), Some(502));
        assert!(
            e.get("message")
                .and_then(|x| x.as_str())
                .unwrap()
                .contains("502")
        );
    }

    #[test]
    fn decode_body_prefers_json_when_content_type_says_so() {
        let json_bytes = b"{\"a\":1}";
        let v = decode_body(json_bytes, "application/json; charset=utf-8");
        assert_eq!(v.get("a").and_then(|x| x.as_i64()), Some(1));
    }

    #[test]
    fn decode_body_falls_back_to_text() {
        let v = decode_body(b"hello", "text/plain");
        assert_eq!(v.as_str(), Some("hello"));
    }

    #[test]
    fn decode_body_base64_for_non_utf8() {
        let v = decode_body(&[0xff, 0xfe, 0xfd], "application/octet-stream");
        // Just assert it's a string — the exact base64 is implementation
        // detail we don't pin here.
        assert!(v.is_string());
    }
}
