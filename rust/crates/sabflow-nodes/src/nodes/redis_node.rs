//! Redis node — key/value, counters, TTL, pub/sub, key listing.
//!
//! Uses the `fred` client (already the workspace-standard Redis driver). Each
//! execution constructs a fresh `fred::clients::Client` from the credential's
//! host/port/password/database fields, runs the operation, and quits the
//! client at the end. There is no client reuse across executions (TODO: cache
//! per credential id at the engine level).

use async_trait::async_trait;
use fred::{
    clients::Client,
    cmd,
    interfaces::{ClientLike, KeysInterface, PubsubInterface},
    types::{Expiration, Value as RedisValue, config::Config as FredConfig},
};
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct RedisNode;

#[async_trait]
impl Node for RedisNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "redis",
            "Redis",
            "Redis key/value, counters, TTL, pub/sub",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#DC382D")
        .credentials(vec![CredentialBinding {
            name: "redisDb".into(),
            display_name: "Redis Connection".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Get".into(),
                        value: json!("get"),
                        description: Some("GET key".into()),
                    },
                    NodePropertyOption {
                        name: "Set".into(),
                        value: json!("set"),
                        description: Some("SET key value (with optional TTL)".into()),
                    },
                    NodePropertyOption {
                        name: "Delete".into(),
                        value: json!("delete"),
                        description: Some("DEL key".into()),
                    },
                    NodePropertyOption {
                        name: "Increment".into(),
                        value: json!("incr"),
                        description: Some("INCR key".into()),
                    },
                    NodePropertyOption {
                        name: "Decrement".into(),
                        value: json!("decr"),
                        description: Some("DECR key".into()),
                    },
                    NodePropertyOption {
                        name: "Expire".into(),
                        value: json!("expire"),
                        description: Some("EXPIRE key ttlSeconds".into()),
                    },
                    NodePropertyOption {
                        name: "Publish".into(),
                        value: json!("publish"),
                        description: Some("PUBLISH channel value".into()),
                    },
                    NodePropertyOption {
                        name: "Exists".into(),
                        value: json!("exists"),
                        description: Some("EXISTS key".into()),
                    },
                    NodePropertyOption {
                        name: "Keys".into(),
                        value: json!("keys"),
                        description: Some("KEYS pattern".into()),
                    },
                ])
                .default(json!("get"))
                .required(),
            NodeProperty::new("key", "Key", NodePropertyType::String).placeholder("user:123"),
            NodeProperty::new("value", "Value", NodePropertyType::String)
                .show_when("operation", &["set", "publish"]),
            NodeProperty::new("ttlSeconds", "TTL (seconds)", NodePropertyType::Number)
                .description("Optional TTL in seconds")
                .show_when("operation", &["set", "expire"]),
            NodeProperty::new("channel", "Channel", NodePropertyType::String)
                .placeholder("notifications")
                .show_when("operation", &["publish"]),
            NodeProperty::new("pattern", "Pattern", NodePropertyType::String)
                .default(json!("*"))
                .placeholder("*")
                .show_when("operation", &["keys"]),
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
        let host = cred
            .data
            .get("host")
            .ok_or_else(|| NodeError::MissingParameter("host".into()))?
            .clone();
        let port_str = cred
            .data
            .get("port")
            .cloned()
            .unwrap_or_else(|| "6379".to_string());
        let port: u16 = port_str.parse().map_err(|_| NodeError::InvalidParameter {
            name: "port".into(),
            reason: format!("not a valid u16: {port_str}"),
        })?;
        let password = cred.data.get("password").cloned();
        let database: Option<u8> = cred.data.get("database").and_then(|s| s.parse::<u8>().ok());

        let url = build_redis_url(&host, port, password.as_deref(), database);

        let config = FredConfig::from_url(&url)
            .map_err(|e| NodeError::DatabaseError(format!("redis url `{url}` invalid: {e}")))?;

        let client = Client::new(config, None, None, None);
        client
            .init()
            .await
            .map_err(|e| NodeError::DatabaseError(format!("redis connect: {e}")))?;

        let operation = ctx.param_str(params, "operation")?;
        let out = run_operation(&client, &operation, ctx, params).await;

        // Best-effort shutdown — ignore the result, since the operation
        // outcome is what we report.
        let _ = client.quit().await;
        out
    }
}

async fn run_operation(
    client: &Client,
    operation: &str,
    ctx: &ExecutionContext,
    params: &Value,
) -> NodeResult<NodeOutput> {
    match operation {
        "get" => {
            let key = ctx.param_str(params, "key")?;
            let v: RedisValue = client
                .get(&key)
                .await
                .map_err(|e| NodeError::DatabaseError(format!("redis GET: {e}")))?;
            Ok(NodeOutput::single(vec![json!({
                "key": key,
                "value": redis_value_to_json(v),
            })]))
        }
        "set" => {
            let key = ctx.param_str(params, "key")?;
            let value = ctx.param_str(params, "value")?;
            let ttl = ctx.param_f64(params, "ttlSeconds").map(|n| n as i64);
            let expiration = ttl.filter(|n| *n > 0).map(|n| Expiration::EX(n));
            let _: RedisValue = client
                .set(&key, value.as_str(), expiration, None, false)
                .await
                .map_err(|e| NodeError::DatabaseError(format!("redis SET: {e}")))?;
            Ok(NodeOutput::single(vec![json!({
                "key": key,
                "ok": true,
            })]))
        }
        "delete" => {
            let key = ctx.param_str(params, "key")?;
            let removed: u64 = client
                .del(&key)
                .await
                .map_err(|e| NodeError::DatabaseError(format!("redis DEL: {e}")))?;
            Ok(NodeOutput::single(vec![json!({
                "key": key,
                "removed": removed,
            })]))
        }
        "incr" => {
            let key = ctx.param_str(params, "key")?;
            let v: i64 = client
                .incr(&key)
                .await
                .map_err(|e| NodeError::DatabaseError(format!("redis INCR: {e}")))?;
            Ok(NodeOutput::single(vec![json!({ "key": key, "value": v })]))
        }
        "decr" => {
            let key = ctx.param_str(params, "key")?;
            let v: i64 = client
                .decr(&key)
                .await
                .map_err(|e| NodeError::DatabaseError(format!("redis DECR: {e}")))?;
            Ok(NodeOutput::single(vec![json!({ "key": key, "value": v })]))
        }
        "expire" => {
            let key = ctx.param_str(params, "key")?;
            let ttl = ctx
                .param_f64(params, "ttlSeconds")
                .map(|n| n as i64)
                .ok_or_else(|| NodeError::MissingParameter("ttlSeconds".into()))?;
            let applied: bool = client
                .expire(&key, ttl, None)
                .await
                .map_err(|e| NodeError::DatabaseError(format!("redis EXPIRE: {e}")))?;
            Ok(NodeOutput::single(vec![json!({
                "key": key,
                "ttlSeconds": ttl,
                "applied": applied,
            })]))
        }
        "publish" => {
            let channel = ctx.param_str(params, "channel")?;
            let value = ctx.param_str(params, "value")?;
            let receivers: i64 = client
                .publish(&channel, value.as_str())
                .await
                .map_err(|e| NodeError::DatabaseError(format!("redis PUBLISH: {e}")))?;
            Ok(NodeOutput::single(vec![json!({
                "channel": channel,
                "receivers": receivers,
            })]))
        }
        "exists" => {
            let key = ctx.param_str(params, "key")?;
            let n: u64 = client
                .exists(&key)
                .await
                .map_err(|e| NodeError::DatabaseError(format!("redis EXISTS: {e}")))?;
            Ok(NodeOutput::single(vec![json!({
                "key": key,
                "exists": n > 0,
            })]))
        }
        "keys" => {
            let pattern = ctx
                .param_str_opt(params, "pattern")
                .map(|s| if s.is_empty() { "*".to_string() } else { s })
                .unwrap_or_else(|| "*".to_string());
            // fred 10 does not expose `KEYS` directly on `KeysInterface` (it's
            // considered a blocking command on large keyspaces). Issue it via
            // the generic `custom` command instead.
            let raw: RedisValue = client
                .custom(cmd!("KEYS"), vec![pattern.clone()])
                .await
                .map_err(|e| NodeError::DatabaseError(format!("redis KEYS: {e}")))?;
            let keys_json = redis_value_to_json(raw);
            Ok(NodeOutput::single(vec![json!({
                "pattern": pattern,
                "keys": keys_json,
            })]))
        }
        other => Err(NodeError::InvalidParameter {
            name: "operation".into(),
            reason: format!("unknown operation: {other}"),
        }),
    }
}

/// Build a `redis://[:password@]host:port[/db]` URL from credential parts.
fn build_redis_url(host: &str, port: u16, password: Option<&str>, database: Option<u8>) -> String {
    let mut url = String::from("redis://");
    if let Some(pw) = password.filter(|p| !p.is_empty()) {
        url.push(':');
        url.push_str(&urlencoding::encode(pw));
        url.push('@');
    }
    url.push_str(host);
    url.push(':');
    url.push_str(&port.to_string());
    if let Some(db) = database {
        url.push('/');
        url.push_str(&db.to_string());
    }
    url
}

/// Convert a `fred::types::Value` into a `serde_json::Value`. Falls back to
/// stringifying for types that don't map cleanly (sets, maps as flat list).
fn redis_value_to_json(v: RedisValue) -> Value {
    match v {
        RedisValue::Null => Value::Null,
        RedisValue::Boolean(b) => Value::Bool(b),
        RedisValue::Integer(i) => json!(i),
        RedisValue::Double(d) => json!(d),
        RedisValue::String(s) => Value::String(s.to_string()),
        RedisValue::Bytes(b) => match std::str::from_utf8(&b) {
            Ok(s) => Value::String(s.to_string()),
            Err(_) => Value::String(format!("<{} bytes>", b.len())),
        },
        RedisValue::Array(items) => {
            Value::Array(items.into_iter().map(redis_value_to_json).collect())
        }
        RedisValue::Map(map) => {
            let mut obj = serde_json::Map::new();
            for (k, v) in map.inner().into_iter() {
                let key_str = match k.as_str() {
                    Some(s) => s.to_string(),
                    None => format!("{k:?}"),
                };
                obj.insert(key_str, redis_value_to_json(v));
            }
            Value::Object(obj)
        }
        other => Value::String(format!("{other:?}")),
    }
}
