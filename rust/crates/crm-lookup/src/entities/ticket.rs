//! `ticket` — CRM Ticket (`crm_tickets`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_tickets",
    searchable_fields: &["subject"],
    default_filter,
    to_chip,
    honors_project_scope: true,
    is_global: false,
};

fn default_filter() -> Document {
    doc! { "status": { "$nin": ["closed", "resolved"] } }
}

fn to_chip(d: &Document) -> LookupChip {
    let id_tail = d
        .get_object_id("_id")
        .ok()
        .map(|oid| {
            let hex = oid.to_hex();
            let len = hex.len();
            hex[len.saturating_sub(6)..].to_owned()
        })
        .unwrap_or_default();
    let subject = d
        .get_str("subject")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or("(no subject)");
    let primary = format!("#{} {}", id_tail, subject);
    let secondary = d
        .get_str("priority")
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
