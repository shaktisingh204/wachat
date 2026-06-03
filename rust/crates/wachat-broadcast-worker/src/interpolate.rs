//! Template-variable interpolation + Meta payload builder.
//!
//! Direct port of `interpolateText` + `buildPayload` from
//! `src/workers/broadcast/send-message.js` (lines 55-203). The Node
//! implementation handles three subtly different interpolation regimes:
//!
//!   * **Body** — `{{1}}`, `{{2}}`, ... numeric placeholders, resolved
//!     against `effectiveVars[N]`, falling back to `variable_body_N` and
//!     `{{N}}` keys.
//!   * **Header text** — same numeric placeholders but the per-row var
//!     keys are namespaced as `variable_header_N`.
//!   * **Component pre-converted** — caller already produced the Meta
//!     "send-format" `parameters` array; we still walk the parameters to
//!     interpolate any `{{name}}` text references.
//!
//! Empty / missing parameters are filled with a zero-width space (U+200B)
//! to avoid Meta error #100 ("Invalid parameter") when the row had a
//! blank cell.
//!
//! Flow broadcasts use a completely different payload (`type: interactive`,
//! `interactive.type: flow`) — captured in `build_flow_payload`.

use serde_json::{Map, Value, json};

/// Zero-width space — used as a fallback for empty template variable
/// substitutions. Mirrors the Node `'​'` literal used in
/// `interpolateText` so Meta's "empty parameter" check
/// (error #100) doesn't trip on rows with blank columns.
const ZWSP: &str = "\u{200B}";

/// Replace `{{name}}` placeholders inside `text` with values from `vars`.
///
/// `vars` keys may be names (`first_name`) or stringified numbers (`1`,
/// `2`); the resolver handles both because the Node code stores per-row
/// CSV columns under their original header strings AND under numeric
/// keys (template body variables are referenced numerically).
pub fn interpolate_text(text: &str, vars: &Value) -> String {
    if text.is_empty() {
        return String::new();
    }
    let mut out = String::with_capacity(text.len());
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        // Look for a `{{ ... }}` placeholder. We do a hand-rolled scan
        // rather than pulling in regex because this is on the per-message
        // hot path and the placeholder grammar is trivial.
        if i + 1 < bytes.len() && bytes[i] == b'{' && bytes[i + 1] == b'{' {
            if let Some(end_rel) = text[i + 2..].find("}}") {
                let key_raw = &text[i + 2..i + 2 + end_rel];
                let key = key_raw.trim();
                let resolved = lookup_var(vars, key).unwrap_or_else(|| ZWSP.to_owned());
                out.push_str(&resolved);
                i += 2 + end_rel + 2;
                continue;
            }
        }
        // Push next UTF-8 char in a way that doesn't slice mid-codepoint.
        let ch_end = next_char_boundary(text, i);
        out.push_str(&text[i..ch_end]);
        i = ch_end;
    }
    out
}

/// Locate the next char boundary at or after `i`. Used so the byte-level
/// scan in `interpolate_text` doesn't slice a multi-byte UTF-8 codepoint.
fn next_char_boundary(s: &str, i: usize) -> usize {
    let mut j = i + 1;
    while j < s.len() && !s.is_char_boundary(j) {
        j += 1;
    }
    j
}

/// Look a key up in the per-row `vars` map. Empty strings and `null` are
/// treated as missing (matches the Node `String(val).trim() !== ''`).
fn lookup_var(vars: &Value, key: &str) -> Option<String> {
    let v = vars.as_object()?.get(key)?;
    let s = match v {
        Value::Null => return None,
        Value::String(s) => s.clone(),
        other => other.to_string(),
    };
    if s.trim().is_empty() { None } else { Some(s) }
}

/// Configuration used by `build_template_payload` — split out so callers
/// (the send handler) can build it once per batch from the broadcast doc
/// instead of re-parsing every component on every send.
#[derive(Debug, Clone)]
pub struct TemplateContext {
    /// Template name (Meta's registered template id, e.g. `welcome_v2`).
    pub template_name: String,
    /// BCP-47 language code, e.g. `en_US`.
    pub language: String,
    /// `components` array as stored on the broadcast document.
    pub components: Vec<Value>,
    /// Resolved Meta media id for the header (one-shot upload — handled
    /// by `media.rs`). `None` when the template has no media header.
    pub header_media_id: Option<String>,
    /// `IMAGE` / `VIDEO` / `DOCUMENT` (uppercase, matches Node).
    pub header_media_type: Option<String>,
    /// Optional broadcast-level body variables — merged under per-row
    /// `contact.variables` so a contact override always wins.
    pub global_body_vars: Option<Value>,
}

/// Configuration for a flow-broadcast send. Mirrors the Node
/// `broadcastType === 'flow'` branch in `buildPayload`.
#[derive(Debug, Clone)]
pub struct FlowContext {
    /// Meta flow id (the registered flow on the WhatsApp Business app).
    pub flow_meta_id: String,
    /// Display name shown in `lastMessage` previews.
    pub flow_name: Option<String>,
    /// `flowConfig` JSON — `{ header, body, footer, cta }` strings.
    pub flow_config: Option<Value>,
}

/// Per-contact data used by both payload builders.
pub struct ContactRef<'a> {
    /// `_id` of the broadcast_contact row (used as `flow_token`).
    pub id_hex: &'a str,
    /// Phone number (canonical `wa_id` form, no leading `+`).
    pub phone: &'a str,
    /// Per-row variables map (CSV-derived).
    pub variables: &'a Value,
}

/// Build the Meta `messages` payload for a TEMPLATE broadcast send.
///
/// Returns `(payload, sent_payload)`:
///   * `payload`      — full request body sent to Meta.
///   * `sent_payload` — the `template` sub-object stored on
///     `outgoing_messages.content.template` (matches Node's
///     `sentPayload = payload.template`).
pub fn build_template_payload(ctx: &TemplateContext, contact: &ContactRef<'_>) -> (Value, Value) {
    // Merge global + per-contact vars; per-contact wins (matches Node
    // `{ ...globalBodyVars, ...contact.variables }`).
    let mut effective = Map::new();
    if let Some(Value::Object(g)) = ctx.global_body_vars.as_ref() {
        for (k, v) in g {
            effective.insert(k.clone(), v.clone());
        }
    }
    if let Value::Object(c) = contact.variables {
        for (k, v) in c {
            effective.insert(k.clone(), v.clone());
        }
    }
    let effective_value = Value::Object(effective);

    let mut final_components: Vec<Value> = Vec::new();

    for raw in &ctx.components {
        let Some(t_raw) = raw.get("type").and_then(Value::as_str) else {
            continue;
        };
        let t_upper = t_raw.to_ascii_uppercase();

        // Pre-converted send-format component? Keep it, but interpolate
        // any `{{var}}` text references inside its parameters.
        if let Some(Value::Array(_)) = raw.get("parameters") {
            let mut clone = raw.clone();
            if let Some(Value::Array(params)) = clone.get_mut("parameters") {
                for p in params.iter_mut() {
                    if let Some(Value::String(s)) = p
                        .get_mut("type")
                        .map(|v| &*v)
                        .cloned()
                        .as_ref()
                        .and_then(|v| {
                            if v == "text" {
                                p.get("text").cloned()
                            } else {
                                None
                            }
                        })
                    {
                        // Scope: re-borrow `p` mutably to overwrite text.
                        let interpolated = interpolate_text(&s, &effective_value);
                        if let Some(text_field) = p.get_mut("text") {
                            *text_field = Value::String(interpolated);
                        }
                    } else if p.get("type").and_then(Value::as_str) == Some("text") {
                        // Direct text field check (the cloned check above is awkward; this is the fallback).
                        if let Some(text_field) = p.get_mut("text") {
                            if let Some(s) = text_field.as_str() {
                                *text_field = Value::String(interpolate_text(s, &effective_value));
                            }
                        }
                    }
                }
            }
            final_components.push(clone);
            continue;
        }

        match t_upper.as_str() {
            "HEADER" => {
                if let (Some(media_id), Some(media_type)) =
                    (&ctx.header_media_id, &ctx.header_media_type)
                {
                    let lower = media_type.to_ascii_lowercase();
                    final_components.push(json!({
                        "type": "header",
                        "parameters": [
                            { "type": lower, lower: { "id": media_id } }
                        ],
                    }));
                } else if raw.get("format").and_then(Value::as_str) == Some("TEXT") {
                    if let Some(text) = raw.get("text").and_then(Value::as_str) {
                        let nums = extract_numeric_placeholders(text);
                        if !nums.is_empty() {
                            let params: Vec<Value> = nums
                                .iter()
                                .map(|n| {
                                    let key = format!("variable_header_{n}");
                                    let val = lookup_var(&effective_value, &key)
                                        .or_else(|| lookup_var(&effective_value, n))
                                        .unwrap_or_else(|| ZWSP.to_owned());
                                    json!({ "type": "text", "text": val })
                                })
                                .collect();
                            final_components.push(json!({
                                "type": "header",
                                "parameters": params,
                            }));
                        }
                        // No numeric vars → no header component (Node skips it).
                    }
                }
                // IMAGE/VIDEO/DOCUMENT formats without a pre-uploaded id
                // are silently dropped — same as the Node code (the
                // upload step should have populated `header_media_id`).
            }
            "BODY" => {
                if let Some(text) = raw.get("text").and_then(Value::as_str) {
                    let mut nums = extract_numeric_placeholders(text);
                    if !nums.is_empty() {
                        nums.sort();
                        nums.dedup();
                        let params: Vec<Value> = nums
                            .iter()
                            .map(|n| {
                                let val = lookup_var(&effective_value, n)
                                    .or_else(|| {
                                        lookup_var(&effective_value, &format!("variable_body_{n}"))
                                    })
                                    .or_else(|| {
                                        lookup_var(&effective_value, &format!("{{{{{n}}}}}"))
                                    })
                                    .unwrap_or_else(|| ZWSP.to_owned());
                                json!({
                                    "type": "text",
                                    "text": interpolate_text(&val, &effective_value),
                                })
                            })
                            .collect();
                        final_components.push(json!({
                            "type": "body",
                            "parameters": params,
                        }));
                    }
                    // No vars in body → no body component needed.
                }
            }
            "BUTTON" => {
                // Already in send format — clone, interpolate text params.
                let mut clone = raw.clone();
                if let Some(Value::Array(params)) = clone.get_mut("parameters") {
                    for p in params.iter_mut() {
                        if p.get("type").and_then(Value::as_str) == Some("text") {
                            if let Some(text_field) = p.get_mut("text") {
                                if let Some(s) = text_field.as_str() {
                                    *text_field =
                                        Value::String(interpolate_text(s, &effective_value));
                                }
                            }
                        }
                    }
                }
                final_components.push(clone);
            }
            // BUTTONS / FOOTER are not emitted as send-format components
            // by the Node code — skip silently.
            _ => {}
        }
    }

    let mut template = Map::new();
    template.insert("name".into(), Value::String(ctx.template_name.clone()));
    template.insert("language".into(), json!({ "code": ctx.language.clone() }));
    if !final_components.is_empty() {
        template.insert("components".into(), Value::Array(final_components));
    }
    let template_value = Value::Object(template);

    let payload = json!({
        "messaging_product": "whatsapp",
        "to": contact.phone,
        "type": "template",
        "template": template_value.clone(),
    });

    (payload, template_value)
}

/// Build the Meta `messages` payload for a FLOW broadcast send. Mirrors
/// the `broadcastType === 'flow'` branch in `buildPayload` (lines 80-105).
pub fn build_flow_payload(ctx: &FlowContext, contact: &ContactRef<'_>) -> (Value, Value) {
    let header = ctx
        .flow_config
        .as_ref()
        .and_then(|v| v.get("header"))
        .and_then(Value::as_str)
        .map(|h| json!({ "type": "text", "text": h }));

    let body_text = ctx
        .flow_config
        .as_ref()
        .and_then(|v| v.get("body"))
        .and_then(Value::as_str)
        .unwrap_or("Open Flow")
        .to_owned();

    let footer = ctx
        .flow_config
        .as_ref()
        .and_then(|v| v.get("footer"))
        .and_then(Value::as_str)
        .map(|f| json!({ "text": f }));

    let cta = ctx
        .flow_config
        .as_ref()
        .and_then(|v| v.get("cta"))
        .and_then(Value::as_str)
        .unwrap_or("Open App")
        .to_owned();

    // Build the `interactive` object incrementally so we omit `header` /
    // `footer` cleanly when not configured (matches the Node `undefined`
    // semantics where missing keys are dropped from JSON output).
    let mut interactive = Map::new();
    interactive.insert("type".into(), Value::String("flow".into()));
    if let Some(h) = header {
        interactive.insert("header".into(), h);
    }
    interactive.insert("body".into(), json!({ "text": body_text }));
    if let Some(f) = footer {
        interactive.insert("footer".into(), f);
    }
    interactive.insert(
        "action".into(),
        json!({
            "name": "flow",
            "parameters": {
                "flow_message_version": "3",
                "flow_token": contact.id_hex,
                "flow_id": ctx.flow_meta_id.clone(),
                "flow_cta": cta,
                "flow_action": "navigate",
                "flow_action_payload": { "screen": "INIT" },
            },
        }),
    );

    let interactive_value = Value::Object(interactive);

    let payload = json!({
        "messaging_product": "whatsapp",
        "to": contact.phone,
        "recipient_type": "individual",
        "type": "interactive",
        "interactive": interactive_value.clone(),
    });

    (payload, interactive_value)
}

/// Pull `{{1}}`, `{{2}}`, … numeric placeholders out of a template
/// string in source order. Used for HEADER / BODY components.
fn extract_numeric_placeholders(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut i = 0;
    let bytes = text.as_bytes();
    while i + 3 < bytes.len() {
        if bytes[i] == b'{' && bytes[i + 1] == b'{' {
            if let Some(end_rel) = text[i + 2..].find("}}") {
                let inner = text[i + 2..i + 2 + end_rel].trim();
                if !inner.is_empty() && inner.chars().all(|c| c.is_ascii_digit()) {
                    out.push(inner.to_owned());
                }
                i += 2 + end_rel + 2;
                continue;
            }
        }
        i = next_char_boundary(text, i);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn interpolate_substitutes_named_var() {
        let v = json!({ "name": "Alice" });
        assert_eq!(interpolate_text("Hi {{name}}!", &v), "Hi Alice!");
    }

    #[test]
    fn interpolate_falls_back_to_zwsp() {
        let v = json!({});
        // ZWSP fallback for missing vars.
        assert_eq!(
            interpolate_text("Hi {{name}}!", &v),
            format!("Hi {}!", ZWSP)
        );
    }

    #[test]
    fn interpolate_handles_unicode() {
        // Multi-byte char inside the template should not be sliced.
        let v = json!({ "x": "OK" });
        assert_eq!(interpolate_text("héllo {{x}}", &v), "héllo OK");
    }

    #[test]
    fn placeholders_extract_numeric_only() {
        let p = extract_numeric_placeholders("Hi {{1}}, your code is {{2}} and {{name}}");
        assert_eq!(p, vec!["1".to_owned(), "2".to_owned()]);
    }

    #[test]
    fn flow_payload_uses_contact_id_as_token() {
        let ctx = FlowContext {
            flow_meta_id: "flow_xyz".into(),
            flow_name: Some("Onboarding".into()),
            flow_config: Some(json!({
                "header": "H",
                "body": "B",
                "footer": "F",
                "cta": "Start",
            })),
        };
        let vars = json!({});
        let contact = ContactRef {
            id_hex: "abc123",
            phone: "12025551234",
            variables: &vars,
        };
        let (payload, _sent) = build_flow_payload(&ctx, &contact);
        assert_eq!(payload["to"], "12025551234");
        assert_eq!(
            payload["interactive"]["action"]["parameters"]["flow_token"],
            "abc123"
        );
        assert_eq!(
            payload["interactive"]["action"]["parameters"]["flow_cta"],
            "Start"
        );
    }

    #[test]
    fn template_payload_emits_body_params() {
        let ctx = TemplateContext {
            template_name: "welcome".into(),
            language: "en_US".into(),
            components: vec![json!({
                "type": "BODY",
                "text": "Hi {{1}}, welcome to {{2}}",
            })],
            header_media_id: None,
            header_media_type: None,
            global_body_vars: None,
        };
        let vars = json!({ "1": "Alice", "2": "SabNode" });
        let contact = ContactRef {
            id_hex: "xx",
            phone: "12025551234",
            variables: &vars,
        };
        let (payload, _) = build_template_payload(&ctx, &contact);
        let comps = payload["template"]["components"].as_array().unwrap();
        assert_eq!(comps.len(), 1);
        assert_eq!(comps[0]["type"], "body");
        assert_eq!(comps[0]["parameters"][0]["text"], "Alice");
        assert_eq!(comps[0]["parameters"][1]["text"], "SabNode");
    }
}
