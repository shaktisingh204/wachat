//! `user` — Platform user (`users`). Cross-tenant collection — the
//! search is naturally narrowed by the tenant root via `userId`, but
//! "user" rows on this collection ARE the tenant roots, so we search
//! across all `users` and rely on RBAC upstream for authorization.

use crate::mongo_lookup::LookupSpec;
use bson::{Document, doc};
use crm_lookup_types::LookupChip;

pub static SPEC: LookupSpec = LookupSpec {
    collection: "users",
    searchable_fields: &["name", "email"],
    default_filter,
    to_chip,
    honors_project_scope: false,
    is_global: false,
};

fn default_filter() -> Document {
    // No archived/inactive flag on the users collection today; return
    // every row matching the tenant scope. Future: filter on a
    // `disabled` field once introduced.
    doc! {}
}

fn to_chip(d: &Document) -> LookupChip {
    let primary = d
        .get_str("name")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| d.get_str("email").ok())
        .unwrap_or("(unnamed)")
        .to_owned();
    let secondary = d
        .get_str("email")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    let avatar_url = d
        .get_str("avatarUrl")
        .ok()
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    LookupChip {
        primary,
        secondary,
        avatar_url,
        ..Default::default()
    }
}
