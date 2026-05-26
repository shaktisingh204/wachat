//! Step DTOs.
//!
//! Each variant of [`StepKind`] is a single transformation. Steps are
//! stored in a recipe as an ordered `Vec<Step>` and applied in order by
//! the engine in [`crate::engine`].

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::ops::{
    AggregateOp, DeriveOp, FillNullsOp, FilterOp, JoinOp, PivotOp, RenameOp,
    ReplaceOp, SplitOp, TypeCastOp, UnionOp, UnpivotOp, DeduplicateOp,
};

/// A single tabular row. Column → JSON scalar (or array/object). The engine
/// treats `Value::Null` and missing keys as equivalent.
pub type Row = HashMap<String, Value>;

/// One typed transformation in a recipe. Tagged-enum representation —
/// `{ "kind": "filter", "config": { ... } }` on the wire.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Step {
    /// Stable client-side id used for reorder / edit / delete handles.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Optional human label shown on the step card.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// Toggle to skip the step without removing it from the recipe.
    #[serde(default)]
    pub disabled: bool,
    #[serde(flatten)]
    pub kind: StepKind,
}

/// The full set of supported step operations.
///
/// Serialised as `{ "kind": "<variant>", "config": <op> }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "config", rename_all = "camelCase")]
pub enum StepKind {
    Filter(FilterOp),
    Rename(RenameOp),
    Derive(DeriveOp),
    Split(SplitOp),
    Replace(ReplaceOp),
    Deduplicate(DeduplicateOp),
    FillNulls(FillNullsOp),
    TypeCast(TypeCastOp),
    Join(JoinOp),
    Union(UnionOp),
    Aggregate(AggregateOp),
    Pivot(PivotOp),
    Unpivot(UnpivotOp),
}

/// A non-fatal failure encountered while applying a step. Logged into the
/// run document; the engine still finishes the remaining steps.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepError {
    pub step_index: u32,
    pub step_kind: String,
    pub message: String,
    /// Optional row index where the error originated.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub row_index: Option<u32>,
}

/// Summary of a single step's effect — populated by the engine.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepRunSummary {
    pub step_index: u32,
    pub step_kind: String,
    pub rows_in: u32,
    pub rows_out: u32,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub errors: Vec<StepError>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn step_round_trip_filter() {
        let s = Step {
            id: Some("s1".to_owned()),
            label: Some("Active only".to_owned()),
            disabled: false,
            kind: StepKind::Filter(FilterOp {
                column: "status".to_owned(),
                operator: crate::ops::FilterOperator::Equals,
                value: Some(Value::String("active".to_owned())),
            }),
        };
        let json = serde_json::to_value(&s).unwrap();
        assert_eq!(json["kind"], "filter");
        assert_eq!(json["config"]["column"], "status");
        let back: Step = serde_json::from_value(json).unwrap();
        assert!(matches!(back.kind, StepKind::Filter(_)));
    }

    #[test]
    fn step_summary_serialises() {
        let s = StepRunSummary {
            step_index: 0,
            step_kind: "filter".to_owned(),
            rows_in: 100,
            rows_out: 42,
            errors: vec![],
        };
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("\"stepIndex\":0"));
        assert!(json.contains("\"rowsOut\":42"));
    }
}
