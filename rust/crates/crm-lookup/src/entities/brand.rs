//! `brand` — Product brand (`crm_brands`).
//!
//! Tenants grow their own brand list as products are imported, so this
//! is a Mongo-backed lookup rather than a static enum (compare with
//! `unit`, `industry`, and `vendorType` which are tiny fixed sets and
//! live in `static_lookup.rs`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_brands",
    searchable_fields: &["name"],
    default_filter,
    to_chip,
    honors_project_scope: true,
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
