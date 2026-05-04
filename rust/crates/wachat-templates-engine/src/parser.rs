//! Placeholder extraction.
//!
//! The TS code uses two regexes interchangeably:
//!
//! - `/\{\{\s*(\d+)\s*\}\}/g` — positional only, used in
//!   `send-template.actions.ts` and the worker's HEADER/BODY parameter loops.
//! - `/\{\{\s*([\w\d._]+)\s*\}\}/g` — named or positional, used in
//!   `interpolateText` inside `src/workers/broadcast/send-message.js`.
//!
//! We collapse both to a single regex `\{\{\s*([A-Za-z0-9_]+)\s*\}\}` and
//! disambiguate at parse time: if the captured group is all digits, it's
//! positional; otherwise it's named. Identifiers may contain underscores
//! (matching the TS `[\w\d._]` minus the dot — we deliberately drop `.` to
//! avoid encouraging nested-property syntax, which the TS code never
//! actually resolves either; it just looks the literal key up in a flat
//! map).
//!
//! Output is **ordered by first appearance** and **deduplicated**. This
//! mirrors how the TS code builds Meta's `parameters` array — it sorts
//! positional vars numerically, but the call to `[...new Set(matches)]`
//! preserves first-seen order for the dedup step.

use once_cell::sync::Lazy;
use regex::Regex;

/// One placeholder occurrence, normalised. Equality ignores the original
/// source span — two `{{1}}` tokens at different offsets are the same
/// placeholder.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Placeholder {
    /// `{{1}}`, `{{2}}`, ... — Meta's WhatsApp template positional slots.
    /// 1-indexed because that's what Meta uses on the wire and what the TS
    /// code generates.
    Positional(u16),

    /// `{{first_name}}`, `{{order_id}}`, ... — used by the broadcast worker
    /// when contacts carry a `variables: { key: value }` map.
    Named(String),
}

/// Compiled lazily; safe to share across threads. We use `OnceCell` (per the
/// slice spec) rather than `LazyLock` to keep the dep graph aligned with
/// other crates that also pull `once_cell`.
static PLACEHOLDER_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}")
        .expect("placeholder regex is a compile-time constant and must compile")
});

/// Returns placeholders in the order they first appear in `text`, with
/// duplicates removed. An empty input yields an empty vec.
pub fn extract_placeholders(text: &str) -> Vec<Placeholder> {
    if text.is_empty() {
        return Vec::new();
    }

    let mut out = Vec::new();
    for cap in PLACEHOLDER_RE.captures_iter(text) {
        let raw = cap
            .get(1)
            .expect("capture group 1 is mandatory in the regex")
            .as_str();
        let ph = classify_for_substitute(raw);
        if !out.contains(&ph) {
            out.push(ph);
        }
    }
    out
}

/// Internal: positional iff the identifier is all-ASCII-digits AND fits in
/// u16 (Meta caps templates at 60 body params today; u16 is generous). A
/// numeric string that overflows u16 falls back to named — that way we
/// never silently truncate a giant numeric key.
///
/// Crate-public so `substitute.rs` can reuse the exact same disambiguation
/// rule without duplicating it.
pub(crate) fn classify_for_substitute(raw: &str) -> Placeholder {
    if !raw.is_empty()
        && raw.bytes().all(|b| b.is_ascii_digit())
        && let Ok(n) = raw.parse::<u16>()
    {
        return Placeholder::Positional(n);
    }
    Placeholder::Named(raw.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_positional_in_order() {
        let p = extract_placeholders("Hello {{1}}, your order {{2}} is ready.");
        assert_eq!(
            p,
            vec![Placeholder::Positional(1), Placeholder::Positional(2)]
        );
    }

    #[test]
    fn extracts_named() {
        let p = extract_placeholders("Hi {{first_name}}!");
        assert_eq!(p, vec![Placeholder::Named("first_name".into())]);
    }

    #[test]
    fn deduplicates_preserving_first_seen_order() {
        let p = extract_placeholders("{{2}} {{1}} {{2}} {{1}}");
        assert_eq!(
            p,
            vec![Placeholder::Positional(2), Placeholder::Positional(1)]
        );
    }

    #[test]
    fn allows_internal_whitespace() {
        let p = extract_placeholders("{{  1  }} {{ name }}");
        assert_eq!(
            p,
            vec![
                Placeholder::Positional(1),
                Placeholder::Named("name".into())
            ]
        );
    }

    #[test]
    fn ignores_single_braces() {
        let p = extract_placeholders("plain { 1 } and {1}");
        assert!(p.is_empty());
    }
}
