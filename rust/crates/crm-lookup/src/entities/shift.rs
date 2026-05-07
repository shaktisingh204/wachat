//! `shift` — CRM Shift (`crm_shifts`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_shifts",
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
    let primary = d
        .get_str("name")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or("(unnamed)")
        .to_owned();
    let secondary = match (d.get_str("startTime").ok(), d.get_str("endTime").ok()) {
        (Some(s), Some(e)) if !s.is_empty() && !e.is_empty() => Some(format!("{s} - {e}")),
        _ => None,
    };
    let tertiary = d
        .get_str("description")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    LookupChip {
        primary,
        secondary,
        tertiary,
        ..Default::default()
    }
}
