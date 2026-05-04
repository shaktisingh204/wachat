//! Pure synchronous substitution.
//!
//! Behaviour mirrors the TS code in two functions:
//!
//! - `interpolateText` (`src/workers/broadcast/send-message.js` lines 55-64) —
//!   replaces every `{{name}}` with `vars[name]`.
//! - The positional loops in `send-template.actions.ts` and the worker —
//!   replaces every `{{N}}` with `vars[N]`.
//!
//! Differences from the TS:
//!
//! - **Empty values are an error** (`SubstituteError::EmptyValue`). The TS
//!   uses `​` as a fallback to dodge Meta error #100; we let the caller
//!   decide because the broadcast worker should mark such contacts as
//!   permanent failures, not silently send a zero-width-space.
//! - **Missing variables are an error** rather than being substituted with
//!   the empty string or left in place. Same rationale.

use std::collections::HashMap;

use once_cell::sync::Lazy;
use regex::{Captures, Regex};

use crate::error::SubstituteError;
use crate::parser::classify_for_substitute;

/// Variable bag. Positional values are 1-indexed externally (`{{1}}` looks
/// up `positional[0]`); the builder methods convert.
#[derive(Debug, Clone, Default)]
pub struct Variables {
    /// 1-indexed positional values. `set_positional(1, v)` puts `v` at
    /// `positional[0]`.
    positional: Vec<String>,
    named: HashMap<String, String>,
}

impl Variables {
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets the value at 1-indexed position `n`. Pads with empty strings if
    /// needed — but those empties will fail substitution, which is the
    /// intended safety net (callers must explicitly fill every slot).
    pub fn set_positional(mut self, n: u16, value: impl Into<String>) -> Self {
        let idx = n.saturating_sub(1) as usize;
        if self.positional.len() <= idx {
            self.positional.resize(idx + 1, String::new());
        }
        self.positional[idx] = value.into();
        self
    }

    /// Bulk-set the named map. Replaces existing entries with the same keys;
    /// other keys are preserved.
    pub fn with_named<K, V, I>(mut self, entries: I) -> Self
    where
        K: Into<String>,
        V: Into<String>,
        I: IntoIterator<Item = (K, V)>,
    {
        for (k, v) in entries {
            self.named.insert(k.into(), v.into());
        }
        self
    }

    /// Merge another `Variables` into self. Values in `other` win on
    /// conflict (matches the TS `{ ...globalBodyVars, ...contact.variables }`
    /// pattern in the worker).
    pub fn merge(mut self, other: Variables) -> Self {
        for (i, v) in other.positional.into_iter().enumerate() {
            let n = (i + 1) as u16;
            if !v.is_empty() {
                self = self.set_positional(n, v);
            }
        }
        for (k, v) in other.named {
            self.named.insert(k, v);
        }
        self
    }

    /// 1-indexed lookup. Returns `None` if the slot is unset OR present but
    /// empty — both are errors at substitution time.
    pub fn positional(&self, n: u16) -> Option<&str> {
        let idx = n.saturating_sub(1) as usize;
        self.positional
            .get(idx)
            .map(String::as_str)
            .filter(|s| !s.is_empty())
    }

    /// Named lookup. Same empty-string semantics as `positional`.
    pub fn named(&self, key: &str) -> Option<&str> {
        self.named
            .get(key)
            .map(String::as_str)
            .filter(|s| !s.is_empty())
    }

    /// Whether the slot exists at all (even if empty). Used to distinguish
    /// "missing" (hard error) from "supplied but empty" (different hard
    /// error — better diagnostics for the caller).
    fn has_positional(&self, n: u16) -> bool {
        let idx = n.saturating_sub(1) as usize;
        self.positional.get(idx).is_some()
    }

    fn has_named(&self, key: &str) -> bool {
        self.named.contains_key(key)
    }
}

/// Same regex as `parser.rs`, kept local so we don't expose internals across
/// modules. Compiled once.
static PLACEHOLDER_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}")
        .expect("placeholder regex is a compile-time constant and must compile")
});

/// Replaces every `{{X}}` in `text`. Returns the first error encountered —
/// we don't accumulate, since the first missing var is usually the only
/// signal a caller needs to fix their input.
///
/// Single `{` characters not followed by another `{` pass through unchanged
/// (the regex requires `\{\{`), which matches both the TS regex and Meta's
/// own template body grammar.
pub fn substitute(text: &str, vars: &Variables) -> Result<String, SubstituteError> {
    if text.is_empty() {
        return Ok(String::new());
    }

    let mut first_err: Option<SubstituteError> = None;

    let result = PLACEHOLDER_RE.replace_all(text, |caps: &Captures<'_>| {
        if first_err.is_some() {
            // Short-circuit on first failure. We still have to return *something*
            // from the closure, so emit the original match (it'll be discarded).
            return caps[0].to_string();
        }
        let raw = &caps[1];
        match classify_for_substitute(raw) {
            crate::parser::Placeholder::Positional(n) => match vars.positional(n) {
                Some(v) => v.to_string(),
                None => {
                    first_err = Some(if vars.has_positional(n) {
                        SubstituteError::EmptyValue {
                            placeholder: n.to_string(),
                        }
                    } else {
                        SubstituteError::MissingPositional(n)
                    });
                    caps[0].to_string()
                }
            },
            crate::parser::Placeholder::Named(name) => match vars.named(&name) {
                Some(v) => v.to_string(),
                None => {
                    first_err = Some(if vars.has_named(&name) {
                        SubstituteError::EmptyValue {
                            placeholder: name.clone(),
                        }
                    } else {
                        SubstituteError::MissingNamed(name.clone())
                    });
                    caps[0].to_string()
                }
            },
        }
    });

    if let Some(err) = first_err {
        Err(err)
    } else {
        Ok(result.into_owned())
    }
}
