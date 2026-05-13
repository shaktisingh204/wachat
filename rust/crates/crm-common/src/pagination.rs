//! Pagination math shared by every CRM list endpoint.
//!
//! Hoisted from `crm-leads::dto` so every entity crate clamps consistently.

/// Default page size when the caller didn't specify one.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling. Keeps single requests bounded and matches the TS
/// `LOOKUP_MAX_LIMIT` used by `<EntityPicker>`.
pub const MAX_LIMIT: i64 = 100;

/// Clamp `requested` page-size into `[1, MAX_LIMIT]`, defaulting to
/// [`DEFAULT_LIMIT`] when absent.
pub fn clamp_limit(requested: Option<u32>) -> i64 {
    match requested {
        None => DEFAULT_LIMIT,
        Some(n) => (n as i64).clamp(1, MAX_LIMIT),
    }
}

/// `skip` for a 0-indexed page+limit combo.
pub fn skip_for(page: Option<u32>, limit: i64) -> u64 {
    let page = page.unwrap_or(0) as u64;
    let limit = limit.max(1) as u64;
    page.saturating_mul(limit)
}
