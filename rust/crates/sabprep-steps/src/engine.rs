//! Bounded in-memory execution engine.
//!
//! ## Invariants
//! - Operates on `Vec<Row>` where `Row = HashMap<String, Value>`.
//! - Memory-safe for small/medium datasets — no streaming, no spill.
//! - Disabled steps are skipped (recipe author can toggle them).
//! - Errors per step are recorded into `StepError` but never abort the run
//!   (matches Zoho DataPrep behavior — partial success is acceptable for
//!   a preview/preview-run flow).

use std::collections::{BTreeMap, HashMap, HashSet};

use serde_json::{Number, Value};

use crate::ops::{
    AggregateFunc, AggregateOp, CastType, DeduplicateOp, DeriveOp, FillNullsOp, FilterOp,
    FilterOperator, JoinOp, JoinType, PivotOp, RenameOp, ReplaceOp, SplitOp, TypeCastOp, UnionOp,
    UnpivotOp,
};
use crate::step::{Row, Step, StepError, StepKind, StepRunSummary};

/// Output of one full recipe execution.
#[derive(Debug, Clone)]
pub struct ExecutionResult {
    pub rows: Vec<Row>,
    pub summaries: Vec<StepRunSummary>,
    pub total_errors: u32,
}

/// Apply `steps` to `input` in order. Disabled steps are skipped.
pub fn apply_steps(input: Vec<Row>, steps: &[Step]) -> ExecutionResult {
    let mut rows = input;
    let mut summaries = Vec::with_capacity(steps.len());
    let mut total_errors: u32 = 0;

    for (idx, step) in steps.iter().enumerate() {
        if step.disabled {
            continue;
        }
        let rows_in = rows.len() as u32;
        let step_kind = step_kind_name(&step.kind);
        let mut errors: Vec<StepError> = Vec::new();

        rows = match &step.kind {
            StepKind::Filter(op) => apply_filter(rows, op),
            StepKind::Rename(op) => apply_rename(rows, op),
            StepKind::Derive(op) => apply_derive(rows, op, idx as u32, &mut errors),
            StepKind::Split(op) => apply_split(rows, op),
            StepKind::Replace(op) => apply_replace(rows, op),
            StepKind::Deduplicate(op) => apply_dedupe(rows, op),
            StepKind::FillNulls(op) => apply_fill_nulls(rows, op),
            StepKind::TypeCast(op) => apply_type_cast(rows, op, idx as u32, &mut errors),
            StepKind::Join(op) => apply_join(rows, op),
            StepKind::Union(op) => apply_union(rows, op),
            StepKind::Aggregate(op) => apply_aggregate(rows, op),
            StepKind::Pivot(op) => apply_pivot(rows, op),
            StepKind::Unpivot(op) => apply_unpivot(rows, op),
        };

        total_errors += errors.len() as u32;
        summaries.push(StepRunSummary {
            step_index: idx as u32,
            step_kind: step_kind.to_owned(),
            rows_in,
            rows_out: rows.len() as u32,
            errors,
        });
    }

    ExecutionResult {
        rows,
        summaries,
        total_errors,
    }
}

fn step_kind_name(k: &StepKind) -> &'static str {
    match k {
        StepKind::Filter(_) => "filter",
        StepKind::Rename(_) => "rename",
        StepKind::Derive(_) => "derive",
        StepKind::Split(_) => "split",
        StepKind::Replace(_) => "replace",
        StepKind::Deduplicate(_) => "deduplicate",
        StepKind::FillNulls(_) => "fillNulls",
        StepKind::TypeCast(_) => "typeCast",
        StepKind::Join(_) => "join",
        StepKind::Union(_) => "union",
        StepKind::Aggregate(_) => "aggregate",
        StepKind::Pivot(_) => "pivot",
        StepKind::Unpivot(_) => "unpivot",
    }
}

// ─── helpers ─────────────────────────────────────────────────────────────

fn value_as_f64(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse::<f64>().ok(),
        Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
        _ => None,
    }
}

fn value_as_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

fn is_null_like(v: Option<&Value>) -> bool {
    matches!(v, None | Some(Value::Null)) || matches!(v, Some(Value::String(s)) if s.is_empty())
}

fn compare_values(a: &Value, b: &Value) -> std::cmp::Ordering {
    use std::cmp::Ordering::*;
    if let (Some(x), Some(y)) = (value_as_f64(a), value_as_f64(b)) {
        x.partial_cmp(&y).unwrap_or(Equal)
    } else {
        value_as_string(a).cmp(&value_as_string(b))
    }
}

// ─── filter ──────────────────────────────────────────────────────────────

fn apply_filter(rows: Vec<Row>, op: &FilterOp) -> Vec<Row> {
    rows.into_iter().filter(|r| matches_filter(r, op)).collect()
}

fn matches_filter(row: &Row, op: &FilterOp) -> bool {
    let v = row.get(&op.column);
    match op.operator {
        FilterOperator::IsNull => is_null_like(v),
        FilterOperator::IsNotNull => !is_null_like(v),
        FilterOperator::Equals => v
            .and_then(|v| {
                op.value
                    .as_ref()
                    .map(|val| compare_values(v, val) == std::cmp::Ordering::Equal)
            })
            .unwrap_or(false),
        FilterOperator::NotEquals => v
            .and_then(|v| {
                op.value
                    .as_ref()
                    .map(|val| compare_values(v, val) != std::cmp::Ordering::Equal)
            })
            .unwrap_or(true),
        FilterOperator::Gt => cmp_op(v, op.value.as_ref(), std::cmp::Ordering::Greater, false),
        FilterOperator::Gte => cmp_op(v, op.value.as_ref(), std::cmp::Ordering::Greater, true),
        FilterOperator::Lt => cmp_op(v, op.value.as_ref(), std::cmp::Ordering::Less, false),
        FilterOperator::Lte => cmp_op(v, op.value.as_ref(), std::cmp::Ordering::Less, true),
        FilterOperator::Contains => str_op(v, op.value.as_ref(), |h, n| h.contains(n)),
        FilterOperator::NotContains => !str_op(v, op.value.as_ref(), |h, n| h.contains(n)),
        FilterOperator::StartsWith => str_op(v, op.value.as_ref(), |h, n| h.starts_with(n)),
        FilterOperator::EndsWith => str_op(v, op.value.as_ref(), |h, n| h.ends_with(n)),
    }
}

fn cmp_op(
    lhs: Option<&Value>,
    rhs: Option<&Value>,
    target: std::cmp::Ordering,
    or_eq: bool,
) -> bool {
    if let (Some(a), Some(b)) = (lhs, rhs) {
        let ord = compare_values(a, b);
        ord == target || (or_eq && ord == std::cmp::Ordering::Equal)
    } else {
        false
    }
}

fn str_op(lhs: Option<&Value>, rhs: Option<&Value>, f: fn(&str, &str) -> bool) -> bool {
    match (lhs, rhs) {
        (Some(a), Some(b)) => f(&value_as_string(a), &value_as_string(b)),
        _ => false,
    }
}

// ─── rename ──────────────────────────────────────────────────────────────

fn apply_rename(rows: Vec<Row>, op: &RenameOp) -> Vec<Row> {
    rows.into_iter()
        .map(|mut r| {
            if let Some(v) = r.remove(&op.from) {
                r.insert(op.to.clone(), v);
            }
            r
        })
        .collect()
}

// ─── derive ──────────────────────────────────────────────────────────────

fn apply_derive(
    rows: Vec<Row>,
    op: &DeriveOp,
    step_index: u32,
    errors: &mut Vec<StepError>,
) -> Vec<Row> {
    rows.into_iter()
        .enumerate()
        .map(|(i, mut r)| {
            match eval_expression(&op.expression, &r) {
                Ok(v) => {
                    r.insert(op.target.clone(), v);
                }
                Err(e) => {
                    errors.push(StepError {
                        step_index,
                        step_kind: "derive".to_owned(),
                        message: e,
                        row_index: Some(i as u32),
                    });
                }
            }
            r
        })
        .collect()
}

/// Tiny expression evaluator:
///   - `{col}` is replaced with the row's value for `col`
///   - Optional prefix function wrapper: `upper(...)`, `lower(...)`, `trim(...)`, `concat(a,b,...)`
///   - Otherwise the expression itself is returned as a string after
///     placeholder substitution.
fn eval_expression(expr: &str, row: &Row) -> Result<Value, String> {
    let expr = expr.trim();
    if let Some(rest) = expr
        .strip_prefix("upper(")
        .and_then(|s| s.strip_suffix(')'))
    {
        let inner = substitute(rest, row);
        return Ok(Value::String(inner.to_uppercase()));
    }
    if let Some(rest) = expr
        .strip_prefix("lower(")
        .and_then(|s| s.strip_suffix(')'))
    {
        let inner = substitute(rest, row);
        return Ok(Value::String(inner.to_lowercase()));
    }
    if let Some(rest) = expr.strip_prefix("trim(").and_then(|s| s.strip_suffix(')')) {
        let inner = substitute(rest, row);
        return Ok(Value::String(inner.trim().to_owned()));
    }
    if let Some(rest) = expr
        .strip_prefix("concat(")
        .and_then(|s| s.strip_suffix(')'))
    {
        let parts: String = rest.split(',').map(|p| substitute(p.trim(), row)).collect();
        return Ok(Value::String(parts));
    }
    Ok(Value::String(substitute(expr, row)))
}

/// `{col}` → row[col] as string. Unknown columns → empty string.
fn substitute(s: &str, row: &Row) -> String {
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'{' {
            if let Some(end) = s[i..].find('}') {
                let key = &s[i + 1..i + end];
                out.push_str(&row.get(key).map(value_as_string).unwrap_or_default());
                i += end + 1;
                continue;
            }
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}

// ─── split ───────────────────────────────────────────────────────────────

fn apply_split(rows: Vec<Row>, op: &SplitOp) -> Vec<Row> {
    rows.into_iter()
        .map(|mut r| {
            let src = r.get(&op.column).map(value_as_string).unwrap_or_default();
            let parts: Vec<&str> = src.split(&op.delimiter).collect();
            for (i, name) in op.into.iter().enumerate() {
                let v = parts
                    .get(i)
                    .map(|s| Value::String((*s).to_owned()))
                    .unwrap_or(Value::Null);
                r.insert(name.clone(), v);
            }
            if !op.keep_original {
                r.remove(&op.column);
            }
            r
        })
        .collect()
}

// ─── replace ─────────────────────────────────────────────────────────────

fn apply_replace(rows: Vec<Row>, op: &ReplaceOp) -> Vec<Row> {
    rows.into_iter()
        .map(|mut r| {
            if let Some(v) = r.get(&op.column) {
                let s = value_as_string(v);
                let replaced = if op.whole_cell {
                    let matches = if op.case_insensitive {
                        s.eq_ignore_ascii_case(&op.find)
                    } else {
                        s == op.find
                    };
                    if matches { op.replace.clone() } else { s }
                } else if op.case_insensitive {
                    replace_ci(&s, &op.find, &op.replace)
                } else {
                    s.replace(&op.find, &op.replace)
                };
                r.insert(op.column.clone(), Value::String(replaced));
            }
            r
        })
        .collect()
}

fn replace_ci(haystack: &str, needle: &str, repl: &str) -> String {
    if needle.is_empty() {
        return haystack.to_owned();
    }
    let hay_l = haystack.to_lowercase();
    let needle_l = needle.to_lowercase();
    let mut out = String::with_capacity(haystack.len());
    let mut i = 0;
    while i <= hay_l.len().saturating_sub(needle_l.len()) {
        if hay_l[i..].starts_with(&needle_l) {
            out.push_str(repl);
            i += needle.len();
        } else {
            out.push(haystack.as_bytes()[i] as char);
            i += 1;
        }
    }
    if i < haystack.len() {
        out.push_str(&haystack[i..]);
    }
    out
}

// ─── deduplicate ─────────────────────────────────────────────────────────

fn apply_dedupe(rows: Vec<Row>, op: &DeduplicateOp) -> Vec<Row> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        let key = dedupe_key(&r, &op.subset);
        if seen.insert(key) {
            out.push(r);
        }
    }
    out
}

fn dedupe_key(row: &Row, subset: &[String]) -> String {
    if subset.is_empty() {
        let mut sorted: BTreeMap<&String, &Value> = BTreeMap::new();
        for (k, v) in row {
            sorted.insert(k, v);
        }
        serde_json::to_string(&sorted).unwrap_or_default()
    } else {
        let mut parts = Vec::with_capacity(subset.len());
        for col in subset {
            parts.push(value_as_string(row.get(col).unwrap_or(&Value::Null)));
        }
        parts.join("\u{1f}")
    }
}

// ─── fillNulls ───────────────────────────────────────────────────────────

fn apply_fill_nulls(rows: Vec<Row>, op: &FillNullsOp) -> Vec<Row> {
    rows.into_iter()
        .map(|mut r| {
            if is_null_like(r.get(&op.column)) {
                r.insert(op.column.clone(), op.fill_with.clone());
            }
            r
        })
        .collect()
}

// ─── typeCast ────────────────────────────────────────────────────────────

fn apply_type_cast(
    rows: Vec<Row>,
    op: &TypeCastOp,
    step_index: u32,
    errors: &mut Vec<StepError>,
) -> Vec<Row> {
    rows.into_iter()
        .enumerate()
        .map(|(i, mut r)| {
            if let Some(v) = r.get(&op.column).cloned() {
                match cast_value(&v, op.target_type) {
                    Ok(nv) => {
                        r.insert(op.column.clone(), nv);
                    }
                    Err(e) => errors.push(StepError {
                        step_index,
                        step_kind: "typeCast".to_owned(),
                        message: e,
                        row_index: Some(i as u32),
                    }),
                }
            }
            r
        })
        .collect()
}

fn cast_value(v: &Value, target: CastType) -> Result<Value, String> {
    match target {
        CastType::String => Ok(Value::String(value_as_string(v))),
        CastType::Number => value_as_f64(v)
            .and_then(Number::from_f64)
            .map(Value::Number)
            .ok_or_else(|| format!("cannot cast {v} to number")),
        CastType::Integer => value_as_f64(v)
            .map(|f| Value::Number(Number::from(f.trunc() as i64)))
            .ok_or_else(|| format!("cannot cast {v} to integer")),
        CastType::Bool => match v {
            Value::Bool(b) => Ok(Value::Bool(*b)),
            Value::Number(n) => Ok(Value::Bool(n.as_f64().unwrap_or(0.0) != 0.0)),
            Value::String(s) => {
                let l = s.to_lowercase();
                if matches!(l.as_str(), "true" | "yes" | "1" | "y") {
                    Ok(Value::Bool(true))
                } else if matches!(l.as_str(), "false" | "no" | "0" | "n" | "") {
                    Ok(Value::Bool(false))
                } else {
                    Err(format!("cannot cast '{s}' to bool"))
                }
            }
            Value::Null => Ok(Value::Bool(false)),
            _ => Err(format!("cannot cast {v} to bool")),
        },
    }
}

// ─── join ────────────────────────────────────────────────────────────────

fn apply_join(left: Vec<Row>, op: &JoinOp) -> Vec<Row> {
    let suffix = op.right_suffix.as_deref().unwrap_or("_right");
    // Index right rows by join key.
    let mut right_index: HashMap<String, Vec<&Row>> = HashMap::new();
    for r in &op.right_rows {
        let key = join_key(r, &op.on, /*from_right=*/ true);
        right_index.entry(key).or_default().push(r);
    }
    let left_keys: HashSet<String> = if matches!(op.join_type, JoinType::Right | JoinType::Outer) {
        left.iter().map(|r| join_key(r, &op.on, false)).collect()
    } else {
        HashSet::new()
    };

    let mut out: Vec<Row> = Vec::new();
    let mut matched_right_keys: HashSet<String> = HashSet::new();

    for lrow in &left {
        let lkey = join_key(lrow, &op.on, false);
        let matches = right_index.get(&lkey);
        match matches {
            Some(rrows) => {
                matched_right_keys.insert(lkey.clone());
                for rr in rrows {
                    out.push(merge_rows(lrow, rr, &op.on, suffix));
                }
            }
            None => {
                if matches!(op.join_type, JoinType::Left | JoinType::Outer) {
                    out.push(lrow.clone());
                }
            }
        }
    }

    // Right / outer: emit unmatched right rows.
    if matches!(op.join_type, JoinType::Right | JoinType::Outer) {
        for (rk, rrows) in &right_index {
            if matched_right_keys.contains(rk) {
                continue;
            }
            for rr in rrows {
                if !matches!(op.join_type, JoinType::Outer) || !left_keys.contains(rk) {
                    out.push((*rr).clone());
                }
            }
        }
    }

    out
}

fn join_key(row: &Row, keys: &[crate::ops::JoinKey], from_right: bool) -> String {
    keys.iter()
        .map(|jk| {
            let k = if from_right { &jk.right } else { &jk.left };
            value_as_string(row.get(k).unwrap_or(&Value::Null))
        })
        .collect::<Vec<_>>()
        .join("\u{1f}")
}

fn merge_rows(left: &Row, right: &Row, on: &[crate::ops::JoinKey], suffix: &str) -> Row {
    let mut out = left.clone();
    let right_join_cols: HashSet<&String> = on.iter().map(|jk| &jk.right).collect();
    for (k, v) in right {
        if right_join_cols.contains(k) {
            continue;
        }
        if out.contains_key(k) {
            out.insert(format!("{k}{suffix}"), v.clone());
        } else {
            out.insert(k.clone(), v.clone());
        }
    }
    out
}

// ─── union ───────────────────────────────────────────────────────────────

fn apply_union(mut a: Vec<Row>, op: &UnionOp) -> Vec<Row> {
    a.extend(op.other_rows.iter().cloned());
    a
}

// ─── aggregate ───────────────────────────────────────────────────────────

fn apply_aggregate(rows: Vec<Row>, op: &AggregateOp) -> Vec<Row> {
    // Group rows by `group_by` key.
    let mut groups: BTreeMap<String, Vec<Row>> = BTreeMap::new();
    let mut order: Vec<String> = Vec::new();
    for r in rows {
        let key = if op.group_by.is_empty() {
            String::new()
        } else {
            op.group_by
                .iter()
                .map(|c| value_as_string(r.get(c).unwrap_or(&Value::Null)))
                .collect::<Vec<_>>()
                .join("\u{1f}")
        };
        if !groups.contains_key(&key) {
            order.push(key.clone());
        }
        groups.entry(key).or_default().push(r);
    }

    let mut out: Vec<Row> = Vec::with_capacity(order.len());
    for key in &order {
        let group = &groups[key];
        let mut row = Row::new();
        // Reconstruct group_by columns from the first row of the group.
        if let Some(first) = group.first() {
            for col in &op.group_by {
                if let Some(v) = first.get(col) {
                    row.insert(col.clone(), v.clone());
                }
            }
        }
        for agg in &op.aggregations {
            let v = aggregate_one(group, &agg.column, agg.func);
            row.insert(agg.output.clone(), v);
        }
        out.push(row);
    }
    out
}

fn aggregate_one(group: &[Row], column: &str, func: AggregateFunc) -> Value {
    match func {
        AggregateFunc::Count => Value::Number(Number::from(group.len() as i64)),
        AggregateFunc::CountDistinct => {
            let set: HashSet<String> = group
                .iter()
                .map(|r| value_as_string(r.get(column).unwrap_or(&Value::Null)))
                .collect();
            Value::Number(Number::from(set.len() as i64))
        }
        AggregateFunc::Sum => {
            let s: f64 = group
                .iter()
                .filter_map(|r| r.get(column).and_then(value_as_f64))
                .sum();
            Number::from_f64(s)
                .map(Value::Number)
                .unwrap_or(Value::Null)
        }
        AggregateFunc::Avg => {
            let nums: Vec<f64> = group
                .iter()
                .filter_map(|r| r.get(column).and_then(value_as_f64))
                .collect();
            if nums.is_empty() {
                Value::Null
            } else {
                let avg = nums.iter().sum::<f64>() / nums.len() as f64;
                Number::from_f64(avg)
                    .map(Value::Number)
                    .unwrap_or(Value::Null)
            }
        }
        AggregateFunc::Min => group
            .iter()
            .filter_map(|r| r.get(column).and_then(value_as_f64))
            .fold(None, |acc: Option<f64>, x| {
                Some(acc.map_or(x, |a| a.min(x)))
            })
            .and_then(Number::from_f64)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        AggregateFunc::Max => group
            .iter()
            .filter_map(|r| r.get(column).and_then(value_as_f64))
            .fold(None, |acc: Option<f64>, x| {
                Some(acc.map_or(x, |a| a.max(x)))
            })
            .and_then(Number::from_f64)
            .map(Value::Number)
            .unwrap_or(Value::Null),
    }
}

// ─── pivot ───────────────────────────────────────────────────────────────

fn apply_pivot(rows: Vec<Row>, op: &PivotOp) -> Vec<Row> {
    // Group by index_columns, then bucket by pivot_column distinct value.
    let mut by_index: BTreeMap<String, Vec<Row>> = BTreeMap::new();
    let mut order: Vec<String> = Vec::new();
    for r in rows {
        let key = op
            .index_columns
            .iter()
            .map(|c| value_as_string(r.get(c).unwrap_or(&Value::Null)))
            .collect::<Vec<_>>()
            .join("\u{1f}");
        if !by_index.contains_key(&key) {
            order.push(key.clone());
        }
        by_index.entry(key).or_default().push(r);
    }

    let mut out = Vec::with_capacity(order.len());
    for key in &order {
        let group = &by_index[key];
        let mut row = Row::new();
        if let Some(first) = group.first() {
            for col in &op.index_columns {
                if let Some(v) = first.get(col) {
                    row.insert(col.clone(), v.clone());
                }
            }
        }
        // Bucket by pivot value.
        let mut buckets: HashMap<String, Vec<&Row>> = HashMap::new();
        for r in group {
            let p = value_as_string(r.get(&op.pivot_column).unwrap_or(&Value::Null));
            buckets.entry(p).or_default().push(r);
        }
        for (pv, bucket) in buckets {
            let bucket_rows: Vec<Row> = bucket.into_iter().cloned().collect();
            let v = aggregate_one(&bucket_rows, &op.value_column, op.agg_func);
            row.insert(pv, v);
        }
        out.push(row);
    }
    out
}

// ─── unpivot ─────────────────────────────────────────────────────────────

fn apply_unpivot(rows: Vec<Row>, op: &UnpivotOp) -> Vec<Row> {
    let mut out = Vec::new();
    for r in rows {
        for col in &op.value_columns {
            let mut new_row = Row::new();
            for id_col in &op.id_columns {
                if let Some(v) = r.get(id_col) {
                    new_row.insert(id_col.clone(), v.clone());
                }
            }
            new_row.insert(op.var_name.clone(), Value::String(col.clone()));
            let val = r.get(col).cloned().unwrap_or(Value::Null);
            new_row.insert(op.value_name.clone(), val);
            out.push(new_row);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ops::*;
    use serde_json::json;

    fn row(pairs: &[(&str, Value)]) -> Row {
        pairs
            .iter()
            .map(|(k, v)| ((*k).to_owned(), v.clone()))
            .collect()
    }

    fn step(kind: StepKind) -> Step {
        Step {
            id: None,
            label: None,
            disabled: false,
            kind,
        }
    }

    #[test]
    fn filter_equals_works() {
        let rows = vec![
            row(&[("status", json!("active"))]),
            row(&[("status", json!("archived"))]),
        ];
        let s = step(StepKind::Filter(FilterOp {
            column: "status".into(),
            operator: FilterOperator::Equals,
            value: Some(json!("active")),
        }));
        let res = apply_steps(rows, &[s]);
        assert_eq!(res.rows.len(), 1);
    }

    #[test]
    fn derive_concat_works() {
        let rows = vec![row(&[("a", json!("hi")), ("b", json!("there"))])];
        let s = step(StepKind::Derive(DeriveOp {
            target: "c".into(),
            expression: "concat({a}, _, {b})".into(),
        }));
        let res = apply_steps(rows, &[s]);
        assert_eq!(res.rows[0]["c"], json!("hi_there"));
    }

    #[test]
    fn dedupe_drops_duplicates() {
        let rows = vec![
            row(&[("id", json!(1))]),
            row(&[("id", json!(1))]),
            row(&[("id", json!(2))]),
        ];
        let s = step(StepKind::Deduplicate(DeduplicateOp {
            subset: vec!["id".to_owned()],
        }));
        let res = apply_steps(rows, &[s]);
        assert_eq!(res.rows.len(), 2);
    }

    #[test]
    fn aggregate_sums_by_group() {
        let rows = vec![
            row(&[("g", json!("a")), ("v", json!(10))]),
            row(&[("g", json!("a")), ("v", json!(5))]),
            row(&[("g", json!("b")), ("v", json!(3))]),
        ];
        let s = step(StepKind::Aggregate(AggregateOp {
            group_by: vec!["g".to_owned()],
            aggregations: vec![Aggregation {
                column: "v".to_owned(),
                func: AggregateFunc::Sum,
                output: "total".to_owned(),
            }],
        }));
        let res = apply_steps(rows, &[s]);
        assert_eq!(res.rows.len(), 2);
        let a_row = res.rows.iter().find(|r| r["g"] == json!("a")).unwrap();
        assert_eq!(a_row["total"], json!(15.0));
    }

    #[test]
    fn join_inner_links_by_key() {
        let left = vec![row(&[("uid", json!(1)), ("name", json!("A"))])];
        let right = vec![row(&[("uid", json!(1)), ("score", json!(99))])];
        let s = step(StepKind::Join(JoinOp {
            right_dataset_id: "x".into(),
            on: vec![JoinKey {
                left: "uid".into(),
                right: "uid".into(),
            }],
            join_type: JoinType::Inner,
            right_suffix: None,
            right_rows: right,
        }));
        let res = apply_steps(left, &[s]);
        assert_eq!(res.rows.len(), 1);
        assert_eq!(res.rows[0]["score"], json!(99));
    }

    #[test]
    fn typecast_to_int_records_error_on_bad_value() {
        let rows = vec![row(&[("x", json!("abc"))])];
        let s = step(StepKind::TypeCast(TypeCastOp {
            column: "x".into(),
            target_type: CastType::Integer,
        }));
        let res = apply_steps(rows, &[s]);
        assert_eq!(res.summaries[0].errors.len(), 1);
    }

    #[test]
    fn disabled_step_skipped() {
        let rows = vec![row(&[("a", json!(1))])];
        let s = Step {
            id: None,
            label: None,
            disabled: true,
            kind: StepKind::Filter(FilterOp {
                column: "a".into(),
                operator: FilterOperator::Equals,
                value: Some(json!(999)),
            }),
        };
        let res = apply_steps(rows, &[s]);
        assert_eq!(res.rows.len(), 1);
        assert_eq!(res.summaries.len(), 0);
    }
}
