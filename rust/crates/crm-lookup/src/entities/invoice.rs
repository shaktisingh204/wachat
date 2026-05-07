//! `invoice` — CRM Invoice (`crm_invoices`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_invoices",
    searchable_fields: &["invoiceNumber"],
    default_filter,
    to_chip,
    honors_project_scope: true,
    is_global: false,
};

fn default_filter() -> Document {
    doc! { "archived": { "$ne": true } }
}

fn format_total(d: &Document) -> Option<String> {
    let total = d
        .get_f64("total")
        .ok()
        .or_else(|| d.get_i32("total").ok().map(|v| v as f64))
        .or_else(|| d.get_i64("total").ok().map(|v| v as f64))?;
    let currency = d
        .get_str("currency")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or("");
    if currency.is_empty() {
        Some(format!("{}", total))
    } else {
        Some(format!("{} {}", total, currency))
    }
}

fn to_chip(d: &Document) -> LookupChip {
    let primary = d
        .get_str("invoiceNumber")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or("(unnamed)")
        .to_owned();
    let secondary = format_total(d);
    let tertiary = d
        .get_str("status")
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
