//! `source` — CRM Lead/Deal Source (`crm_sources`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_sources",
    searchable_fields: &["name"],
    default_filter,
    to_chip,
    honors_project_scope: false,
    is_global: false,
};

fn default_filter() -> Document {
    doc! { "active": { "$ne": false } }
}

fn to_chip(d: &Document) -> LookupChip {
    let primary = d.get_str("name").unwrap_or("(unnamed)").to_owned();
    let secondary = d
        .get_str("description")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    LookupChip {
        primary,
        secondary,
        tertiary: None,
        ..Default::default()
    }
}
