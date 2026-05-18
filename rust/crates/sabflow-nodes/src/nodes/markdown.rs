//! Markdown node — convert between Markdown, HTML, and plain text.
//!
//! Hand-rolled (no new top-level deps). Covers the subset n8n's `markdown`
//! node ships and that almost every flow needs in practice:
//!
//!   - `markdownToHtml` : ATX headings, paragraphs, fenced code, inline code,
//!     bold/italic, links, unordered + ordered lists, blockquotes, hr.
//!   - `htmlToMarkdown` : best-effort inverse — strips tags, maps the same
//!     subset back to Markdown.
//!   - `markdownToText` : Markdown stripped to plain text (no formatting).
//!
//! Output of HTML conversions is HTML-escaped at the leaf-text level so user
//! input can't smuggle script tags into downstream nodes.
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

pub struct MarkdownNode;

#[async_trait]
impl Node for MarkdownNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "markdown",
            "Markdown",
            "Convert between Markdown, HTML, and plain text",
            NodeCategory::Transform,
        )
        .icon("file-text")
        .color("#475569")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Markdown to HTML".into(),
                        value: json!("markdownToHtml"),
                        description: Some("Render Markdown text as HTML".into()),
                    },
                    NodePropertyOption {
                        name: "HTML to Markdown".into(),
                        value: json!("htmlToMarkdown"),
                        description: Some("Best-effort HTML → Markdown".into()),
                    },
                    NodePropertyOption {
                        name: "Markdown to Plain Text".into(),
                        value: json!("markdownToText"),
                        description: Some("Strip all Markdown formatting".into()),
                    },
                ])
                .default(json!("markdownToHtml"))
                .required(),
            NodeProperty::new("source", "Source", NodePropertyType::String)
                .description("Markdown or HTML input")
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
        let source = ctx.param_str(params, "source")?;

        let body: Value = match operation.as_str() {
            "markdownToHtml" => {
                let html = markdown_to_html(&source);
                let mut m = Map::new();
                m.insert("html".into(), Value::String(html));
                Value::Object(m)
            }
            "htmlToMarkdown" => {
                let md = html_to_markdown(&source);
                let mut m = Map::new();
                m.insert("markdown".into(), Value::String(md));
                Value::Object(m)
            }
            "markdownToText" => {
                let text = markdown_to_text(&source);
                let mut m = Map::new();
                m.insert("text".into(), Value::String(text));
                Value::Object(m)
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

// ─── markdown → html ────────────────────────────────────────────────────────

fn markdown_to_html(input: &str) -> String {
    let mut out = String::new();
    let lines: Vec<&str> = input.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i];
        let trimmed = line.trim_start();

        // Fenced code block.
        if let Some(rest) = trimmed.strip_prefix("```") {
            let lang = rest.trim();
            i += 1;
            let mut buf = String::new();
            while i < lines.len() && !lines[i].trim_start().starts_with("```") {
                buf.push_str(lines[i]);
                buf.push('\n');
                i += 1;
            }
            if i < lines.len() {
                i += 1; // consume closing ```
            }
            if lang.is_empty() {
                out.push_str("<pre><code>");
            } else {
                out.push_str(&format!(
                    "<pre><code class=\"language-{}\">",
                    escape_html(lang)
                ));
            }
            out.push_str(&escape_html(&buf));
            out.push_str("</code></pre>\n");
            continue;
        }

        // ATX heading.
        if let Some(h) = parse_heading(trimmed) {
            out.push_str(&format!("<h{0}>{1}</h{0}>\n", h.level, render_inline(&h.text)));
            i += 1;
            continue;
        }

        // Horizontal rule.
        if is_hr(trimmed) {
            out.push_str("<hr/>\n");
            i += 1;
            continue;
        }

        // Blockquote — collect contiguous `>`-prefixed lines.
        if trimmed.starts_with('>') {
            let mut quoted: Vec<String> = Vec::new();
            while i < lines.len() && lines[i].trim_start().starts_with('>') {
                let stripped = lines[i]
                    .trim_start()
                    .trim_start_matches('>')
                    .trim_start()
                    .to_string();
                quoted.push(stripped);
                i += 1;
            }
            out.push_str("<blockquote>");
            out.push_str(&render_inline(&quoted.join(" ")));
            out.push_str("</blockquote>\n");
            continue;
        }

        // Unordered list.
        if is_ul_item(trimmed) {
            out.push_str("<ul>\n");
            while i < lines.len() && is_ul_item(lines[i].trim_start()) {
                let body = lines[i].trim_start();
                let item = body.trim_start_matches(|c| c == '-' || c == '*' || c == '+').trim_start();
                out.push_str(&format!("<li>{}</li>\n", render_inline(item)));
                i += 1;
            }
            out.push_str("</ul>\n");
            continue;
        }

        // Ordered list.
        if is_ol_item(trimmed) {
            out.push_str("<ol>\n");
            while i < lines.len() && is_ol_item(lines[i].trim_start()) {
                let body = lines[i].trim_start();
                // Drop the leading "N." prefix.
                let after = body.splitn(2, '.').nth(1).unwrap_or("").trim_start();
                out.push_str(&format!("<li>{}</li>\n", render_inline(after)));
                i += 1;
            }
            out.push_str("</ol>\n");
            continue;
        }

        // Blank line — paragraph separator.
        if trimmed.is_empty() {
            i += 1;
            continue;
        }

        // Otherwise: collect a paragraph (until blank or block-break).
        let mut para: Vec<&str> = Vec::new();
        while i < lines.len() {
            let l = lines[i].trim_start();
            if l.is_empty() || is_block_break(l) {
                break;
            }
            para.push(lines[i]);
            i += 1;
        }
        if !para.is_empty() {
            out.push_str(&format!("<p>{}</p>\n", render_inline(&para.join(" "))));
        }
    }

    out
}

struct Heading {
    level: usize,
    text: String,
}

fn parse_heading(line: &str) -> Option<Heading> {
    let mut level = 0usize;
    for ch in line.chars() {
        if ch == '#' {
            level += 1;
        } else {
            break;
        }
    }
    if level == 0 || level > 6 {
        return None;
    }
    let rest = line[level..].trim();
    if rest.is_empty() && !line.starts_with('#') {
        return None;
    }
    // A heading marker must be followed by a space (per CommonMark) — accept
    // either a space or end-of-line for robustness.
    if line.chars().nth(level).is_some_and(|c| c != ' ' && c != '\t') {
        return None;
    }
    Some(Heading {
        level,
        text: rest.to_string(),
    })
}

fn is_hr(line: &str) -> bool {
    let l = line.trim();
    if l.len() < 3 {
        return false;
    }
    let first = l.chars().next().unwrap();
    matches!(first, '-' | '*' | '_') && l.chars().all(|c| c == first || c.is_whitespace())
}

fn is_ul_item(line: &str) -> bool {
    let mut chars = line.chars();
    let Some(first) = chars.next() else { return false };
    if !matches!(first, '-' | '*' | '+') {
        return false;
    }
    matches!(chars.next(), Some(' '))
}

fn is_ol_item(line: &str) -> bool {
    let mut idx = 0;
    let bytes = line.as_bytes();
    while idx < bytes.len() && bytes[idx].is_ascii_digit() {
        idx += 1;
    }
    idx > 0 && idx < bytes.len() && bytes[idx] == b'.' && idx + 1 < bytes.len() && bytes[idx + 1] == b' '
}

fn is_block_break(line: &str) -> bool {
    is_ul_item(line)
        || is_ol_item(line)
        || line.starts_with('#')
        || line.starts_with('>')
        || line.starts_with("```")
        || is_hr(line)
}

// ─── inline rendering ───────────────────────────────────────────────────────

/// Apply inline Markdown: code spans, bold, italic, links. Escapes HTML at
/// the leaf-text level so user input can't inject script tags.
fn render_inline(input: &str) -> String {
    let mut out = String::new();
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];

        // Backtick code span.
        if c == '`' {
            if let Some(end) = find_char(&chars, i + 1, '`') {
                let inner: String = chars[i + 1..end].iter().collect();
                out.push_str("<code>");
                out.push_str(&escape_html(&inner));
                out.push_str("</code>");
                i = end + 1;
                continue;
            }
        }

        // Link: [text](url).
        if c == '[' {
            if let Some(close_text) = find_char(&chars, i + 1, ']') {
                if close_text + 1 < chars.len() && chars[close_text + 1] == '(' {
                    if let Some(close_url) = find_char(&chars, close_text + 2, ')') {
                        let text: String = chars[i + 1..close_text].iter().collect();
                        let url: String = chars[close_text + 2..close_url].iter().collect();
                        out.push_str(&format!(
                            "<a href=\"{}\">{}</a>",
                            escape_attr(&url),
                            render_inline(&text),
                        ));
                        i = close_url + 1;
                        continue;
                    }
                }
            }
        }

        // Bold: **text** or __text__.
        if (c == '*' || c == '_') && i + 1 < chars.len() && chars[i + 1] == c {
            let needle = [c, c];
            if let Some(end) = find_seq(&chars, i + 2, &needle) {
                let inner: String = chars[i + 2..end].iter().collect();
                out.push_str("<strong>");
                out.push_str(&render_inline(&inner));
                out.push_str("</strong>");
                i = end + 2;
                continue;
            }
        }

        // Italic: *text* or _text_.
        if c == '*' || c == '_' {
            if let Some(end) = find_char(&chars, i + 1, c) {
                let inner: String = chars[i + 1..end].iter().collect();
                if !inner.is_empty() {
                    out.push_str("<em>");
                    out.push_str(&render_inline(&inner));
                    out.push_str("</em>");
                    i = end + 1;
                    continue;
                }
            }
        }

        // Literal char — HTML-escape it.
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            other => out.push(other),
        }
        i += 1;
    }

    out
}

fn find_char(chars: &[char], start: usize, needle: char) -> Option<usize> {
    chars[start..].iter().position(|c| *c == needle).map(|p| p + start)
}

fn find_seq(chars: &[char], start: usize, seq: &[char; 2]) -> Option<usize> {
    let mut i = start;
    while i + 1 < chars.len() {
        if chars[i] == seq[0] && chars[i + 1] == seq[1] {
            return Some(i);
        }
        i += 1;
    }
    None
}

fn escape_html(s: &str) -> String {
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

fn escape_attr(s: &str) -> String {
    // Same as escape_html with quote escaping (which it already does).
    escape_html(s)
}

// ─── html → markdown (best-effort) ──────────────────────────────────────────

fn html_to_markdown(input: &str) -> String {
    // Strategy: walk the input char-by-char, recognise a small set of tags,
    // emit Markdown for those, drop the rest. Anything between an open tag
    // and its closing twin is passed through (with recursive handling for
    // common inline tags).

    // Normalise: remove <br>/<br/> with newlines; collapse repeated newlines.
    let normalised = input
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
        .replace("<br>", "\n");

    let mut out = String::with_capacity(normalised.len());
    let bytes = normalised.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        if bytes[i] == b'<' {
            // Try to match a recognised tag.
            if let Some((tag, attrs, end_of_open)) = read_tag(&normalised, i) {
                let lower = tag.to_lowercase();
                let close = format!("</{lower}>");

                if let Some(close_pos) = find_substr(&normalised, end_of_open, &close) {
                    let inner = &normalised[end_of_open..close_pos];
                    let after = close_pos + close.len();
                    let inner_md = html_to_markdown(inner);

                    match lower.as_str() {
                        "h1" => out.push_str(&format!("# {inner_md}\n")),
                        "h2" => out.push_str(&format!("## {inner_md}\n")),
                        "h3" => out.push_str(&format!("### {inner_md}\n")),
                        "h4" => out.push_str(&format!("#### {inner_md}\n")),
                        "h5" => out.push_str(&format!("##### {inner_md}\n")),
                        "h6" => out.push_str(&format!("###### {inner_md}\n")),
                        "p" => out.push_str(&format!("{inner_md}\n\n")),
                        "strong" | "b" => out.push_str(&format!("**{inner_md}**")),
                        "em" | "i" => out.push_str(&format!("*{inner_md}*")),
                        "code" => out.push_str(&format!("`{inner_md}`")),
                        "pre" => out.push_str(&format!("```\n{}\n```\n", inner_md.trim_end())),
                        "blockquote" => {
                            for line in inner_md.trim().lines() {
                                out.push_str(&format!("> {line}\n"));
                            }
                        }
                        "li" => out.push_str(&format!("- {inner_md}\n")),
                        "ul" | "ol" => out.push_str(&inner_md),
                        "a" => {
                            let href = extract_attr(&attrs, "href").unwrap_or_default();
                            out.push_str(&format!("[{inner_md}]({href})"));
                        }
                        _ => out.push_str(&inner_md),
                    }
                    i = after;
                    continue;
                }

                // Unmatched / void tag — skip the open tag and move on.
                if lower == "hr" {
                    out.push_str("\n---\n");
                }
                i = end_of_open;
                continue;
            }
        }

        let ch = normalised[i..].chars().next().unwrap();
        out.push(ch);
        i += ch.len_utf8();
    }

    decode_basic_entities(&out)
}

/// Returns `(tag_name, raw_attrs, index_after_open_tag)` if `bytes[start]`
/// starts an opening (or self-closing) tag.
fn read_tag(s: &str, start: usize) -> Option<(String, String, usize)> {
    let bytes = s.as_bytes();
    if bytes.get(start) != Some(&b'<') {
        return None;
    }
    // Skip a leading slash so callers can detect close tags too if needed.
    let mut idx = start + 1;
    if bytes.get(idx) == Some(&b'/') {
        return None;
    }
    let tag_start = idx;
    while idx < bytes.len() && (bytes[idx].is_ascii_alphanumeric() || bytes[idx] == b'-') {
        idx += 1;
    }
    if idx == tag_start {
        return None;
    }
    let tag = s[tag_start..idx].to_string();

    let attrs_start = idx;
    while idx < bytes.len() && bytes[idx] != b'>' {
        idx += 1;
    }
    if idx >= bytes.len() {
        return None;
    }
    let mut attrs_end = idx;
    if attrs_end > attrs_start && bytes[attrs_end - 1] == b'/' {
        attrs_end -= 1;
    }
    let attrs = s[attrs_start..attrs_end].trim().to_string();
    Some((tag, attrs, idx + 1))
}

fn extract_attr(attrs: &str, key: &str) -> Option<String> {
    // Look for `key="value"` (quotes either single or double).
    let lower = attrs.to_lowercase();
    let needle = format!("{}=", key.to_lowercase());
    let pos = lower.find(&needle)?;
    let after = &attrs[pos + needle.len()..];
    let mut chars = after.chars();
    match chars.next()? {
        '"' => {
            let rest: String = chars.collect();
            rest.split_once('"').map(|(v, _)| v.to_string())
        }
        '\'' => {
            let rest: String = chars.collect();
            rest.split_once('\'').map(|(v, _)| v.to_string())
        }
        c if !c.is_whitespace() => {
            let mut v = String::from(c);
            for c2 in chars {
                if c2.is_whitespace() || c2 == '>' {
                    break;
                }
                v.push(c2);
            }
            Some(v)
        }
        _ => None,
    }
}

fn find_substr(haystack: &str, start: usize, needle: &str) -> Option<usize> {
    haystack[start..].find(needle).map(|p| p + start)
}

fn decode_basic_entities(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
}

// ─── markdown → plain text ──────────────────────────────────────────────────

fn markdown_to_text(input: &str) -> String {
    // Strip block + inline markers — same approach as `markdown_to_html`'s
    // inline pass but emit raw text instead of HTML tags.
    let html = markdown_to_html(input);
    let mut out = String::with_capacity(html.len());
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            other if !in_tag => out.push(other),
            _ => {}
        }
    }
    decode_basic_entities(&out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn heading_renders() {
        assert_eq!(markdown_to_html("# hi"), "<h1>hi</h1>\n");
        assert_eq!(markdown_to_html("### deep"), "<h3>deep</h3>\n");
    }

    #[test]
    fn bold_and_italic() {
        assert_eq!(
            markdown_to_html("**bold** and *it*"),
            "<p><strong>bold</strong> and <em>it</em></p>\n",
        );
    }

    #[test]
    fn link_renders() {
        assert_eq!(
            markdown_to_html("[click](https://example.com)"),
            "<p><a href=\"https://example.com\">click</a></p>\n",
        );
    }

    #[test]
    fn html_escapes_tags_in_paragraphs() {
        let html = markdown_to_html("hi <script>alert('x')</script>");
        assert!(html.contains("&lt;script&gt;"));
    }

    #[test]
    fn html_to_md_roundtrip_basic() {
        let md = html_to_markdown("<p><strong>hi</strong> there</p>");
        assert!(md.contains("**hi**"));
        assert!(md.contains("there"));
    }

    #[test]
    fn markdown_to_text_strips_formatting() {
        let text = markdown_to_text("# Title\n\n**bold** word");
        assert!(text.contains("Title"));
        assert!(!text.contains('*'));
        assert!(!text.contains('<'));
    }
}
