//! Per-step config DTOs.
//!
//! Each struct here is the `config` block for one [`crate::step::StepKind`]
//! variant. They are kept intentionally narrow — only fields the UI editor
//! collects — to make round-tripping over the wire trivial.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::step::Row;

// ─── filter ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterOp {
    pub column: String,
    pub operator: FilterOperator,
    /// Operand. `None` is valid for `IsNull` / `IsNotNull`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<Value>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FilterOperator {
    #[default]
    Equals,
    NotEquals,
    Contains,
    NotContains,
    StartsWith,
    EndsWith,
    Gt,
    Gte,
    Lt,
    Lte,
    IsNull,
    IsNotNull,
}

// ─── rename ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameOp {
    pub from: String,
    pub to: String,
}

// ─── derive ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeriveOp {
    /// New column name.
    pub target: String,
    /// Expression string. Today: very small DSL — `{col}` placeholders +
    /// `concat` / `upper` / `lower` / `trim` / literal strings.
    /// Future: full expression parser.
    pub expression: String,
}

// ─── split ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitOp {
    pub column: String,
    pub delimiter: String,
    /// Output column names. Extra parts beyond `into.len()` are dropped.
    pub into: Vec<String>,
    /// If true, keep the original column too. Defaults to false.
    #[serde(default)]
    pub keep_original: bool,
}

// ─── replace ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceOp {
    pub column: String,
    pub find: String,
    pub replace: String,
    /// Case-insensitive match.
    #[serde(default)]
    pub case_insensitive: bool,
    /// Whole-cell match vs substring.
    #[serde(default)]
    pub whole_cell: bool,
}

// ─── deduplicate ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeduplicateOp {
    /// If empty → dedupe across all columns. Else only `subset` columns
    /// are considered when comparing rows.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub subset: Vec<String>,
}

// ─── fillNulls ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FillNullsOp {
    pub column: String,
    pub fill_with: Value,
}

// ─── typeCast ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeCastOp {
    pub column: String,
    pub target_type: CastType,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CastType {
    #[default]
    String,
    Number,
    Integer,
    Bool,
}

// ─── join ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinOp {
    /// Mongo `_id` of the second dataset (resolved by the recipe handler
    /// before running). The handler injects rows into `right_rows` at
    /// execution time; the wire DTO only carries the dataset id.
    pub right_dataset_id: String,
    pub on: Vec<JoinKey>,
    #[serde(default)]
    pub join_type: JoinType,
    /// Suffix appended to right-side columns that collide with left-side
    /// columns (default: "_right").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub right_suffix: Option<String>,
    /// **Engine-only.** Populated by the handler before invoking the
    /// engine — not part of the persisted recipe.
    #[serde(skip)]
    pub right_rows: Vec<Row>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinKey {
    pub left: String,
    pub right: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JoinType {
    #[default]
    Inner,
    Left,
    Right,
    Outer,
}

// ─── union ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnionOp {
    pub other_dataset_id: String,
    /// Engine-only — see [`JoinOp::right_rows`].
    #[serde(skip)]
    pub other_rows: Vec<Row>,
}

// ─── aggregate ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AggregateOp {
    /// Columns to group by. Empty → single-group rollup.
    #[serde(default)]
    pub group_by: Vec<String>,
    pub aggregations: Vec<Aggregation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Aggregation {
    pub column: String,
    pub func: AggregateFunc,
    /// Output column name. Defaults client-side to e.g. `sum_amount`.
    pub output: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AggregateFunc {
    #[default]
    Count,
    Sum,
    Avg,
    Min,
    Max,
    CountDistinct,
}

// ─── pivot ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PivotOp {
    /// Column whose distinct values become new column names.
    pub pivot_column: String,
    /// Column whose values fill the cells.
    pub value_column: String,
    /// Columns kept as the "index".
    pub index_columns: Vec<String>,
    #[serde(default)]
    pub agg_func: AggregateFunc,
}

// ─── unpivot ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnpivotOp {
    /// Columns to melt into rows.
    pub value_columns: Vec<String>,
    pub var_name: String,
    pub value_name: String,
    /// Columns to keep as id vars.
    #[serde(default)]
    pub id_columns: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filter_op_round_trips() {
        let op = FilterOp {
            column: "name".to_owned(),
            operator: FilterOperator::StartsWith,
            value: Some(Value::String("A".to_owned())),
        };
        let s = serde_json::to_string(&op).unwrap();
        assert!(s.contains("\"operator\":\"starts_with\""));
        let back: FilterOp = serde_json::from_str(&s).unwrap();
        assert_eq!(back.operator, FilterOperator::StartsWith);
    }

    #[test]
    fn aggregate_func_snake_cased() {
        let s = serde_json::to_string(&AggregateFunc::CountDistinct).unwrap();
        assert_eq!(s, "\"count_distinct\"");
    }

    #[test]
    fn join_right_rows_not_persisted() {
        let op = JoinOp {
            right_dataset_id: "abc".to_owned(),
            on: vec![JoinKey {
                left: "id".to_owned(),
                right: "id".to_owned(),
            }],
            join_type: JoinType::Inner,
            right_suffix: None,
            right_rows: vec![Row::new()],
        };
        let s = serde_json::to_string(&op).unwrap();
        assert!(!s.contains("rightRows"));
        assert!(s.contains("rightDatasetId"));
    }
}
