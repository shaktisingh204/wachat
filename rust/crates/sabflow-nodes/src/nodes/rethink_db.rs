//! RethinkDB node.
//!
//! Descriptor is fully wired so the SabFlow editor can render this node and
//! its settings panel, but `execute` currently returns `NotImplemented`.
//!
//! TODO(sabflow): pull in `reql` / `reql-rust` (the community RethinkDB
//! driver) and implement the operations below. They are deferred for this
//! phase because:
//!   1. No RethinkDB driver is currently a workspace dependency, and the rule
//!      for this phase is "no new top-level deps".
//!   2. RethinkDB speaks a custom binary protocol (QL2), so a REST-only fall
//!      back is not realistic — we need the native driver.
//!
//! Until then the descriptor is complete so users can configure the node;
//! execution intentionally errors out.

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

pub struct RethinkDbNode;

#[async_trait]
impl Node for RethinkDbNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "rethinkDb",
            "RethinkDB",
            "Document database with realtime changefeeds",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#1F1F1F")
        .credentials(vec![CredentialBinding {
            name: "rethinkDbApi".into(),
            display_name: "RethinkDB Cluster".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("database", "Database", NodePropertyType::String)
                .placeholder("test")
                .default(json!("test"))
                .required(),
            NodeProperty::new("table", "Table", NodePropertyType::String)
                .placeholder("users")
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Get".into(),
                        value: json!("get"),
                        description: Some("Fetch a document by primary key".into()),
                    },
                    NodePropertyOption {
                        name: "Filter".into(),
                        value: json!("filter"),
                        description: Some("Find documents matching a filter".into()),
                    },
                    NodePropertyOption {
                        name: "Insert".into(),
                        value: json!("insert"),
                        description: Some("Insert one or many documents".into()),
                    },
                    NodePropertyOption {
                        name: "Update".into(),
                        value: json!("update"),
                        description: Some("Update matching documents".into()),
                    },
                    NodePropertyOption {
                        name: "Delete".into(),
                        value: json!("delete"),
                        description: Some("Delete matching documents".into()),
                    },
                    NodePropertyOption {
                        name: "Changes (changefeed)".into(),
                        value: json!("changes"),
                        description: Some("Subscribe to changefeed (returns a snapshot in flow mode)".into()),
                    },
                ])
                .default(json!("filter"))
                .required(),
            NodeProperty::new("documentId", "Document ID", NodePropertyType::String)
                .placeholder("doc-123")
                .show_when("operation", &["get"]),
            NodeProperty::new("filter", "Filter", NodePropertyType::Json)
                .description("ReQL filter document, e.g. {\"status\":\"active\"}")
                .default(json!({}))
                .show_when("operation", &["filter", "update", "delete"]),
            NodeProperty::new("documents", "Documents", NodePropertyType::Json)
                .description("Single document or array of documents to insert")
                .default(json!([]))
                .show_when("operation", &["insert"]),
            NodeProperty::new("updateDoc", "Update Document", NodePropertyType::Json)
                .description("Partial update — fields are merged into matching documents")
                .default(json!({}))
                .show_when("operation", &["update"]),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(100))
                .show_when("operation", &["filter", "changes"]),
        ])
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // TODO(sabflow): implement against a RethinkDB driver (e.g. `reql`).
        Err(NodeError::NotImplemented(
            "RethinkDB node requires the RethinkDB driver (deferred — no new top-level deps in this phase)".to_string(),
        ))
    }
}
