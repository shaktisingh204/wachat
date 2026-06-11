//! Canonical SabSheet command/op model.
//!
//! This is the **single source of truth** for the intent-based operations that flow through the
//! whole system: client edits -> `sabsheet_ops` log -> server authoritative apply -> (later) Yjs
//! collab relay. Every variant is position-addressed and intent-based (never "set absolute cell
//! list") so structural ops (insert/delete rows/cols) can be rebased server-side under concurrency.
//!
//! The TypeScript twin lives at `src/lib/sabsheet/commands/ops.ts` and MUST stay byte-compatible
//! with this serde representation (a round-trip test guards it). Serialization is a tagged union:
//! `{ "type": "setCellInput", "sheet": 0, "row": 1, "col": 1, "input": "=SUM(A1:A3)" }`.

use serde::{Deserialize, Serialize};

/// A rectangular range, mirroring IronCalc's `Area` (1-based row/column, 0-based sheet index).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct RangeRef {
    pub sheet: u32,
    pub row: i32,
    pub col: i32,
    pub width: i32,
    pub height: i32,
}

impl RangeRef {
    /// A single cell as a 1x1 range.
    pub fn cell(sheet: u32, row: i32, col: i32) -> Self {
        Self { sheet, row, col, width: 1, height: 1 }
    }
}

/// One intent-based operation. Applying a `Command` to the engine is exactly one logical undo step
/// contributor; a user gesture (toolbar click, paste) may produce a batch that is grouped as a
/// single undo transaction at the app layer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Command {
    /// Set the raw user input of a cell (value or `=formula`). Triggers recalc.
    #[serde(rename_all = "camelCase")]
    SetCellInput { sheet: u32, row: i32, col: i32, input: String },

    /// Clear cell contents (keep formatting) over a range.
    #[serde(rename_all = "camelCase")]
    ClearContents { range: RangeRef },

    /// Clear all (contents + formatting) over a range.
    #[serde(rename_all = "camelCase")]
    ClearAll { range: RangeRef },

    /// Apply one style attribute to a range, addressed by IronCalc's dotted style path
    /// (e.g. `"font.b"`=bold, `"font.color"`, `"fill.fg_color"`, `"num_fmt"`,
    /// `"alignment.horizontal"`) with its string value (e.g. `"true"`, `"#1a73e8"`, `"0.00%"`).
    /// A multi-attribute toolbar gesture emits one `SetStyle` per attribute, grouped into a single
    /// undo transaction at the app layer.
    #[serde(rename_all = "camelCase")]
    SetStyle { range: RangeRef, path: String, value: String },

    /// Insert `count` rows at `row` (1-based), shifting existing rows down.
    #[serde(rename_all = "camelCase")]
    InsertRows { sheet: u32, row: i32, count: i32 },

    /// Insert `count` columns at `col` (1-based), shifting existing columns right.
    #[serde(rename_all = "camelCase")]
    InsertColumns { sheet: u32, col: i32, count: i32 },

    /// Delete `count` rows starting at `row`.
    #[serde(rename_all = "camelCase")]
    DeleteRows { sheet: u32, row: i32, count: i32 },

    /// Delete `count` columns starting at `col`.
    #[serde(rename_all = "camelCase")]
    DeleteColumns { sheet: u32, col: i32, count: i32 },

    /// Set explicit heights for a row range (px).
    #[serde(rename_all = "camelCase")]
    SetRowHeight { sheet: u32, row: i32, count: i32, height: f64 },

    /// Set explicit widths for a column range (px).
    #[serde(rename_all = "camelCase")]
    SetColumnWidth { sheet: u32, col: i32, count: i32, width: f64 },

    /// Set the number of frozen rows for a sheet.
    #[serde(rename_all = "camelCase")]
    SetFrozenRows { sheet: u32, count: i32 },

    /// Set the number of frozen columns for a sheet.
    #[serde(rename_all = "camelCase")]
    SetFrozenColumns { sheet: u32, count: i32 },

    /// Fill the source area downward to `to_row` (auto-fill / fill handle; series detection in engine).
    #[serde(rename_all = "camelCase")]
    AutoFillRows { source: RangeRef, to_row: i32 },

    /// Fill the source area rightward to `to_col`.
    #[serde(rename_all = "camelCase")]
    AutoFillColumns { source: RangeRef, to_col: i32 },

    /// Paste a CSV/TSV string into a range (used by clipboard + connected-table landing).
    #[serde(rename_all = "camelCase")]
    PasteCsv { range: RangeRef, csv: String },

    /// Sort the rows of a range by one key column. `key_col_offset` is 0-based within the range.
    /// `has_header` keeps the first row pinned. (MVP sorts cell *content*; relative formula refs are
    /// not yet re-based — see the wrapper note.)
    #[serde(rename_all = "camelCase")]
    SortRange { range: RangeRef, key_col_offset: i32, ascending: bool, has_header: bool },

    /// Replace every occurrence of `find` with `replace` across a range; `match_case` toggles
    /// case-sensitivity. Operates on raw cell content (so `=A1` text is matched literally).
    #[serde(rename_all = "camelCase")]
    ReplaceAll { range: RangeRef, find: String, replace: String, match_case: bool },

    /// Add a new (empty) sheet at the end.
    NewSheet,

    /// Delete a sheet by index.
    #[serde(rename_all = "camelCase")]
    DeleteSheet { sheet: u32 },

    /// Rename a sheet.
    #[serde(rename_all = "camelCase")]
    RenameSheet { sheet: u32, name: String },

    /// Set a sheet's tab color (CSS hex, e.g. `#1a73e8`).
    #[serde(rename_all = "camelCase")]
    SetSheetColor { sheet: u32, color: String },

    /// Hide a sheet.
    #[serde(rename_all = "camelCase")]
    HideSheet { sheet: u32 },

    /// Unhide a sheet.
    #[serde(rename_all = "camelCase")]
    UnhideSheet { sheet: u32 },

    /// Toggle gridline rendering for a sheet.
    #[serde(rename_all = "camelCase")]
    SetShowGridLines { sheet: u32, show: bool },

    /// Create a defined name (named range). `scope` is `None` for workbook scope or a sheet index.
    #[serde(rename_all = "camelCase")]
    NewDefinedName { name: String, scope: Option<u32>, formula: String },

    /// Update a defined name's target/scope.
    #[serde(rename_all = "camelCase")]
    UpdateDefinedName {
        name: String,
        scope: Option<u32>,
        new_name: String,
        new_scope: Option<u32>,
        new_formula: String,
    },

    /// Delete a defined name.
    #[serde(rename_all = "camelCase")]
    DeleteDefinedName { name: String, scope: Option<u32> },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_cell_input_json_shape() {
        let c = Command::SetCellInput { sheet: 0, row: 1, col: 1, input: "=SUM(A1:A3)".into() };
        let j = serde_json::to_value(&c).unwrap();
        assert_eq!(j["type"], "setCellInput");
        assert_eq!(j["sheet"], 0);
        assert_eq!(j["row"], 1);
        assert_eq!(j["col"], 1);
        assert_eq!(j["input"], "=SUM(A1:A3)");
        // Round-trips back to the same command.
        let back: Command = serde_json::from_value(j).unwrap();
        assert_eq!(back, c);
    }

    #[test]
    fn range_op_json_shape() {
        let c = Command::ClearContents { range: RangeRef::cell(0, 2, 3) };
        let j = serde_json::to_value(&c).unwrap();
        assert_eq!(j["type"], "clearContents");
        assert_eq!(j["range"]["sheet"], 0);
        assert_eq!(j["range"]["row"], 2);
        assert_eq!(j["range"]["col"], 3);
        assert_eq!(j["range"]["width"], 1);
        assert_eq!(j["range"]["height"], 1);
    }

    #[test]
    fn unit_variant_shape() {
        let j = serde_json::to_value(&Command::NewSheet).unwrap();
        assert_eq!(j["type"], "newSheet");
    }

    #[test]
    fn defined_name_optional_scope() {
        let c = Command::NewDefinedName {
            name: "Revenue".into(),
            scope: None,
            formula: "Sheet1!$A$1:$A$10".into(),
        };
        let s = serde_json::to_string(&c).unwrap();
        let back: Command = serde_json::from_str(&s).unwrap();
        assert_eq!(back, c);
    }
}
