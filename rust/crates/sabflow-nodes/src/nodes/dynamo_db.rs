//! AWS DynamoDB node.
//!
//! Descriptor is fully wired so the SabFlow editor can render this node and
//! its settings panel, but `execute` currently returns `NotImplemented`.
//!
//! TODO(sabflow): wire the AWS SigV4 signer + the DynamoDB JSON protocol
//! (PutItem, GetItem, UpdateItem, DeleteItem, Query, Scan) on top of the
//! workspace `reqwest` client, OR pull in `aws-sdk-dynamodb`. Deferred for
//! this phase because:
//!   1. `aws-sdk-dynamodb` is not yet a workspace dependency, and the rule
//!      for this phase is "no new top-level deps".
//!   2. The `aws-config` + `aws-credential-types` crates are already in the
//!      workspace (used by the S3 node) and could host a hand-rolled SigV4
//!      signer, but doing that correctly is a chunk of work we want to land
//!      together with proper coverage tests, not as part of this batch.
//!
//! Until then the descriptor is complete so users can configure the node and
//! see it in the picker; execution intentionally errors out.

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

pub struct DynamoDbNode;

#[async_trait]
impl Node for DynamoDbNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "awsDynamoDb",
            "AWS DynamoDB",
            "Read and write items in an Amazon DynamoDB table",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#4D72B8")
        .credentials(vec![CredentialBinding {
            name: "aws".into(),
            display_name: "AWS Credentials".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("region", "Region", NodePropertyType::String)
                .placeholder("us-east-1")
                .default(json!("us-east-1"))
                .required(),
            NodeProperty::new("tableName", "Table Name", NodePropertyType::String)
                .placeholder("my-table")
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Get Item".into(),
                        value: json!("getItem"),
                        description: Some("Fetch a single item by primary key".into()),
                    },
                    NodePropertyOption {
                        name: "Put Item".into(),
                        value: json!("putItem"),
                        description: Some("Create or replace an item".into()),
                    },
                    NodePropertyOption {
                        name: "Update Item".into(),
                        value: json!("updateItem"),
                        description: Some("Update specific attributes".into()),
                    },
                    NodePropertyOption {
                        name: "Delete Item".into(),
                        value: json!("deleteItem"),
                        description: Some("Delete an item by primary key".into()),
                    },
                    NodePropertyOption {
                        name: "Query".into(),
                        value: json!("query"),
                        description: Some("Query items by partition / sort key".into()),
                    },
                    NodePropertyOption {
                        name: "Scan".into(),
                        value: json!("scan"),
                        description: Some("Full table scan with optional filter".into()),
                    },
                ])
                .default(json!("getItem"))
                .required(),
            NodeProperty::new("key", "Key", NodePropertyType::Json)
                .description("Primary key as JSON, e.g. {\"pk\": \"user-1\", \"sk\": \"profile\"}")
                .default(json!({}))
                .show_when("operation", &["getItem", "updateItem", "deleteItem"]),
            NodeProperty::new("item", "Item", NodePropertyType::Json)
                .description("Item attributes as JSON (raw values; DynamoDB type wrappers applied automatically)")
                .default(json!({}))
                .show_when("operation", &["putItem"]),
            NodeProperty::new("updateExpression", "Update Expression", NodePropertyType::String)
                .placeholder("SET #s = :status, updatedAt = :ts")
                .show_when("operation", &["updateItem"]),
            NodeProperty::new("expressionAttributeNames", "Expression Attribute Names", NodePropertyType::Json)
                .description("Map of placeholder → attribute name, e.g. {\"#s\":\"status\"}")
                .default(json!({}))
                .show_when("operation", &["updateItem", "query", "scan"]),
            NodeProperty::new("expressionAttributeValues", "Expression Attribute Values", NodePropertyType::Json)
                .description("Map of placeholder → value, e.g. {\":status\":\"active\"}")
                .default(json!({}))
                .show_when("operation", &["updateItem", "query", "scan"]),
            NodeProperty::new("keyConditionExpression", "Key Condition Expression", NodePropertyType::String)
                .placeholder("pk = :pkval")
                .show_when("operation", &["query"]),
            NodeProperty::new("filterExpression", "Filter Expression", NodePropertyType::String)
                .placeholder("attribute_exists(email)")
                .show_when("operation", &["query", "scan"]),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(100))
                .show_when("operation", &["query", "scan"]),
        ])
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // TODO(sabflow): implement using AWS SigV4 + the DynamoDB JSON protocol
        // (Content-Type: application/x-amz-json-1.0, X-Amz-Target: DynamoDB_20120810.<Op>).
        // Reuse the `aws-config` + `aws-credential-types` crates already in the workspace
        // for credential resolution; do the SigV4 signing by hand against the workspace
        // `reqwest` client.
        Err(NodeError::NotImplemented(
            "DynamoDB node requires AWS SigV4 signing — deferred (no new top-level deps in this phase)".to_string(),
        ))
    }
}
