//! Generic Mongo-backed lookup executor. Each entity provides a
//! [`LookupSpec`] (collection name, searchable fields, default filter,
//! chip projection) and the executor handles the rest: tenant
//! narrowing, paging, free-text $regex search, id-hydration.

use crate::context::TenantCtx;
use bson::{Bson, Document, doc, oid::ObjectId};
use crm_lookup_types::{
    LOOKUP_DEFAULT_LIMIT, LOOKUP_MAX_LIMIT, LookupChip, LookupItem, LookupParams, LookupResult,
    Scope,
};
use futures::stream::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::MongoHandle;

/// Per-entity executor configuration. The chip projection is a regular
/// `fn` (not a closure) so we can stash specs in `static` items.
pub struct LookupSpec {
    /// Mongo collection name (e.g. `"crm_accounts"`).
    pub collection: &'static str,
    /// Fields searched when `params.q` is non-empty. The executor
    /// builds a `$or` of `$regex` clauses across them.
    pub searchable_fields: &'static [&'static str],
    /// Returns the per-entity baseline filter (e.g. `{ archived: { $ne: true } }`).
    /// Returning a `Document` (rather than a static reference) keeps the
    /// fn pointer compatible with `static` storage.
    pub default_filter: fn() -> Document,
    /// Projects a `Document` into a [`LookupChip`].
    pub to_chip: fn(&Document) -> LookupChip,
    /// Project-scoping behavior. Most entities support `Scope::Tenant`
    /// but globals like Currency live with `Scope::Global` (skip the
    /// `userId` filter entirely).
    pub honors_project_scope: bool,
}

/// Build a Mongo `$regex` BSON value from a free-text query. Escapes
/// regex metacharacters so a stray `.` / `*` / `+` doesn't blow up the
/// query plan.
fn build_regex(q: &str) -> Bson {
    // Escape every char that has regex meaning. Cheap; query is short.
    let mut escaped = String::with_capacity(q.len() + 8);
    for c in q.chars() {
        if matches!(
            c,
            '\\' | '^' | '$' | '.' | '|' | '?' | '*' | '+' | '(' | ')' | '[' | ']' | '{' | '}'
        ) {
            escaped.push('\\');
        }
        escaped.push(c);
    }
    Bson::RegularExpression(bson::Regex {
        pattern: escaped,
        options: "i".to_owned(),
    })
}

/// Execute a single lookup against the configured collection.
pub async fn execute(
    mongo: &MongoHandle,
    spec: &LookupSpec,
    params: &LookupParams,
    ctx: &TenantCtx,
) -> Result<LookupResult> {
    /* ----- pagination ------------------------------------------------ */
    let limit = params
        .limit
        .unwrap_or(LOOKUP_DEFAULT_LIMIT)
        .clamp(1, LOOKUP_MAX_LIMIT) as i64;
    let page = params.page.unwrap_or(0) as i64;
    let skip = page.saturating_mul(limit);

    /* ----- assemble the filter -------------------------------------- */
    let mut filter = (spec.default_filter)();

    // Tenant filter — every CRM doc carries `userId` per §0. Globals
    // opt out of this (their docs are cross-tenant by design).
    if !matches!(ctx.scope, Scope::Global) {
        filter.insert("userId", ctx.user_id);
    }

    // Project narrowing when the caller asked for project scope.
    if matches!(ctx.scope, Scope::Project)
        && spec.honors_project_scope
        && let Some(project_id) = ctx.project_id
    {
        filter.insert("projectId", project_id);
    }

    // Hydration-by-id. When ids are passed, the executor returns those
    // exact rows (regardless of the q/filter narrowing) so a stale
    // picker chip can render without reordering.
    if !params.ids.is_empty() {
        let oids: Vec<Bson> = params
            .ids
            .iter()
            .filter_map(|s| ObjectId::parse_str(s).ok().map(Bson::ObjectId))
            .collect();
        if !oids.is_empty() {
            filter.insert("_id", doc! { "$in": oids });
        }
    }

    // Free-text $regex across searchable fields.
    if let Some(q) = params.q.as_deref().filter(|s| !s.is_empty()) {
        let regex = build_regex(q);
        let or_clauses: Vec<Document> = spec
            .searchable_fields
            .iter()
            .map(|f| doc! { *f: regex.clone() })
            .collect();
        if !or_clauses.is_empty() {
            filter.insert("$or", or_clauses);
        }
    }

    // Free-form caller filter merged on top — caller wins on key
    // collisions, matching the TS server-action behavior.
    if let Some(extra) = params.filter.as_object() {
        for (k, v) in extra {
            if let Ok(b) = bson::to_bson(v) {
                filter.insert(k.clone(), b);
            }
        }
    }

    /* ----- query ----------------------------------------------------- */
    let collection = mongo.collection::<Document>(spec.collection);
    let opts = FindOptions::builder()
        // Fetch one extra row so we can infer `has_more` without a
        // separate `count_documents` call.
        .limit(limit + 1)
        .skip(skip as u64)
        .build();

    let cursor = collection
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let mut docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let has_more = docs.len() as i64 > limit;
    if has_more {
        docs.truncate(limit as usize);
    }

    let items: Vec<LookupItem> = docs
        .iter()
        .map(|d| LookupItem {
            id: d
                .get_object_id("_id")
                .map(|o| o.to_hex())
                .unwrap_or_default(),
            chip: (spec.to_chip)(d),
            raw: serde_json::Value::Null,
        })
        .collect();

    Ok(LookupResult {
        items,
        page: page as u32,
        limit: limit as u32,
        total: None,
        has_more,
        recent: vec![],
    })
}

/* ===================== Tests ===================== */

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_regex_escapes_metacharacters() {
        let bson = build_regex("a.c*+?");
        match bson {
            Bson::RegularExpression(r) => {
                assert_eq!(r.pattern, "a\\.c\\*\\+\\?");
                assert_eq!(r.options, "i");
            }
            _ => panic!("expected RegularExpression"),
        }
    }

    #[test]
    fn build_regex_preserves_plain_text() {
        let bson = build_regex("acme");
        match bson {
            Bson::RegularExpression(r) => {
                assert_eq!(r.pattern, "acme");
            }
            _ => panic!("expected RegularExpression"),
        }
    }
}
