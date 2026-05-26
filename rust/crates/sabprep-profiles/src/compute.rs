//! Pure-compute profiler.
//!
//! Given a `Vec<Row>`, produce a `Vec<ColumnProfile>` plus a set of
//! "suggested cleansing" chips per column. Heuristics are intentionally
//! conservative — the UI surfaces each chip as a one-tap step builder, not
//! an automatic mutation.

use std::collections::HashMap;

use sabprep_steps::Row;
use serde_json::Value;

use crate::types::{CleansingSuggestion, ColumnProfile, TopValue};

const TOP_N: usize = 5;

/// Build per-column profiles for the given rows.
pub fn profile_rows(rows: &[Row]) -> Vec<ColumnProfile> {
    // Column union.
    let mut columns: Vec<String> = Vec::new();
    {
        let mut seen = std::collections::HashSet::new();
        for r in rows {
            for k in r.keys() {
                if seen.insert(k.clone()) {
                    columns.push(k.clone());
                }
            }
        }
    }

    columns
        .into_iter()
        .map(|c| profile_column(&c, rows))
        .collect()
}

fn profile_column(name: &str, rows: &[Row]) -> ColumnProfile {
    let mut null_count = 0u32;
    let mut counts: HashMap<String, u32> = HashMap::new();
    let mut originals: HashMap<String, Value> = HashMap::new();
    let mut nums: Vec<f64> = Vec::new();
    let mut has_string = false;
    let mut has_number = false;
    let mut has_bool = false;
    let mut has_leading_or_trailing_ws = false;
    let mut has_mixed_case = false;
    let mut has_lowercase = false;
    let mut has_uppercase = false;
    let mut looks_like_phone_strings = 0u32;
    let mut numeric_strings = 0u32;

    for r in rows {
        let v = r.get(name);
        if is_null_like(v) {
            null_count += 1;
            continue;
        }
        let v = v.unwrap();
        let s = scalar_string(v);
        let entry = counts.entry(s.clone()).or_insert(0);
        *entry += 1;
        originals.entry(s.clone()).or_insert_with(|| v.clone());

        match v {
            Value::Number(n) => {
                has_number = true;
                if let Some(f) = n.as_f64() {
                    nums.push(f);
                }
            }
            Value::Bool(_) => has_bool = true,
            Value::String(s) => {
                has_string = true;
                if s.trim() != s {
                    has_leading_or_trailing_ws = true;
                }
                if !s.is_empty() && s == s.to_lowercase() {
                    has_lowercase = true;
                } else if !s.is_empty() && s == s.to_uppercase() {
                    has_uppercase = true;
                } else {
                    has_mixed_case = true;
                }
                if s.trim().parse::<f64>().is_ok() {
                    numeric_strings += 1;
                }
                if looks_like_phone(s) {
                    looks_like_phone_strings += 1;
                }
            }
            _ => {}
        }
    }

    let kind = guess_kind(has_string, has_number, has_bool, null_count, rows.len() as u32);
    let mut top_vec: Vec<(String, u32)> = counts.into_iter().collect();
    top_vec.sort_by(|a, b| b.1.cmp(&a.1));
    let top_values: Vec<TopValue> = top_vec
        .into_iter()
        .take(TOP_N)
        .map(|(k, c)| TopValue {
            value: originals.remove(&k).unwrap_or(Value::String(k)),
            count: c,
        })
        .collect();

    let distinct_count = top_values.iter().count() as u32; // distinct in top-N
    // For full distinct count we need a re-scan — cheap:
    let distinct_total = unique_count(name, rows);

    let (min, max, mean) = if !nums.is_empty() {
        let mn = nums.iter().cloned().fold(f64::INFINITY, f64::min);
        let mx = nums.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let mean = nums.iter().sum::<f64>() / nums.len() as f64;
        (Some(mn), Some(mx), Some(mean))
    } else {
        (None, None, None)
    };

    let suggested_cleansing = suggest_cleansing(SuggestInput {
        kind: &kind,
        has_leading_or_trailing_ws,
        has_mixed_case,
        has_lowercase,
        has_uppercase,
        null_count,
        rows_total: rows.len() as u32,
        numeric_strings,
        looks_like_phone_strings,
    });

    ColumnProfile {
        name: name.to_owned(),
        kind,
        null_count,
        distinct_count: distinct_total.max(distinct_count),
        min,
        max,
        mean,
        top_values,
        suggested_cleansing,
    }
}

fn unique_count(name: &str, rows: &[Row]) -> u32 {
    let mut set: std::collections::HashSet<String> = std::collections::HashSet::new();
    for r in rows {
        if let Some(v) = r.get(name) {
            if !is_null_like(Some(v)) {
                set.insert(scalar_string(v));
            }
        }
    }
    set.len() as u32
}

pub(crate) fn is_null_like(v: Option<&Value>) -> bool {
    matches!(v, None | Some(Value::Null))
        || matches!(v, Some(Value::String(s)) if s.is_empty())
}

fn scalar_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

fn guess_kind(has_string: bool, has_number: bool, has_bool: bool, null_count: u32, total: u32) -> String {
    let total_non_null = total.saturating_sub(null_count);
    if total_non_null == 0 {
        return "null".to_owned();
    }
    let typed = [has_string, has_number, has_bool].iter().filter(|b| **b).count();
    if typed > 1 {
        return "mixed".to_owned();
    }
    if has_number {
        return "number".to_owned();
    }
    if has_bool {
        return "bool".to_owned();
    }
    "string".to_owned()
}

fn looks_like_phone(s: &str) -> bool {
    let digits = s.chars().filter(|c| c.is_ascii_digit()).count();
    if digits < 7 || digits > 15 {
        return false;
    }
    s.chars()
        .all(|c| c.is_ascii_digit() || matches!(c, ' ' | '+' | '-' | '(' | ')' | '.'))
}

struct SuggestInput<'a> {
    kind: &'a str,
    has_leading_or_trailing_ws: bool,
    has_mixed_case: bool,
    has_lowercase: bool,
    has_uppercase: bool,
    null_count: u32,
    rows_total: u32,
    numeric_strings: u32,
    looks_like_phone_strings: u32,
}

fn suggest_cleansing(i: SuggestInput<'_>) -> Vec<CleansingSuggestion> {
    let mut out = Vec::new();
    if i.has_leading_or_trailing_ws {
        out.push(CleansingSuggestion {
            kind: "trim".to_owned(),
            label: "Trim whitespace".to_owned(),
            reason: "Some values have leading or trailing spaces.".to_owned(),
        });
    }
    if i.kind == "string" && i.has_mixed_case && (i.has_lowercase || i.has_uppercase) {
        out.push(CleansingSuggestion {
            kind: "lowercase".to_owned(),
            label: "Standardize to lowercase".to_owned(),
            reason: "Mixed casing across values.".to_owned(),
        });
    }
    if i.null_count > 0 {
        let pct = (i.null_count as f64 / i.rows_total.max(1) as f64) * 100.0;
        if pct >= 5.0 {
            out.push(CleansingSuggestion {
                kind: "fill_nulls".to_owned(),
                label: format!("Fill {:.0}% null values", pct),
                reason: "Significant fraction of nulls; pick a fill value.".to_owned(),
            });
        }
    }
    if i.kind == "string"
        && i.numeric_strings as f64 / i.rows_total.max(1) as f64 >= 0.8
    {
        out.push(CleansingSuggestion {
            kind: "cast_to_number".to_owned(),
            label: "Cast to number".to_owned(),
            reason: "Values look numeric but are stored as strings.".to_owned(),
        });
    }
    if i.looks_like_phone_strings as f64 / i.rows_total.max(1) as f64 >= 0.5 {
        out.push(CleansingSuggestion {
            kind: "standardize_phone".to_owned(),
            label: "Standardize phone format".to_owned(),
            reason: "Values look like phone numbers with mixed punctuation.".to_owned(),
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn r(pairs: &[(&str, Value)]) -> Row {
        pairs.iter().map(|(k, v)| ((*k).to_owned(), v.clone())).collect()
    }

    #[test]
    fn profiles_basic_columns() {
        let rows = vec![
            r(&[("name", json!("alice ")), ("age", json!(30))]),
            r(&[("name", json!("Bob")), ("age", json!(25))]),
            r(&[("name", json!("alice")), ("age", json!(null))]),
        ];
        let profiles = profile_rows(&rows);
        assert_eq!(profiles.len(), 2);
        let age = profiles.iter().find(|p| p.name == "age").unwrap();
        assert_eq!(age.null_count, 1);
        assert!(age.mean.is_some());
    }

    #[test]
    fn suggests_trim_when_whitespace_present() {
        let rows = vec![
            r(&[("x", json!(" hi"))]),
            r(&[("x", json!("hi"))]),
        ];
        let profiles = profile_rows(&rows);
        let p = &profiles[0];
        assert!(p.suggested_cleansing.iter().any(|c| c.kind == "trim"));
    }

    #[test]
    fn suggests_cast_for_numeric_strings() {
        let rows = vec![
            r(&[("n", json!("1"))]),
            r(&[("n", json!("2"))]),
            r(&[("n", json!("3"))]),
        ];
        let profiles = profile_rows(&rows);
        let p = &profiles[0];
        assert!(p.suggested_cleansing.iter().any(|c| c.kind == "cast_to_number"));
    }
}
