//! `vendor` — Supplier (`crm_vendors`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_vendors",
    searchable_fields: &[
        "name",
        "email",
        "phone",
        "gstin",
        "displayName",
        "companyName",
    ],
    default_filter,
    to_chip,
    honors_project_scope: true,
    is_global: false,
};

fn default_filter() -> Document {
    doc! { "archived": { "$ne": true } }
}

fn to_chip(d: &Document) -> LookupChip {
    let primary = d
        .get_str("displayName")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| d.get_str("companyName").ok().filter(|s| !s.is_empty()))
        .or_else(|| d.get_str("name").ok())
        .unwrap_or("(unnamed)")
        .to_owned();
    let secondary = d
        .get_str("gstin")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    LookupChip {
        primary,
        secondary,
        ..Default::default()
    }
}
