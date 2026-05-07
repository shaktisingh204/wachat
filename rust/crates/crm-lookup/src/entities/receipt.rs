//! `receipt` — CRM Payment Receipt (`crm_payment_receipts`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_payment_receipts",
    searchable_fields: &["receiptNumber"],
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
        .get_str("receiptNumber")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or("(no number)")
        .to_owned();
    let secondary = d.get_f64("amount").ok().map(|a| {
        let currency = d
            .get_str("currency")
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or("");
        if currency.is_empty() {
            format!("{:.2}", a)
        } else {
            format!("{:.2} {}", a, currency)
        }
    });
    let tertiary = d
        .get_str("mode")
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
