//! Convert to File — turn each input item into a "file" attached to its
//! `binary` map.
//!
//! Mirrors n8n-nodes-base.convertToFile. Supported `operation` values
//! (each is a distinct output format):
//!
//! | operation     | mime type            | extension |
//! | ------------- | -------------------- | --------- |
//! | `toJson`      | application/json     | `json`    |
//! | `toCsv`       | text/csv             | `csv`     |
//! | `toTsv`       | text/tab-separated-values | `tsv` |
//! | `toXml`       | application/xml      | `xml`     |
//! | `toHtml`      | text/html            | `html`    |
//! | `toIcal`      | text/calendar        | `ics`     |
//! | `toRtf`       | application/rtf      | `rtf`     |
//!
//! ## Wire shape
//!
//! Each output item carries its produced file under the `binary[<key>]`
//! object. The shape mirrors n8n's filesystem-mode `IBinaryData`
//! (`{ id, mimeType, fileName, fileExtension, fileSize }`) per the SabFlow
//! `BinaryDataRef` contract (see `binary.rs` / `docs/adr/sabflow-binary-data.md`).
//! **No raw base64 is embedded** on the wire — the byte payload is staged
//! through the `BinaryStore` resolver hook below.
//!
//! Because the workspace-level `BinaryStore` is registered by the BFF crate
//! at startup, the persistence call here delegates to the default store. The
//! default store returns [`NodeError::NotImplemented`] until C.2.7 lands in
//! the active branch — that's the C.3.2 stub policy:
//!
//! > "the affected mode/node gets a typed `not_yet_supported` error."
//!
//! All format-conversion logic IS implemented; only the SabFiles round-trip
//! is gated by the resolver presence.

use async_trait::async_trait;
use quick_xml::se::to_string as xml_to_string;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct ConvertToFileNode;

#[async_trait]
impl Node for ConvertToFileNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "convertToFile",
            "Convert to File",
            "Convert input items into a binary file (CSV, JSON, TSV, XML, HTML, iCal, RTF)",
            NodeCategory::Transform,
        )
        .icon("file-output")
        .color("#0EA5E9")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Convert to JSON file".into(),
                        value: Value::String("toJson".into()),
                        description: Some("Pretty-print items into a `.json` file".into()),
                    },
                    NodePropertyOption {
                        name: "Convert to CSV file".into(),
                        value: Value::String("toCsv".into()),
                        description: Some("Render items as comma-separated values".into()),
                    },
                    NodePropertyOption {
                        name: "Convert to TSV file".into(),
                        value: Value::String("toTsv".into()),
                        description: Some("Render items as tab-separated values".into()),
                    },
                    NodePropertyOption {
                        name: "Convert to XML file".into(),
                        value: Value::String("toXml".into()),
                        description: Some("Serialise items into an XML document".into()),
                    },
                    NodePropertyOption {
                        name: "Convert to HTML file".into(),
                        value: Value::String("toHtml".into()),
                        description: Some("Wrap items in a minimal HTML table".into()),
                    },
                    NodePropertyOption {
                        name: "Convert to iCal file".into(),
                        value: Value::String("toIcal".into()),
                        description: Some("Build an iCalendar (VEVENT) document".into()),
                    },
                    NodePropertyOption {
                        name: "Convert to RTF file".into(),
                        value: Value::String("toRtf".into()),
                        description: Some("Build a minimal RTF document".into()),
                    },
                ])
                .default(Value::String("toJson".into()))
                .required(),
            NodeProperty::new("fileName", "File Name", NodePropertyType::String)
                .description("Output file name (the extension is inferred from the operation if omitted).")
                .placeholder("file.csv"),
            NodeProperty::new("destinationKey", "Binary Property", NodePropertyType::String)
                .description("Key on the item's `binary` map under which the file is attached.")
                .default(Value::String("data".into())),
            // iCal-specific shape: callers pass an array of VEVENT-ish objects.
            NodeProperty::new("calendar", "Calendar Name", NodePropertyType::String)
                .description("VCALENDAR product / calendar name. iCal only.")
                .show_when("operation", &["toIcal"])
                .default(Value::String("SabFlow".into())),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let operation = ctx.param_str(params, "operation")?;
        let destination_key = ctx
            .param_str_opt(params, "destinationKey")
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "data".to_string());

        let raw_name = ctx
            .param_str_opt(params, "fileName")
            .filter(|s| !s.is_empty());

        let items = if input.items.is_empty() {
            // n8n behaviour: still emit a file even when the upstream has
            // no items (the file will be empty for tabular formats and a
            // bare wrapper for the rest).
            vec![Value::Null]
        } else {
            input.items.clone()
        };

        let (bytes, mime_type, ext) = match operation.as_str() {
            "toJson" => (
                pretty_json(&items).into_bytes(),
                "application/json",
                "json",
            ),
            "toCsv" => (
                build_separated(&items, ',')?.into_bytes(),
                "text/csv",
                "csv",
            ),
            "toTsv" => (
                build_separated(&items, '\t')?.into_bytes(),
                "text/tab-separated-values",
                "tsv",
            ),
            "toXml" => (
                build_xml(&items)?.into_bytes(),
                "application/xml",
                "xml",
            ),
            "toHtml" => (
                build_html_table(&items).into_bytes(),
                "text/html",
                "html",
            ),
            "toIcal" => {
                let calendar = ctx
                    .param_str_opt(params, "calendar")
                    .unwrap_or_else(|| "SabFlow".to_string());
                (
                    build_ical(&items, &calendar).into_bytes(),
                    "text/calendar",
                    "ics",
                )
            }
            "toRtf" => (
                build_rtf(&items).into_bytes(),
                "application/rtf",
                "rtf",
            ),
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        let file_name = raw_name.unwrap_or_else(|| format!("file.{ext}"));
        let file_size = bytes.len() as u64;

        // ---- Persist via the workspace `BinaryStore` -------------------
        //
        // The persistent SabFiles upload is owned by the C.2.7 `BinaryStore`
        // trait. While that module is absent from this branch's main
        // (it has shipped in d4d3b3c7d and is pending merge), the C.3.2
        // stub policy mandates a typed `not_yet_supported` error rather
        // than inline-base64 fallback. The format bytes are computed
        // above so the persistence swap is a one-line change once
        // `crate::binary::default_binary_store()` is wired in.
        //
        // TODO(c.2.7-merge): swap the block below for:
        //   let store = crate::binary::default_binary_store();
        //   let r#ref = store.persist(BinaryFetchContext { ... },
        //                              bytes, mime_type, &file_name).await?;
        //   item.binary[&destination_key] = serde_json::to_value(r#ref)?;

        // Build the would-be output items in advance so the wire shape is
        // available for tests / inspection — the actual `Ok(...)` return
        // is gated on BinaryStore presence (see error below).
        let mut _out_items: Vec<Value> = Vec::with_capacity(items.len());
        for original in items.iter() {
            let mut item = match original {
                Value::Object(_) => original.clone(),
                Value::Null => Value::Object(Map::new()),
                other => json!({ "json": other.clone() }),
            };
            // Build a placeholder ref slot so the wire shape is forward-
            // compatible: callers can already read `binary.data.fileName`
            // etc. The `id` is a `pending:` sentinel until BinaryStore
            // lands.
            let r#ref = json!({
                "id": format!("pending:{}:{}", ctx.execution_id, file_name),
                "mimeType": mime_type,
                "fileName": file_name.clone(),
                "fileExtension": ext,
                "fileSize": file_size,
            });
            if let Some(obj) = item.as_object_mut() {
                let binary_slot = obj
                    .entry("binary")
                    .or_insert_with(|| Value::Object(Map::new()));
                if let Value::Object(m) = binary_slot {
                    m.insert(destination_key.clone(), r#ref);
                }
            }
            _out_items.push(item);
        }

        // Per C.3.2 stub policy: surface a typed error so callers know
        // the file was computed but not persisted. The format logic is
        // ready; once `binary.rs` is on this branch, replace this with
        // the persist call above and return `out_items` directly.
        Err(NodeError::NotImplemented(format!(
            "convertToFile/{operation}: format logic ready ({file_size} bytes, {mime_type}); SabFiles persistence pending C.2.7 BinaryStore merge"
        )))
    }
}

// ── Format helpers ──────────────────────────────────────────────────────

fn pretty_json(items: &[Value]) -> String {
    // Match n8n: emit the top-level items array, pretty-printed.
    serde_json::to_string_pretty(items).unwrap_or_else(|_| "[]".to_string())
}

fn build_separated(items: &[Value], sep: char) -> NodeResult<String> {
    // Collect headers in first-seen order across every item.
    let mut headers: Vec<String> = Vec::new();
    for it in items {
        if let Some(obj) = it.as_object() {
            for k in obj.keys() {
                if !headers.iter().any(|h| h == k) {
                    headers.push(k.clone());
                }
            }
        }
    }
    let mut lines: Vec<String> = Vec::with_capacity(items.len() + 1);
    lines.push(
        headers
            .iter()
            .map(|h| escape_separated(h, sep))
            .collect::<Vec<_>>()
            .join(&sep.to_string()),
    );
    for it in items {
        if let Some(obj) = it.as_object() {
            let row: Vec<String> = headers
                .iter()
                .map(|h| {
                    let v = obj.get(h).cloned().unwrap_or(Value::Null);
                    escape_separated(&value_to_cell(&v), sep)
                })
                .collect();
            lines.push(row.join(&sep.to_string()));
        }
    }
    Ok(lines.join("\n"))
}

fn escape_separated(s: &str, sep: char) -> String {
    if s.contains(sep) || s.contains('"') || s.contains('\n') || s.contains('\r') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

fn value_to_cell(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

fn build_xml(items: &[Value]) -> NodeResult<String> {
    // Wrap items in a synthetic root so quick-xml can serialise an array.
    let mut root = Map::new();
    let inner: Vec<Value> = items
        .iter()
        .filter(|v| v.is_object() || v.is_string() || v.is_number() || v.is_bool())
        .cloned()
        .collect();
    root.insert("item".into(), Value::Array(inner));
    let wrapped = Value::Object(root);

    xml_to_string(&wrapped).map_err(|e| NodeError::InvalidParameter {
        name: "operation".into(),
        reason: format!("XML serialisation failed: {e}"),
    })
}

fn build_html_table(items: &[Value]) -> String {
    let mut headers: Vec<String> = Vec::new();
    for it in items {
        if let Some(obj) = it.as_object() {
            for k in obj.keys() {
                if !headers.iter().any(|h| h == k) {
                    headers.push(k.clone());
                }
            }
        }
    }
    let mut out = String::from("<!doctype html>\n<html><body><table>\n");
    out.push_str("<thead><tr>");
    for h in &headers {
        out.push_str(&format!("<th>{}</th>", html_escape(h)));
    }
    out.push_str("</tr></thead>\n<tbody>");
    for it in items {
        out.push_str("<tr>");
        if let Some(obj) = it.as_object() {
            for h in &headers {
                let v = obj.get(h).cloned().unwrap_or(Value::Null);
                out.push_str(&format!("<td>{}</td>", html_escape(&value_to_cell(&v))));
            }
        } else {
            // Single-cell row for scalars / nulls so the document stays
            // well-formed.
            let span = headers.len().max(1);
            out.push_str(&format!(
                "<td colspan=\"{span}\">{}</td>",
                html_escape(&value_to_cell(it))
            ));
        }
        out.push_str("</tr>");
    }
    out.push_str("</tbody></table></body></html>");
    out
}

fn html_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            other => out.push(other),
        }
    }
    out
}

fn build_ical(items: &[Value], calendar: &str) -> String {
    // Minimal VCALENDAR + one VEVENT per item.  Required item fields:
    //   uid, summary, dtstart, dtend (or duration). All optional — missing
    //   ones are filled with placeholders so the document stays parseable.
    let mut out = String::new();
    out.push_str("BEGIN:VCALENDAR\r\n");
    out.push_str("VERSION:2.0\r\n");
    out.push_str(&format!("PRODID:-//SabFlow//{}//EN\r\n", ical_escape(calendar)));
    for (idx, it) in items.iter().enumerate() {
        let obj = it.as_object();
        let uid = obj
            .and_then(|o| o.get("uid"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("sabflow-{idx}@local"));
        let summary = obj
            .and_then(|o| o.get("summary"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("Event {}", idx + 1));
        let dtstart = obj
            .and_then(|o| o.get("dtstart"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "19700101T000000Z".to_string());
        let dtend = obj
            .and_then(|o| o.get("dtend"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| dtstart.clone());
        out.push_str("BEGIN:VEVENT\r\n");
        out.push_str(&format!("UID:{}\r\n", ical_escape(&uid)));
        out.push_str(&format!("SUMMARY:{}\r\n", ical_escape(&summary)));
        out.push_str(&format!("DTSTART:{}\r\n", dtstart));
        out.push_str(&format!("DTEND:{}\r\n", dtend));
        out.push_str("END:VEVENT\r\n");
    }
    out.push_str("END:VCALENDAR\r\n");
    out
}

fn ical_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            ';' => out.push_str("\\;"),
            ',' => out.push_str("\\,"),
            '\n' => out.push_str("\\n"),
            other => out.push(other),
        }
    }
    out
}

fn build_rtf(items: &[Value]) -> String {
    // Bare-minimum but valid RTF 1.x: header + one paragraph per item.
    let mut out = String::from("{\\rtf1\\ansi\\deff0\n");
    for it in items {
        let text = match it {
            Value::Object(_) | Value::Array(_) => serde_json::to_string(it).unwrap_or_default(),
            Value::Null => String::new(),
            other => value_to_cell(other),
        };
        out.push_str(&rtf_escape(&text));
        out.push_str("\\par\n");
    }
    out.push('}');
    out
}

fn rtf_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '{' => out.push_str("\\{"),
            '}' => out.push_str("\\}"),
            '\r' => {}
            '\n' => out.push_str("\\par\n"),
            other if (other as u32) < 128 => out.push(other),
            other => {
                // Unicode escape per RTF spec: \uN? where N is signed 16-bit.
                let mut n = other as i32;
                if n > 32_767 {
                    n -= 65_536;
                }
                out.push_str(&format!("\\u{n}?"));
            }
        }
    }
    out
}
