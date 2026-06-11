//! Mongo persistence for the authoritative engine state + op log.
//!
//! The whole workbook is persisted as one IronCalc snapshot in `sabsheet_engine_state`, and every
//! applied batch appends to `sabsheet_ops` (correct + totally-ordered). This is the right model for
//! the **fat-client** architecture: the client runs the full engine in WASM (for offline + instant
//! recalc), so it always needs the whole workbook — partial block-tile loads (the original plan)
//! would not give the client enough data to recalculate. The P3 hardening here is therefore
//! snapshot **chunking**: snapshots larger than `CHUNK_THRESHOLD` are split across
//! `sabsheet_engine_chunks` (Mongo caps a single document at 16 MB), transparently to `load_state`.

use bson::{Binary, DateTime as BsonDateTime, Document, doc, oid::ObjectId, spec::BinarySubtype};
use chrono::Utc;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;

pub const STATE_COLL: &str = "sabsheet_engine_state";
pub const OPS_COLL: &str = "sabsheet_ops";
pub const CHUNKS_COLL: &str = "sabsheet_engine_chunks";
pub const WORKBOOK_COLL: &str = "sabsheet_workbooks";

/// Above this size, the snapshot is split across `sabsheet_engine_chunks` instead of being stored
/// inline (Mongo caps a single BSON document at 16 MB; we leave headroom for the doc envelope).
pub const CHUNK_THRESHOLD: usize = 15 * 1024 * 1024;
/// Per-chunk payload size when chunking (well under the 16 MB document cap).
pub const CHUNK_SIZE: usize = 8 * 1024 * 1024;

fn internal(e: impl Into<anyhow::Error>, ctx: &'static str) -> ApiError {
    ApiError::Internal(e.into().context(ctx))
}

/// Split a snapshot into `CHUNK_SIZE`-byte slices (the last may be shorter). Pure + Mongo-free so it
/// can be unit-tested directly. Returns an empty Vec only for an empty input.
pub fn split_chunks(snapshot: &[u8]) -> Vec<Vec<u8>> {
    snapshot.chunks(CHUNK_SIZE).map(|c| c.to_vec()).collect()
}

/// Reassemble chunks (already ordered by `idx`) back into the original snapshot. Inverse of
/// [`split_chunks`].
pub fn join_chunks(chunks: &[Vec<u8>]) -> Vec<u8> {
    let total = chunks.iter().map(|c| c.len()).sum();
    let mut out = Vec::with_capacity(total);
    for c in chunks {
        out.extend_from_slice(c);
    }
    out
}

/// Verify the caller owns (or shares) the workbook; returns `NotFound` otherwise. Sharing checks
/// extend here once `members[]` lands (Superpower A).
pub async fn assert_workbook_access(
    mongo: &MongoHandle,
    workbook_id: ObjectId,
    user_id: ObjectId,
) -> Result<()> {
    let coll = mongo.collection::<Document>(WORKBOOK_COLL);
    let found = coll
        .find_one(doc! { "_id": workbook_id, "ownerUserId": user_id })
        .await
        .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.workbook_lookup"))?;
    if found.is_none() {
        return Err(ApiError::NotFound("workbook".to_owned()));
    }
    Ok(())
}

/// The persisted engine snapshot + the seq it was written at, if any.
pub struct EngineState {
    pub snapshot: Vec<u8>,
    pub seq: i64,
}

/// Load the latest engine snapshot for a workbook (None for a fresh workbook).
///
/// Transparently reassembles a chunked snapshot: when the state doc carries `chunked: true`, all
/// rows in `sabsheet_engine_chunks` for this workbook are read in `idx` order and concatenated.
/// Otherwise the inline `snapshot` Binary is returned (backward-compatible with pre-P3 docs).
pub async fn load_state(mongo: &MongoHandle, workbook_id: ObjectId) -> Result<Option<EngineState>> {
    let coll = mongo.collection::<Document>(STATE_COLL);
    let doc = coll
        .find_one(doc! { "workbookId": workbook_id })
        .await
        .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.load_state"))?;
    let Some(doc) = doc else { return Ok(None) };
    let seq = doc.get_i64("seq").unwrap_or(0);

    if doc.get_bool("chunked").unwrap_or(false) {
        let snapshot = load_chunks(mongo, workbook_id).await?;
        return Ok(Some(EngineState { snapshot, seq }));
    }

    let snapshot = match doc.get("snapshot") {
        Some(bson::Bson::Binary(b)) => b.bytes.clone(),
        _ => return Err(internal(anyhow::anyhow!("state.snapshot missing"), "sabsheet_ops.load_state")),
    };
    Ok(Some(EngineState { snapshot, seq }))
}

/// Read every chunk for a workbook ordered by `idx` and concatenate them into the full snapshot.
async fn load_chunks(mongo: &MongoHandle, workbook_id: ObjectId) -> Result<Vec<u8>> {
    use futures::TryStreamExt;
    let coll = mongo.collection::<Document>(CHUNKS_COLL);
    let mut cursor = coll
        .find(doc! { "workbookId": workbook_id })
        .sort(doc! { "idx": 1 })
        .await
        .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.load_chunks"))?;
    let mut chunks: Vec<Vec<u8>> = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.load_chunks.next"))?
    {
        match d.get("bytes") {
            Some(bson::Bson::Binary(b)) => chunks.push(b.bytes.clone()),
            _ => return Err(internal(anyhow::anyhow!("chunk.bytes missing"), "sabsheet_ops.load_chunks")),
        }
    }
    Ok(join_chunks(&chunks))
}

/// Upsert the engine snapshot at a new seq (authoritative state after apply).
///
/// Small snapshots (`<= CHUNK_THRESHOLD`) are stored inline in a single `snapshot` Binary field
/// (unchanged from P1). Large snapshots are split into `sabsheet_engine_chunks` rows and the state
/// doc records `{ chunked: true, chunkCount }` *without* an inline `snapshot`. When a workbook
/// switches representation, the now-unused side (old chunks or old inline field) is deleted so a
/// stale snapshot can never be reassembled.
pub async fn save_state(
    mongo: &MongoHandle,
    workbook_id: ObjectId,
    owner_user_id: ObjectId,
    snapshot: Vec<u8>,
    seq: i64,
) -> Result<()> {
    let coll = mongo.collection::<Document>(STATE_COLL);

    if snapshot.len() > CHUNK_THRESHOLD {
        // --- chunked path ---
        let chunks = split_chunks(&snapshot);
        let chunk_count = chunks.len() as i64;
        let chunk_coll = mongo.collection::<Document>(CHUNKS_COLL);

        // Replace the chunk set wholesale: clear any prior chunks, then write the new ones.
        chunk_coll
            .delete_many(doc! { "workbookId": workbook_id })
            .await
            .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.save_state.clear_chunks"))?;

        let docs: Vec<Document> = chunks
            .into_iter()
            .enumerate()
            .map(|(idx, bytes)| {
                doc! {
                    "workbookId": workbook_id,
                    "idx": idx as i64,
                    "bytes": Binary { subtype: BinarySubtype::Generic, bytes },
                }
            })
            .collect();
        if !docs.is_empty() {
            chunk_coll
                .insert_many(docs)
                .await
                .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.save_state.insert_chunks"))?;
        }

        coll.update_one(
            doc! { "workbookId": workbook_id },
            doc! {
                "$set": {
                    "workbookId": workbook_id,
                    "ownerUserId": owner_user_id,
                    "chunked": true,
                    "chunkCount": chunk_count,
                    "seq": seq,
                    "updatedAt": BsonDateTime::from_chrono(Utc::now()),
                },
                // Drop any stale inline representation from a previously-small snapshot.
                "$unset": { "snapshot": "" },
            },
        )
        .upsert(true)
        .await
        .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.save_state"))?;
        return Ok(());
    }

    // --- inline path (small snapshot) ---
    let bin = Binary { subtype: BinarySubtype::Generic, bytes: snapshot };
    coll.update_one(
        doc! { "workbookId": workbook_id },
        doc! {
            "$set": {
                "workbookId": workbook_id,
                "ownerUserId": owner_user_id,
                "snapshot": bin,
                "seq": seq,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            },
            // Clear any chunked-mode markers from a previously-large snapshot.
            "$unset": { "chunked": "", "chunkCount": "" },
        },
    )
    .upsert(true)
    .await
    .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.save_state"))?;

    // Delete now-unused chunks left over from a prior chunked representation.
    mongo
        .collection::<Document>(CHUNKS_COLL)
        .delete_many(doc! { "workbookId": workbook_id })
        .await
        .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.save_state.cleanup_chunks"))?;

    Ok(())
}

/// Append a batch to the op log. `diffs` is the bitcode diff blob from the engine (stored raw as
/// Binary); `commands_json` is the human-/audit-readable intent payload.
pub async fn append_op(
    mongo: &MongoHandle,
    workbook_id: ObjectId,
    user_id: ObjectId,
    seq: i64,
    diffs: &[u8],
    commands_json: bson::Bson,
    origin: &str,
) -> Result<()> {
    let coll = mongo.collection::<Document>(OPS_COLL);
    let bin = Binary { subtype: BinarySubtype::Generic, bytes: diffs.to_vec() };
    coll.insert_one(doc! {
        "workbookId": workbook_id,
        "seq": seq,
        "userId": user_id,
        "ts": BsonDateTime::from_chrono(Utc::now()),
        "diffs": bin,
        "commands": commands_json,
        "origin": origin,
    })
    .await
    .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.append_op"))?;
    Ok(())
}

/// Set the workbook's `schemaVersion` (used by the migration endpoint to mark a workbook as
/// migrated to the v2 engine representation).
pub async fn set_schema_version(
    mongo: &MongoHandle,
    workbook_id: ObjectId,
    version: i32,
) -> Result<()> {
    let coll = mongo.collection::<Document>(WORKBOOK_COLL);
    coll.update_one(
        doc! { "_id": workbook_id },
        doc! { "$set": { "schemaVersion": version } },
    )
    .await
    .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.set_schema_version"))?;
    Ok(())
}

/// Fetch op-log diff blobs strictly after `since` seq (for SSE/poll catch-up by other open tabs).
pub async fn ops_since(
    mongo: &MongoHandle,
    workbook_id: ObjectId,
    since: i64,
) -> Result<Vec<(i64, Vec<u8>)>> {
    use futures::TryStreamExt;
    let coll = mongo.collection::<Document>(OPS_COLL);
    let mut cursor = coll
        .find(doc! { "workbookId": workbook_id, "seq": { "$gt": since } })
        .sort(doc! { "seq": 1 })
        .await
        .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.ops_since"))?;
    let mut out = Vec::new();
    while let Some(doc) = cursor
        .try_next()
        .await
        .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.ops_since.next"))?
    {
        let seq = doc.get_i64("seq").unwrap_or(0);
        if let Some(bson::Bson::Binary(b)) = doc.get("diffs") {
            out.push((seq, b.bytes.clone()));
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_then_join_roundtrips_large_snapshot() {
        // Synthetic snapshot just over the 15 MB chunking threshold so it splits into multiple
        // ~8 MB chunks. Use a non-trivial byte pattern so a mis-ordered/dropped chunk is caught.
        let n = CHUNK_THRESHOLD + 1_000_000;
        let snapshot: Vec<u8> = (0..n).map(|i| (i % 251) as u8).collect();

        let chunks = split_chunks(&snapshot);
        // Expect ceil(n / CHUNK_SIZE) chunks, more than one.
        let expected = n.div_ceil(CHUNK_SIZE);
        assert_eq!(chunks.len(), expected);
        assert!(chunks.len() > 1, "snapshot over threshold must split into >1 chunk");
        // Every chunk except possibly the last is exactly CHUNK_SIZE.
        for c in &chunks[..chunks.len() - 1] {
            assert_eq!(c.len(), CHUNK_SIZE);
        }
        assert!(chunks.last().unwrap().len() <= CHUNK_SIZE);

        let rejoined = join_chunks(&chunks);
        assert_eq!(rejoined.len(), snapshot.len());
        assert_eq!(rejoined, snapshot);
    }

    #[test]
    fn small_snapshot_stays_single_chunk() {
        let snapshot: Vec<u8> = vec![7u8; 1024];
        let chunks = split_chunks(&snapshot);
        assert_eq!(chunks.len(), 1);
        assert_eq!(join_chunks(&chunks), snapshot);
        // And it is under the inline threshold, so save_state would keep it inline.
        assert!(snapshot.len() <= CHUNK_THRESHOLD);
    }

    #[test]
    fn empty_snapshot_joins_back_to_empty() {
        let chunks = split_chunks(&[]);
        assert!(chunks.is_empty());
        assert_eq!(join_chunks(&chunks), Vec::<u8>::new());
    }
}
