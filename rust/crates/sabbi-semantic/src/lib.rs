//! # sabbi-semantic
//!
//! The SabBI semantic/metrics layer — the governed center of gravity of the
//! BI module. A `BiModel` names a base collection and a reusable vocabulary of
//! **measures** (aggregations), **dimensions** (grouping fields), **joins**
//! (cross-collection `$lookup`s), and **segments** (named filters). Every
//! consumer — charts, dashboards, the AI copilot, embeds — authors a
//! `MetricQuery` against a model rather than touching raw collections, so a
//! metric like "revenue" or "win rate" is defined once and compiled
//! deterministically to the Mongo aggregation engine.
//!
//! HTTP surface: CRUD over `sabbi_models`, mounted at `/v1/sabbi/models`.
//! Tenant-scoped by the active project via `crm_common::tenant::tenant_oid`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
pub use types::{BiModel, Dimension, Join, Measure, Segment};
