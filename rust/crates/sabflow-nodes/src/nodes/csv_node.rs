//! CSV node — read CSV text into items, or write items back out as CSV.
//!
//! Pairs with n8n's `spreadsheetFile` for the CSV path. Hand-rolled parser
//! (no `csv` crate dep) — handles double-quoted fields, escaped quotes
//! (`""`), CR/LF/CRLF line endings, and configurable delimiters.
//!
//! Operations:
//!   - `fromCsv` : parse `sourceData` into one item per row, keyed by the
//!     header row (or by `col_0`, `col_1`, … when `hasHeader` is false).
//!   - `toCsv`   : serialize the upstream `input.items` (each an object) into
//!     a single CSV string, returned as `{ csv: "..." }`.
//!
//! Local-only; no HTTP.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct CsvNode;

#[async_trait]
impl Node for CsvNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "spreadsheetFile",
            "Spreadsheet File (CSV)",
            "Read or write CSV text",
            NodeCategory::Files,
        )
        .icon("table")
        .color("#16a34a")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "From CSV".into(),
                        value: json!("fromCsv"),
                        description: Some("Parse a CSV string into items".into()),
                    },
                    NodePropertyOption {
                        name: "To CSV".into(),
                        value: json!("toCsv"),
                        description: Some(
                            "Serialize upstream items as a single CSV string".into(),
                        ),
                    },
                ])
                .default(json!("fromCsv"))
                .required(),
            NodeProperty::new("sourceData", "CSV", NodePropertyType::String)
                .description("The CSV document to parse")
                .placeholder("a,b,c\n1,2,3")
                .show_when("operation", &["fromCsv"])
                .required(),
            NodeProperty::new("delimiter", "Delimiter", NodePropertyType::String)
                .description("Field separator (one character)")
                .default(json!(","))
                .placeholder(","),
            NodeProperty::new("hasHeader", "First Row Is Header", NodePropertyType::Boolean)
                .description("Treat the first row as field names")
                .default(json!(true)),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let operation = ctx.param_str(params, "operation")?;
        let delim_raw = ctx
            .param_str_opt(params, "delimiter")
            .unwrap_or_else(|| ",".to_string());
        let delim = delim_raw.chars().next().unwrap_or(',');
        let has_header = ctx.param_bool(params, "hasHeader", true);

        match operation.as_str() {
            "fromCsv" => {
                let source = ctx.param_str(params, "sourceData")?;
                let rows = parse_csv(&source, delim);

                let mut iter = rows.into_iter();
                let headers: Vec<String> = if has_header {
                    iter.next().unwrap_or_default()
                } else {
                    vec![]
                };

                let mut items: Vec<Value> = Vec::new();
                for row in iter {
                    let mut obj: Map<String, Value> = Map::new();
                    for (i, cell) in row.into_iter().enumerate() {
                        let key = if has_header && i < headers.len() {
                            headers[i].clone()
                        } else {
                            format!("col_{i}")
                        };
                        obj.insert(key, Value::String(cell));
                    }
                    items.push(Value::Object(obj));
                }

                Ok(NodeOutput::single(items))
            }
            "toCsv" => {
                // Collect every key seen across items, in first-seen order, to
                // form the header row.
                let mut headers: Vec<String> = Vec::new();
                for item in input.items.iter() {
                    if let Some(map) = item.as_object() {
                        for key in map.keys() {
                            if !headers.contains(key) {
                                headers.push(key.clone());
                            }
                        }
                    }
                }

                let mut buf = String::new();
                buf.push_str(&join_csv_row(&headers.iter().map(|s| s.as_str()).collect::<Vec<_>>(), delim));
                buf.push('\n');

                for item in input.items.iter() {
                    let mut row: Vec<String> = Vec::with_capacity(headers.len());
                    let map = item.as_object();
                    for h in headers.iter() {
                        let cell = map
                            .and_then(|m| m.get(h))
                            .map(value_to_csv_cell)
                            .unwrap_or_default();
                        row.push(cell);
                    }
                    buf.push_str(&join_csv_row(
                        &row.iter().map(|s| s.as_str()).collect::<Vec<_>>(),
                        delim,
                    ));
                    buf.push('\n');
                }

                let mut out = Map::new();
                out.insert("csv".into(), Value::String(buf));
                Ok(NodeOutput::single(vec![Value::Object(out)]))
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

/// Parse CSV text into `Vec<Vec<String>>`. Tolerant:
///   - Honours `""` as an escaped quote inside a quoted field.
///   - Treats CR, LF, and CRLF as row terminators.
///   - Skips a single trailing empty row (common from trailing newline).
fn parse_csv(input: &str, delim: char) -> Vec<Vec<String>> {
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut row: Vec<String> = Vec::new();
    let mut field = String::new();
    let mut in_quotes = false;
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        if in_quotes {
            match c {
                '"' => {
                    if chars.peek() == Some(&'"') {
                        // Escaped quote.
                        field.push('"');
                        chars.next();
                    } else {
                        in_quotes = false;
                    }
                }
                other => field.push(other),
            }
            continue;
        }

        // Not in quotes.
        if c == '"' && field.is_empty() {
            in_quotes = true;
            continue;
        }
        if c == delim {
            row.push(std::mem::take(&mut field));
            continue;
        }
        if c == '\r' {
            // Swallow an optional following LF.
            if chars.peek() == Some(&'\n') {
                chars.next();
            }
            row.push(std::mem::take(&mut field));
            rows.push(std::mem::take(&mut row));
            continue;
        }
        if c == '\n' {
            row.push(std::mem::take(&mut field));
            rows.push(std::mem::take(&mut row));
            continue;
        }
        field.push(c);
    }

    // Flush final field/row if any text remained.
    if !field.is_empty() || !row.is_empty() {
        row.push(field);
        rows.push(row);
    }

    // Drop a single trailing empty row to absorb a trailing newline.
    if let Some(last) = rows.last() {
        if last.len() == 1 && last[0].is_empty() {
            rows.pop();
        }
    }

    rows
}

/// Quote a CSV cell when it contains the delimiter, quotes, or a newline.
fn escape_csv_cell(s: &str, delim: char) -> String {
    let needs_quoting = s.contains(delim)
        || s.contains('"')
        || s.contains('\n')
        || s.contains('\r');
    if !needs_quoting {
        return s.to_string();
    }
    let escaped = s.replace('"', "\"\"");
    format!("\"{escaped}\"")
}

fn join_csv_row(cells: &[&str], delim: char) -> String {
    cells
        .iter()
        .map(|c| escape_csv_cell(c, delim))
        .collect::<Vec<_>>()
        .join(&delim.to_string())
}

fn value_to_csv_cell(v: &Value) -> String {
    match v {
        Value::Null => String::new(),
        Value::String(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        other => other.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_basic_csv() {
        let rows = parse_csv("a,b,c\n1,2,3\n", ',');
        assert_eq!(rows, vec![vec!["a", "b", "c"], vec!["1", "2", "3"]]);
    }

    #[test]
    fn parses_quoted_fields() {
        let rows = parse_csv("name,note\n\"smith, j.\",\"he said \"\"hi\"\"\"\n", ',');
        assert_eq!(
            rows,
            vec![
                vec!["name", "note"],
                vec!["smith, j.", "he said \"hi\""],
            ],
        );
    }

    #[test]
    fn handles_crlf_endings() {
        let rows = parse_csv("a,b\r\n1,2\r\n", ',');
        assert_eq!(rows, vec![vec!["a", "b"], vec!["1", "2"]]);
    }

    #[test]
    fn escapes_csv_cells_with_specials() {
        assert_eq!(escape_csv_cell("plain", ','), "plain");
        assert_eq!(escape_csv_cell("a,b", ','), "\"a,b\"");
        assert_eq!(escape_csv_cell("he said \"hi\"", ','), "\"he said \"\"hi\"\"\"");
    }
}
