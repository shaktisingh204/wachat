//! # sabflow-nodes
//!
//! Node registry, descriptors, and runtime for SabFlow.
//! Provides n8n-parity node implementations for the Rust execution engine.
//!
//! Add a new node by:
//!   1. creating `src/nodes/<name>.rs` that implements [`Node`]
//!   2. adding it to `src/nodes/mod.rs`
//!   3. registering it in [`registry::default_registry`]
//!
//! The registry is consumed by the engine runtime (`sabflow-engine-runtime`)
//! and exposed over HTTP so the frontend can render a generic settings UI
//! from each node's [`NodeDescriptor`].

pub mod context;
pub mod descriptor;
pub mod error;
pub mod errors;
pub mod node;
pub mod nodes;
pub mod registry;

pub use context::{Credential, ExecutionContext, NodeInput, NodeOutput};
pub use descriptor::{
    CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
    NodePropertyType,
};
pub use error::{NodeError, NodeResult};
pub use errors::{
    codes, CredentialFailure, ErrorContext, ExecutorError, ExecutorErrorCode, NodeOperationReason,
    WireError, WorkflowFaultKind,
};
pub use node::Node;
pub use registry::{default_registry, NodeRegistry};

/// Author-facing attribute macro `#[node(...)]`. Generates the
/// `impl sabflow_nodes::Node for ...` block so a typical node file shrinks
/// from ~80 lines to ~15. See `AUTHORING.md` for the full guide.
///
/// Module-name `node` (the trait module) and macro-name `node` (this re-export)
/// live in different namespaces, so `use sabflow_nodes::node;` resolves to the
/// macro at the attribute-position call site without shadowing the module.
pub use sabflow_node_derive::node;
