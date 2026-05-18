//! Convert to Text — inverse of [`super::convert_to_file`].  Reads a binary
//! reference attached to each input item and emits one or more JSON items
//! parsed from its contents.
//!
//! Mirrors n8n-nodes-base.convertToText. Supported `operation` parsers:
//!
//! | operation     | accepts                | output items                 |
//! | ------------- | ---------------------- | ---------------------------- |
//! | `fromJson`    | `application/json`     | the JSON value (or array)    |
//! | `fromCsv`     | `text/csv`             | one item per row             |
//! | `fromTsv`     | `text/tab-separated-values` | one item per row        |
//! | `fromXml`     | `application/xml`      | quick-xml deserialised value |
//! | `fromRtf`     | `application/rtf`      | `{ text: "<plain-text>" }`   |
//! | `fromPlain`   | `text/*`               | `{ text: "<raw>" }`          |
//!
//! ## Wire-shape contract
//!
//! The input item carries the file under `binary[<sourceKey>]` (default
//! `data`) shaped per `BinaryDataRef`. Loading the actual bytes is
//! delegated to [`crate::binary::default_binary_store`] (C.2.7). Until
//! that module is merged into this branch, the node returns the
//! C.3.2 typed `not_yet_supported` error — parser logic still ships so
//! the swap is a one-liner.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct ConvertToTextNode;

#[async_trait]
impl Node for ConvertToTextNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "convertToText",
            "Convert to Text",
            "Parse a binary file (JSON / CSV / TSV / XML / RTF / Plain) back into items",
            NodeCategory::Transform,
        )
        .icon("file-input")
        .color("#0EA5E9")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "From JSON file".into(),
                        value: Value::String("fromJson".into()),
                        description: Some("Parse JSON bytes into items".into()),
                    },
                    NodePropertyOption {
                        name: "From CSV file".into(),
                        value: Value::String("fromCsv".into()),
                        description: Some("Parse comma-separated rows into items".into()),
                    },
                    NodePropertyOption {
                        name: "From TSV file".into(),
                        value: Value::String("fromTsv".into()),
                        description: Some("Parse tab-separated rows into items".into()),
                    },
                    NodePropertyOption {
                        name: "From XML file".into(),
                        value: Value::String("fromXml".into()),
                        description: Some("Parse XML into items via quick-xml".into()),
                    },
                    NodePropertyOption {
                        name: "From RTF file".into(),
                        value: Value::String("fromRtf".into()),
                        description: Some("Strip RTF markup and emit `{ text }`".into()),
                    },
                    NodePropertyOption {
                        name: "From plain-text file".into(),
                        value: Value::String("fromPlain".into()),
                        description: Some("Emit `{ text }` from a UTF-8 file".into()),
                    },
                ])
                .default(Value::String("fromJson".into()))
                .required(),
            NodeProperty::new("sourceKey", "Source Binary Property", NodePropertyType::String)
                .description("Key on the item's `binary` map to read.")
                .default(Value::String("data".into())),
            NodeProperty::new("hasHeader", "Has Header Row", NodePropertyType::Boolean)
                .description(
                    "CSV/TSV: when true the first row is used as field names; otherwise rows are indexed columns.",
                )
                .show_when("operation", &["fromCsv", "fromTsv"])
                .default(Value::Bool(true)),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let operation = ctx.param_str(params, "operation")?;
        let source_key = ctx
            .param_str_opt(params, "sourceKey")
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "data".to_string());
        let has_header = ctx.param_bool(params, "hasHeader", true);

        // Validate that every item carries a binary ref at the named slot so
        // the node fails fast with a useful message rather than later when
        // BinaryStore lookups arrive.
        for (idx, it) in input.items.iter().enumerate() {
            let r#ref = it.get("binary").and_then(|b| b.get(&source_key));
            if r#ref.is_none() {
                return Err(NodeError::InvalidParameter {
                    name: "sourceKey".into(),
                    reason: format!(
                        "item[{idx}] has no binary entry under '{source_key}'"
                    ),
                });
            }
            // Pre-emptively reject ad-hoc base64 payloads — wire shape must
            // be the BinaryDataRef object.
            if let Some(v) = r#ref {
                if let Some(o) = v.as_object() {
                    if o.contains_key("data") {
                        return Err(NodeError::InvalidParameter {
                            name: format!("binary.{source_key}"),
                            reason: "inline `data` fields are not allowed on the wire — items must reference SabFiles via `id`".into(),
                        });
                    }
                }
            }
        }

        // Keep `has_header` referenced — once C.2.7 lands, the dispatch
        // below threads it into `parse_csv` / `parse_tsv`. The parser
        // helpers themselves are `pub(crate)` + exercised by unit tests.
        let _ = has_header;

        // ---- BinaryStore load -----------------------------------------
        //
        // Lifts the bytes for each item's `BinaryDataRef` and dispatches
        // to the parser. Pending C.2.7 merge — see convert_to_file.rs for
        // the matching gate.
        //
        // TODO(c.2.7-merge): replace with:
        //   let store = crate::binary::default_binary_store();
        //   for item in input.items { let bytes = store.load(ctx, ref).await?;
        //                              out.extend(dispatch(&operation, &bytes)?); }
        Err(NodeError::NotImplemented(format!(
            "convertToText/{operation}: parser logic ready; SabFiles load pending C.2.7 BinaryStore merge"
        )))
    }
}

// ── Parser helpers ──────────────────────────────────────────────────────
//
// All parsers are pure functions over a byte slice so the unit-tests can
// pin behaviour without exercising the BinaryStore. They MUST stay
// dependency-free of `tokio` / `reqwest` for fast compile.
//
// `#[allow(dead_code)]` keeps the helpers around in non-test builds while
// the BinaryStore call-site is gated by C.2.7. Once the gate lifts, the
// dispatcher in `execute` will consume them and the attribute can drop.

#[allow(dead_code)]
pub(crate) fn parse_json(bytes: &[u8]) -> NodeResult<Vec<Value>> {
    let v: Value = serde_json::from_slice(bytes).map_err(|e| NodeError::InvalidParameter {
        name: "operation".into(),
        reason: format!("invalid JSON: {e}"),
    })?;
    Ok(match v {
        Value::Array(a) => a,
        other => vec![other],
    })
}

#[allow(dead_code)]
pub(crate) fn parse_csv(bytes: &[u8], has_header: bool) -> NodeResult<Vec<Value>> {
    parse_separated(bytes, ',', has_header)
}

#[allow(dead_code)]
pub(crate) fn parse_tsv(bytes: &[u8], has_header: bool) -> NodeResult<Vec<Value>> {
    parse_separated(bytes, '\t', has_header)
}

#[allow(dead_code)]
fn parse_separated(bytes: &[u8], sep: char, has_header: bool) -> NodeResult<Vec<Value>> {
    let text = std::str::from_utf8(bytes).map_err(|e| NodeError::InvalidParameter {
        name: "operation".into(),
        reason: format!("file is not valid UTF-8: {e}"),
    })?;
    let rows = parse_separated_rows(text, sep);
    if rows.is_empty() {
        return Ok(vec![]);
    }
    let mut out: Vec<Value> = Vec::with_capacity(rows.len());
    if has_header {
        let (head, body) = rows.split_at(1);
        let headers = &head[0];
        for row in body {
            let mut m = Map::new();
            for (i, cell) in row.iter().enumerate() {
                let key = headers
                    .get(i)
                    .cloned()
                    .unwrap_or_else(|| format!("col_{i}"));
                m.insert(key, Value::String(cell.clone()));
            }
            out.push(Value::Object(m));
        }
    } else {
        for row in &rows {
            let arr = row.iter().cloned().map(Value::String).collect();
            out.push(Value::Array(arr));
        }
    }
    Ok(out)
}

#[allow(dead_code)]
fn parse_separated_rows(text: &str, sep: char) -> Vec<Vec<String>> {
    // Minimal RFC-4180-ish parser: handles quoted cells with embedded
    // delimiters / newlines / doubled-double-quotes. Skips empty trailing
    // line so a trailing `\n` doesn't produce a phantom empty row.
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut cur_row: Vec<String> = Vec::new();
    let mut cur_cell = String::new();
    let mut in_quotes = false;
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if in_quotes {
            if c == '"' {
                if i + 1 < chars.len() && chars[i + 1] == '"' {
                    cur_cell.push('"');
                    i += 2;
                    continue;
                }
                in_quotes = false;
                i += 1;
                continue;
            }
            cur_cell.push(c);
            i += 1;
            continue;
        }
        if c == '"' {
            in_quotes = true;
            i += 1;
            continue;
        }
        if c == sep {
            cur_row.push(std::mem::take(&mut cur_cell));
            i += 1;
            continue;
        }
        if c == '\r' {
            i += 1;
            continue;
        }
        if c == '\n' {
            cur_row.push(std::mem::take(&mut cur_cell));
            rows.push(std::mem::take(&mut cur_row));
            i += 1;
            continue;
        }
        cur_cell.push(c);
        i += 1;
    }
    if !cur_cell.is_empty() || !cur_row.is_empty() {
        cur_row.push(cur_cell);
        rows.push(cur_row);
    }
    rows
}

#[allow(dead_code)]
pub(crate) fn parse_xml(bytes: &[u8]) -> NodeResult<Vec<Value>> {
    let text = std::str::from_utf8(bytes).map_err(|e| NodeError::InvalidParameter {
        name: "operation".into(),
        reason: format!("XML file is not valid UTF-8: {e}"),
    })?;
    let parsed: Value =
        quick_xml::de::from_str(text).map_err(|e| NodeError::InvalidParameter {
            name: "operation".into(),
            reason: format!("invalid XML: {e}"),
        })?;
    Ok(match parsed {
        Value::Array(a) => a,
        other => vec![other],
    })
}

#[allow(dead_code)]
pub(crate) fn parse_rtf(bytes: &[u8]) -> NodeResult<Vec<Value>> {
    let text = std::str::from_utf8(bytes).map_err(|e| NodeError::InvalidParameter {
        name: "operation".into(),
        reason: format!("RTF file is not valid UTF-8: {e}"),
    })?;
    Ok(vec![json!({ "text": rtf_strip(text) })])
}

#[allow(dead_code)]
fn rtf_strip(s: &str) -> String {
    // Quick-and-dirty: drop control words and braces, keep visible chars.
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\\' => {
                // Control word: \word or \word123 — consume until non-alnum.
                while let Some(&n) = chars.peek() {
                    if n.is_ascii_alphanumeric() {
                        chars.next();
                    } else {
                        break;
                    }
                }
                // Optional trailing space is part of the control word.
                if let Some(&n) = chars.peek() {
                    if n == ' ' {
                        chars.next();
                    }
                }
            }
            '{' | '}' => {}
            other => out.push(other),
        }
    }
    out.trim().to_string()
}

#[allow(dead_code)]
pub(crate) fn parse_plain(bytes: &[u8]) -> NodeResult<Vec<Value>> {
    let text = std::str::from_utf8(bytes).map_err(|e| NodeError::InvalidParameter {
        name: "operation".into(),
        reason: format!("file is not valid UTF-8: {e}"),
    })?;
    Ok(vec![json!({ "text": text })])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_csv_with_header() {
        let bytes = b"name,age\nAda,36\nGrace,72\n";
        let items = parse_csv(bytes, true).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0]["name"], "Ada");
        assert_eq!(items[1]["age"], "72");
    }

    #[test]
    fn parse_csv_quoted_cells() {
        let bytes = b"name,note\n\"Ada\",\"hello, world\"\n";
        let items = parse_csv(bytes, true).unwrap();
        assert_eq!(items[0]["note"], "hello, world");
    }

    #[test]
    fn parse_tsv_no_header() {
        let bytes = b"a\tb\nc\td\n";
        let items = parse_tsv(bytes, false).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0][0], "a");
        assert_eq!(items[1][1], "d");
    }

    #[test]
    fn parse_json_array() {
        let items = parse_json(br#"[{"a":1},{"a":2}]"#).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[1]["a"], 2);
    }

    #[test]
    fn parse_rtf_strips_control_words() {
        let text = parse_rtf(br"{\rtf1\ansi\deff0 Hello\par world}").unwrap();
        let s = text[0]["text"].as_str().unwrap();
        assert!(s.contains("Hello"));
        assert!(s.contains("world"));
    }

    #[test]
    fn parse_plain_passes_through() {
        let items = parse_plain(b"line one\nline two").unwrap();
        assert_eq!(items[0]["text"], "line one\nline two");
    }
}
