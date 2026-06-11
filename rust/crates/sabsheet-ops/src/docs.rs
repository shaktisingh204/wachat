//! Mongo persistence for the authoritative engine state + op log.
//!
//! P1 skeleton: the whole workbook is persisted as one IronCalc snapshot blob in
//! `sabsheet_engine_state`, and every applied batch appends to `sabsheet_ops`. This is correct and
//! totally-ordered; the **P3 upgrade** swaps the single-snapshot store for block tiles
//! (`sabsheet_blocks`, 128×32) so viewport loads fetch only the visible tiles instead of the whole
//! workbook. The op-log shape and the apply path do not change in that upgrade.

use bson::{Binary, DateTime as BsonDateTime, Document, doc, oid::ObjectId, spec::BinarySubtype};
use chrono::Utc;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;

pub const STATE_COLL: &str = "sabsheet_engine_state";
pub const OPS_COLL: &str = "sabsheet_ops";
const WORKBOOK_COLL: &str = "sabsheet_workbooks";

fn internal(e: impl Into<anyhow::Error>, ctx: &'static str) -> ApiError {
    ApiError::Internal(e.into().context(ctx))
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
pub async fn load_state(mongo: &MongoHandle, workbook_id: ObjectId) -> Result<Option<EngineState>> {
    let coll = mongo.collection::<Document>(STATE_COLL);
    let doc = coll
        .find_one(doc! { "workbookId": workbook_id })
        .await
        .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.load_state"))?;
    let Some(doc) = doc else { return Ok(None) };
    let snapshot = match doc.get("snapshot") {
        Some(bson::Bson::Binary(b)) => b.bytes.clone(),
        _ => return Err(internal(anyhow::anyhow!("state.snapshot missing"), "sabsheet_ops.load_state")),
    };
    let seq = doc.get_i64("seq").unwrap_or(0);
    Ok(Some(EngineState { snapshot, seq }))
}

/// Upsert the engine snapshot at a new seq (authoritative state after apply).
pub async fn save_state(
    mongo: &MongoHandle,
    workbook_id: ObjectId,
    owner_user_id: ObjectId,
    snapshot: Vec<u8>,
    seq: i64,
) -> Result<()> {
    let coll = mongo.collection::<Document>(STATE_COLL);
    let bin = Binary { subtype: BinarySubtype::Generic, bytes: snapshot };
    coll.update_one(
        doc! { "workbookId": workbook_id },
        doc! { "$set": {
            "workbookId": workbook_id,
            "ownerUserId": owner_user_id,
            "snapshot": bin,
            "seq": seq,
            "updatedAt": BsonDateTime::from_chrono(Utc::now()),
        }},
    )
    .upsert(true)
    .await
    .map_err(|e| internal(anyhow::Error::new(e), "sabsheet_ops.save_state"))?;
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
