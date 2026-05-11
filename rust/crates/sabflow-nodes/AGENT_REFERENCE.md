# sabflow-nodes — Agent Implementation Reference

This crate holds the Node trait and 30 fully-implemented n8n-parity nodes.
You are implementing ONE OR TWO node files. **Do NOT modify** any other file —
the trait, registry, descriptor, and mod.rs are already wired.

## Files you MUST NOT touch
- `src/lib.rs`
- `src/node.rs`
- `src/registry.rs`
- `src/descriptor.rs`
- `src/error.rs`
- `src/context.rs`
- `src/nodes/mod.rs`  ← your node is already registered there
- `src/nodes/stub.rs`
- `Cargo.toml` (unless you need a new dependency, then add to bottom of [dependencies])

## File you MUST replace
Your prompt names a single Rust file under `src/nodes/`.  Replace it entirely.
Keep the struct name and module name identical to the skeleton — they're
already referenced by `src/nodes/mod.rs::register_implemented`.

## The Node trait

```rust
#[async_trait::async_trait]
pub trait Node: Send + Sync {
    fn descriptor(&self) -> NodeDescriptor;
    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput>;
}
```

## Useful APIs

### NodeDescriptor (read `src/descriptor.rs`)
```rust
NodeDescriptor::new("nodeName", "Display Name", "Description", NodeCategory::Communication)
    .icon("send")
    .color("#4A154B")
    .credentials(vec![CredentialBinding { name: "slackApi".into(), display_name: "Slack API".into(), required: true }])
    .properties(vec![
        NodeProperty::new("operation", "Operation", NodePropertyType::Options)
            .options(vec![
                NodePropertyOption { name: "Send Message".into(), value: json!("send"), description: None },
                NodePropertyOption { name: "List Channels".into(), value: json!("listChannels"), description: None },
            ])
            .default(json!("send"))
            .required(),
        NodeProperty::new("channel", "Channel", NodePropertyType::String)
            .placeholder("#general")
            .show_when("operation", &["send"])
            .required(),
        NodeProperty::new("text", "Text", NodePropertyType::String)
            .show_when("operation", &["send"])
            .required(),
    ])
```

### ExecutionContext (`src/context.rs`)
```rust
pub struct ExecutionContext {
    pub variables: HashMap<String, Value>,
    pub credentials: HashMap<String, Credential>,
    pub http: Arc<reqwest::Client>,
    pub mongo: Option<sabnode_db::mongo::MongoHandle>,
    pub trigger_data: Option<Value>,
    pub node_outputs: HashMap<String, NodeOutput>,
    pub execution_id: String,
}

impl ExecutionContext {
    pub fn credential(&self, id: &str) -> NodeResult<&Credential>;
    pub fn param_str(&self, params: &Value, key: &str) -> NodeResult<String>;
    pub fn param_str_opt(&self, params: &Value, key: &str) -> Option<String>;
    pub fn param_bool(&self, params: &Value, key: &str, default: bool) -> bool;
    pub fn param_f64(&self, params: &Value, key: &str) -> Option<f64>;
    pub fn substitute(&self, raw: &str) -> String;  // {{var}} interpolation
}
```

### Credential (runtime data)
```rust
pub struct Credential {
    pub id: String,
    pub credential_type: String,
    pub data: HashMap<String, String>,  // decrypted fields keyed by schema property name
}
```

How to find a credential the user has linked to this node instance:
```rust
let cred_id = ctx.param_str(params, "credentialId")?;
let cred = ctx.credential(&cred_id)?;
let token = cred.data.get("apiKey").ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?;
```

### NodeInput / NodeOutput
```rust
pub struct NodeInput { pub items: Vec<Value> }      // items flowing in
pub struct NodeOutput { pub branches: Vec<NodeInput> }  // one branch per output port

// Convenience constructors:
NodeOutput::single(vec![json!({"ok": true})])       // 1 branch, 1 item
NodeOutput::multi(vec![branch_a_items, branch_b_items])
NodeOutput::empty()
```

### Error type
```rust
NodeError::NotImplemented(String)
NodeError::MissingParameter(String)
NodeError::InvalidParameter { name, reason }
NodeError::MissingCredential(String)
NodeError::HttpError(String)
NodeError::UpstreamError { status: u16, body: String }
NodeError::AuthError(String)
NodeError::Other(String)
// reqwest::Error and serde_json::Error auto-convert via From impls
```

## Common pattern for HTTP integration nodes

```rust
let cred_id = ctx.param_str(params, "credentialId")?;
let cred = ctx.credential(&cred_id)?;
let token = cred.data.get("apiKey")
    .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?;

let operation = ctx.param_str(params, "operation")?;

match operation.as_str() {
    "send" => {
        let channel = ctx.param_str(params, "channel")?;
        let text = ctx.param_str(params, "text")?;
        let res = ctx.http
            .post("https://slack.com/api/chat.postMessage")
            .bearer_auth(token)
            .json(&json!({ "channel": channel, "text": text }))
            .send()
            .await?;
        let status = res.status();
        let body: serde_json::Value = res.json().await.unwrap_or(Value::Null);
        if !status.is_success() {
            return Err(NodeError::UpstreamError {
                status: status.as_u16(),
                body: body.to_string(),
            });
        }
        Ok(NodeOutput::single(vec![body]))
    }
    other => Err(NodeError::InvalidParameter {
        name: "operation".into(),
        reason: format!("unknown operation: {other}"),
    }),
}
```

## Checklist before finishing

- [ ] File compiles via `cargo build -p sabflow-nodes`
- [ ] At least 3 operations implemented (or 1 for non-CRUD nodes like HTTP Request)
- [ ] Each operation has its descriptor properties wired with `show_when`
- [ ] Credential lookup goes through `ctx.credential(id)`
- [ ] `ctx.substitute(s)` used for any user-provided strings that may contain `{{var}}`
- [ ] Errors mapped to `NodeError` variants (no `unwrap`/`panic`)
- [ ] No `unused_imports` warnings — remove anything you don't end up using
