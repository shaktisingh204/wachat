//! `item` — Product (`crm_products`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_products",
    searchable_fields: &["name", "sku", "barcode", "hsnSac"],
    default_filter,
    to_chip,
    honors_project_scope: true,
};

fn default_filter() -> Document {
    doc! { "archived": { "$ne": true } }
}

fn to_chip(d: &Document) -> LookupChip {
    let name = d.get_str("name").unwrap_or("(unnamed)").to_owned();
    let sku = d.get_str("sku").ok().filter(|s| !s.is_empty());
    let price = d
        .get_f64("sellingPrice")
        .ok()
        .or_else(|| d.get_i32("sellingPrice").ok().map(f64::from))
        .or_else(|| d.get_i64("sellingPrice").ok().map(|i| i as f64));

    let secondary = match (sku, price) {
        (Some(s), Some(p)) => Some(format!("SKU {s} · {p:.2}")),
        (Some(s), None) => Some(format!("SKU {s}")),
        (None, Some(p)) => Some(format!("{p:.2}")),
        (None, None) => None,
    };

    let tertiary = d
        .get_str("hsnSac")
        .ok()
        .filter(|s| !s.is_empty())
        .map(|s| format!("HSN {s}"));

    let avatar_url = d
        .get_array("gallery")
        .ok()
        .and_then(|a| a.first())
        .and_then(|v| v.as_str())
        .map(str::to_owned)
        .or_else(|| d.get_str("thumbnail").ok().map(str::to_owned));

    LookupChip {
        primary: name,
        secondary,
        tertiary,
        avatar_url,
        ..Default::default()
    }
}
