//! HTML node — parse HTML and extract values via CSS selectors, or convert
//! plain text into HTML.
//!
//! Operations:
//!   - `extract`: parse `sourceData` with `scraper::Html`, run each
//!     `extractionValues` entry's CSS selector, and collect results into an
//!     object keyed by `key`.
//!   - `convertToHtml`: take plain text, escape `& < >`, and replace newlines
//!     with `<br/>`.
//!
//! Local-only; no HTTP.

use async_trait::async_trait;
use scraper::{ElementRef, Html, Selector};
use serde_json::{Map, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct HtmlNode;

#[async_trait]
impl Node for HtmlNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "html",
            "HTML",
            "Parse HTML with CSS selectors or convert text to HTML",
            NodeCategory::Transform,
        )
        .icon("file-code")
        .color("#E34F26")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Extract HTML Content".into(),
                        value: Value::String("extract".into()),
                        description: Some(
                            "Run CSS selectors against an HTML document".into(),
                        ),
                    },
                    NodePropertyOption {
                        name: "Convert to HTML".into(),
                        value: Value::String("convertToHtml".into()),
                        description: Some(
                            "Escape special chars and turn newlines into <br/>".into(),
                        ),
                    },
                ])
                .default(Value::String("extract".into()))
                .required(),
            NodeProperty::new("sourceData", "HTML", NodePropertyType::String)
                .description("The HTML to parse")
                .placeholder("<html>...</html>")
                .show_when("operation", &["extract"])
                .required(),
            NodeProperty::new("extractionValues", "Extraction Values", NodePropertyType::Json)
                .description(
                    "Array of { key, cssSelector, returnValue: \"text\"|\"html\"|\"attribute\", attribute? }",
                )
                .default(Value::Array(vec![]))
                .show_when("operation", &["extract"]),
            NodeProperty::new("text", "Text", NodePropertyType::String)
                .description("Plain text input to convert into HTML")
                .placeholder("Hello\nworld")
                .show_when("operation", &["convertToHtml"])
                .required(),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "extract" => {
                let source = ctx.param_str(params, "sourceData")?;
                let extraction_raw = params
                    .get("extractionValues")
                    .cloned()
                    .unwrap_or(Value::Array(vec![]));
                let extractions = match extraction_raw {
                    Value::Array(a) => a,
                    Value::Null => vec![],
                    other => {
                        return Err(NodeError::InvalidParameter {
                            name: "extractionValues".into(),
                            reason: format!("expected an array, got: {other}"),
                        });
                    }
                };

                let doc = Html::parse_document(&source);

                let mut out = Map::new();
                for entry in extractions.iter() {
                    let key = entry
                        .get("key")
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| NodeError::InvalidParameter {
                            name: "extractionValues.key".into(),
                            reason: "missing `key` on entry".into(),
                        })?
                        .to_string();
                    let css = entry
                        .get("cssSelector")
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| NodeError::InvalidParameter {
                            name: "extractionValues.cssSelector".into(),
                            reason: format!("missing `cssSelector` on entry `{key}`"),
                        })?;
                    let return_value = entry
                        .get("returnValue")
                        .and_then(|v| v.as_str())
                        .unwrap_or("text");
                    let attribute = entry
                        .get("attribute")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");

                    let css = ctx.substitute(css);
                    let attribute = ctx.substitute(attribute);

                    let selector =
                        Selector::parse(&css).map_err(|e| NodeError::InvalidParameter {
                            name: "extractionValues.cssSelector".into(),
                            reason: format!("invalid selector `{css}`: {e}"),
                        })?;

                    let mut values: Vec<Value> = Vec::new();
                    for el in doc.select(&selector) {
                        if let Some(v) = extract_value(&el, return_value, &attribute) {
                            values.push(v);
                        }
                    }

                    let entry_value = match values.len() {
                        0 => Value::Null,
                        1 => values.into_iter().next().unwrap(),
                        _ => Value::Array(values),
                    };
                    out.insert(key, entry_value);
                }

                Ok(NodeOutput::single(vec![Value::Object(out)]))
            }
            "convertToHtml" => {
                let text = ctx.param_str(params, "text")?;
                let escaped = escape_and_brify(&text);
                let mut obj = Map::new();
                obj.insert("html".into(), Value::String(escaped));
                let _ = input; // suppress unused warning; input not used by this op
                Ok(NodeOutput::single(vec![Value::Object(obj)]))
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

fn extract_value(el: &ElementRef<'_>, return_value: &str, attribute: &str) -> Option<Value> {
    match return_value {
        "html" => Some(Value::String(el.inner_html())),
        "attribute" => el
            .value()
            .attr(attribute)
            .map(|v| Value::String(v.to_string())),
        _ => {
            // "text" (default): collapsed text content
            let s: String = el.text().collect::<Vec<_>>().join("");
            Some(Value::String(s.trim().to_string()))
        }
    }
}

fn escape_and_brify(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '\r' => {}
            '\n' => out.push_str("<br/>"),
            other => out.push(other),
        }
    }
    out
}
