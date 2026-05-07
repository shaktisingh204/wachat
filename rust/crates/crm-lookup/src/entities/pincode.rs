//! `pincode` — India PIN-code reference data (`crm_pincodes`).
//!
//! Cross-tenant: every tenant reads from the same shared collection,
//! so [`LookupSpec::is_global`] is `true` and the `userId` filter is
//! skipped. Seed once with the India Post CSV (~30 k rows) — the
//! collection has no per-tenant ownership.
//!
//! Document shape (matches the seed importer):
//! ```json
//! {
//!   "_id": ObjectId,
//!   "pincode": "560001",
//!   "city": "Bengaluru",
//!   "state": "Karnataka",
//!   "country": "India"
//! }
//! ```

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_pincodes",
    searchable_fields: &["pincode", "city", "state"],
    default_filter,
    to_chip,
    honors_project_scope: false,
    is_global: true,
};

fn default_filter() -> Document {
    doc! {}
}

fn to_chip(d: &Document) -> LookupChip {
    let primary = d.get_str("pincode").unwrap_or("(unknown)").to_owned();
    let city = d.get_str("city").ok().filter(|s| !s.is_empty());
    let state = d.get_str("state").ok().filter(|s| !s.is_empty());
    let secondary = match (city, state) {
        (Some(c), Some(s)) => Some(format!("{c}, {s}")),
        (Some(c), None) => Some(c.to_owned()),
        (None, Some(s)) => Some(s.to_owned()),
        (None, None) => None,
    };
    LookupChip {
        primary,
        secondary,
        ..Default::default()
    }
}
