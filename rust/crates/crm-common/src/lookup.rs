//! Forward-looking glue for one-line lookup registration.
//!
//! Per-entity crates that opt in implement [`CrmLookupAdapter`]; the
//! `crm-lookup` crate gains a shim layer that picks up every adapter at
//! compile time so the §13.4 registry stops being hand-edited.
//!
//! The existing 42 entities in `crm-lookup` keep working unchanged — this
//! trait is additive.

use bson::Document;

/// Minimal lookup contract a CRM entity crate satisfies to register with
/// `crm-lookup` via a single `impl` block.
pub trait CrmLookupAdapter {
    /// camelCase entity key (e.g. `"invoice"`, `"bankAccount"`).
    const ENTITY: &'static str;

    /// Mongo collection name.
    const COLLECTION: &'static str;

    /// Whether this collection is tenant-scoped (`false` for cross-tenant
    /// reference data such as Pincode / Country).
    const IS_GLOBAL: bool = false;

    /// Field names searched by `?q=…` regex.
    fn searchable_fields() -> &'static [&'static str];

    /// Build the picker chip from a raw Mongo doc. Implementations should
    /// pull whatever fields exist and degrade gracefully — pickers rely on
    /// every chip returning *something* renderable.
    fn chip(doc: &Document) -> LookupChip;
}

/// Mirror of `crm_lookup_types::LookupChip` to avoid an upstream crate dep
/// here. Per-entity crates compose `crm-lookup-types` directly when they
/// register their `EntitySpec`.
#[derive(Debug, Clone)]
pub struct LookupChip {
    pub primary: String,
    pub secondary: Option<String>,
    pub tertiary: Option<String>,
    pub avatar_url: Option<String>,
    pub color: Option<String>,
}

impl LookupChip {
    /// Convenience constructor for the common case (just `primary`).
    pub fn from_primary(primary: impl Into<String>) -> Self {
        Self {
            primary: primary.into(),
            secondary: None,
            tertiary: None,
            avatar_url: None,
            color: None,
        }
    }
}
