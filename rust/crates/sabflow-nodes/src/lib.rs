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

pub mod binary;
pub mod context;
pub mod continue_on_fail;
pub mod descriptor;
pub mod error;
pub mod errors;
pub mod item_helpers;
pub mod node;
pub mod nodes;
pub mod registry;

pub use binary::{
    BinaryDataRef, BinaryFetchContext, BinaryStore, InMemoryBinaryStore, UnconfiguredBinaryStore,
    default_binary_store, set_default_binary_store,
};
pub use context::{
    Credential, ExecutionContext, NodeContext, NodeInput, NodeMetrics, NodeOutput, SubFlowInvoker,
    WaitMode, WaitRegistration, WaitResumer,
};
pub use continue_on_fail::{ItemResult, error_sentinel, try_with_continue_on_fail};
pub use descriptor::{
    CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
    NodePropertyType,
};
pub use error::{NodeError, NodeResult};
pub use errors::{
    CredentialFailure, ErrorContext, ExecutorError, ExecutorErrorCode, NodeOperationReason,
    WireError, WorkflowFaultKind, codes,
};
pub use item_helpers::{
    PairOptions, PairedItem, PairedRow, PairingMode, attach_paired_item, error_item, for_each_item,
    for_each_item_async, merge_branches, pair_items, paired_rows_to_items,
};
pub use node::Node;
pub use registry::{NodeRegistry, default_registry};

/// Author-facing attribute macro `#[node(...)]`. Generates the
/// `impl sabflow_nodes::Node for ...` block so a typical node file shrinks
/// from ~80 lines to ~15. See `AUTHORING.md` for the full guide.
///
/// Module-name `node` (the trait module) and macro-name `node` (this re-export)
/// live in different namespaces, so `use sabflow_nodes::node;` resolves to the
/// macro at the attribute-position call site without shadowing the module.
pub use sabflow_node_derive::node;
