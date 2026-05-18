//! Cloudflare node.
//!
//! Manage Cloudflare zones, DNS records, and cache against the Cloudflare
//! v4 API (https://api.cloudflare.com/client/v4). Authenticates with a
//! bearer API token supplied via the `cloudflareApi` credential
//! (`apiToken` field).

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct CloudflareNode;

const CLOUDFLARE_API_BASE: &str = "https://api.cloudflare.com/client/v4";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for CloudflareNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "cloudflare",
            "Cloudflare",
            "Manage Cloudflare zones, DNS records, and cache",
            NodeCategory::Developer,
        )
        .icon("cloud")
        .color("#F38020")
        .credentials(vec![CredentialBinding {
            name: "cloudflareApi".into(),
            display_name: "Cloudflare API Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Zone", "zone"),
                    opt("DNS Record", "dnsRecord"),
                    opt("Cache", "cache"),
                ])
                .default(json!("dnsRecord"))
                .required(),
            // Zone ops
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("List", "list"), opt("Get", "get")])
                .default(json!("list"))
                .show_when("resource", &["zone"])
                .required(),
            // DNS ops
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                    opt("Get", "get"),
                    opt("List", "list"),
                ])
                .default(json!("list"))
                .show_when("resource", &["dnsRecord"])
                .required(),
            // Cache ops
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Purge Everything", "purgeAll"),
                    opt("Purge by URLs", "purgeFiles"),
                ])
                .default(json!("purgeFiles"))
                .show_when("resource", &["cache"])
                .required(),
            NodeProperty::new("zoneId", "Zone ID", NodePropertyType::String)
                .placeholder("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
                .show_when("resource", &["dnsRecord", "cache"])
                .show_when("operation", &["create", "update", "delete", "get", "list", "purgeAll", "purgeFiles"])
                .required(),
            NodeProperty::new("zoneId", "Zone ID", NodePropertyType::String)
                .placeholder("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
                .show_when("resource", &["zone"])
                .show_when("operation", &["get"])
                .required(),
            NodeProperty::new("recordId", "Record ID", NodePropertyType::String)
                .show_when("resource", &["dnsRecord"])
                .show_when("operation", &["update", "delete", "get"])
                .required(),
            NodeProperty::new("recordType", "Type", NodePropertyType::Options)
                .options(vec![
                    opt("A", "A"),
                    opt("AAAA", "AAAA"),
                    opt("CNAME", "CNAME"),
                    opt("TXT", "TXT"),
                    opt("MX", "MX"),
                    opt("NS", "NS"),
                    opt("SRV", "SRV"),
                    opt("CAA", "CAA"),
                ])
                .default(json!("A"))
                .show_when("operation", &["create", "update"])
                .show_when("resource", &["dnsRecord"]),
            NodeProperty::new("name", "Name", NodePropertyType::String)
                .placeholder("www.example.com")
                .show_when("operation", &["create", "update"])
                .show_when("resource", &["dnsRecord"]),
            NodeProperty::new("content", "Content", NodePropertyType::String)
                .placeholder("203.0.113.10")
                .show_when("operation", &["create", "update"])
                .show_when("resource", &["dnsRecord"]),
            NodeProperty::new("ttl", "TTL", NodePropertyType::Number)
                .default(json!(1))
                .show_when("operation", &["create", "update"])
                .show_when("resource", &["dnsRecord"])
                .description("Time to live in seconds. 1 = automatic."),
            NodeProperty::new("proxied", "Proxied", NodePropertyType::Boolean)
                .default(json!(false))
                .show_when("operation", &["create", "update"])
                .show_when("resource", &["dnsRecord"]),
            NodeProperty::new("priority", "Priority", NodePropertyType::Number)
                .show_when("operation", &["create", "update"])
                .show_when("resource", &["dnsRecord"])
                .description("Required for MX / SRV records"),
            // Cache purge files
            NodeProperty::new("urls", "URLs", NodePropertyType::Json)
                .show_when("operation", &["purgeFiles"])
                .description("JSON array of fully-qualified URLs to purge"),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let cred = ctx.credential(&cred_id)?;
        let token = cred
            .data
            .get("apiToken")
            .or_else(|| cred.data.get("apiKey"))
            .ok_or_else(|| NodeError::MissingParameter("apiToken".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "dnsRecord".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let result: Value = match (resource.as_str(), operation.as_str()) {
            ("zone", "list") => cf_get(ctx, &token, "zones").await?,
            ("zone", "get") => {
                let id = ctx.param_str(params, "zoneId")?;
                cf_get(ctx, &token, &format!("zones/{id}")).await?
            }
            ("dnsRecord", "list") => {
                let zone = ctx.param_str(params, "zoneId")?;
                cf_get(ctx, &token, &format!("zones/{zone}/dns_records")).await?
            }
            ("dnsRecord", "get") => {
                let zone = ctx.param_str(params, "zoneId")?;
                let rec = ctx.param_str(params, "recordId")?;
                cf_get(ctx, &token, &format!("zones/{zone}/dns_records/{rec}")).await?
            }
            ("dnsRecord", "create") => {
                let zone = ctx.param_str(params, "zoneId")?;
                let payload = dns_payload(ctx, params)?;
                cf_post(ctx, &token, &format!("zones/{zone}/dns_records"), payload).await?
            }
            ("dnsRecord", "update") => {
                let zone = ctx.param_str(params, "zoneId")?;
                let rec = ctx.param_str(params, "recordId")?;
                let payload = dns_payload(ctx, params)?;
                cf_put(
                    ctx,
                    &token,
                    &format!("zones/{zone}/dns_records/{rec}"),
                    payload,
                )
                .await?
            }
            ("dnsRecord", "delete") => {
                let zone = ctx.param_str(params, "zoneId")?;
                let rec = ctx.param_str(params, "recordId")?;
                cf_delete(ctx, &token, &format!("zones/{zone}/dns_records/{rec}")).await?
            }
            ("cache", "purgeAll") => {
                let zone = ctx.param_str(params, "zoneId")?;
                let payload = json!({ "purge_everything": true });
                cf_post(ctx, &token, &format!("zones/{zone}/purge_cache"), payload).await?
            }
            ("cache", "purgeFiles") => {
                let zone = ctx.param_str(params, "zoneId")?;
                let urls = parse_json_param(ctx, params, "urls")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let payload = json!({ "files": urls });
                cf_post(ctx, &token, &format!("zones/{zone}/purge_cache"), payload).await?
            }
            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown {res} operation: {op}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![result]))
    }
}

fn dns_payload(ctx: &ExecutionContext, params: &Value) -> NodeResult<Value> {
    let record_type = ctx
        .param_str_opt(params, "recordType")
        .unwrap_or_else(|| "A".to_string());
    let name = ctx.param_str(params, "name")?;
    let content = ctx.param_str(params, "content")?;
    let ttl = ctx.param_f64(params, "ttl").unwrap_or(1.0) as i64;
    let proxied = ctx.param_bool(params, "proxied", false);
    let mut payload = Map::new();
    payload.insert("type".into(), json!(record_type));
    payload.insert("name".into(), json!(name));
    payload.insert("content".into(), json!(content));
    payload.insert("ttl".into(), json!(ttl));
    payload.insert("proxied".into(), json!(proxied));
    if let Some(priority) = ctx.param_f64(params, "priority") {
        payload.insert("priority".into(), json!(priority as i64));
    }
    Ok(Value::Object(payload))
}

async fn cf_get(ctx: &ExecutionContext, token: &str, endpoint: &str) -> NodeResult<Value> {
    let url = format!("{CLOUDFLARE_API_BASE}/{endpoint}");
    let res = ctx.http.get(&url).bearer_auth(token).send().await?;
    finalize(res).await
}

async fn cf_post(
    ctx: &ExecutionContext,
    token: &str,
    endpoint: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{CLOUDFLARE_API_BASE}/{endpoint}");
    let res = ctx
        .http
        .post(&url)
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await?;
    finalize(res).await
}

async fn cf_put(
    ctx: &ExecutionContext,
    token: &str,
    endpoint: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{CLOUDFLARE_API_BASE}/{endpoint}");
    let res = ctx
        .http
        .put(&url)
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await?;
    finalize(res).await
}

async fn cf_delete(ctx: &ExecutionContext, token: &str, endpoint: &str) -> NodeResult<Value> {
    let url = format!("{CLOUDFLARE_API_BASE}/{endpoint}");
    let res = ctx.http.delete(&url).bearer_auth(token).send().await?;
    finalize(res).await
}

async fn finalize(res: reqwest::Response) -> NodeResult<Value> {
    let status = res.status();
    let body: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(body)
}

fn parse_json_param(ctx: &ExecutionContext, params: &Value, key: &str) -> Option<Value> {
    let raw = params.get(key)?;
    match raw {
        Value::Null => None,
        Value::String(s) => {
            let s = ctx.substitute(s);
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else {
                serde_json::from_str::<Value>(trimmed).ok()
            }
        }
        other => Some(substitute_value(ctx, other.clone())),
    }
}

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
