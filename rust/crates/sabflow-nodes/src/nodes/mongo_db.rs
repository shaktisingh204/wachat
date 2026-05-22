//! MongoDB node — CRUD + aggregation against an arbitrary Mongo URI.
//!
//! Each `execute` call connects to the configured URI fresh. There is no
//! pool reuse across executions (TODO: cache `mongodb::Client` per credential
//! id once the engine grows a long-lived node-state cache). The `mongodb`
//! driver is internally pooled, so a single execution shares one connection
//! pool across its operation.
//!
//! Operations implemented:
//!   - `find`      — filter doc → array of matching docs, with `limit`
//!   - `insert`    — single doc or array of docs
//!   - `update`    — filter + update doc (caller must include `$set` etc.)
//!   - `delete`    — filter doc, deletes matching
//!   - `aggregate` — full pipeline as a JSON array
//!   - `count`     — filter doc → `{ count: N }`
//!
//! BSON values are converted to JSON via `bson::Bson` → `serde_json::Value`.

use async_trait::async_trait;
use bson::{Bson, Document};
use futures::stream::TryStreamExt;
use mongodb::Client;
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

pub struct MongoDbNode;

#[async_trait]
impl Node for MongoDbNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mongoDb",
            "MongoDB",
            "MongoDB CRUD and aggregation operations",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#47A248")
        .credentials(vec![CredentialBinding {
            name: "mongoDb".into(),
            display_name: "MongoDB Connection".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("collection", "Collection", NodePropertyType::String)
                .placeholder("users")
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Find".into(),
                        value: json!("find"),
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
                        name: "Aggregate".into(),
                        value: json!("aggregate"),
                        description: Some("Run an aggregation pipeline".into()),
                    },
                    NodePropertyOption {
                        name: "Count".into(),
                        value: json!("count"),
                        description: Some("Count matching documents".into()),
                    },
                ])
                .default(json!("find"))
                .required(),
            NodeProperty::new("query", "Filter / Query", NodePropertyType::Json)
                .description("MongoDB filter document, e.g. {\"status\":\"active\"}")
                .default(json!({}))
                .show_when("operation", &["find", "update", "delete", "count"]),
            NodeProperty::new("update", "Update Document", NodePropertyType::Json)
                .description("Update spec, e.g. {\"$set\":{\"foo\":1}}")
                .default(json!({}))
                .show_when("operation", &["update"]),
            NodeProperty::new("documents", "Documents", NodePropertyType::Json)
                .description("Single document or array of documents to insert")
                .default(json!([]))
                .show_when("operation", &["insert"]),
            NodeProperty::new("pipeline", "Aggregation Pipeline", NodePropertyType::Json)
                .description("Array of aggregation stages")
                .default(json!([]))
                .show_when("operation", &["aggregate"]),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(100))
                .show_when("operation", &["find"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let cred = ctx.credential(&cred_id)?;
        let uri = cred
            .data
            .get("connectionString")
            .ok_or_else(|| NodeError::MissingParameter("connectionString".into()))?
            .clone();
        let db_name = cred
            .data
            .get("database")
            .ok_or_else(|| NodeError::MissingParameter("database".into()))?
            .clone();

        let collection_name = ctx.param_str(params, "collection")?;
        let operation = ctx.param_str(params, "operation")?;

        let client = Client::with_uri_str(&uri)
            .await
            .map_err(|e| NodeError::DatabaseError(format!("mongo connect: {e}")))?;
        let coll = client
            .database(&db_name)
            .collection::<Document>(&collection_name);

        match operation.as_str() {
            "find" => {
                let filter = read_doc(ctx, params, "query")?;
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as i64)
                    .unwrap_or(100);
                let mut cursor = coll
                    .find(filter)
                    .limit(limit)
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("mongo find: {e}")))?;
                let mut docs: Vec<Value> = Vec::new();
                while let Some(d) = cursor
                    .try_next()
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("mongo cursor: {e}")))?
                {
                    docs.push(bson_to_json(Bson::Document(d))?);
                }
                Ok(NodeOutput::single(docs))
            }
            "insert" => {
                let docs_value = read_json_value(ctx, params, "documents")?;
                let docs = match docs_value {
                    Value::Array(arr) => arr,
                    other => vec![other],
                };
                if docs.is_empty() {
                    return Err(NodeError::InvalidParameter {
                        name: "documents".into(),
                        reason: "no documents to insert".into(),
                    });
                }
                let mut bson_docs: Vec<Document> = Vec::with_capacity(docs.len());
                for d in &docs {
                    let bson = bson::to_bson(d)
                        .map_err(|e| NodeError::SerializationError(format!("doc → bson: {e}")))?;
                    match bson {
                        Bson::Document(doc) => bson_docs.push(doc),
                        _ => {
                            return Err(NodeError::InvalidParameter {
                                name: "documents".into(),
                                reason: "each document must be a JSON object".into(),
                            });
                        }
                    }
                }
                if bson_docs.len() == 1 {
                    let res = coll
                        .insert_one(bson_docs.into_iter().next().unwrap())
                        .await
                        .map_err(|e| NodeError::DatabaseError(format!("mongo insert: {e}")))?;
                    let id_json = bson_to_json(res.inserted_id)?;
                    Ok(NodeOutput::single(vec![json!({
                        "insertedCount": 1,
                        "insertedId": id_json,
                    })]))
                } else {
                    let res = coll
                        .insert_many(bson_docs)
                        .await
                        .map_err(|e| NodeError::DatabaseError(format!("mongo insertMany: {e}")))?;
                    let ids: Vec<Value> = res
                        .inserted_ids
                        .into_values()
                        .map(|b| bson_to_json(b).unwrap_or(Value::Null))
                        .collect();
                    Ok(NodeOutput::single(vec![json!({
                        "insertedCount": ids.len(),
                        "insertedIds": ids,
                    })]))
                }
            }
            "update" => {
                let filter = read_doc(ctx, params, "query")?;
                let update = read_doc(ctx, params, "update")?;
                let res = coll
                    .update_many(filter, update)
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("mongo update: {e}")))?;
                Ok(NodeOutput::single(vec![json!({
                    "matchedCount": res.matched_count,
                    "modifiedCount": res.modified_count,
                })]))
            }
            "delete" => {
                let filter = read_doc(ctx, params, "query")?;
                let res = coll
                    .delete_many(filter)
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("mongo delete: {e}")))?;
                Ok(NodeOutput::single(vec![json!({
                    "deletedCount": res.deleted_count,
                })]))
            }
            "aggregate" => {
                let pipeline_value = read_json_value(ctx, params, "pipeline")?;
                let stages = match pipeline_value {
                    Value::Array(arr) => arr,
                    Value::Null => Vec::new(),
                    other => {
                        return Err(NodeError::InvalidParameter {
                            name: "pipeline".into(),
                            reason: format!("expected array, got {}", type_of_json(&other)),
                        });
                    }
                };
                let mut docs: Vec<Document> = Vec::with_capacity(stages.len());
                for stage in &stages {
                    let bson = bson::to_bson(stage)
                        .map_err(|e| NodeError::SerializationError(format!("stage → bson: {e}")))?;
                    match bson {
                        Bson::Document(d) => docs.push(d),
                        _ => {
                            return Err(NodeError::InvalidParameter {
                                name: "pipeline".into(),
                                reason: "each stage must be a JSON object".into(),
                            });
                        }
                    }
                }
                let mut cursor = coll
                    .aggregate(docs)
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("mongo aggregate: {e}")))?;
                let mut out: Vec<Value> = Vec::new();
                while let Some(d) = cursor
                    .try_next()
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("mongo cursor: {e}")))?
                {
                    out.push(bson_to_json(Bson::Document(d))?);
                }
                Ok(NodeOutput::single(out))
            }
            "count" => {
                let filter = read_doc(ctx, params, "query")?;
                let count = coll
                    .count_documents(filter)
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("mongo count: {e}")))?;
                Ok(NodeOutput::single(vec![json!({ "count": count })]))
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

/// Read a JSON parameter and coerce to `bson::Document`.
fn read_doc(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<Document> {
    let value = read_json_value(ctx, params, key)?;
    let resolved = match value {
        Value::Null => Value::Object(serde_json::Map::new()),
        other => other,
    };
    if !resolved.is_object() {
        return Err(NodeError::InvalidParameter {
            name: key.into(),
            reason: format!("expected object, got {}", type_of_json(&resolved)),
        });
    }
    let bson = bson::to_bson(&resolved)
        .map_err(|e| NodeError::SerializationError(format!("{key} → bson: {e}")))?;
    match bson {
        Bson::Document(d) => Ok(d),
        _ => Err(NodeError::InvalidParameter {
            name: key.into(),
            reason: "must be a JSON object".into(),
        }),
    }
}

/// Read a parameter that can either be a JSON value directly or a JSON
/// string that parses into one. Runs `{{var}}` substitution on string form.
fn read_json_value(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<Value> {
    let raw = match params.get(key) {
        Some(v) => v,
        None => return Ok(Value::Null),
    };
    match raw {
        Value::String(s) => {
            let sub = ctx.substitute(s);
            let trimmed = sub.trim();
            if trimmed.is_empty() {
                return Ok(Value::Null);
            }
            serde_json::from_str(trimmed).map_err(|e| NodeError::InvalidParameter {
                name: key.into(),
                reason: format!("not valid JSON: {e}"),
            })
        }
        other => Ok(other.clone()),
    }
}

/// Convert a BSON value to JSON via serde. We go through `serde_json::to_value`
/// so extended-JSON types (`ObjectId`, `DateTime`, etc.) serialize through
/// `bson`'s built-in `Serialize` impl.
fn bson_to_json(b: Bson) -> NodeResult<Value> {
    serde_json::to_value(b).map_err(|e| NodeError::SerializationError(format!("bson → json: {e}")))
}

fn type_of_json(v: &Value) -> &'static str {
    match v {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}
