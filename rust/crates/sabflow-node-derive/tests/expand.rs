//! Integration tests for the `#[node]` attribute macro.
//!
//! Because `sabflow-nodes` depends on `sabflow-node-derive`, this test crate
//! cannot import the real `sabflow-nodes` (cycle). Instead it declares a
//! minimal local module tree that mirrors the surface the macro emits paths
//! to (`::sabflow_nodes::descriptor::*`, `::sabflow_nodes::node::Node`, etc.),
//! plus `extern crate self as sabflow_nodes;` so the macro's absolute paths
//! resolve back into this test crate.
//!
//! These tests pass if the macro expansion compiles and the descriptor
//! returned at runtime matches the attribute keys.

extern crate self as sabflow_nodes;

use sabflow_node_derive::node;
use serde_json::Value;

// ── Stub mirror of the real `sabflow-nodes` public surface ─────────────────

pub mod descriptor {
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub enum NodeCategory {
        Trigger,
        Action,
        Logic,
        Transform,
        Ai,
        Communication,
        Productivity,
        Crm,
        Marketing,
        Developer,
        Database,
        Storage,
        Analytics,
        Files,
        Sales,
        Finance,
        Hr,
        Misc,
    }

    #[derive(Debug, Clone, Default, PartialEq, Eq)]
    pub struct NodeProperty {
        pub name: String,
        pub display_name: String,
    }

    impl NodeProperty {
        pub fn new(name: &str, display_name: &str, _ty: NodePropertyType) -> Self {
            Self {
                name: name.into(),
                display_name: display_name.into(),
            }
        }
    }

    #[derive(Debug, Clone, PartialEq, Eq)]
    pub enum NodePropertyType {
        String,
        Number,
        Boolean,
    }

    #[derive(Debug, Clone, Default, PartialEq, Eq)]
    pub struct CredentialBinding {
        pub name: String,
        pub display_name: String,
        pub required: bool,
    }

    #[derive(Debug, Clone)]
    pub struct NodeDescriptor {
        pub name: String,
        pub display_name: String,
        pub description: String,
        pub category: NodeCategory,
        pub version: u32,
        pub icon: String,
        pub color: String,
        pub is_trigger: bool,
        pub inputs: u32,
        pub outputs: u32,
        pub credentials: Vec<CredentialBinding>,
        pub properties: Vec<NodeProperty>,
        pub stub: bool,
    }

    impl NodeDescriptor {
        pub fn new(name: &str, display: &str, description: &str, category: NodeCategory) -> Self {
            Self {
                name: name.into(),
                display_name: display.into(),
                description: description.into(),
                category,
                version: 1,
                icon: String::new(),
                color: String::new(),
                is_trigger: false,
                inputs: 1,
                outputs: 1,
                credentials: vec![],
                properties: vec![],
                stub: false,
            }
        }
        pub fn icon(mut self, v: &str) -> Self {
            self.icon = v.into();
            self
        }
        pub fn color(mut self, v: &str) -> Self {
            self.color = v.into();
            self
        }
        pub fn trigger(mut self) -> Self {
            self.is_trigger = true;
            self.inputs = 0;
            self
        }
        pub fn outputs(mut self, n: u32) -> Self {
            self.outputs = n;
            self
        }
        pub fn properties(mut self, p: Vec<NodeProperty>) -> Self {
            self.properties = p;
            self
        }
        pub fn credentials(mut self, c: Vec<CredentialBinding>) -> Self {
            self.credentials = c;
            self
        }
        pub fn stub(mut self) -> Self {
            self.stub = true;
            self
        }
    }
}

pub mod context {
    #[derive(Default)]
    pub struct ExecutionContext;

    #[derive(Default)]
    pub struct NodeInput {
        pub items: Vec<serde_json::Value>,
    }

    #[derive(Default)]
    pub struct NodeOutput {
        pub branches: Vec<NodeInput>,
    }
    impl NodeOutput {
        pub fn single(items: Vec<serde_json::Value>) -> Self {
            Self {
                branches: vec![NodeInput { items }],
            }
        }
    }
}

pub mod error {
    #[derive(Debug)]
    pub enum NodeError {
        Other(String),
    }
    pub type NodeResult<T> = Result<T, NodeError>;
}

pub mod node {
    use super::context::{ExecutionContext, NodeInput, NodeOutput};
    use super::descriptor::NodeDescriptor;
    use super::error::NodeResult;
    use async_trait::async_trait;
    use serde_json::Value;

    #[async_trait]
    pub trait Node: Send + Sync {
        fn descriptor(&self) -> NodeDescriptor;
        async fn execute(
            &self,
            ctx: &mut ExecutionContext,
            input: NodeInput,
            params: &Value,
        ) -> NodeResult<NodeOutput>;
    }
}

// Re-export so `::sabflow_nodes::Node` works as a convenience path.
pub use node::Node;

// ── Test nodes built with #[node] ──────────────────────────────────────────

use context::{ExecutionContext, NodeInput, NodeOutput};
use descriptor::{NodeCategory, NodeProperty, NodePropertyType};
use error::NodeResult;

/// Minimal node — exercises the smallest legal attribute set.
pub struct MinimalNode;

#[node(
    name = "minimal",
    display = "Minimal",
    description = "Smallest possible node",
    category = "logic"
)]
impl MinimalNode {
    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Ok(NodeOutput::single(input.items))
    }
}

/// Rich node — exercises every optional attribute and the optional helper fns.
pub struct RichNode;

#[node(
    name = "rich",
    display = "Rich Node",
    description = "Exercises every optional attribute",
    category = Ai,
    icon = "sparkles",
    color = "#abcdef",
    version = 7,
    is_trigger = false,
    outputs = 3
)]
impl RichNode {
    fn properties() -> Vec<NodeProperty> {
        vec![
            NodeProperty::new("foo", "Foo", NodePropertyType::String),
            NodeProperty::new("bar", "Bar", NodePropertyType::Number),
        ]
    }

    fn credentials() -> Vec<descriptor::CredentialBinding> {
        vec![descriptor::CredentialBinding {
            name: "richApi".into(),
            display_name: "Rich API".into(),
            required: true,
        }]
    }

    // Helper function — should be re-emitted into an inherent impl.
    fn _helper(x: u32) -> u32 {
        x + 1
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        let _ = Self::_helper(0);
        Ok(NodeOutput::single(vec![]))
    }
}

/// Trigger node — verifies `is_trigger = true` flips `inputs` to 0.
pub struct TriggerNode;

#[node(
    name = "myTrigger",
    display = "My Trigger",
    description = "Fires once",
    category = "trigger",
    is_trigger = true
)]
impl TriggerNode {
    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Ok(NodeOutput::single(vec![]))
    }
}

// ── Assertions ─────────────────────────────────────────────────────────────

#[test]
fn minimal_descriptor_matches() {
    let d = MinimalNode.descriptor();
    assert_eq!(d.name, "minimal");
    assert_eq!(d.display_name, "Minimal");
    assert_eq!(d.description, "Smallest possible node");
    assert_eq!(d.category, NodeCategory::Logic);
    assert_eq!(d.version, 1);
    assert_eq!(d.is_trigger, false);
    assert_eq!(d.inputs, 1);
    assert_eq!(d.outputs, 1);
    assert!(d.properties.is_empty());
    assert!(d.credentials.is_empty());
    assert!(!d.stub);
}

#[test]
fn rich_descriptor_matches() {
    let d = RichNode.descriptor();
    assert_eq!(d.name, "rich");
    assert_eq!(d.display_name, "Rich Node");
    assert_eq!(d.category, NodeCategory::Ai);
    assert_eq!(d.icon, "sparkles");
    assert_eq!(d.color, "#abcdef");
    assert_eq!(d.version, 7);
    assert_eq!(d.outputs, 3);
    assert_eq!(d.properties.len(), 2);
    assert_eq!(d.properties[0].name, "foo");
    assert_eq!(d.credentials.len(), 1);
    assert_eq!(d.credentials[0].name, "richApi");
}

#[test]
fn trigger_descriptor_flips_inputs() {
    let d = TriggerNode.descriptor();
    assert!(d.is_trigger);
    assert_eq!(d.inputs, 0);
    assert_eq!(d.category, NodeCategory::Trigger);
}

#[tokio::test]
async fn execute_runs_through_macro() {
    let n = MinimalNode;
    let mut ctx = ExecutionContext::default();
    let input = NodeInput {
        items: vec![serde_json::json!({"hello": "world"})],
    };
    let out = n
        .execute(&mut ctx, input, &serde_json::Value::Null)
        .await
        .unwrap();
    assert_eq!(out.branches.len(), 1);
    assert_eq!(out.branches[0].items.len(), 1);
}
