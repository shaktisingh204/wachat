//! Couchbase node.
//!
//! Descriptor is fully wired so the SabFlow editor can render this node and
//! its settings panel, but `execute` currently returns `NotImplemented`.
//!
//! TODO(sabflow): pull in the official `couchbase` crate (or use the
//! cluster's HTTP query / KV REST endpoints with the workspace `reqwest`
//! client) and implement the operations below. They are deferred for now
//! because:
//!   1. The `couchbase` Rust SDK is not currently a workspace dependency, and
//!      the rule for this phase is "no new top-level deps".
//!   2. A REST-only implementation requires careful auth (Couchbase mixes
//!      bucket-level Basic Auth with cluster-management endpoints), so we
//!      want a single, well-tested impl rather than a half-working one.
//!
//! Until then, the descriptor below is shipped so the node appears in the
//! editor's picker and users can configure it; runtime execution
//! intentionally errors out with a clear NotImplemented message.

use async_trait::async_trait;
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

pub struct CouchbaseNode;

#[async_trait]
impl Node for CouchbaseNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "couchbase",
            "Couchbase",
            "Couchbase document database — KV and N1QL queries",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#EA2328")
        .credentials(vec![CredentialBinding {
            name: "couchbaseApi".into(),
            display_name: "Couchbase Cluster".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("bucket", "Bucket", NodePropertyType::String)
                .placeholder("travel-sample")
                .required(),
            NodeProperty::new("scope", "Scope", NodePropertyType::String)
                .default(json!("_default"))
                .placeholder("_default"),
            NodeProperty::new("collection", "Collection", NodePropertyType::String)
                .default(json!("_default"))
                .placeholder("_default"),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Get".into(),
                        value: json!("get"),
                        description: Some("Fetch a document by key".into()),
                    },
                    NodePropertyOption {
                        name: "Insert".into(),
                        value: json!("insert"),
                        description: Some("Insert a document (fails if key exists)".into()),
                    },
                    NodePropertyOption {
                        name: "Upsert".into(),
                        value: json!("upsert"),
                        description: Some("Insert or replace a document".into()),
                    },
                    NodePropertyOption {
                        name: "Replace".into(),
                        value: json!("replace"),
                        description: Some("Replace an existing document".into()),
                    },
                    NodePropertyOption {
                        name: "Delete".into(),
                        value: json!("delete"),
                        description: Some("Delete a document by key".into()),
                    },
                    NodePropertyOption {
                        name: "Query (N1QL)".into(),
                        value: json!("query"),
                        description: Some("Run a N1QL / SQL++ query".into()),
                    },
                ])
                .default(json!("get"))
                .required(),
            NodeProperty::new("documentKey", "Document Key", NodePropertyType::String)
                .placeholder("user::123")
                .show_when("operation", &["get", "insert", "upsert", "replace", "delete"]),
            NodeProperty::new("document", "Document", NodePropertyType::Json)
                .description("Document JSON body")
                .default(json!({}))
                .show_when("operation", &["insert", "upsert", "replace"]),
            NodeProperty::new("statement", "N1QL Statement", NodePropertyType::String)
                .placeholder("SELECT * FROM `travel-sample` WHERE type = 'airline' LIMIT 10")
                .show_when("operation", &["query"]),
            NodeProperty::new("parameters", "Named Parameters", NodePropertyType::Json)
                .description("Object of $name → value for parameterised queries")
                .default(json!({}))
                .show_when("operation", &["query"]),
        ])
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // TODO(sabflow): implement against the Couchbase query/KV REST API or
        // the official SDK once it lands in the workspace.
        Err(NodeError::NotImplemented(
            "Couchbase node requires the Couchbase SDK (deferred — no new top-level deps in this phase)".to_string(),
        ))
    }
}
