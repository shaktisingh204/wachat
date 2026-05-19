//! Builder-JSON → MJML → HTML render pipeline.
//!
//! The drag-and-drop builder produces an [`EmailBuilderDocument`].
//! [`render_builder_to_html`] walks that document, emits an MJML
//! string, and hands it to the `mrml` crate's parser + HTML renderer.
//!
//! ## Brand kit injection
//!
//! When a [`EmailBrandKit`] is supplied, its palette + fonts are
//! emitted as `<mj-attributes>` overrides at the top of the MJML
//! document so every block inherits the kit unless it overrides
//! locally. Footer copy (company name + address + unsubscribe text) is
//! appended as a final `<mj-section>` when the document doesn't
//! already contain a `footer` block.
//!
//! ## Supported block types
//!
//! `text`, `image`, `button`, `columns`, `divider`, `spacer`,
//! `footer`, `html`. Unknown block types render as an HTML comment
//! plus a warning on the [`RenderResult`].

use anyhow::Context;
use sabnode_common::{ApiError, Result};
use serde_json::Value;

use crate::dto::{
    EmailBrandKit, EmailBuilderBlock, EmailBuilderDocument, EmailBuilderSettings,
};

/// Output of the render pipeline. `mjml` is kept alongside `html` so
/// callers can stash it for cache-invalidation diffing or developer
/// debugging.
#[derive(Debug, Clone)]
pub struct RenderResult {
    /// Final HTML the send engine drops into the SMTP body.
    pub html: String,
    /// The MJML string we handed to `mrml` — useful for caching and
    /// for the in-app "show MJML" developer view.
    pub mjml: String,
    /// Soft warnings collected while walking the block tree
    /// (unknown block types, missing required props, etc.). Render
    /// does NOT fail on these — broken blocks degrade to comments.
    pub warnings: Vec<String>,
}

/// Render a builder document into HTML.
///
/// `brand` is optional — when present its palette / fonts / footer are
/// woven into the emitted MJML.
pub fn render_builder_to_html(
    doc: &EmailBuilderDocument,
    brand: Option<&EmailBrandKit>,
) -> Result<RenderResult> {
    let mut warnings: Vec<String> = Vec::new();
    let mjml = emit_mjml(doc, brand, &mut warnings);

    // Hand the MJML to mrml. Both parse and render errors funnel into
    // ApiError::Internal — they indicate either a bug in our emitter
    // or an extremely large document.
    let parsed = mrml::parse(&mjml)
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::msg(format!("mrml parse error: {e:?}"))
                    .context("email-templates::render"),
            )
        })?;
    let render_opts = mrml::prelude::render::RenderOptions::default();
    let html = parsed
        .element
        .render(&render_opts)
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::msg(format!("mrml render error: {e:?}"))
                    .context("email-templates::render"),
            )
        })
        .context("mrml render")
        .map_err(ApiError::Internal)?;

    Ok(RenderResult {
        html,
        mjml,
        warnings,
    })
}

// ---------------------------------------------------------------------------
// MJML emitter
// ---------------------------------------------------------------------------

/// Walk the document and produce an MJML string.
///
/// The structure is:
///
/// ```text
/// <mjml>
///   <mj-head>
///     <mj-attributes>…brand defaults…</mj-attributes>
///     <mj-preview>…preheader…</mj-preview>
///   </mj-head>
///   <mj-body background-color="…">
///     <mj-section>…block…</mj-section>
///     …
///     <mj-section>…brand footer (if not already present)…</mj-section>
///   </mj-body>
/// </mjml>
/// ```
fn emit_mjml(
    doc: &EmailBuilderDocument,
    brand: Option<&EmailBrandKit>,
    warnings: &mut Vec<String>,
) -> String {
    let mut out = String::with_capacity(2048);
    out.push_str("<mjml>");

    // ---- head -----------------------------------------------------
    out.push_str("<mj-head>");
    out.push_str(&head_attributes(&doc.settings, brand));
    if let Some(pre) = doc.settings.preheader.as_deref() {
        if !pre.is_empty() {
            out.push_str("<mj-preview>");
            out.push_str(&escape_text(pre));
            out.push_str("</mj-preview>");
        }
    }
    out.push_str("</mj-head>");

    // ---- body -----------------------------------------------------
    let body_bg = doc
        .settings
        .background_color
        .clone()
        .or_else(|| brand.and_then(|b| b.palette.background.clone()))
        .unwrap_or_else(|| "#f4f4f4".to_owned());
    let body_width = doc.settings.width.unwrap_or(600);
    out.push_str(&format!(
        "<mj-body background-color=\"{}\" width=\"{}px\">",
        escape_attr(&body_bg),
        body_width
    ));

    // Walk top-level blocks.
    let mut saw_footer = false;
    for block in &doc.blocks {
        if block.kind == "footer" {
            saw_footer = true;
        }
        out.push_str(&emit_block(block, brand, warnings));
    }

    // Append brand footer if the document didn't include one and a
    // brand kit was supplied.
    if !saw_footer {
        if let Some(b) = brand {
            out.push_str(&emit_brand_footer(b));
        }
    }

    out.push_str("</mj-body>");
    out.push_str("</mjml>");
    out
}

/// Emit `<mj-attributes>` defaults so every block inherits brand
/// fonts and colours unless it overrides locally.
fn head_attributes(settings: &EmailBuilderSettings, brand: Option<&EmailBrandKit>) -> String {
    let body_font = settings
        .font_family
        .clone()
        .or_else(|| brand.and_then(|b| b.fonts.body.clone()))
        .unwrap_or_else(|| "Arial, sans-serif".to_owned());
    let heading_font = brand
        .and_then(|b| b.fonts.heading.clone())
        .unwrap_or_else(|| body_font.clone());
    let primary = brand
        .map(|b| b.palette.primary.clone())
        .unwrap_or_else(|| "#1a73e8".to_owned());
    let text_color = brand
        .and_then(|b| b.palette.text.clone())
        .unwrap_or_else(|| "#202020".to_owned());

    let mut out = String::from("<mj-attributes>");
    out.push_str(&format!(
        "<mj-all font-family=\"{}\" color=\"{}\" />",
        escape_attr(&body_font),
        escape_attr(&text_color),
    ));
    out.push_str(&format!(
        "<mj-text font-family=\"{}\" color=\"{}\" font-size=\"14px\" line-height=\"1.5\" />",
        escape_attr(&body_font),
        escape_attr(&text_color),
    ));
    out.push_str(&format!(
        "<mj-button background-color=\"{}\" color=\"#ffffff\" font-family=\"{}\" />",
        escape_attr(&primary),
        escape_attr(&heading_font),
    ));
    out.push_str("</mj-attributes>");
    out
}

/// Emit a single block. Container blocks recurse.
fn emit_block(
    block: &EmailBuilderBlock,
    brand: Option<&EmailBrandKit>,
    warnings: &mut Vec<String>,
) -> String {
    match block.kind.as_str() {
        "text" => emit_text(block),
        "image" => emit_image(block),
        "button" => emit_button(block),
        "columns" => emit_columns(block, brand, warnings),
        "divider" => emit_divider(block),
        "spacer" => emit_spacer(block),
        "footer" => emit_footer_block(block, brand),
        "html" => emit_html(block),
        other => {
            warnings.push(format!(
                "unknown block type `{other}` (id={}) rendered as comment",
                block.id
            ));
            format!("<!-- unsupported block: {} -->", escape_text(other))
        }
    }
}

fn emit_text(block: &EmailBuilderBlock) -> String {
    let text = prop_str(&block.props, "text").unwrap_or_default();
    let align = prop_str(&block.props, "align").unwrap_or_else(|| "left".to_owned());
    format!(
        "<mj-section><mj-column><mj-text align=\"{}\">{}</mj-text></mj-column></mj-section>",
        escape_attr(&align),
        // Text props are HTML-by-design (the builder produces inline
        // markup from a rich-text editor); pass through verbatim.
        text,
    )
}

fn emit_image(block: &EmailBuilderBlock) -> String {
    let src = prop_str(&block.props, "src").unwrap_or_default();
    let alt = prop_str(&block.props, "alt").unwrap_or_default();
    let href = prop_str(&block.props, "href");
    let width = prop_str(&block.props, "width");
    let align = prop_str(&block.props, "align").unwrap_or_else(|| "center".to_owned());

    let mut attrs = format!(
        "src=\"{}\" alt=\"{}\" align=\"{}\"",
        escape_attr(&src),
        escape_attr(&alt),
        escape_attr(&align),
    );
    if let Some(h) = href {
        attrs.push_str(&format!(" href=\"{}\"", escape_attr(&h)));
    }
    if let Some(w) = width {
        attrs.push_str(&format!(" width=\"{}\"", escape_attr(&w)));
    }
    format!(
        "<mj-section><mj-column><mj-image {attrs} /></mj-column></mj-section>"
    )
}

fn emit_button(block: &EmailBuilderBlock) -> String {
    let label = prop_str(&block.props, "label").unwrap_or_else(|| "Click here".to_owned());
    let href = prop_str(&block.props, "href").unwrap_or_else(|| "#".to_owned());
    let bg = prop_str(&block.props, "backgroundColor");
    let color = prop_str(&block.props, "color");
    let align = prop_str(&block.props, "align").unwrap_or_else(|| "center".to_owned());

    let mut attrs = format!(
        "href=\"{}\" align=\"{}\"",
        escape_attr(&href),
        escape_attr(&align),
    );
    if let Some(c) = bg {
        attrs.push_str(&format!(" background-color=\"{}\"", escape_attr(&c)));
    }
    if let Some(c) = color {
        attrs.push_str(&format!(" color=\"{}\"", escape_attr(&c)));
    }
    format!(
        "<mj-section><mj-column><mj-button {attrs}>{}</mj-button></mj-column></mj-section>",
        escape_text(&label),
    )
}

fn emit_divider(block: &EmailBuilderBlock) -> String {
    let color = prop_str(&block.props, "color").unwrap_or_else(|| "#cccccc".to_owned());
    let padding = prop_str(&block.props, "padding").unwrap_or_else(|| "10px 25px".to_owned());
    format!(
        "<mj-section><mj-column><mj-divider border-color=\"{}\" padding=\"{}\" /></mj-column></mj-section>",
        escape_attr(&color),
        escape_attr(&padding),
    )
}

fn emit_spacer(block: &EmailBuilderBlock) -> String {
    let height = prop_u32(&block.props, "height").unwrap_or(20);
    format!(
        "<mj-section><mj-column><mj-spacer height=\"{height}px\" /></mj-column></mj-section>"
    )
}

fn emit_html(block: &EmailBuilderBlock) -> String {
    let html = prop_str(&block.props, "html").unwrap_or_default();
    // `mj-raw` is the MJML escape hatch for verbatim HTML.
    format!("<mj-section><mj-column><mj-raw>{html}</mj-raw></mj-column></mj-section>")
}

fn emit_columns(
    block: &EmailBuilderBlock,
    brand: Option<&EmailBrandKit>,
    warnings: &mut Vec<String>,
) -> String {
    let children = block.children.as_deref().unwrap_or(&[]);
    if children.is_empty() {
        warnings.push(format!("columns block id={} has no children", block.id));
        return String::from("<mj-section><mj-column></mj-column></mj-section>");
    }
    let widths = block
        .props
        .get("widths")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|n| n.as_u64().map(|x| x as u32))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let mut out = String::from("<mj-section>");
    for (i, child) in children.iter().enumerate() {
        let width_attr = widths
            .get(i)
            .copied()
            .map(|w| format!(" width=\"{w}px\""))
            .unwrap_or_default();
        out.push_str(&format!("<mj-column{width_attr}>"));
        // For column children we skip the wrapping `<mj-section>` the
        // top-level emitters would add — but the helpers above always
        // wrap. Simplest: just emit a raw inline element per known
        // child type. For unknown / unsupported children inside a
        // column we degrade to a text block.
        out.push_str(&emit_block_inline(child, brand, warnings));
        out.push_str("</mj-column>");
    }
    out.push_str("</mj-section>");
    out
}

/// Like [`emit_block`] but emits the inner `<mj-…>` element without
/// the wrapping `<mj-section><mj-column>` — for use as a child of a
/// `columns` block.
fn emit_block_inline(
    block: &EmailBuilderBlock,
    _brand: Option<&EmailBrandKit>,
    warnings: &mut Vec<String>,
) -> String {
    match block.kind.as_str() {
        "text" => {
            let text = prop_str(&block.props, "text").unwrap_or_default();
            let align = prop_str(&block.props, "align").unwrap_or_else(|| "left".to_owned());
            format!("<mj-text align=\"{}\">{}</mj-text>", escape_attr(&align), text)
        }
        "image" => {
            let src = prop_str(&block.props, "src").unwrap_or_default();
            let alt = prop_str(&block.props, "alt").unwrap_or_default();
            format!(
                "<mj-image src=\"{}\" alt=\"{}\" />",
                escape_attr(&src),
                escape_attr(&alt)
            )
        }
        "button" => {
            let label = prop_str(&block.props, "label").unwrap_or_else(|| "Click".to_owned());
            let href = prop_str(&block.props, "href").unwrap_or_else(|| "#".to_owned());
            format!(
                "<mj-button href=\"{}\">{}</mj-button>",
                escape_attr(&href),
                escape_text(&label)
            )
        }
        "divider" => {
            let color = prop_str(&block.props, "color").unwrap_or_else(|| "#cccccc".to_owned());
            format!("<mj-divider border-color=\"{}\" />", escape_attr(&color))
        }
        "spacer" => {
            let height = prop_u32(&block.props, "height").unwrap_or(10);
            format!("<mj-spacer height=\"{height}px\" />")
        }
        "html" => {
            let html = prop_str(&block.props, "html").unwrap_or_default();
            format!("<mj-raw>{html}</mj-raw>")
        }
        other => {
            warnings.push(format!(
                "unknown inline block type `{other}` (id={}) rendered as comment",
                block.id
            ));
            format!("<mj-raw><!-- unsupported: {} --></mj-raw>", escape_text(other))
        }
    }
}

fn emit_footer_block(block: &EmailBuilderBlock, brand: Option<&EmailBrandKit>) -> String {
    let company = prop_str(&block.props, "companyName")
        .or_else(|| brand.map(|b| b.footer.company_name.clone()))
        .unwrap_or_default();
    let address = prop_str(&block.props, "address")
        .or_else(|| brand.map(|b| b.footer.address.clone()))
        .unwrap_or_default();
    let unsub = prop_str(&block.props, "unsubscribeUrl").unwrap_or_else(|| "#".to_owned());
    let unsub_text = brand
        .and_then(|b| b.footer.unsubscribe_text.clone())
        .unwrap_or_else(|| "Unsubscribe".to_owned());

    format!(
        "<mj-section><mj-column>\
            <mj-text align=\"center\" font-size=\"12px\" color=\"#888888\">\
                {company}<br/>{address}<br/>\
                <a href=\"{unsub_href}\" style=\"color:#888888;text-decoration:underline;\">{unsub_text}</a>\
            </mj-text>\
        </mj-column></mj-section>",
        company = escape_text(&company),
        address = escape_text(&address),
        unsub_href = escape_attr(&unsub),
        unsub_text = escape_text(&unsub_text),
    )
}

fn emit_brand_footer(brand: &EmailBrandKit) -> String {
    let unsub_text = brand
        .footer
        .unsubscribe_text
        .clone()
        .unwrap_or_else(|| "Unsubscribe".to_owned());
    format!(
        "<mj-section><mj-column>\
            <mj-text align=\"center\" font-size=\"12px\" color=\"#888888\">\
                {company}<br/>{address}<br/>\
                <a href=\"{{{{unsubscribe_url}}}}\" style=\"color:#888888;text-decoration:underline;\">{unsub_text}</a>\
            </mj-text>\
        </mj-column></mj-section>",
        company = escape_text(&brand.footer.company_name),
        address = escape_text(&brand.footer.address),
        unsub_text = escape_text(&unsub_text),
    )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn prop_str(props: &Value, key: &str) -> Option<String> {
    props.get(key).and_then(|v| match v {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        Value::Bool(b) => Some(b.to_string()),
        _ => None,
    })
}

fn prop_u32(props: &Value, key: &str) -> Option<u32> {
    props
        .get(key)
        .and_then(|v| v.as_u64().or_else(|| v.as_i64().map(|i| i.max(0) as u64)))
        .map(|n| n as u32)
}

/// XML-attr-safe escape — `"` becomes `&quot;` and `&` becomes
/// `&amp;`. Used for everything we drop into `attr="…"`.
fn escape_attr(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
}

/// Plain-text escape — text that ends up between MJML tags. Less
/// strict than `escape_attr` (quotes don't need escaping in body
/// text), but `<` / `>` / `&` still do.
fn escape_text(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc_with_text() -> EmailBuilderDocument {
        EmailBuilderDocument {
            version: 1,
            settings: EmailBuilderSettings::default(),
            blocks: vec![EmailBuilderBlock {
                id: "b1".into(),
                kind: "text".into(),
                props: serde_json::json!({ "text": "Hello <strong>World</strong>" }),
                children: None,
            }],
        }
    }

    #[test]
    fn renders_basic_text_block() {
        let r = render_builder_to_html(&doc_with_text(), None).expect("render");
        assert!(r.html.contains("Hello"));
        assert!(r.mjml.contains("<mj-text"));
        assert!(r.warnings.is_empty());
    }

    #[test]
    fn unknown_block_warns_but_does_not_fail() {
        let doc = EmailBuilderDocument {
            version: 1,
            settings: EmailBuilderSettings::default(),
            blocks: vec![EmailBuilderBlock {
                id: "x1".into(),
                kind: "rocketship".into(),
                props: Value::Null,
                children: None,
            }],
        };
        let r = render_builder_to_html(&doc, None).expect("render");
        assert_eq!(r.warnings.len(), 1);
        assert!(r.mjml.contains("unsupported block"));
    }

    #[test]
    fn escape_attr_handles_quotes_and_amp() {
        assert_eq!(escape_attr("a & b"), "a &amp; b");
        assert_eq!(escape_attr("\"q\""), "&quot;q&quot;");
    }
}
