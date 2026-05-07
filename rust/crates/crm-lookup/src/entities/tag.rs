//! `tag` — CRM Tag (`crm_tags`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_tags",
    searchable_fields: &["name"],
    default_filter,
    to_chip,
    honors_project_scope: false,
    is_global: false,
};

fn default_filter() -> Document {
    doc! {}
}

fn to_chip(d: &Document) -> LookupChip {
    let primary = d.get_str("name").unwrap_or("(unnamed)").to_owned();
    let color = d
        .get_str("color")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    LookupChip {
        primary,
        secondary: color.clone(),
        tertiary: None,
        color,
        ..Default::default()
    }
}
