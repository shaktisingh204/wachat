//! `bill` — CRM Bill (`crm_bills`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_bills",
    searchable_fields: &["billNumber", "vendorInvoiceNumber"],
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
        .get_str("billNumber")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| {
            d.get_str("vendorInvoiceNumber")
                .ok()
                .filter(|s| !s.is_empty())
        })
        .unwrap_or("(no number)")
        .to_owned();
    let secondary = d.get_f64("total").ok().map(|t| {
        let currency = d
            .get_str("currency")
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or("");
        if currency.is_empty() {
            format!("{:.2}", t)
        } else {
            format!("{:.2} {}", t, currency)
        }
    });
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
