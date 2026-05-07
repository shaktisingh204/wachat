//! `bankAccount` — Payment / bank account (`crm_payment_accounts`).

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "crm_payment_accounts",
    searchable_fields: &["accountName", "bankName", "accountNo", "ifsc", "upiVpa"],
    default_filter,
    to_chip,
    honors_project_scope: true,
    is_global: false,
};

fn default_filter() -> Document {
    doc! { "active": { "$ne": false } }
}

fn to_chip(d: &Document) -> LookupChip {
    let name = d.get_str("accountName").unwrap_or("(unnamed)").to_owned();

    // Tail of the account number — never the full string.
    let secondary = d
        .get_str("accountNo")
        .ok()
        .filter(|s| !s.is_empty())
        .map(|n| {
            let tail = n.chars().rev().take(4).collect::<String>();
            let tail: String = tail.chars().rev().collect();
            format!("•••• {tail}")
        });

    let tertiary = d
        .get_str("bankName")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);

    LookupChip {
        primary: name,
        secondary,
        tertiary,
        ..Default::default()
    }
}
