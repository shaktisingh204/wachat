//! `hsn` — CRM HSN/SAC Code (`crm_hsn_sac`).

use crate::mongo_lookup::LookupSpec;
use bson::{Bson, Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_hsn_sac",
    searchable_fields: &["code", "description"],
    default_filter,
    to_chip,
    honors_project_scope: false,
    is_global: false,
};

fn default_filter() -> Document {
    doc! {}
}

fn to_chip(d: &Document) -> LookupChip {
    let primary = d.get_str("code").unwrap_or("(no code)").to_owned();
    let secondary = d
        .get_str("description")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    let tertiary = match d.get("gstRatePct") {
        Some(Bson::Double(v)) => Some(format!("GST {}%", format_num(*v))),
        Some(Bson::Int32(v)) => Some(format!("GST {}%", v)),
        Some(Bson::Int64(v)) => Some(format!("GST {}%", v)),
        _ => None,
    };
    LookupChip {
        primary,
        secondary,
        tertiary,
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
