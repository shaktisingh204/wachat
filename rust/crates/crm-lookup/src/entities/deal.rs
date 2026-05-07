//! `deal` — CRM Deal (`crm_deals`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_deals",
    searchable_fields: &["name"],
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
        .get_str("name")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or("(unnamed)")
        .to_owned();
    let value = d
        .get_f64("value")
        .ok()
        .or_else(|| d.get_i32("value").ok().map(f64::from))
        .or_else(|| d.get_i64("value").ok().map(|i| i as f64));
    let currency = d.get_str("currency").ok().filter(|s| !s.is_empty());
    let secondary = value.map(|v| match currency {
        Some(c) => format!("{v:.2} {c}"),
        None => format!("{v:.2}"),
    });
    let tertiary = d
        .get_str("stage")
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
