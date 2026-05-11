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
pub mod node;
pub mod nodes;
pub mod registry;

pub use context::{Credential, ExecutionContext, NodeInput, NodeOutput};
pub use descriptor::{
    CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
    NodePropertyType,
};
pub use error::{NodeError, NodeResult};
pub use node::Node;
pub use registry::{default_registry, NodeRegistry};
