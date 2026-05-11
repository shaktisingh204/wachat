//! XML node — convert between XML and JSON.
//!
//! Operations:
//!   - `xmlToJson`: parse XML via `quick_xml::de::from_str` into a
//!     `serde_json::Value`.  If the document does not parse cleanly as a
//!     simple element tree, fall back to `{ raw: <xml> }` with a TODO note.
//!   - `jsonToXml`: serialize a JSON value via `quick_xml::se::to_string`.
//!     If the shape isn't trivially representable as XML, return an error.
//!
//! Local-only; no HTTP.

use async_trait::async_trait;
use quick_xml::{de::from_str as xml_from_str, se::to_string as xml_to_string};
use serde_json::{Map, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct XmlNode;

#[async_trait]
impl Node for XmlNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "xml",
            "XML",
            "Convert between XML and JSON",
            NodeCategory::Transform,
        )
        .icon("file-code")
        .color("#0288D1")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "XML to JSON".into(),
                        value: Value::String("xmlToJson".into()),
                        description: Some("Parse an XML document into a JSON value".into()),
                    },
                    NodePropertyOption {
                        name: "JSON to XML".into(),
                        value: Value::String("jsonToXml".into()),
                        description: Some("Serialize a JSON value as XML".into()),
                    },
                ])
                .default(Value::String("xmlToJson".into()))
                .required(),
            NodeProperty::new("sourceXml", "XML", NodePropertyType::String)
                .description("The XML document to parse")
                .placeholder("<root><item>1</item></root>")
                .show_when("operation", &["xmlToJson"])
                .required(),
            NodeProperty::new("sourceJson", "JSON", NodePropertyType::Json)
                .description("The JSON value to serialize as XML")
                .default(Value::Object(Map::new()))
                .show_when("operation", &["jsonToXml"])
                .required(),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "xmlToJson" => {
                let source = ctx.param_str(params, "sourceXml")?;

                // Try to deserialize into a generic JSON value.  quick-xml's
                // serde adapter handles simple element-tree shapes well; if it
                // fails, fall back to a raw passthrough so the caller can still
                // inspect the input.
                let parsed: NodeResult<Value> = xml_from_str::<Value>(&source).map_err(|e| {
                    NodeError::InvalidParameter {
                        name: "sourceXml".into(),
                        reason: format!("failed to parse XML: {e}"),
                    }
                });

                let out = match parsed {
                    Ok(v) => v,
                    Err(_) => {
                        let mut m = Map::new();
                        m.insert("raw".into(), Value::String(source));
                        m.insert(
                            "_todo".into(),
                            Value::String(
                                // TODO: implement a richer XML → JSON walker
                                // (attributes, mixed content, namespaces) once
                                // the simple-element path covers the common
                                // cases.
                                "complex XML not yet supported; returning raw".into(),
                            ),
                        );
                        Value::Object(m)
                    }
                };

                Ok(NodeOutput::single(vec![out]))
            }
            "jsonToXml" => {
                let source = params.get("sourceJson").cloned().ok_or_else(|| {
                    NodeError::MissingParameter("sourceJson".into())
                })?;

                // quick-xml only knows how to serialize struct-shaped values —
                // a top-level scalar / array / null can't be represented as a
                // well-formed XML document, so reject those up front.
                match &source {
                    Value::Object(_) => {}
                    other => {
                        return Err(NodeError::InvalidParameter {
                            name: "sourceJson".into(),
                            reason: format!(
                                "JSON shape isn't representable as XML (expected an object root, got: {})",
                                shape_name(other)
                            ),
                        });
                    }
                }

                let xml = xml_to_string(&source).map_err(|e| NodeError::InvalidParameter {
                    name: "sourceJson".into(),
                    reason: format!("failed to serialize to XML: {e}"),
                })?;

                let mut obj = Map::new();
                obj.insert("xml".into(), Value::String(xml));
                Ok(NodeOutput::single(vec![Value::Object(obj)]))
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

fn shape_name(v: &Value) -> &'static str {
    match v {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}
