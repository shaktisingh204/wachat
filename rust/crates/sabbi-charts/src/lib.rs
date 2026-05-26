//! # sabbi-charts
//!
//! Chart entity + query execution. Each chart owns: type (bar/line/pie/
//! table/kpi/map/heatmap), config (dimensions/measures/aggregation),
//! filters, and drilldown definition.
//!
//! `POST /v1/sabbi/charts/{chartId}/run` is the execution endpoint that the
//! workbook editor and the public embed both hit.

pub mod dto;
pub mod handlers;
pub mod query_exec;
pub mod router;
pub mod types;

pub use router::router;
