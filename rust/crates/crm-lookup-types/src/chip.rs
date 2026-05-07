//! `LookupChip` — visual chip metadata returned for every lookup item.
//! Mirrors the TS `LookupChip` shape so picker components don't need to
//! reach into entity-specific schemas to render results.

use serde::{Deserialize, Serialize};

/// Renderable summary of a lookup row. The picker displays this
/// without touching the underlying document.
///
/// - `primary` is the headline (e.g. client name, product name).
/// - `secondary` is the supporting line (e.g. GSTIN + city, SKU + price).
/// - `tertiary` is a small terciary line (e.g. stage label, status).
/// - `avatar_url` and `color` are optional decorations.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LookupChip {
    pub primary: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secondary: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tertiary: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
    /// Free-form color token — Tailwind class ("emerald-500"), CSS
    /// hex ("#22c55e"), or a semantic role ("danger"). The picker
    /// owns the rendering rules.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chip_round_trips_with_optional_decorations() {
        let chip = LookupChip {
            primary: "Acme Corp".into(),
            secondary: Some("29ABCDE1234F1Z5 · Bengaluru".into()),
            tertiary: None,
            avatar_url: Some("https://files/abc.png".into()),
            color: Some("emerald-500".into()),
        };
        let json = serde_json::to_value(&chip).unwrap();
        assert_eq!(json["primary"], "Acme Corp");
        assert!(json.get("tertiary").is_none(), "None must skip");
        let back: LookupChip = serde_json::from_value(json).unwrap();
        assert_eq!(back.color.as_deref(), Some("emerald-500"));
    }
}
