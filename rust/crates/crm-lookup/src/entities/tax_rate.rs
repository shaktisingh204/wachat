//! `tax_rate` — CRM Tax Rate (`crm_taxes`).

use crate::mongo_lookup::LookupSpec;
use bson::{Bson, Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_taxes",
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
    let name = d.get_str("name").unwrap_or("(unnamed)");
    let rate = match d.get("rate") {
        Some(Bson::Double(v)) => Some(*v),
        Some(Bson::Int32(v)) => Some(*v as f64),
        Some(Bson::Int64(v)) => Some(*v as f64),
        _ => None,
    };
    let primary = match rate {
        Some(r) => format!("{} {}%", name, format_num(r)),
        None => name.to_owned(),
    };
    let secondary = d
        .get_str("taxType")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    LookupChip {
        primary,
        secondary,
        tertiary: None,
        ..Default::default()
    }
}

fn format_num(v: f64) -> String {
    if (v - v.trunc()).abs() < f64::EPSILON {
        format!("{}", v as i64)
    } else {
        format!("{}", v)
    }
}
