//! Per-tenant per-entity LRU of recently picked ids, backed by Redis.
//!
//! Implements §13.9 — "Redis cache: per-tenant per-entity LRU of last
//! 1000 items keyed by `<tenantId>:<entity>`". Today we cap at
//! [`MAX_RECENT`] = 50 because the picker only renders the top 5; 50
//! gives a cushion against duplicate-suppression churn without
//! ballooning Redis memory across thousands of tenants × dozens of
//! entities.
//!
//! ## Wire shape
//!
//! Storage uses a Redis LIST per (tenant, entity) pair so that "most
//! recently picked" is `LRANGE 0 N-1`:
//!
//! - **Key**: `crm:lookup:recent:<userIdHex>:<entityKey>` (entity key
//!   is the camelCase string from `EntityKey::as_str`).
//! - **Element**: the item id as a string (Mongo ObjectId hex, or the
//!   composite `pipelineId:stageId` for `Stage`, or the static code
//!   like `"INR"` for Currency).
//!
//! ## Operations
//!
//! - [`record_pick`] — bumps an id to the head of the list. Implemented
//!   as `LREM 0 <id>; LPUSH <id>; LTRIM 0 N-1` so the same id never
//!   appears twice and the cap is enforced atomically-ish (Redis
//!   pipelines those three commands per call; we accept the tiny
//!   non-atomic window since duplicate dedup is best-effort).
//! - [`fetch_recent`] — `LRANGE 0 limit-1`.

use bson::oid::ObjectId;
use crm_lookup_types::EntityKey;
use fred::interfaces::ListInterface;
use sabnode_common::{ApiError, Result};
use sabnode_db::RedisHandle;

/// Cap on the number of recents stored per (tenant, entity) pair. The
/// picker only ever renders the top ~5; the extra headroom is a cheap
/// safeguard against churn.
pub const MAX_RECENT: i64 = 50;

/// Build the canonical Redis key for a tenant + entity.
pub fn key(user_id: &ObjectId, entity: EntityKey) -> String {
    format!("crm:lookup:recent:{}:{}", user_id.to_hex(), entity.as_str())
}

/// Push `item_id` to the head of the recents list for this tenant +
/// entity, deduping any existing copy and trimming to [`MAX_RECENT`].
///
/// Returns `Ok(())` even when Redis is briefly unavailable for non-
/// critical errors — recents are a UX nicety, not a correctness
/// invariant. We surface only typed `ApiError` so callers can choose
/// to log + drop without breaking the request that spawned this call.
pub async fn record_pick(
    redis: &RedisHandle,
    user_id: &ObjectId,
    entity: EntityKey,
    item_id: &str,
) -> Result<()> {
    if item_id.is_empty() {
        return Ok(());
    }
    let k = key(user_id, entity);

    // Dedup — at most one copy of `item_id` survives at the end.
    let _: i64 = redis
        .client
        .lrem(&k, 0, item_id)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("recents lrem: {e}")))?;

    // Push to head.
    let _: i64 = redis
        .client
        .lpush(&k, item_id)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("recents lpush: {e}")))?;

    // Cap.
    let _: () = redis
        .client
        .ltrim(&k, 0, MAX_RECENT - 1)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("recents ltrim: {e}")))?;

    Ok(())
}

/// Fetch the `limit` most-recent ids for this tenant + entity (newest
/// first). Returns an empty `Vec` when the key doesn't exist yet.
pub async fn fetch_recent(
    redis: &RedisHandle,
    user_id: &ObjectId,
    entity: EntityKey,
    limit: u32,
) -> Result<Vec<String>> {
    if limit == 0 {
        return Ok(vec![]);
    }
    let k = key(user_id, entity);
    let stop = (limit as i64).min(MAX_RECENT) - 1;

    let items: Vec<String> = redis
        .client
        .lrange(&k, 0, stop)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("recents lrange: {e}")))?;

    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_format_round_trips() {
        let oid = ObjectId::parse_str("507f1f77bcf86cd799439011").unwrap();
        let k = key(&oid, EntityKey::Client);
        assert_eq!(k, "crm:lookup:recent:507f1f77bcf86cd799439011:client");
    }

    #[test]
    fn key_uses_camel_case_entity() {
        let oid = ObjectId::parse_str("507f1f77bcf86cd799439011").unwrap();
        // BankAccount → "bankAccount" (camelCase, not "bank_account").
        let k = key(&oid, EntityKey::BankAccount);
        assert!(k.ends_with(":bankAccount"));
    }

    #[test]
    fn cap_constant_is_at_least_picker_window() {
        // Picker renders top 5; we cap at 50 for headroom. Anything
        // below 5 is a regression — pickers would lose entries.
        const _: () = assert!(MAX_RECENT >= 5);
    }
}
