//! QuestDB node.
//!
//! Descriptor is fully wired so the SabFlow editor can render this node and
//! its settings panel, but `execute` currently returns `NotImplemented`.
//!
//! Operations mirror the n8n `questDb` node:
//!   - `executeQuery` — run raw SQL (bind params via `$1`, `$2`, … — TODO)
//!   - `insert`       — `INSERT INTO {table} (...) VALUES (...)`
//!   - `update`       — `UPDATE {table} SET ... WHERE {where}`
//!   - `delete`       — `DELETE FROM {table} WHERE {where}` (limited support
//!     in QuestDB — only via partition drop, surfaced as a stub for now)
//!
//! QuestDB exposes a Postgres wire endpoint plus an HTTP `/exec` API and a
//! line-protocol ingest path (ILP). The right driver depends on workload:
//! ILP for high-throughput ingest, pg-wire for ad-hoc queries. We ship the
//! typed stub per the C.3.2 stub policy — the editor surfaces the node and
//! its settings, but executing it errors until we land a dedicated client.

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

pub struct QuestDbNode;

fn opt(name: &str, value: &str, description: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: Some(description.to_string()),
    }
}

#[async_trait]
impl Node for QuestDbNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "questDb",
            "QuestDB",
            "Run SQL on QuestDB (time-series)",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#D14671")
        .credentials(vec![CredentialBinding {
            name: "questDb".into(),
            display_name: "QuestDB Connection".into(),
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
                .placeholder("SELECT * FROM trades WHERE ts > now() - 1h")
                .description("Raw SQL — use $1, $2, … for bind variables")
                .show_when("operation", &["executeQuery"]),
            NodeProperty::new("table", "Table", NodePropertyType::String)
                .placeholder("trades")
                .show_when("operation", &["insert", "update", "delete"]),
            NodeProperty::new("data", "Data", NodePropertyType::Json)
                .description("Field → value map for INSERT / UPDATE")
                .default(json!({}))
                .show_when("operation", &["insert", "update"]),
            NodeProperty::new("where", "WHERE Clause", NodePropertyType::String)
                .placeholder("symbol = 'BTC'")
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
        // TODO(sabflow): decide between pg-wire (sqlx-postgres reuse) and
        // the dedicated `questdb-rs` ILP client. The descriptor is complete
        // so users can configure the node, but execution is intentionally
        // blocked until the driver lands.
        Err(NodeError::NotImplemented(
            "QuestDB driver not in workspace — TODO (questdb-rs or pg-wire)".into(),
        ))
    }
}
