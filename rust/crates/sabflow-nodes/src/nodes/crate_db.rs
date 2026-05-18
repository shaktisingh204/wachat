//! CrateDB node.
//!
//! Descriptor is fully wired so the SabFlow editor can render this node and
//! its settings panel, but `execute` currently returns `NotImplemented`.
//!
//! Operations mirror the n8n `crateDb` node:
//!   - `executeQuery` — run raw SQL (bind params via `?` — TODO)
//!   - `insert`       — `INSERT INTO {table} (...) VALUES (...)`
//!   - `update`       — `UPDATE {table} SET ... WHERE {where}`
//!   - `delete`       — `DELETE FROM {table} WHERE {where}`
//!
//! CrateDB speaks the Postgres wire protocol so we *could* re-use the
//! workspace `sqlx-postgres` driver against `crate://`. We intentionally
//! ship the typed stub instead — Crate's dialect differs enough (object
//! types, geo types, array semantics) that mapping through the postgres
//! decoder produces subtly wrong rows for non-trivial workloads. Per the
//! C.3.2 stub policy, the descriptor is complete so the editor renders
//! the node, but executing it errors until we wire up a dedicated client
//! (e.g. `crate-rs` or a thin reqwest wrapper around the Crate HTTP API).

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

pub struct CrateDbNode;

fn opt(name: &str, value: &str, description: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: Some(description.to_string()),
    }
}

#[async_trait]
impl Node for CrateDbNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "crateDb",
            "CrateDB",
            "Run SQL on CrateDB (distributed SQL)",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#00A3E0")
        .credentials(vec![CredentialBinding {
            name: "crateDb".into(),
            display_name: "CrateDB Connection".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Execute Query", "executeQuery", "Run raw SQL"),
                    opt("Insert", "insert", "INSERT row built from a JSON field map"),
                    opt("Update", "update", "UPDATE row(s) matching WHERE clause"),
                    opt("Delete", "delete", "DELETE row(s) matching WHERE clause"),
                ])
                .default(json!("executeQuery"))
                .required(),
            NodeProperty::new("query", "Query", NodePropertyType::String)
                .placeholder("SELECT * FROM doc.users WHERE id = ?")
                .description("Raw SQL — use ? for bind variables")
                .show_when("operation", &["executeQuery"]),
            NodeProperty::new("table", "Table", NodePropertyType::String)
                .placeholder("doc.users")
                .show_when("operation", &["insert", "update", "delete"]),
            NodeProperty::new("data", "Data", NodePropertyType::Json)
                .description("Field → value map for INSERT / UPDATE")
                .default(json!({}))
                .show_when("operation", &["insert", "update"]),
            NodeProperty::new("where", "WHERE Clause", NodePropertyType::String)
                .placeholder("id = 1")
                .description("Raw WHERE clause without the WHERE keyword")
                .show_when("operation", &["update", "delete"]),
        ])
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // TODO(sabflow): wire either a dedicated Crate client crate or a
        // thin HTTP wrapper over Crate's `_sql` endpoint. The descriptor is
        // complete so users can configure the node, but execution is
        // intentionally blocked while we evaluate which path keeps the
        // sqlx-postgres decoder consistent with Crate's dialect.
        Err(NodeError::NotImplemented(
            "CrateDB driver not in workspace — TODO (HTTP `_sql` or crate-rs)".into(),
        ))
    }
}
