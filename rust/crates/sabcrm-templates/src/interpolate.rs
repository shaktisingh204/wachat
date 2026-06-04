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
//! ## Relation hints
//!
//! Records may carry *resolved relation hints* alongside their flat `data`
//! map: a `fieldKey → { id, label, avatarUrl }` object produced by the
//! records surface's `?enrich=relations` pass. When a dotted path does not
//! resolve against the flat variables (e.g. `data.company` only holds a bare
//! relation id, not a nested object), resolution falls back to the relation
//! hint for the path's head segment. Against a hint:
//!
//! - the bare head (`{{company}}`) and the friendly leaves
//!   `name` / `label` / `displayName` / `title` resolve to the hint's `label`,
//! - `id` resolves to the hint's `id`,
//! - any other key resolves verbatim against the hint object
//!   (e.g. `{{company.avatarUrl}}`).
//!
//! Flat / nested `data` always wins over a relation hint, so existing
//! `{{field}}` and `{{company.name}}` (nested-object) templates are unchanged.
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

/// Resolve a dot/index path against a relation-hint map (`fieldKey → hint`).
///
/// The path's head segment selects a hint object; the remaining segments
/// address into it with friendly aliases (see the module docs). Returns
/// `None` when there is no hint for the head segment, the hint is `null`, or
/// the addressed leaf is absent / `null`.
fn resolve_relation<'a>(relations: &'a Value, path: &str) -> Option<&'a Value> {
    let relations = match relations {
        Value::Object(map) => map,
        _ => return None,
    };

    let normalized = normalize_path(path);
    let mut segs = normalized.split('.').map(str::trim);
    let head = segs.next()?;
    if head.is_empty() {
        return None;
    }

    let hint = match relations.get(head)? {
        Value::Null => return None,
        v => v,
    };

    let rest: Vec<&str> = segs.filter(|s| !s.is_empty()).collect();

    // Bare head (`{{company}}`) or a friendly label leaf maps to the hint's
    // `label`; `id` maps to the hint's `id`; anything else is a verbatim key
    // lookup on the hint object.
    if rest.is_empty() {
        return hint_label(hint);
    }
    if rest.len() == 1 {
        match rest[0] {
            "name" | "label" | "displayName" | "title" => return hint_label(hint),
            "id" => {
                return match hint {
                    Value::Object(h) => h.get("id").filter(|v| !v.is_null()),
                    _ => None,
                };
            }
            _ => {}
        }
    }

    // Fall through: address the remaining path verbatim against the hint.
    let rest_path = rest.join(".");
    resolve(hint, &rest_path)
}

/// The `label` field of a relation hint object (the human-facing value), or
/// `None` when absent / `null` / the hint is not an object.
fn hint_label(hint: &Value) -> Option<&Value> {
    match hint {
        Value::Object(h) => h.get("label").filter(|v| !v.is_null()),
        _ => None,
    }
}

/// Render `template`, substituting `{{path}}` placeholders with values from
/// `vars`. Unresolved placeholders become the empty string and are collected
/// into [`Rendered::missing`]. Escaped braces are not supported (Twenty's
/// templates do not use literal `{{`), so a `{{` always opens a placeholder;
/// an unterminated `{{` is emitted verbatim.
pub fn render(template: &str, vars: &Value) -> Rendered {
    render_with_relations(template, vars, &Value::Null)
}

/// Render `template` like [`render`], but also fall back to a resolved
/// relation-hint map for any placeholder that the flat / nested `vars` do not
/// resolve.
///
/// `relations` is a `fieldKey → { id, label, avatarUrl }` object (see the
/// module docs). Flat / nested `vars` always take priority, so passing
/// `&Value::Null` (or any non-object) makes this identical to [`render`].
/// Placeholders that resolve via neither source are collected into
/// [`Rendered::missing`].
pub fn render_with_relations(template: &str, vars: &Value, relations: &Value) -> Rendered {
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
                    match resolve(vars, path).or_else(|| resolve_relation(relations, path)) {
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

    #[test]
    fn relation_hint_label_and_aliases() {
        let vars = json!({ "company": "507f1f77bcf86cd799439011" });
        let relations = json!({
            "company": { "id": "507f1f77bcf86cd799439011", "label": "Babbage", "avatarUrl": "x.png" }
        });
        // Bare head and friendly leaves resolve to the hint label.
        let r = render_with_relations("{{company}}/{{company.name}}/{{company.label}}", &vars, &relations);
        assert_eq!(r.text, "Babbage/Babbage/Babbage");
        assert!(r.missing.is_empty());
        // `id` and verbatim keys resolve too.
        let r2 = render_with_relations("{{company.id}}|{{company.avatarUrl}}", &vars, &relations);
        assert_eq!(r2.text, "507f1f77bcf86cd799439011|x.png");
    }

    #[test]
    fn flat_data_wins_over_relation_hint() {
        let vars = json!({ "company": { "name": "FromData" } });
        let relations = json!({ "company": { "id": "1", "label": "FromHint" } });
        let r = render_with_relations("{{company.name}}", &vars, &relations);
        assert_eq!(r.text, "FromData");
    }

    #[test]
    fn unresolved_relation_path_is_missing() {
        let vars = json!({ "name": "Ada" });
        let relations = json!({ "company": { "id": "1", "label": "Babbage" } });
        let r = render_with_relations("{{owner.email}}", &vars, &relations);
        assert_eq!(r.text, "");
        assert!(r.missing.contains("owner.email"));
    }

    #[test]
    fn render_ignores_non_object_relations() {
        // `render` delegates with a null relations map — behaviour unchanged.
        let vars = json!({ "name": "Ada" });
        let r = render("Hi {{name}}", &vars);
        assert_eq!(r.text, "Hi Ada");
        let r2 = render_with_relations("{{company}}", &vars, &Value::Null);
        assert!(r2.missing.contains("company"));
    }
}
