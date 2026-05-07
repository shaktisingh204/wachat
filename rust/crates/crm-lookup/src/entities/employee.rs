//! `employee` — HR Employee (`crm_employees`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_employees",
    searchable_fields: &[
        "firstName",
        "lastName",
        "displayName",
        "workEmail",
        "personalEmail",
        "employeeId",
    ],
    default_filter,
    to_chip,
    honors_project_scope: false,
};

fn default_filter() -> Document {
    // Hide terminated/resigned employees from picker results unless
    // the caller explicitly asks for them via `params.filter`.
    doc! { "status": { "$nin": ["terminated", "resigned"] } }
}

fn to_chip(d: &Document) -> LookupChip {
    let first = d.get_str("firstName").unwrap_or("");
    let last = d.get_str("lastName").unwrap_or("");
    let primary = d
        .get_str("displayName")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| format!("{first} {last}").trim().to_owned());

    let designation = d.get_str("designation").ok().filter(|s| !s.is_empty());
    let dept = d.get_str("department").ok().filter(|s| !s.is_empty());

    let secondary = match (designation, dept) {
        (Some(role), Some(d2)) => Some(format!("{role} · {d2}")),
        (Some(role), None) => Some(role.to_owned()),
        (None, Some(d2)) => Some(d2.to_owned()),
        (None, None) => None,
    };

    LookupChip {
        primary,
        secondary,
        ..Default::default()
    }
}
