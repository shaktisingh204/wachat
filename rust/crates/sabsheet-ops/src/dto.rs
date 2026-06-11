//! Request/response payloads for `/v1/sabsheet/ops`.

use sabsheet_engine::ops::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyOpsInput {
    pub workbook_id: String,
    /// The seq the client based this batch on (optimistic concurrency). `None` = no expectation.
    #[serde(default)]
    pub base_seq: Option<i64>,
    /// The intent-based command batch (one undo step). Deserialized straight into the engine model.
    pub commands: Vec<Command>,
    /// Provenance: `ui` | `import` | `api` | `form` | `connection` | `ai`.
    #[serde(default)]
    pub origin: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyOpsResponse {
    /// New authoritative seq after this batch.
    pub seq: i64,
    /// The engine diff blob (bitcode) base64-encoded, for the client to replay locally / broadcast.
    pub diffs_b64: String,
    /// True when `base_seq` was stale and the client should refetch before retrying.
    pub rejected: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpsSinceQuery {
    pub workbook_id: String,
    #[serde(default)]
    pub since: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpsSinceResponse {
    pub ops: Vec<OpEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpEntry {
    pub seq: i64,
    pub diffs_b64: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotQuery {
    pub workbook_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotResponse {
    /// Current authoritative seq (0 for a never-persisted workbook).
    pub seq: i64,
    /// Full-workbook IronCalc snapshot, base64. Empty string when no state exists yet (open fresh).
    pub snapshot_b64: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportXlsxQuery {
    pub workbook_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportXlsxResponse {
    /// `.xlsx` file bytes, base64 (client builds a Blob download).
    pub xlsx_b64: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportXlsxInput {
    /// Target workbook to replace with the imported file's contents.
    pub workbook_id: String,
    pub name: String,
    pub xlsx_b64: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportXlsxResponse {
    /// New authoritative seq after the wholesale import-replace.
    pub seq: i64,
}

/// One cell in a migration payload: a position plus the raw user input (a formula starts with `=`,
/// otherwise a literal like `"42"` or `"hello"`).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrateCell {
    pub row: i32,
    pub col: i32,
    pub input: String,
}

/// One sheet in a migration payload: its display name and the cells to populate.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrateSheet {
    pub name: String,
    pub cells: Vec<MigrateCell>,
}

/// `POST /v1/sabsheet/ops/migrate` request: rebuild a workbook from sheet/cell intent payloads
/// (used by the v1 -> v2 migration driver).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrateInput {
    pub workbook_id: String,
    pub sheets: Vec<MigrateSheet>,
}

/// `POST /v1/sabsheet/ops/migrate` response.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrateResponse {
    /// Authoritative seq after migration (always 1 — migration seeds a fresh workbook).
    pub seq: i64,
    /// Total number of cells written across all sheets.
    pub cell_count: i64,
}
