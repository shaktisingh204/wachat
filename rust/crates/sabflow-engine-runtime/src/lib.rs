//! # sabflow-engine-runtime
//!
//! Executes a serialised SabFlow document by traversing its blocks/edges and
//! dispatching each block to the [`sabflow_nodes::NodeRegistry`].
//!
//! Also exposes HTTP endpoints (under `/v1/sabflow`) for:
//!   - `GET /nodes`            — list all registered node descriptors
//!   - `GET /nodes/:type`      — single node descriptor by name
//!   - `POST /internal/execute` — execute a flow (called by the TS worker)

pub mod engine;
pub mod router;
pub mod state;

pub use engine::{ExecuteFlowInput, ExecuteFlowOutput, FlowEngine};
pub use router::router;
pub use state::SabflowRuntimeState;
