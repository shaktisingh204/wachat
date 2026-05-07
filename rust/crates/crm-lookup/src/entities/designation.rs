//! `designation` — CRM Designation (`crm_designations`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_designations",
    searchable_fields: &["name", "code"],
    default_filter,
    to_chip,
    honors_project_scope: false,
    is_global: false,
};

fn default_filter() -> Document {
    doc! { "active": { "$ne": false } }
}

fn to_chip(d: &Document) -> LookupChip {
    let primary = d
        .get_str("name")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or("(unnamed)")
        .to_owned();
    let secondary = d
        .get_str("grade")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    let tertiary = d.get_i32("level").ok().map(|n| format!("level: {n}"));
    LookupChip {
        primary,
        secondary,
        tertiary,
        ..Default::default()
    }
}
