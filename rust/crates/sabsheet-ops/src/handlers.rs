//! HTTP handlers for the authoritative op-apply path.

use axum::{
    Json,
    extract::{Query, State},
};
use base64::{Engine as _, engine::general_purpose::STANDARD as B64};
use crm_common::tenant::user_oid;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use sabsheet_engine::SabEngine;
use tracing::instrument;

use crate::docs;
use crate::dto::{
    ApplyOpsInput, ApplyOpsResponse, ExportXlsxQuery, ExportXlsxResponse, ImportXlsxInput,
    ImportXlsxResponse, OpEntry, OpsSinceQuery, OpsSinceResponse, SnapshotQuery, SnapshotResponse,
};

/// `POST /v1/sabsheet/ops` — apply a command batch to the authoritative engine, persist the new
/// snapshot + op-log entry, and return the diff blob for the client to replay/broadcast.
///
/// The `SabEngine` is created and dropped entirely inside one synchronous block, so it never crosses
/// an `.await` — no `Send` bound on the engine is required, and Mongo I/O stays outside the borrow.
#[instrument(skip(mongo, input), fields(workbook = %input.workbook_id, n = input.commands.len()))]
pub async fn apply_ops(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<ApplyOpsInput>,
) -> Result<Json<ApplyOpsResponse>> {
    let user_id = user_oid(&user)?;
    let workbook_id = oid_from_str(&input.workbook_id)?;
    docs::assert_workbook_access(&mongo, workbook_id, user_id).await?;

    let state = docs::load_state(&mongo, workbook_id).await?;
    let cur_seq = state.as_ref().map(|s| s.seq).unwrap_or(0);

    // Optimistic concurrency: if the client based its batch on a stale seq, reject so it refetches.
    if let Some(base) = input.base_seq {
        if base != cur_seq {
            return Ok(Json(ApplyOpsResponse {
                seq: cur_seq,
                diffs_b64: String::new(),
                rejected: true,
            }));
        }
    }

    let to_engine_err =
        |e: String| ApiError::Internal(anyhow::anyhow!(e).context("sabsheet_ops.engine"));

    // --- synchronous engine block: engine is constructed, used, and dropped here ---
    let (new_snapshot, diffs) = {
        let mut engine = match &state {
            Some(s) => SabEngine::from_snapshot(&s.snapshot).map_err(to_engine_err)?,
            None => SabEngine::new(&input.workbook_id).map_err(to_engine_err)?,
        };
        let diffs = engine.apply(&input.commands).map_err(to_engine_err)?;
        (engine.to_snapshot(), diffs)
    };
    // --- end engine block ---

    let new_seq = cur_seq + 1;
    docs::save_state(&mongo, workbook_id, user_id, new_snapshot, new_seq).await?;

    let commands_json = bson::to_bson(&input.commands)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_ops.commands_bson")))?;
    let origin = input.origin.as_deref().unwrap_or("ui");
    docs::append_op(&mongo, workbook_id, user_id, new_seq, &diffs, commands_json, origin).await?;

    Ok(Json(ApplyOpsResponse {
        seq: new_seq,
        diffs_b64: B64.encode(&diffs),
        rejected: false,
    }))
}

/// `GET /v1/sabsheet/ops?workbookId=..&since=N` — diff blobs after `since` for tab catch-up.
#[instrument(skip(mongo, q), fields(workbook = %q.workbook_id, since = q.since))]
pub async fn ops_since(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<OpsSinceQuery>,
) -> Result<Json<OpsSinceResponse>> {
    let user_id = user_oid(&user)?;
    let workbook_id = oid_from_str(&q.workbook_id)?;
    docs::assert_workbook_access(&mongo, workbook_id, user_id).await?;

    let rows = docs::ops_since(&mongo, workbook_id, q.since).await?;
    let ops = rows
        .into_iter()
        .map(|(seq, diffs)| OpEntry { seq, diffs_b64: B64.encode(&diffs) })
        .collect();
    Ok(Json(OpsSinceResponse { ops }))
}

/// `GET /v1/sabsheet/ops/snapshot?workbookId=..` — the full-workbook snapshot for engine bootstrap.
#[instrument(skip(mongo, q), fields(workbook = %q.workbook_id))]
pub async fn get_snapshot(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<SnapshotQuery>,
) -> Result<Json<SnapshotResponse>> {
    let user_id = user_oid(&user)?;
    let workbook_id = oid_from_str(&q.workbook_id)?;
    docs::assert_workbook_access(&mongo, workbook_id, user_id).await?;

    match docs::load_state(&mongo, workbook_id).await? {
        Some(state) => Ok(Json(SnapshotResponse {
            seq: state.seq,
            snapshot_b64: B64.encode(&state.snapshot),
        })),
        None => Ok(Json(SnapshotResponse { seq: 0, snapshot_b64: String::new() })),
    }
}

/// `GET /v1/sabsheet/ops/export.xlsx?workbookId=..` — render the workbook to `.xlsx` (base64).
#[instrument(skip(mongo, q), fields(workbook = %q.workbook_id))]
pub async fn export_xlsx(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ExportXlsxQuery>,
) -> Result<Json<ExportXlsxResponse>> {
    let user_id = user_oid(&user)?;
    let workbook_id = oid_from_str(&q.workbook_id)?;
    docs::assert_workbook_access(&mongo, workbook_id, user_id).await?;

    let state = docs::load_state(&mongo, workbook_id).await?;
    let to_engine_err =
        |e: String| ApiError::Internal(anyhow::anyhow!(e).context("sabsheet_ops.xlsx"));

    let xlsx = {
        let engine = match &state {
            Some(s) => SabEngine::from_snapshot(&s.snapshot).map_err(to_engine_err)?,
            None => SabEngine::new(&q.workbook_id).map_err(to_engine_err)?,
        };
        engine.to_xlsx().map_err(to_engine_err)?
    };
    Ok(Json(ExportXlsxResponse { xlsx_b64: B64.encode(&xlsx) }))
}

/// `POST /v1/sabsheet/ops/import.xlsx` — replace a workbook's contents with an uploaded `.xlsx`.
#[instrument(skip(mongo, input), fields(workbook = %input.workbook_id))]
pub async fn import_xlsx(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<ImportXlsxInput>,
) -> Result<Json<ImportXlsxResponse>> {
    let user_id = user_oid(&user)?;
    let workbook_id = oid_from_str(&input.workbook_id)?;
    docs::assert_workbook_access(&mongo, workbook_id, user_id).await?;

    let bytes = B64
        .decode(input.xlsx_b64.as_bytes())
        .map_err(|e| ApiError::BadRequest(format!("invalid xlsx base64: {e}")))?;

    let cur_seq = docs::load_state(&mongo, workbook_id).await?.map(|s| s.seq).unwrap_or(0);
    let to_engine_err =
        |e: String| ApiError::Internal(anyhow::anyhow!(e).context("sabsheet_ops.xlsx_import"));

    let snapshot = {
        let engine = SabEngine::from_xlsx(&bytes, &input.name).map_err(to_engine_err)?;
        engine.to_snapshot()
    };

    // Wholesale replace: bump the seq so other tabs re-bootstrap on their next apply.
    let new_seq = cur_seq + 1;
    docs::save_state(&mongo, workbook_id, user_id, snapshot, new_seq).await?;
    Ok(Json(ImportXlsxResponse { seq: new_seq }))
}
