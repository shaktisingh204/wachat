# Authoring SabFlow nodes — the short version

Every fully-implemented node in this crate satisfies the same trait:

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

Hand-rolling that impl is ~80 lines of boilerplate per node. The
`#[node(...)]` attribute macro re-exported from this crate
(`sabflow_nodes::node`) compresses it to ~15 lines while remaining fully
typed and trace-friendly.

> **Migration policy.** The macro is the recommended path for **new** nodes
> (C.3 / C.4 / C.5 stub-backfill agents). Existing nodes continue to use the
> hand-written form; a separate migration pass (C.2.10) will move them over.

---

## Before — hand-written (~80 lines)

```rust
//! Crypto node.
use async_trait::async_trait;
use serde_json::{Value, json};

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
    NodePropertyOption { name: name.into(), value: json!(value), description: None }
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
            // ...four more properties...
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let op = ctx.param_str(params, "operation")?;
        // ... do the work ...
        Ok(NodeOutput::single(vec![/* result */]))
    }
}
```

---

## After — `#[node]` macro (~15 lines)

```rust
//! Crypto node.
use serde_json::{Value, json};
use sabflow_nodes::{
    ExecutionContext, NodeInput, NodeOutput, NodeProperty, NodePropertyType,
    NodeResult, node,
};

pub struct CryptoNode;

#[node(
    name = "crypto",
    display = "Crypto",
    description = "Hash, HMAC, and random string generation",
    category = "transform",
    icon = "lock",
    color = "#0ea5e9"
)]
impl CryptoNode {
    fn properties() -> Vec<NodeProperty> {
        vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .default(json!("hash"))
                .required(),
            // ...four more properties...
        ]
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let op = ctx.param_str(params, "operation")?;
        // ... do the work ...
        Ok(NodeOutput::single(vec![/* result */]))
    }
}
```

Everything else — `#[async_trait]`, the trait impl, the descriptor builder
chain, the import of `Node`, `NodeDescriptor`, `NodeCategory` variants — is
generated.

---

## Attribute reference

```rust
#[node(
    name = "...",          // required — stable identifier
    display = "...",       // required — UI label
    description = "...",   // required — short tagline
    category = ...,        // required — ident or string (see below)

    icon = "...",          // optional — Lucide icon or asset path
    color = "...",         // optional — CSS color
    version = 1,           // optional integer — defaults to 1
    is_trigger = true,     // optional — sets is_trigger + inputs = 0
    outputs = 2,           // optional integer — output-port count
    stub = false,          // optional — mark as a stub (returns NotImplemented)
)]
```

### Category values

Pass either an unqualified variant or its kebab/snake/space string form
(case-insensitive). Valid values:

```
trigger  action       logic        transform   ai
communication         productivity crm         marketing
developer database    storage      analytics   files
sales    finance      hr           misc
```

So all four of these are equivalent:

```rust
category = Logic
category = "logic"
category = "Logic"
category = "LOGIC"
```

### Optional helper fns

Inside the `impl FooNode { ... }` block the macro recognises two helper
functions by name and folds them into the descriptor:

| fn signature | wired into |
|---|---|
| `fn properties() -> Vec<NodeProperty>` | `descriptor().properties` |
| `fn credentials() -> Vec<CredentialBinding>` | `descriptor().credentials` |

Any other items in the impl block are preserved as inherent methods on the
struct (private helpers stay private, public helpers stay public).

---

## Registering the node

The macro generates the trait impl only. You still wire the node into the
registry by adding it to `src/nodes/mod.rs` exactly as before:

```rust
// src/nodes/mod.rs
pub mod crypto;

fn register_implemented(r: &mut NodeRegistry) {
    // ... existing nodes ...
    r.register(crypto::CryptoNode);
}
```

If the node was previously registered as a stub under the same `name`, the
existing stub-skip logic in `register_stubs` ensures only the real
implementation ends up in the registry.

---

## What the macro does NOT do

- It does **not** define a new `Node` trait — it implements the existing
  `sabflow_nodes::node::Node` trait.
- It does **not** auto-register the node — you still add it to `mod.rs`.
- It does **not** introspect doc comments to fill `description` — pass it
  explicitly via `description = "..."`. (This keeps macro output stable and
  greppable.)
- It does **not** support `#[node]` on trait impls or non-struct types —
  apply it only to inherent `impl FooNode { ... }` blocks.

---

## Diagnostics

Missing or malformed attributes produce friendly compile errors:

```
error: missing `name = "..."`
  --> src/nodes/my_node.rs:9:1
   |
 9 | #[node(display = "My Node", description = "x", category = "logic")]
   | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

error: unknown NodeCategory: `dragons` (expected one of: trigger, action, logic, transform, ai, ...)
```

If you forget the `execute` method or write it as a non-async fn, the macro
points at the struct type with a single targeted error.
