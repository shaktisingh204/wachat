//! Microsoft SQL Server node.
//!
//! Descriptor is fully wired so the SabFlow editor can render this node and
//! its settings panel, but `execute` currently returns `NotImplemented`.
//!
//! Operations mirror the n8n `microsoftSql` node:
//!   - `executeQuery` — run raw SQL (params via `?` / `@p1` style — TODO)
//!   - `insert`       — `INSERT INTO {table} (...) VALUES (...)`
//!   - `update`       — `UPDATE {table} SET ... WHERE {where}`
//!   - `delete`       — `DELETE FROM {table} WHERE {where}`
//!
//! A real implementation requires the TDS protocol driver (`tiberius`) and
//! a TLS-friendly runtime adapter (`tokio-util`). Neither is in the
//! workspace today, so we ship the typed stub per the C.3.2 stub policy —
//! the editor surfaces the node, but executing it errors immediately.

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

pub struct MicrosoftSqlNode;

fn opt(name: &str, value: &str, description: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: Some(description.to_string()),
    }
}

#[async_trait]
impl Node for MicrosoftSqlNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "microsoftSql",
            "Microsoft SQL",
            "Run SQL on Microsoft SQL Server",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#A91D22")
        .credentials(vec![CredentialBinding {
            name: "microsoftSql".into(),
            display_name: "Microsoft SQL Connection".into(),
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
                .placeholder("SELECT * FROM users WHERE id = @p1")
                .description("Raw T-SQL — use @p1, @p2, … for placeholders")
                .show_when("operation", &["executeQuery"]),
            NodeProperty::new("table", "Table", NodePropertyType::String)
                .placeholder("dbo.users")
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
        // TODO(sabflow): integrate `tiberius` (TDS) + `tokio-util` once we are
        // ready to absorb the additional workspace dependencies. Until then
        // the descriptor renders in the editor but execution is blocked.
        Err(NodeError::NotImplemented(
            "Microsoft SQL requires tiberius (TDS) driver — TODO".into(),
        ))
    }
}
