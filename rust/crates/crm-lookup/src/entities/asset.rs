//! `asset` — CRM Fixed Asset (`crm_fixed_assets`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_fixed_assets",
    searchable_fields: &["code", "name", "serial"],
    default_filter,
    to_chip,
    honors_project_scope: true,
    is_global: false,
};

fn default_filter() -> Document {
    doc! { "condition": { "$ne": "retired" } }
}

fn to_chip(d: &Document) -> LookupChip {
    let primary = d
        .get_str("name")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or("(unnamed)")
        .to_owned();
    let secondary = d
        .get_str("code")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    let tertiary = d
        .get_object_id("custodianEmployeeId")
        .ok()
        .map(|oid| format!("Custodian {}", oid.to_hex()));
    LookupChip {
        primary,
        secondary,
        tertiary,
        ..Default::default()
    }
}
