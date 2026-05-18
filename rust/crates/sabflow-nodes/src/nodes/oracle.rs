//! Oracle Database node.
//!
//! Descriptor is fully wired so the SabFlow editor can render this node and
//! its settings panel, but `execute` currently returns `NotImplemented`.
//!
//! Operations mirror the n8n `oracle` node:
//!   - `executeQuery` — run raw SQL (bind params via `:1`, `:2`, … — TODO)
//!   - `insert`       — `INSERT INTO {table} (...) VALUES (...)`
//!   - `update`       — `UPDATE {table} SET ... WHERE {where}`
//!   - `delete`       — `DELETE FROM {table} WHERE {where}`
//!
//! A real implementation requires the Oracle Call Interface (OCI) wrapper
//! (`oracle` crate) or the upcoming pure-Rust `siamese` driver, plus the
//! Oracle Instant Client native libraries. Neither is in the workspace
//! today, so we ship the typed stub per the C.3.2 stub policy — the editor
//! surfaces the node, but executing it errors immediately.

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

pub struct OracleNode;

fn opt(name: &str, value: &str, description: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: Some(description.to_string()),
    }
}

#[async_trait]
impl Node for OracleNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "oracle",
            "Oracle DB",
            "Run SQL on Oracle Database",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#F80000")
        .credentials(vec![CredentialBinding {
            name: "oracleDb".into(),
            display_name: "Oracle Connection".into(),
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
                .placeholder("SELECT * FROM users WHERE id = :1")
                .description("Raw SQL — use :1, :2, … for bind variables")
                .show_when("operation", &["executeQuery"]),
            NodeProperty::new("table", "Table", NodePropertyType::String)
                .placeholder("HR.EMPLOYEES")
                .show_when("operation", &["insert", "update", "delete"]),
            NodeProperty::new("data", "Data", NodePropertyType::Json)
                .description("Field → value map for INSERT / UPDATE")
                .default(json!({}))
                .show_when("operation", &["insert", "update"]),
            NodeProperty::new("where", "WHERE Clause", NodePropertyType::String)
                .placeholder("ID = 1")
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
        // TODO(sabflow): integrate the `oracle` (OCI) crate plus the Oracle
        // Instant Client native libraries once we are ready to ship them
        // in the runtime image. The descriptor is complete so users can
        // configure the node, but execution is intentionally blocked.
        Err(NodeError::NotImplemented(
            "Oracle DB requires OCI (oracle crate + Instant Client) — TODO".into(),
        ))
    }
}
