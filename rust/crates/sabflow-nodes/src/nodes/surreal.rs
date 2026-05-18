//! SurrealDB node (substitute for Redis in this phase — already implemented).
//!
//! SurrealDB has a proper HTTP API (`POST /sql`, `GET /key/{tb}/{id}`, etc.)
//! that we *could* drive from the workspace `reqwest` client today. Doing so
//! cleanly requires:
//!   1. A small response normaliser (Surreal wraps every result in
//!      `[{status, time, result: [...]}]`).
//!   2. Correct handling of NS / DB headers on every request.
//!
//! Both are doable, but to keep this batch focused on shipping the node
//! registration (and matching the pattern of the other 4 stubs in this
//! commit), execution is deferred. The descriptor below is complete so the
//! node renders in the editor; runtime errors out with NotImplemented until
//! we land the HTTP impl.

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

pub struct SurrealNode;

#[async_trait]
impl Node for SurrealNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "surreal",
            "SurrealDB",
            "Multi-model document / graph / KV database",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#FF00A0")
        .credentials(vec![CredentialBinding {
            name: "surrealDbApi".into(),
            display_name: "SurrealDB Server".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("namespace", "Namespace", NodePropertyType::String)
                .placeholder("production")
                .required(),
            NodeProperty::new("database", "Database", NodePropertyType::String)
                .placeholder("app")
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Query (SurrealQL)".into(),
                        value: json!("query"),
                        description: Some("Run a SurrealQL statement".into()),
                    },
                    NodePropertyOption {
                        name: "Select".into(),
                        value: json!("select"),
                        description: Some("Select records from a table".into()),
                    },
                    NodePropertyOption {
                        name: "Create".into(),
                        value: json!("create"),
                        description: Some("Create a new record".into()),
                    },
                    NodePropertyOption {
                        name: "Update".into(),
                        value: json!("update"),
                        description: Some("Replace a record by id".into()),
                    },
                    NodePropertyOption {
                        name: "Merge".into(),
                        value: json!("merge"),
                        description: Some("Merge fields into a record".into()),
                    },
                    NodePropertyOption {
                        name: "Delete".into(),
                        value: json!("delete"),
                        description: Some("Delete a record or table".into()),
                    },
                ])
                .default(json!("query"))
                .required(),
            NodeProperty::new("table", "Table", NodePropertyType::String)
                .placeholder("user")
                .show_when("operation", &["select", "create", "update", "merge", "delete"]),
            NodeProperty::new("recordId", "Record ID", NodePropertyType::String)
                .placeholder("123")
                .description("Optional record id — omit to operate on the whole table")
                .show_when("operation", &["select", "update", "merge", "delete"]),
            NodeProperty::new("statement", "SurrealQL Statement", NodePropertyType::String)
                .placeholder("SELECT * FROM user WHERE active = true LIMIT 10")
                .show_when("operation", &["query"]),
            NodeProperty::new("parameters", "Bindings", NodePropertyType::Json)
                .description("Object of $name → value for the SurrealQL statement")
                .default(json!({}))
                .show_when("operation", &["query"]),
            NodeProperty::new("data", "Data", NodePropertyType::Json)
                .description("Record data (object) for create/update/merge")
                .default(json!({}))
                .show_when("operation", &["create", "update", "merge"]),
        ])
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // TODO(sabflow): wire SurrealDB's HTTP API on the workspace `reqwest`
        // client (POST /sql with NS/DB headers; key/{tb}[/{id}] endpoints) and
        // normalise the wrapped response into a flat array of items.
        Err(NodeError::NotImplemented(
            "SurrealDB node — HTTP impl deferred to a follow-up batch".to_string(),
        ))
    }
}
