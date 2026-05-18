//! Spreadsheet File node.
//!
//! Reads or writes tabular data in CSV/TSV format. Heavier binary formats
//! (XLSX, XLS, ODS) are advertised in the descriptor but return
//! `NotImplemented` at runtime — adding `calamine`/`rust_xlsxwriter` is out
//! of scope for this sub-task and would balloon the worker binary.
//!
//! Operations:
//!   - `read`  : parses the `data` string (or the upstream item's `data`
//!               field) into one row-object per record. The first row is
//!               treated as headers unless `hasHeaders=false`, in which
//!               case fields are named `col1`, `col2`, …
//!   - `write` : serialises every input item's top-level object fields into
//!               CSV/TSV text. Headers are the union of keys across items,
//!               in first-seen order. Output is a single item:
//!               `{ "fileContent": "...", "format": "...", "rows": N }`.
//!
//! CSV parsing implements the minimal RFC 4180 dialect: quoted fields with
//! `""` escaping, CR/LF inside quotes, and configurable delimiter.

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

pub struct SpreadsheetFileNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

fn delimiter_for(format: &str) -> char {
    match format {
        "tsv" => '\t',
        _ => ',',
    }
}

/// Minimal RFC 4180 parser. Returns one record per row.
fn parse_csv(text: &str, delimiter: char) -> Vec<Vec<String>> {
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut cur: Vec<String> = Vec::new();
    let mut field = String::new();
    let mut in_quotes = false;
    let mut chars = text.chars().peekable();

    while let Some(c) = chars.next() {
        if in_quotes {
            if c == '"' {
                if chars.peek() == Some(&'"') {
                    chars.next();
                    field.push('"');
                } else {
                    in_quotes = false;
                }
            } else {
                field.push(c);
            }
            continue;
        }

        if c == '"' {
            in_quotes = true;
        } else if c == delimiter {
            cur.push(std::mem::take(&mut field));
        } else if c == '\r' {
            // Swallow CR, the LF (or end) finishes the row.
            if chars.peek() == Some(&'\n') {
                chars.next();
            }
            cur.push(std::mem::take(&mut field));
            rows.push(std::mem::take(&mut cur));
        } else if c == '\n' {
            cur.push(std::mem::take(&mut field));
            rows.push(std::mem::take(&mut cur));
        } else {
            field.push(c);
        }
    }

    // Flush trailing field/row (only if there's content — avoid an empty
    // trailing row for files ending in a newline).
    if !field.is_empty() || !cur.is_empty() {
        cur.push(field);
        rows.push(cur);
    }
    rows
}

fn quote_field(raw: &str, delimiter: char) -> String {
    let needs_quotes = raw.contains(delimiter)
        || raw.contains('"')
        || raw.contains('\n')
        || raw.contains('\r');
    if !needs_quotes {
        return raw.to_string();
    }
    let escaped = raw.replace('"', "\"\"");
    format!("\"{escaped}\"")
}

fn value_to_csv_cell(v: &Value) -> String {
    match v {
        Value::Null => String::new(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::String(s) => s.clone(),
        // Nested objects / arrays are serialised as JSON text so the cell
        // round-trips losslessly when read back.
        other => other.to_string(),
    }
}

#[async_trait]
impl Node for SpreadsheetFileNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "spreadsheetFile",
            "Spreadsheet File",
            "Read or write CSV / TSV data (XLSX/ODS reserved for future use)",
            NodeCategory::Files,
        )
        .icon("table")
        .color("#22c55e")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Read", "read"), opt("Write", "write")])
                .default(json!("read"))
                .required(),
            NodeProperty::new("format", "Format", NodePropertyType::Options)
                .options(vec![
                    opt("CSV", "csv"),
                    opt("TSV", "tsv"),
                    opt("XLSX (unsupported)", "xlsx"),
                    opt("XLS (unsupported)", "xls"),
                    opt("ODS (unsupported)", "ods"),
                ])
                .default(json!("csv"))
                .required(),
            NodeProperty::new("data", "Data", NodePropertyType::String)
                .placeholder("col1,col2\\nfoo,bar")
                .description(
                    "For Read: the spreadsheet text. If empty, the upstream item's `data` \
                     field is used instead.",
                )
                .show_when("operation", &["read"]),
            NodeProperty::new("hasHeaders", "Has Header Row", NodePropertyType::Boolean)
                .description("First row of CSV/TSV is treated as field names")
                .default(json!(true))
                .show_when("operation", &["read"]),
            NodeProperty::new("includeHeaders", "Include Header Row", NodePropertyType::Boolean)
                .description("Emit a header row as the first line of the output")
                .default(json!(true))
                .show_when("operation", &["write"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let operation = ctx
            .param_str_opt(params, "operation")
            .unwrap_or_else(|| "read".to_string());
        let format = ctx
            .param_str_opt(params, "format")
            .unwrap_or_else(|| "csv".to_string());

        if matches!(format.as_str(), "xlsx" | "xls" | "ods") {
            return Err(NodeError::NotImplemented(format!(
                "Spreadsheet File: {format} binary format support is not yet shipped — \
                 use CSV/TSV via the Read/Write operations for now."
            )));
        }
        let delimiter = delimiter_for(&format);

        match operation.as_str() {
            "read" => {
                let raw_text = ctx
                    .param_str_opt(params, "data")
                    .filter(|s| !s.is_empty())
                    .or_else(|| {
                        input
                            .items
                            .first()
                            .and_then(|item| item.get("data"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                    })
                    .ok_or_else(|| NodeError::MissingParameter("data".into()))?;

                let has_headers = ctx.param_bool(params, "hasHeaders", true);
                let mut rows = parse_csv(&raw_text, delimiter);

                if rows.is_empty() {
                    return Ok(NodeOutput::single(vec![]));
                }

                let headers: Vec<String> = if has_headers {
                    rows.remove(0)
                } else {
                    let width = rows.iter().map(|r| r.len()).max().unwrap_or(0);
                    (1..=width).map(|i| format!("col{i}")).collect()
                };

                let mut items: Vec<Value> = Vec::with_capacity(rows.len());
                for row in rows.into_iter() {
                    let mut obj = Map::new();
                    for (i, val) in row.into_iter().enumerate() {
                        let key = headers
                            .get(i)
                            .cloned()
                            .unwrap_or_else(|| format!("col{}", i + 1));
                        obj.insert(key, Value::String(val));
                    }
                    items.push(Value::Object(obj));
                }
                Ok(NodeOutput::single(items))
            }
            "write" => {
                let include_headers = ctx.param_bool(params, "includeHeaders", true);

                // Collect headers in first-seen order across all items.
                let mut headers: Vec<String> = Vec::new();
                for item in input.items.iter() {
                    if let Some(obj) = item.as_object() {
                        for k in obj.keys() {
                            if !headers.iter().any(|h| h == k) {
                                headers.push(k.clone());
                            }
                        }
                    }
                }

                let delim_str = delimiter.to_string();
                let mut out = String::new();
                if include_headers {
                    let row = headers
                        .iter()
                        .map(|h| quote_field(h, delimiter))
                        .collect::<Vec<_>>()
                        .join(&delim_str);
                    out.push_str(&row);
                    out.push('\n');
                }
                for item in input.items.iter() {
                    let obj = match item.as_object() {
                        Some(o) => o,
                        None => continue,
                    };
                    let row = headers
                        .iter()
                        .map(|h| {
                            let raw = obj
                                .get(h)
                                .map(value_to_csv_cell)
                                .unwrap_or_default();
                            quote_field(&raw, delimiter)
                        })
                        .collect::<Vec<_>>()
                        .join(&delim_str);
                    out.push_str(&row);
                    out.push('\n');
                }

                Ok(NodeOutput::single(vec![json!({
                    "fileContent": out,
                    "format": format,
                    "rows": input.items.len(),
                })]))
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}
