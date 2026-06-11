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
use sabsheet_engine::ops::Command;
use tracing::instrument;

use crate::cache;
use crate::docs;
use crate::dto::{
    ApplyOpsInput, ApplyOpsResponse, ExportXlsxQuery, ExportXlsxResponse, ImportXlsxInput,
    ImportXlsxResponse, MigrateInput, MigrateResponse, OpEntry, OpsSinceQuery, OpsSinceResponse,
    SnapshotQuery, SnapshotResponse,
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
    // The engine never crosses an `.await`. We try to reuse a warm engine from the LRU cache
    // (only when its seq matches the state we just loaded); otherwise we rehydrate from snapshot.
    let new_seq = cur_seq + 1;
    let (new_snapshot, diffs) = {
        let mut engine = match cache::take(workbook_id, cur_seq) {
            Some(e) => e,
            None => match &state {
                Some(s) => SabEngine::from_snapshot(&s.snapshot).map_err(to_engine_err)?,
                None => SabEngine::new(&input.workbook_id).map_err(to_engine_err)?,
            },
        };
        let diffs = engine.apply(&input.commands).map_err(to_engine_err)?;
        let snapshot = engine.to_snapshot();
        // Return the freshly-advanced engine to the cache at its new seq for the next request.
        cache::put(workbook_id, new_seq, engine);
        (snapshot, diffs)
    };
    // --- end engine block ---

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
    let cur_seq = state.as_ref().map(|s| s.seq).unwrap_or(0);
    let to_engine_err =
        |e: String| ApiError::Internal(anyhow::anyhow!(e).context("sabsheet_ops.xlsx"));

    // Reuse a warm engine when its seq matches; export is read-only so we return it unchanged.
    let xlsx = {
        let engine = match cache::take(workbook_id, cur_seq) {
            Some(e) => e,
            None => match &state {
                Some(s) => SabEngine::from_snapshot(&s.snapshot).map_err(to_engine_err)?,
                None => SabEngine::new(&q.workbook_id).map_err(to_engine_err)?,
            },
        };
        let xlsx = engine.to_xlsx().map_err(to_engine_err)?;
        // Only re-cache when there is persisted state (a never-saved fresh workbook has seq 0 and
        // no authoritative snapshot to key against).
        if state.is_some() {
            cache::put(workbook_id, cur_seq, engine);
        }
        xlsx
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
    // The cached engine (if any) is now stale; drop it so the next request rehydrates the import.
    cache::invalidate(workbook_id);
    Ok(Json(ImportXlsxResponse { seq: new_seq }))
}

/// `POST /v1/sabsheet/ops/migrate` — rebuild a workbook from a sheet/cell intent payload (the
/// v1 -> v2 migration driver). Builds a fresh `SabEngine`, materializes every sheet's cells in one
/// paused-evaluation batch per sheet, persists the snapshot at seq=1, and marks the workbook
/// `schemaVersion = 2`.
///
/// Error policy: any cell the engine rejects (invalid row/col/input) fails the **whole** migration
/// with a `BadRequest` — migration is all-or-nothing so a partially-populated workbook is never
/// persisted. The error names the offending sheet/cell.
///
/// The engine is constructed, used, and dropped inside one synchronous block, so it never crosses an
/// `.await` (no `Send` bound needed); all Mongo I/O happens outside that block.
#[instrument(skip(mongo, input), fields(workbook = %input.workbook_id, sheets = input.sheets.len()))]
pub async fn migrate(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<MigrateInput>,
) -> Result<Json<MigrateResponse>> {
    let user_id = user_oid(&user)?;
    let workbook_id = oid_from_str(&input.workbook_id)?;
    docs::assert_workbook_access(&mongo, workbook_id, user_id).await?;

    let to_engine_err =
        |e: String| ApiError::Internal(anyhow::anyhow!(e).context("sabsheet_ops.migrate.engine"));

    // --- synchronous engine block: engine is constructed, used, and dropped here ---
    let (snapshot, cell_count) = {
        let mut engine = SabEngine::new(&input.workbook_id).map_err(to_engine_err)?;
        let mut total: i64 = 0;

        for (i, sheet) in input.sheets.iter().enumerate() {
            let sheet_idx = i as u32;
            // A fresh engine starts with exactly one sheet (index 0); add one per extra sheet.
            if i > 0 {
                engine
                    .apply(&[Command::NewSheet])
                    .map_err(to_engine_err)?;
            }
            // Name the sheet to match the source workbook.
            engine
                .apply(&[Command::RenameSheet { sheet: sheet_idx, name: sheet.name.clone() }])
                .map_err(|e| {
                    ApiError::BadRequest(format!("migrate: rename sheet {i} ({}): {e}", sheet.name))
                })?;

            // Apply all of this sheet's cells in ONE batch so evaluation is paused/bulk.
            let cmds: Vec<Command> = sheet
                .cells
                .iter()
                .map(|c| Command::SetCellInput {
                    sheet: sheet_idx,
                    row: c.row,
                    col: c.col,
                    input: c.input.clone(),
                })
                .collect();
            if !cmds.is_empty() {
                engine.apply(&cmds).map_err(|e| {
                    ApiError::BadRequest(format!(
                        "migrate: sheet {i} ({}) has an invalid cell: {e}",
                        sheet.name
                    ))
                })?;
                total += cmds.len() as i64;
            }
        }

        let snapshot = engine.to_snapshot();
        // Seed the LRU cache with the freshly-built engine at seq=1 so the first post-migration
        // edit/export reuses it instead of re-parsing the snapshot.
        cache::put(workbook_id, 1, engine);
        (snapshot, total)
    };
    // --- end engine block ---

    // Migration seeds a fresh authoritative state at seq=1.
    docs::save_state(&mongo, workbook_id, user_id, snapshot, 1).await?;
    docs::set_schema_version(&mongo, workbook_id, 2).await?;

    Ok(Json(MigrateResponse { seq: 1, cell_count }))
}
