//! `{{variable}}` interpolation for SabCRM templates (Twenty parity).
//!
//! Templates carry `subject` / `body` strings that may embed
//! `{{path.to.field}}` placeholders. At render time the placeholders are
//! substituted with values pulled from a record's field map.
//!
//! ## Syntax
//!
//! - A placeholder is `{{ <path> }}` — optional surrounding whitespace inside
//!   the braces is trimmed (`{{ name }}` ≡ `{{name}}`).
//! - `<path>` is a dot-separated key path resolved against the variables JSON
//!   object (e.g. `{{company.name}}`, `{{firstName}}`).
//! - Array index steps are supported (`{{emails.0}}`).
//! - A leading `record.` / `data.` segment is tolerated and stripped so both
//!   `{{name}}` and `{{record.name}}` resolve against the same map.
//! - Unknown / unresolved paths render as the empty string by default; the
//!   set of missing paths is reported back to the caller for previews.
//!
//! Resolution is a pure function over a `serde_json::Value` (the flattened
//! record fields), so it has no Mongo / IO dependency and is easy to unit
//! test.

use serde_json::Value;
use std::collections::BTreeSet;

/// Outcome of rendering one template string.
#[derive(Debug, Clone, Default)]
pub struct Rendered {
    /// The interpolated text.
    pub text: String,
    /// Distinct placeholder paths that did not resolve to a value.
    pub missing: BTreeSet<String>,
    /// Distinct placeholder paths encountered (resolved or not).
    pub used: BTreeSet<String>,
}

/// Stringify a resolved JSON value the way a template author expects:
///
/// - strings render verbatim (no surrounding quotes),
/// - numbers / bools render via their `Display`,
/// - `null` and missing render as the empty string,
/// - arrays/objects render as compact JSON (best-effort; rarely embedded).
fn value_to_string(v: &Value) -> String {
    match v {
        Value::Null => String::new(),
        Value::String(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        other => other.to_string(),
    }
}

/// Strip an optional leading `record.` / `data.` prefix so authors can write
/// either `{{name}}` or `{{record.name}}`.
fn normalize_path(path: &str) -> &str {
    path.strip_prefix("record.")
        .or_else(|| path.strip_prefix("data."))
        .unwrap_or(path)
}

/// Resolve a dot/index path against `vars`. Returns `None` for any
/// unresolved or `null` leaf.
fn resolve<'a>(vars: &'a Value, path: &str) -> Option<&'a Value> {
    let mut cur = vars;
    for seg in normalize_path(path).split('.') {
        let seg = seg.trim();
        if seg.is_empty() {
            return None;
        }
        cur = match cur {
            Value::Object(map) => map.get(seg)?,
            Value::Array(arr) => {
                let idx: usize = seg.parse().ok()?;
                arr.get(idx)?
            }
            _ => return None,
        };
    }
    match cur {
        Value::Null => None,
        v => Some(v),
    }
}

/// Render `template`, substituting `{{path}}` placeholders with values from
/// `vars`. Unresolved placeholders become the empty string and are collected
/// into [`Rendered::missing`]. Escaped braces are not supported (Twenty's
/// templates do not use literal `{{`), so a `{{` always opens a placeholder;
/// an unterminated `{{` is emitted verbatim.
pub fn render(template: &str, vars: &Value) -> Rendered {
    let mut out = Rendered::default();
    let bytes = template.as_bytes();
    let mut i = 0;
    let n = bytes.len();

    while i < n {
        // Look for the next "{{".
        if i + 1 < n && bytes[i] == b'{' && bytes[i + 1] == b'{' {
            // Find the closing "}}".
            if let Some(rel) = template[i + 2..].find("}}") {
                let raw = &template[i + 2..i + 2 + rel];
                let path = raw.trim();
                if path.is_empty() {
                    // `{{}}` — nothing to resolve; drop it.
                } else {
                    out.used.insert(path.to_owned());
                    match resolve(vars, path) {
                        Some(v) => out.text.push_str(&value_to_string(v)),
                        None => {
                            out.missing.insert(path.to_owned());
                        }
                    }
                }
                i = i + 2 + rel + 2; // skip past the closing "}}"
                continue;
            }
            // No closing braces — emit the rest verbatim and stop.
            out.text.push_str(&template[i..]);
            break;
        }
        // Regular byte — copy the full char (handle UTF-8 by char, not byte).
        let ch_start = i;
        // Advance to the next char boundary.
        let mut j = i + 1;
        while j < n && (bytes[j] & 0b1100_0000) == 0b1000_0000 {
            j += 1;
        }
        out.text.push_str(&template[ch_start..j]);
        i = j;
    }

    out
}

/// Collect the distinct placeholder paths declared in a template string
/// (used to advertise a template's required variables).
pub fn extract_variables(template: &str) -> BTreeSet<String> {
    render(template, &Value::Null).used
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn substitutes_flat_and_nested() {
        let vars = json!({ "name": "Ada", "company": { "name": "Babbage" } });
        let r = render("Hi {{name}} at {{company.name}}!", &vars);
        assert_eq!(r.text, "Hi Ada at Babbage!");
        assert!(r.missing.is_empty());
    }

    #[test]
    fn tolerates_record_prefix_and_whitespace() {
        let vars = json!({ "name": "Ada" });
        let r = render("{{ record.name }}", &vars);
        assert_eq!(r.text, "Ada");
    }

    #[test]
    fn missing_renders_empty_and_is_reported() {
        let vars = json!({ "name": "Ada" });
        let r = render("{{name}}/{{email}}", &vars);
        assert_eq!(r.text, "Ada/");
        assert!(r.missing.contains("email"));
    }

    #[test]
    fn array_index_and_unterminated() {
        let vars = json!({ "tags": ["a", "b"] });
        let r = render("{{tags.1}} {{oops", &vars);
        assert_eq!(r.text, "b {{oops");
    }

    #[test]
    fn extract_lists_variables() {
        let vars = extract_variables("{{a}} {{b.c}} {{a}}");
        assert!(vars.contains("a") && vars.contains("b.c"));
        assert_eq!(vars.len(), 2);
    }
}
