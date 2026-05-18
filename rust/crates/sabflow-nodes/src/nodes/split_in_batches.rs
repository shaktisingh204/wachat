//! Split In Batches node — chunk items into fixed-size batches.
//!
//! n8n's `n8n-nodes-base.splitInBatches` is implemented as a stateful loop
//! node in the editor: it tracks a `batchIndex` across iterations and the
//! runtime re-enters it after each downstream pass. SabFlow's engine doesn't
//! yet expose that re-entrancy state to nodes, so this implementation does
//! the **non-looping** form — emit all batches as a single output, one item
//! per batch, with `batchIndex` / `batchSize` / `isLast` metadata. Downstream
//! nodes can `splitOutItems` on `data` to fan back out, or iterate manually
//! via the engine's `executeBlock` re-entry once that surface exists.
//!
//! Operations:
//! - `batch`: chunk `input.items` into groups of `batchSize` and emit one
//!   item per batch with `{ batchIndex, batchSize, isLast, data }`.
//!
//! Pure local computation; no HTTP.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct SplitInBatchesNode;

#[async_trait]
impl Node for SplitInBatchesNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "splitInBatches",
            "Split In Batches",
            "Chunk items into batches of a fixed size",
            NodeCategory::Logic,
        )
        .icon("layers")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("batchSize", "Batch Size", NodePropertyType::Number)
                .description("Number of items per batch")
                .default(json!(10))
                .required(),
            NodeProperty::new("resetOnFirst", "Reset On First Item", NodePropertyType::Boolean)
                .description("Reset batchIndex to 0 on the first run (no-op in stateless mode)")
                .default(json!(true)),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let batch_size = ctx
            .param_f64(params, "batchSize")
            .map(|n| n as i64)
            .unwrap_or(10);

        if batch_size <= 0 {
            return Err(NodeError::InvalidParameter {
                name: "batchSize".into(),
                reason: "must be greater than zero".into(),
            });
        }
        let batch_size = batch_size as usize;

        let total = input.items.len();
        if total == 0 {
            // No items — emit a single empty batch so flows that expect one
            // tick still proceed.
            let mut obj = Map::new();
            obj.insert("batchIndex".into(), json!(0));
            obj.insert("batchSize".into(), json!(0));
            obj.insert("isLast".into(), json!(true));
            obj.insert("data".into(), Value::Array(vec![]));
            return Ok(NodeOutput::single(vec![Value::Object(obj)]));
        }

        let mut out_items: Vec<Value> = Vec::with_capacity(total.div_ceil(batch_size));
        let mut batch_index = 0usize;
        let total_batches = total.div_ceil(batch_size);
        for chunk in input.items.chunks(batch_size) {
            let mut obj = Map::new();
            obj.insert("batchIndex".into(), json!(batch_index));
            obj.insert("batchSize".into(), json!(chunk.len()));
            obj.insert("isLast".into(), json!(batch_index + 1 == total_batches));
            obj.insert("data".into(), Value::Array(chunk.to_vec()));
            out_items.push(Value::Object(obj));
            batch_index += 1;
        }

        Ok(NodeOutput::single(out_items))
    }
}
