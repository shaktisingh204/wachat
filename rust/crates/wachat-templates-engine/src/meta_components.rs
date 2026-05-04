//! Build the `components` payload Meta's Cloud API `messages` endpoint
//! expects when sending a template.
//!
//! Reference shape (from Meta's docs and the existing TS code in
//! `send-template.actions.ts` lines 152-200):
//!
//! ```json
//! {
//!   "type": "header",
//!   "parameters": [{ "type": "text", "text": "Welcome" }]
//! }
//! ```
//!
//! Buttons are emitted with `sub_type` (`url`, `quick_reply`, `phone_number`,
//! `copy_code`) and a stringified `index` per the Meta spec — e.g.
//! `{"type": "button", "sub_type": "url", "index": "0", "parameters": [...]}`.
//!
//! Variable substitution runs against the template's body / header / button
//! URL templates using [`crate::substitute`]. The TS code uses positional
//! indices everywhere on the wire (it builds a `parameters` array sorted by
//! variable number); we preserve that contract while letting authors mix
//! named placeholders inside the same template body.

use serde::{Deserialize, Serialize};

use crate::error::SubstituteError;
use crate::parser::{Placeholder, extract_placeholders};
use crate::substitute::{Variables, substitute};

/// A single template's storage representation. This is the SabNode-side
/// shape (closer to Meta's *create-template* API), not the *send* shape —
/// `build_components` converts between them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateSpec {
    pub name: String,
    pub language_code: String,
    pub header: Option<String>,
    pub body: String,
    pub footer: Option<String>,
    pub buttons: Vec<TemplateButton>,
}

/// Subset of WhatsApp button types we currently substitute into. The TS
/// code also handles `COPY_CODE` and the carousel-specific button types;
/// those can be added without changing the core engine.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TemplateButton {
    QuickReply {
        text: String,
    },
    /// `url_template` may contain `{{1}}` (Meta only allows one variable in
    /// a URL button, and it must be positional).
    Url {
        text: String,
        url_template: String,
    },
    PhoneNumber {
        text: String,
        phone: String,
    },
}

/// Send-time component as Meta wants it on the wire. Untagged so the
/// serializer emits the exact `{"type": "...", ...}` shape — `serde_json`
/// will preserve key ordering at insertion order, which keeps wire diffs
/// stable for tests.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct MetaComponent {
    /// `"header"`, `"body"`, or `"button"`.
    #[serde(rename = "type")]
    pub component_type: String,

    /// Only present for buttons: `"url"`, `"quick_reply"`, etc.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub_type: Option<String>,

    /// Only present for buttons: stringified 0-based index. Meta requires a
    /// string, not a number — see `send-template.actions.ts:185`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index: Option<String>,

    pub parameters: Vec<MetaParameter>,
}

/// Body / header parameters use `{"type": "text", "text": "..."}`. We model
/// only the text variant here because that's all the substitution engine
/// produces — media headers, location headers, and copy_code coupons are
/// produced by `send-template.actions.ts` directly from request payloads
/// and don't flow through the substitution engine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MetaParameter {
    #[serde(rename = "type")]
    pub parameter_type: String,
    pub text: String,
}

impl MetaParameter {
    fn text(value: impl Into<String>) -> Self {
        Self {
            parameter_type: "text".to_owned(),
            text: value.into(),
        }
    }
}

/// Build the ordered `components` array for a Meta send.
///
/// Order matches the TS implementation: header → body → buttons (one
/// component per button that needs substitution).
pub fn build_components(
    template: &TemplateSpec,
    vars: &Variables,
) -> Result<Vec<MetaComponent>, SubstituteError> {
    let mut out = Vec::new();

    // --- HEADER --- only emitted when there's at least one placeholder.
    // The TS code follows the same rule: a static text header doesn't get
    // a header component on the wire (Meta uses the template definition).
    if let Some(header_text) = template.header.as_deref() {
        let placeholders = extract_placeholders(header_text);
        if !placeholders.is_empty() {
            let parameters = placeholders
                .iter()
                .map(|p| substitute_one(p, vars).map(MetaParameter::text))
                .collect::<Result<Vec<_>, _>>()?;
            out.push(MetaComponent {
                component_type: "header".to_owned(),
                sub_type: None,
                index: None,
                parameters,
            });
        }
    }

    // --- BODY --- same rule: only emitted when the body has placeholders.
    let body_placeholders = extract_placeholders(&template.body);
    if !body_placeholders.is_empty() {
        // Sort positional placeholders ascending — Meta's body parameter
        // array is positional-indexed, so {{2}} must come before {{3}}.
        // Named placeholders are kept in first-seen order *after* all
        // positionals (the TS code only emits positionals into body, but
        // we need a stable rule for the named case).
        let mut positionals: Vec<u16> = body_placeholders
            .iter()
            .filter_map(|p| match p {
                Placeholder::Positional(n) => Some(*n),
                _ => None,
            })
            .collect();
        positionals.sort_unstable();

        let nameds: Vec<&str> = body_placeholders
            .iter()
            .filter_map(|p| match p {
                Placeholder::Named(s) => Some(s.as_str()),
                _ => None,
            })
            .collect();

        let mut parameters = Vec::with_capacity(positionals.len() + nameds.len());
        for n in positionals {
            let v = vars
                .positional(n)
                .ok_or_else(|| missing_or_empty_positional(vars, n))?;
            parameters.push(MetaParameter::text(v.to_owned()));
        }
        for name in nameds {
            let v = vars
                .named(name)
                .ok_or_else(|| missing_or_empty_named(vars, name))?;
            parameters.push(MetaParameter::text(v.to_owned()));
        }

        out.push(MetaComponent {
            component_type: "body".to_owned(),
            sub_type: None,
            index: None,
            parameters,
        });
    }

    // --- BUTTONS --- one component per button that contains a placeholder.
    // Static (e.g. `QuickReply { text: "Yes" }`) buttons are not emitted —
    // Meta uses the template definition directly.
    for (i, button) in template.buttons.iter().enumerate() {
        match button {
            TemplateButton::Url { url_template, .. } => {
                let placeholders = extract_placeholders(url_template);
                if placeholders.is_empty() {
                    continue;
                }
                let parameters = placeholders
                    .iter()
                    .map(|p| substitute_one(p, vars).map(MetaParameter::text))
                    .collect::<Result<Vec<_>, _>>()?;
                out.push(MetaComponent {
                    component_type: "button".to_owned(),
                    sub_type: Some("url".to_owned()),
                    index: Some(i.to_string()),
                    parameters,
                });
            }
            TemplateButton::QuickReply { .. } | TemplateButton::PhoneNumber { .. } => {
                // These types don't carry runtime substitution. Quick reply
                // payloads go through the template definition; phone number
                // buttons use the static `phone` field directly. No-op
                // matches the TS behaviour.
                continue;
            }
        }
    }

    Ok(out)
}

/// Substitute a *single* placeholder (used for header/url variables where
/// we want the resolved value, not a substituted string).
fn substitute_one(p: &Placeholder, vars: &Variables) -> Result<String, SubstituteError> {
    // Round-trip through `substitute` so we use the exact same empty-value
    // / missing-value semantics rather than reimplementing them.
    let token = match p {
        Placeholder::Positional(n) => format!("{{{{{n}}}}}"),
        Placeholder::Named(s) => format!("{{{{{s}}}}}"),
    };
    substitute(&token, vars)
}

fn missing_or_empty_positional(vars: &Variables, n: u16) -> SubstituteError {
    // Re-use the substitute path so the error variant matches `substitute`
    // exactly (one source of truth for the missing-vs-empty distinction).
    let token = format!("{{{{{n}}}}}");
    substitute(&token, vars)
        .err()
        .unwrap_or(SubstituteError::MissingPositional(n))
}

fn missing_or_empty_named(vars: &Variables, name: &str) -> SubstituteError {
    let token = format!("{{{{{name}}}}}");
    substitute(&token, vars)
        .err()
        .unwrap_or_else(|| SubstituteError::MissingNamed(name.to_owned()))
}
