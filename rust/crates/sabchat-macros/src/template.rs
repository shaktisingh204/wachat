//! `{{var}}` template interpolation used by send-message steps.
//!
//! The executor calls [`interpolate`] on every textual field of a
//! [`sabchat_types::ContentBlock`] before persisting the rendered
//! message. The syntax is intentionally minimal — `{{path.to.var}}` —
//! and missing paths render as the literal placeholder so writers see
//! the failure in-context instead of silently dropping copy.
//!
//! ## Lookup
//!
//! Paths are dot-separated. Each segment indexes either a JSON object
//! key or an array element by zero-based integer index. Both are
//! tolerated to keep the syntax forgiving when authors stash arrays in
//! `customAttrs`.
//!
//! ## Rendering
//!
//! Resolved values render via [`std::fmt::Display`]:
//!
//! - `String` → the unquoted contents
//! - `Number` / `Bool` → standard Rust formatting
//! - `Null` → an empty string
//! - `Array` / `Object` → JSON syntax (`serde_json::to_string`)
//!
//! Anything that fails to resolve falls back to the original
//! placeholder text (e.g. `{{contact.name}}`) so authors can see what's
//! missing.

use serde_json::Value;

/// Substitute every `{{path.to.var}}` placeholder in `template` with
/// the resolved value from `vars`. Unresolved placeholders are echoed
/// verbatim.
///
/// The parser is non-recursive and intentionally permissive: a bare
/// `{` is left alone, double-`{` without a matching `}}` is also left
/// alone, and inner whitespace inside `{{ name }}` is trimmed. Nested
/// `{{` is not supported — the parser scans for the next `}}` from the
/// current cursor position.
pub(crate) fn interpolate(template: &str, vars: &Value) -> String {
    let bytes = template.as_bytes();
    let mut out = String::with_capacity(template.len());
    let mut i: usize = 0;
    let n = bytes.len();

    while i < n {
        // Look for the next `{{`.
        if i + 1 < n && bytes[i] == b'{' && bytes[i + 1] == b'{' {
            // Find the matching `}}` from here.
            if let Some(end_rel) = find_close(&bytes[i + 2..]) {
                let inner_start = i + 2;
                let inner_end = inner_start + end_rel;
                // SAFETY: we sliced the byte range out of a `&str`, and
                // since `{{` / `}}` are ASCII the boundary is a UTF-8
                // char boundary. Just go through `str::from_utf8`
                // which is cheap and infallible here.
                let raw = std::str::from_utf8(&bytes[inner_start..inner_end]).unwrap_or("");
                let key = raw.trim();
                match lookup(vars, key) {
                    Some(rendered) => out.push_str(&rendered),
                    None => {
                        // Echo placeholder verbatim including delimiters.
                        out.push_str("{{");
                        out.push_str(raw);
                        out.push_str("}}");
                    }
                }
                i = inner_end + 2;
                continue;
            }
            // No closing `}}` — bail out and copy the rest verbatim.
            out.push_str(&template[i..]);
            break;
        }
        // Otherwise copy the current byte. Index is safe because we
        // either match `{{` (handled above) or copy a single byte at a
        // time, but we need to advance by one *char* not one byte to
        // keep the iteration on a UTF-8 boundary.
        let ch_len = utf8_char_len(bytes[i]);
        let end = (i + ch_len).min(n);
        out.push_str(&template[i..end]);
        i = end;
    }
    out
}

/// Return the byte offset of the next `}}` in `s`, or `None` if there
/// isn't one. The offset is relative to the start of `s`.
fn find_close(s: &[u8]) -> Option<usize> {
    let mut i = 0;
    while i + 1 < s.len() {
        if s[i] == b'}' && s[i + 1] == b'}' {
            return Some(i);
        }
        i += 1;
    }
    None
}

/// UTF-8 leading byte → byte length of the encoded char. Falls back to
/// 1 for invalid leaders so we keep advancing instead of looping.
fn utf8_char_len(b: u8) -> usize {
    if b < 0x80 {
        1
    } else if b & 0xE0 == 0xC0 {
        2
    } else if b & 0xF0 == 0xE0 {
        3
    } else if b & 0xF8 == 0xF0 {
        4
    } else {
        1
    }
}

/// Resolve `path` (dot-separated) against `vars`. Returns `None` if
/// any segment of the walk fails.
fn lookup(vars: &Value, path: &str) -> Option<String> {
    if path.is_empty() {
        return None;
    }
    let mut cur = vars;
    for segment in path.split('.') {
        match cur {
            Value::Object(map) => {
                cur = map.get(segment)?;
            }
            Value::Array(arr) => {
                let idx: usize = segment.parse().ok()?;
                cur = arr.get(idx)?;
            }
            _ => return None,
        }
    }
    Some(value_to_string(cur))
}

/// Render a `Value` as the human-facing string that should land in the
/// message body. Nulls collapse to empty, scalars render unquoted, and
/// containers fall back to compact JSON.
fn value_to_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Null => String::new(),
        other => serde_json::to_string(other).unwrap_or_default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn replaces_simple_placeholders() {
        let vars = json!({ "name": "Alice" });
        assert_eq!(interpolate("Hi {{name}}!", &vars), "Hi Alice!");
    }

    #[test]
    fn replaces_dotted_paths() {
        let vars = json!({ "contact": { "first": "Bob" } });
        assert_eq!(interpolate("Hello {{contact.first}}", &vars), "Hello Bob",);
    }

    #[test]
    fn echoes_missing_placeholders() {
        let vars = json!({});
        assert_eq!(interpolate("Hi {{name}}", &vars), "Hi {{name}}",);
    }

    #[test]
    fn trims_inner_whitespace() {
        let vars = json!({ "name": "Carol" });
        assert_eq!(interpolate("{{ name }}", &vars), "Carol");
    }

    #[test]
    fn handles_array_index() {
        let vars = json!({ "items": ["a", "b", "c"] });
        assert_eq!(interpolate("{{items.1}}", &vars), "b");
    }

    #[test]
    fn renders_numbers_and_bools_unquoted() {
        let vars = json!({ "n": 42, "b": true });
        assert_eq!(interpolate("{{n}}/{{b}}", &vars), "42/true",);
    }

    #[test]
    fn null_renders_as_empty() {
        let vars = json!({ "x": null });
        assert_eq!(interpolate("[{{x}}]", &vars), "[]");
    }

    #[test]
    fn unmatched_open_brace_is_copied_verbatim() {
        let vars = json!({});
        assert_eq!(interpolate("{{ oops", &vars), "{{ oops");
    }

    #[test]
    fn bare_single_brace_left_alone() {
        let vars = json!({ "name": "X" });
        assert_eq!(interpolate("{notvar} {{name}}", &vars), "{notvar} X",);
    }
}
