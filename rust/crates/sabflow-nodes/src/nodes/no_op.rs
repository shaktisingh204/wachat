//! No Operation node — pass items through unchanged.
//!
//! Useful as a join point, a labelled placeholder while wiring a flow, or as
//! a target for the IF/Switch "default" branch when you want to capture items
//! without doing anything with them.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct NoOpNode;

#[async_trait]
impl Node for NoOpNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "noOp",
            "No Operation",
            "Pass items through unchanged",
            NodeCategory::Logic,
        )
        .icon("circle-dashed")
        .color("#737373")
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Ok(NodeOutput::single(input.items))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Arc;

    fn ctx() -> ExecutionContext {
        ExecutionContext::new(
            "test-exec".to_string(),
            Arc::new(reqwest::Client::new()),
        )
    }

    #[tokio::test]
    async fn passthrough_preserves_items_verbatim() {
        let node = NoOpNode;
        let mut c = ctx();
        let items = vec![json!({"a": 1}), json!({"b": "two"})];
        let out = node
            .execute(
                &mut c,
                NodeInput::many(items.clone()),
                &json!({}),
            )
            .await
            .unwrap();
        assert_eq!(out.branches.len(), 1);
        assert_eq!(out.branches[0].items, items);
    }

    #[tokio::test]
    async fn passthrough_empty_yields_one_empty_branch() {
        let node = NoOpNode;
        let mut c = ctx();
        let out = node
            .execute(&mut c, NodeInput::empty(), &json!({}))
            .await
            .unwrap();
        assert_eq!(out.branches.len(), 1);
        assert!(out.branches[0].items.is_empty());
    }

    #[test]
    fn descriptor_is_not_a_stub() {
        let d = NoOpNode.descriptor();
        assert_eq!(d.name, "noOp");
        assert!(!d.stub, "NoOp must not be registered as a stub");
    }
}
