//! HTTP Request node.
//!
//! Generic HTTP client node — n8n V3 parity (method, auth, query, headers, body).
//! Returns one item per input item: `{ statusCode, headers, body }`.

use std::time::Duration;

use async_trait::async_trait;
use reqwest::{Method, RequestBuilder};
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

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
                    opt("Raw / Text", "raw"),
                    opt("Binary (base64)", "binary"),
                ])
                .default(json!("json"))
                .show_when("sendBody", &["true"]),
            NodeProperty::new("body", "Body", NodePropertyType::Json)
                .show_when("sendBody", &["true"])
                .description("Request body — JSON object for json/form, string for raw, base64 for binary"),
            NodeProperty::new("timeout", "Timeout (ms)", NodePropertyType::Number)
                .default(json!(30000)),
            NodeProperty::new(
                "ignoreHttpStatusErrors",
                "Ignore HTTP Status Errors",
                NodePropertyType::Boolean,
            )
            .default(json!(false)),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let method_str = ctx
            .param_str_opt(params, "method")
            .unwrap_or_else(|| "GET".to_string())
            .to_uppercase();
        let method = parse_method(&method_str)?;

        let raw_url = ctx.param_str(params, "url")?;
        let url = ctx.substitute(&raw_url);
        if url.is_empty() {
            return Err(NodeError::MissingParameter("url".into()));
        }

        let auth = ctx
            .param_str_opt(params, "authentication")
            .unwrap_or_else(|| "none".to_string());

        let send_query = ctx.param_bool(params, "sendQuery", false);
        let send_headers = ctx.param_bool(params, "sendHeaders", false);
        let send_body = ctx.param_bool(params, "sendBody", false);

        let timeout_ms = ctx
            .param_f64(params, "timeout")
            .map(|n| n as u64)
            .unwrap_or(30_000);
        let ignore_errors = ctx.param_bool(params, "ignoreHttpStatusErrors", false);

        // Pre-resolve params that don't depend on per-item state.
        let query_obj = if send_query {
            substitute_json_strings(ctx, params.get("queryParameters"))
        } else {
            None
        };
        let header_obj = if send_headers {
            substitute_json_strings(ctx, params.get("headers"))
        } else {
            None
        };

        let body_ct = ctx
            .param_str_opt(params, "bodyContentType")
            .unwrap_or_else(|| "json".to_string());
        let body_val = if send_body {
            params.get("body").cloned().map(|v| substitute_value(ctx, v))
        } else {
            None
        };

        let items = if input.items.is_empty() {
            vec![Value::Null]
        } else {
            input.items
        };

        let mut results: Vec<Value> = Vec::with_capacity(items.len());

        for _item in items.iter() {
            let mut req: RequestBuilder = ctx
                .http
                .request(method.clone(), &url)
                .timeout(Duration::from_millis(timeout_ms));

            // Authentication
            match auth.as_str() {
                "none" => {}
                "basicAuth" => {
                    let user = ctx.param_str_opt(params, "username").unwrap_or_default();
                    let pass = ctx.param_str_opt(params, "password");
                    req = req.basic_auth(user, pass);
                }
                "headerAuth" => {
                    let name = ctx.param_str_opt(params, "headerName").unwrap_or_default();
                    let value = ctx.param_str_opt(params, "headerValue").unwrap_or_default();
                    if !name.is_empty() {
                        req = req.header(name, value);
                    }
                }
                "queryAuth" => {
                    let name = ctx.param_str_opt(params, "queryAuthName").unwrap_or_default();
                    let value = ctx.param_str_opt(params, "queryAuthValue").unwrap_or_default();
                    if !name.is_empty() {
                        req = req.query(&[(name, value)]);
                    }
                }
                "bearerAuth" => {
                    let token = ctx.param_str_opt(params, "bearerToken").unwrap_or_default();
                    if !token.is_empty() {
                        req = req.bearer_auth(token);
                    }
                }
                "oAuth2" => {
                    let token = ctx.param_str_opt(params, "oauth2Token").unwrap_or_default();
                    if !token.is_empty() {
                        req = req.bearer_auth(token);
                    }
                }
                other => {
                    return Err(NodeError::InvalidParameter {
                        name: "authentication".into(),
                        reason: format!("unknown authentication mode: {other}"),
                    });
                }
            }

            // Query parameters
            if let Some(Value::Object(map)) = &query_obj {
                let pairs: Vec<(String, String)> = map
                    .iter()
                    .map(|(k, v)| (k.clone(), value_to_qstring(v)))
                    .collect();
                if !pairs.is_empty() {
                    req = req.query(&pairs);
                }
            }

            // Headers
            if let Some(Value::Object(map)) = &header_obj {
                for (k, v) in map.iter() {
                    req = req.header(k.as_str(), value_to_qstring(v));
                }
            }

            // Body
            if send_body {
                req = apply_body(req, &body_ct, body_val.as_ref())?;
            }

            // Execute
            let res = req.send().await?;
            let status = res.status();
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
            let body_value = if content_type.contains("application/json") {
                serde_json::from_slice::<Value>(&body_bytes).unwrap_or_else(|_| {
                    Value::String(String::from_utf8_lossy(&body_bytes).into_owned())
                })
            } else {
                match std::str::from_utf8(&body_bytes) {
                    Ok(s) => Value::String(s.to_string()),
                    Err(_) => Value::String(
                        base64::Engine::encode(
                            &base64::engine::general_purpose::STANDARD,
                            &body_bytes,
                        ),
                    ),
                }
            };

            if !ignore_errors && status.as_u16() >= 400 {
                return Err(NodeError::UpstreamError {
                    status: status.as_u16(),
                    body: match &body_value {
                        Value::String(s) => s.clone(),
                        other => other.to_string(),
                    },
                });
            }

            results.push(json!({
                "statusCode": status.as_u16(),
                "headers": Value::Object(headers_map),
                "body": body_value,
            }));
        }

        Ok(NodeOutput::single(results))
    }
}

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

/// Param accessor that also accepts a JSON-encoded string (frontends sometimes
/// stash the Json property as a stringified blob).
fn substitute_json_strings(ctx: &ExecutionContext, raw: Option<&Value>) -> Option<Value> {
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
    content_type: &str,
    body: Option<&Value>,
) -> NodeResult<RequestBuilder> {
    let Some(body) = body else {
        return Ok(req);
    };
    match content_type {
        "json" => {
            // If user supplied a string, try to parse it as JSON; otherwise send as-is.
            let payload = match body {
                Value::String(s) => {
                    serde_json::from_str::<Value>(s).unwrap_or_else(|_| Value::String(s.clone()))
                }
                other => other.clone(),
            };
            Ok(req.json(&payload))
        }
        "form-urlencoded" => {
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
        "raw" => {
            let s = match body {
                Value::String(s) => s.clone(),
                other => other.to_string(),
            };
            Ok(req
                .header(reqwest::header::CONTENT_TYPE, "text/plain")
                .body(s))
        }
        "binary" => {
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
        other => Err(NodeError::InvalidParameter {
            name: "bodyContentType".into(),
            reason: format!("unknown body content type: {other}"),
        }),
    }
}
