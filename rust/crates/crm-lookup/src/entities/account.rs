//! `account` — Chart-of-accounts node (`crm_chart_of_accounts`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_chart_of_accounts",
    searchable_fields: &["code", "name"],
    default_filter,
    to_chip,
    honors_project_scope: true,
};

fn default_filter() -> Document {
    doc! { "active": { "$ne": false } }
}

fn to_chip(d: &Document) -> LookupChip {
    let code = d.get_str("code").ok().filter(|s| !s.is_empty());
    let name = d.get_str("name").unwrap_or("(unnamed)");

    let primary = match code {
        Some(c) => format!("{c} · {name}"),
        None => name.to_owned(),
    };

    let secondary = d
        .get_str("nature")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);

    LookupChip {
        primary,
        secondary,
        ..Default::default()
    }
}
