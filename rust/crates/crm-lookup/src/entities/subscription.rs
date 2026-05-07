//! `subscription` — CRM Subscription (`crm_subscriptions`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_subscriptions",
    searchable_fields: &["planName"],
    default_filter,
    to_chip,
    honors_project_scope: true,
    is_global: false,
};

fn default_filter() -> Document {
    doc! { "status": { "$nin": ["cancelled", "expired"] } }
}

fn to_chip(d: &Document) -> LookupChip {
    let primary = d
        .get_str("planName")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or("(unnamed)")
        .to_owned();
    let secondary = d
        .get_str("frequency")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
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
