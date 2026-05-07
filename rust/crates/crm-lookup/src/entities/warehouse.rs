//! `warehouse` — Stock location (`crm_warehouses`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_warehouses",
    searchable_fields: &["name", "code"],
    default_filter,
    to_chip,
    honors_project_scope: true,
    is_global: false,
};

fn default_filter() -> Document {
    doc! { "active": { "$ne": false } }
}

fn to_chip(d: &Document) -> LookupChip {
    let name = d.get_str("name").unwrap_or("(unnamed)").to_owned();
    let code = d.get_str("code").ok().filter(|s| !s.is_empty());
    let secondary = code.map(|c| format!("Code {c}"));
    LookupChip {
        primary: name,
        secondary,
        ..Default::default()
    }
}
