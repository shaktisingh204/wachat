//! `plan` — CRM Plan (`crm_plans`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_plans",
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
    let primary = d
        .get_str("name")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or("(unnamed)")
        .to_owned();
    let price = d.get_str("price").ok().filter(|s| !s.is_empty());
    let frequency = d.get_str("frequency").ok().filter(|s| !s.is_empty());
    let secondary = match (price, frequency) {
        (Some(p), Some(f)) => {
            let currency = d
                .get_str("currency")
                .ok()
                .filter(|s| !s.is_empty())
                .unwrap_or("");
            Some(format!("{}{} / {}", p, currency, f))
        }
        _ => None,
    };
    let tertiary = d
        .get_str("code")
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
