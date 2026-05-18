//! Compare Datasets node — diff two arrays of records by a join key.
//!
//! Mirrors n8n's `n8n-nodes-base.compareDatasets`. Both datasets come in
//! through the same input branch — convention is that upstream nodes write
//! `dataset1` and `dataset2` as array fields on the first item, OR send a
//! single item with two arrays under named fields. To stay flexible we read
//! both arrays from explicit field paths (`leftPath`, `rightPath`) on the
//! first incoming item.
//!
//! Output is a single item containing four arrays:
//!   - `same`:     rows whose join keys match (paired left/right)
//!   - `differs`:  rows whose join keys match but whose row content differs
//!   - `onlyLeft`:  rows present only in dataset1
//!   - `onlyRight`: rows present only in dataset2
//!
//! Pure local computation; no HTTP.

use async_trait::async_trait;
use std::collections::HashMap;

use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct CompareDatasetsNode;

fn value_at_path<'a>(root: &'a Value, path: &str) -> Option<&'a Value> {
    if path.is_empty() {
        return Some(root);
    }
    let mut cur = root;
    for segment in path.split('.') {
        if segment.is_empty() {
            continue;
        }
        cur = cur.get(segment)?;
    }
    Some(cur)
}

fn key_of(record: &Value, key_path: &str) -> String {
    value_at_path(record, key_path)
        .map(|v| match v {
            Value::String(s) => s.clone(),
            Value::Null => "__null__".to_string(),
            other => other.to_string(),
        })
        .unwrap_or_else(|| "__missing__".to_string())
}

fn as_array(v: Option<&Value>) -> Vec<Value> {
    match v {
        Some(Value::Array(a)) => a.clone(),
        Some(other) => vec![other.clone()],
        None => vec![],
    }
}

#[async_trait]
impl Node for CompareDatasetsNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "compareDatasets",
            "Compare Datasets",
            "Diff two arrays of records by a join key",
            NodeCategory::Transform,
        )
        .icon("git-compare")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("leftPath", "Left Dataset Path", NodePropertyType::String)
                .description("Field on the first input item containing dataset1 (array)")
                .placeholder("dataset1")
                .default(json!("dataset1"))
                .required(),
            NodeProperty::new("rightPath", "Right Dataset Path", NodePropertyType::String)
                .description("Field on the first input item containing dataset2 (array)")
                .placeholder("dataset2")
                .default(json!("dataset2"))
                .required(),
            NodeProperty::new("joinKey", "Join Key", NodePropertyType::String)
                .description("Field within each record used to match left and right rows")
                .placeholder("id")
                .required(),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let left_path = ctx.param_str(params, "leftPath")?;
        let right_path = ctx.param_str(params, "rightPath")?;
        let join_key = ctx.param_str(params, "joinKey")?;

        let root = input.items.first().cloned().unwrap_or(Value::Null);
        let left = as_array(value_at_path(&root, &left_path));
        let right = as_array(value_at_path(&root, &right_path));

        if left.is_empty() && right.is_empty() {
            return Err(NodeError::InvalidParameter {
                name: "leftPath/rightPath".into(),
                reason: "both datasets are empty or missing".into(),
            });
        }

        let mut right_index: HashMap<String, Value> = HashMap::with_capacity(right.len());
        for record in right.iter() {
            right_index.insert(key_of(record, &join_key), record.clone());
        }

        let mut same: Vec<Value> = Vec::new();
        let mut differs: Vec<Value> = Vec::new();
        let mut only_left: Vec<Value> = Vec::new();

        for record in left.into_iter() {
            let k = key_of(&record, &join_key);
            match right_index.remove(&k) {
                Some(rhs) => {
                    let mut paired = Map::new();
                    paired.insert("key".into(), Value::String(k.clone()));
                    paired.insert("left".into(), record.clone());
                    paired.insert("right".into(), rhs.clone());
                    if record == rhs {
                        same.push(Value::Object(paired));
                    } else {
                        differs.push(Value::Object(paired));
                    }
                }
                None => only_left.push(record),
            }
        }

        let only_right: Vec<Value> = right_index.into_values().collect();

        let mut body = Map::new();
        body.insert("same".into(), Value::Array(same));
        body.insert("differs".into(), Value::Array(differs));
        body.insert("onlyLeft".into(), Value::Array(only_left));
        body.insert("onlyRight".into(), Value::Array(only_right));

        Ok(NodeOutput::single(vec![Value::Object(body)]))
    }
}
