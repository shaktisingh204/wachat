//! `contact` — CRM Contact (`crm_contacts`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_contacts",
    searchable_fields: &["firstName", "lastName", "email", "phone", "company"],
    default_filter,
    to_chip,
    honors_project_scope: true,
    is_global: false,
};

fn default_filter() -> Document {
    doc! { "archived": { "$ne": true } }
}

fn to_chip(d: &Document) -> LookupChip {
    let first = d.get_str("firstName").unwrap_or("").trim();
    let last = d.get_str("lastName").unwrap_or("").trim();
    let full = format!("{first} {last}");
    let full = full.trim();
    let email = d.get_str("email").ok().filter(|s| !s.is_empty());
    let primary = if !full.is_empty() {
        full.to_owned()
    } else {
        email
            .map(str::to_owned)
            .unwrap_or_else(|| "(unnamed)".to_owned())
    };
    let secondary = d
        .get_str("company")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    let tertiary = email.map(str::to_owned);
    LookupChip {
        primary,
        secondary,
        tertiary,
        ..Default::default()
    }
}
