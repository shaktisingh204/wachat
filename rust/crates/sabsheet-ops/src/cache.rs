//! In-process LRU cache of warm [`SabEngine`] instances, keyed by workbook id.
//!
//! Rehydrating an engine from its snapshot (`from_snapshot`) on every request is wasteful for hot
//! workbooks: the snapshot is parsed and the whole model is rebuilt each time. Because `SabEngine`
//! is `Send` (proven by the `send_verdict` compile-time assertion in `lib.rs`), we can safely park
//! warm engines in a process-global `Mutex`-guarded map and hand them back to the next request.
//!
//! ## Concurrency / no-await rule
//!
//! The engine must never cross an `.await`. Callers therefore:
//!   1. `take(workbook_id, base_seq)` — pops the engine OUT of the cache (under a short lock) iff its
//!      cached seq matches what the caller loaded. While taken, no other request can grab the same
//!      engine, so there is no aliasing.
//!   2. use the engine entirely inside one synchronous block (mutate, snapshot).
//!   3. `put(workbook_id, new_seq, engine)` — returns the engine to the cache at the new seq.
//!
//! `take` removing the entry (rather than lending a reference) is what keeps the lock un-held across
//! the synchronous engine work: we only hold the `Mutex` for the O(1) map op, never during recalc.
//!
//! Seq-keying is the invalidation strategy: a cached engine is only reused when its seq equals the
//! seq the caller just loaded from Mongo. If another process wrote a newer seq, the cached engine is
//! stale; `take` returns `None` and the caller falls back to `from_snapshot`, then `put`s the fresh
//! engine at the new seq (replacing the stale one).

use std::collections::HashMap;
use std::sync::Mutex;

use bson::oid::ObjectId;
use once_cell::sync::Lazy;
use sabsheet_engine::SabEngine;

/// Maximum number of warm engines kept resident. Engines can be large (a full workbook model), so
/// this is deliberately small; the LRU evicts the least-recently-used workbook past the bound.
const CAPACITY: usize = 32;

struct Entry {
    seq: i64,
    engine: SabEngine,
    /// Monotonic tick of last access, for LRU eviction.
    last_used: u64,
}

struct Cache {
    map: HashMap<ObjectId, Entry>,
    tick: u64,
}

impl Cache {
    fn next_tick(&mut self) -> u64 {
        self.tick = self.tick.wrapping_add(1);
        self.tick
    }

    /// Evict the least-recently-used entry while over capacity.
    fn evict_if_needed(&mut self) {
        while self.map.len() > CAPACITY {
            if let Some((&victim, _)) = self.map.iter().min_by_key(|(_, e)| e.last_used) {
                self.map.remove(&victim);
            } else {
                break;
            }
        }
    }
}

static CACHE: Lazy<Mutex<Cache>> =
    Lazy::new(|| Mutex::new(Cache { map: HashMap::new(), tick: 0 }));

/// Take ownership of the warm engine for `workbook_id` iff its cached seq equals `expected_seq`.
///
/// Returns `None` when there is no cached engine or the cached seq is stale (a different writer
/// advanced the snapshot). The entry is removed from the map on a hit so the caller has exclusive
/// ownership during the synchronous engine work; return it with [`put`].
pub fn take(workbook_id: ObjectId, expected_seq: i64) -> Option<SabEngine> {
    let mut cache = CACHE.lock().ok()?;
    match cache.map.get(&workbook_id) {
        Some(e) if e.seq == expected_seq => cache.map.remove(&workbook_id).map(|e| e.engine),
        // Stale or absent: drop any stale entry so we don't keep handing out an old engine.
        Some(_) => {
            cache.map.remove(&workbook_id);
            None
        }
        None => None,
    }
}

/// Insert or replace the warm engine for `workbook_id` at `seq`, evicting the LRU entry if the cache
/// is over capacity. Always call this after mutating (or freshly building) an engine so the next
/// request can reuse it.
pub fn put(workbook_id: ObjectId, seq: i64, engine: SabEngine) {
    let Ok(mut cache) = CACHE.lock() else { return };
    let last_used = cache.next_tick();
    cache.map.insert(workbook_id, Entry { seq, engine, last_used });
    cache.evict_if_needed();
}

/// Drop any cached engine for `workbook_id` (e.g. after a wholesale replace where rebuilding from
/// the new snapshot is simplest). Safe to call when nothing is cached.
pub fn invalidate(workbook_id: ObjectId) {
    if let Ok(mut cache) = CACHE.lock() {
        cache.map.remove(&workbook_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sabsheet_engine::ops::Command;

    fn engine_with(val: &str) -> SabEngine {
        let mut e = SabEngine::new("t").unwrap();
        e.apply(&[Command::SetCellInput { sheet: 0, row: 1, col: 1, input: val.into() }])
            .unwrap();
        e
    }

    #[test]
    fn take_returns_engine_only_on_matching_seq() {
        let id = ObjectId::new();
        put(id, 5, engine_with("=1+1"));

        // Stale seq -> miss (and the stale entry is dropped).
        assert!(take(id, 4).is_none());
        // After a stale miss, even the right seq is gone.
        assert!(take(id, 5).is_none());

        // Re-put and take with the matching seq -> hit.
        put(id, 7, engine_with("=2*21"));
        let e = take(id, 7).expect("matching seq must hit");
        assert_eq!(e.formatted(0, 1, 1).unwrap(), "42");
        // Taken out: a second take misses.
        assert!(take(id, 7).is_none());
    }

    #[test]
    fn put_evicts_lru_past_capacity() {
        // Fill beyond capacity; the oldest inserts must be evicted.
        let mut ids = Vec::new();
        for i in 0..(CAPACITY + 5) {
            let id = ObjectId::new();
            ids.push(id);
            put(id, 1, engine_with(&i.to_string()));
        }
        let cache = CACHE.lock().unwrap();
        assert!(cache.map.len() <= CAPACITY);
        // The most-recently inserted id must still be resident.
        assert!(cache.map.contains_key(ids.last().unwrap()));
    }
}
