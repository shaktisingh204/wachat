//! Edit Image node.
//!
//! Surfaces n8n's image-manipulation operations (resize, crop, rotate, blur,
//! composite, draw text, …) so flows can be authored against the real
//! schema. Actual pixel work is **not** shipped yet — adding the `image`
//! crate plus a TTF font pipeline doubled the worker binary in prototypes,
//! so this node returns `NotImplemented` at runtime per the C.3.2 stub
//! policy. The descriptor is intentionally complete so:
//!
//!   1. The editor renders the same property panel as n8n.
//!   2. When the real backend lands, flipping the `execute` body is the
//!      only change required.
//!   3. Users see *which* operation we don't support, not a generic
//!      "node not implemented" toast.

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct EditImageNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for EditImageNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "editImage",
            "Edit Image",
            "Resize, crop, rotate, blur, or composite image binaries",
            NodeCategory::Files,
        )
        .icon("image")
        .color("#ec4899")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Information", "information"),
                    opt("Resize", "resize"),
                    opt("Crop", "crop"),
                    opt("Rotate", "rotate"),
                    opt("Blur", "blur"),
                    opt("Sharpen", "sharpen"),
                    opt("Composite", "composite"),
                    opt("Draw Text", "drawText"),
                    opt("Border", "border"),
                    opt("Convert Format", "convert"),
                ])
                .default(json!("resize"))
                .required(),
            NodeProperty::new("sourceFileId", "Source File", NodePropertyType::String)
                .placeholder("sabFileId or upstream binary key")
                .description("SabFiles id of the source image (binary will be loaded lazily)")
                .required(),
            NodeProperty::new("width", "Width (px)", NodePropertyType::Number)
                .default(json!(800))
                .show_when("operation", &["resize", "crop", "border"]),
            NodeProperty::new("height", "Height (px)", NodePropertyType::Number)
                .default(json!(600))
                .show_when("operation", &["resize", "crop", "border"]),
            NodeProperty::new("offsetX", "Offset X (px)", NodePropertyType::Number)
                .default(json!(0))
                .show_when("operation", &["crop", "composite", "drawText"]),
            NodeProperty::new("offsetY", "Offset Y (px)", NodePropertyType::Number)
                .default(json!(0))
                .show_when("operation", &["crop", "composite", "drawText"]),
            NodeProperty::new("degrees", "Rotation (degrees)", NodePropertyType::Number)
                .default(json!(90))
                .show_when("operation", &["rotate"]),
            NodeProperty::new("blurRadius", "Blur Radius", NodePropertyType::Number)
                .default(json!(5))
                .show_when("operation", &["blur"]),
            NodeProperty::new("text", "Text", NodePropertyType::String)
                .placeholder("Hello")
                .show_when("operation", &["drawText"]),
            NodeProperty::new("fontSize", "Font Size", NodePropertyType::Number)
                .default(json!(24))
                .show_when("operation", &["drawText"]),
            NodeProperty::new("color", "Color", NodePropertyType::Color)
                .default(json!("#000000"))
                .show_when("operation", &["drawText", "border"]),
            NodeProperty::new("overlayFileId", "Overlay File", NodePropertyType::String)
                .placeholder("sabFileId")
                .description("SabFiles id of the image to composite onto the source")
                .show_when("operation", &["composite"]),
            NodeProperty::new("outputFormat", "Output Format", NodePropertyType::Options)
                .options(vec![
                    opt("PNG", "png"),
                    opt("JPEG", "jpeg"),
                    opt("WebP", "webp"),
                    opt("GIF", "gif"),
                ])
                .default(json!("png")),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Resolve the operation so the rejection message is actionable.
        let operation = ctx
            .param_str_opt(params, "operation")
            .unwrap_or_else(|| "resize".to_string());

        Err(NodeError::NotImplemented(format!(
            "Edit Image: operation `{operation}` requires the image-processing backend \
             (not yet shipped — tracked under Phase C.5 long-tail closeout)."
        )))
    }
}
