//! # sabflow-engine-runtime
//!
//! Executes a serialised SabFlow document by traversing its blocks/edges and
//! dispatching each block to the [`sabflow_nodes::NodeRegistry`].
//!
//! This crate provides the foundation; the full graph walker is filled in by
//! the engine task in Phase 7.

pub mod engine;

pub use engine::{ExecuteFlowInput, ExecuteFlowOutput, FlowEngine};
