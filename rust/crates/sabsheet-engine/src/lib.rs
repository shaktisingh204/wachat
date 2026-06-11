//! SabSheet v2 engine.
//!
//! A thin, framework-free wrapper around IronCalc's [`UserModel`] that speaks the canonical
//! [`ops::Command`] model. The same crate compiles **native** (server authoritative recalc, in the
//! `sabsheet-ops` crate) and **wasm32** (client Web Worker, via the `sabsheet-engine-wasm` façade).
//!
//! Sync model: every applied command is recorded by IronCalc into an internal send-queue of
//! bitcode-encoded diffs. [`SabEngine::flush_diffs`] drains that queue (persist to `sabsheet_ops` +
//! broadcast); a remote engine replays them with [`SabEngine::apply_remote_diffs`]. This is the
//! op-log / collab transport — no separate operational-transform layer is needed because the engine
//! recalculates deterministically from identical inputs on every peer.

pub mod ops;

use ironcalc_base::UserModel;
use ironcalc_base::expressions::types::Area;
use ironcalc_base::types::{HorizontalAlignment, Style};
use ops::{Command, RangeRef};

const LANGUAGE: &str = "en";
const LOCALE: &str = "en";
const TIMEZONE: &str = "UTC";

fn area(r: RangeRef) -> Area {
    Area { sheet: r.sheet, row: r.row, column: r.col, width: r.width, height: r.height }
}

/// A single SabSheet workbook engine instance.
pub struct SabEngine {
    model: UserModel<'static>,
}

/// One materialized cell for viewport reads: the formatted display string plus whether it holds a
/// formula (so the grid can show the fx indicator / the formula bar can show the source).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CellView {
    pub row: i32,
    pub col: i32,
    pub text: String,
    pub formula: Option<String>,
    /// Cell style, mapped from IronCalc's `Style` (only set when non-default). These let the canvas
    /// renderer paint formatting that today only persists + exports to xlsx.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub italic: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub underline: Option<bool>,
    /// CSS hex text color (`font.color`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// CSS hex background (`fill.fg_color`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fill: Option<String>,
    /// Horizontal alignment: `"left"` / `"center"` / `"right"` (general/None omitted).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub align: Option<String>,
}

/// Display metadata for one worksheet (the order is the command sheet index).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SheetInfo {
    pub name: String,
    /// `"visible"` or `"hidden"`.
    pub state: String,
    pub color: Option<String>,
}

impl SabEngine {
    /// Create an empty single-sheet workbook.
    pub fn new(name: &str) -> Result<Self, String> {
        let model = UserModel::new_empty(
            // UserModel borrows the language id for `'a`; we only ever use the static "en".
            leak_name(name),
            LOCALE,
            TIMEZONE,
            LANGUAGE,
        )?;
        Ok(Self { model })
    }

    /// Rehydrate from a snapshot produced by [`SabEngine::to_snapshot`].
    pub fn from_snapshot(bytes: &[u8]) -> Result<Self, String> {
        let model = UserModel::from_bytes(bytes, LANGUAGE)?;
        Ok(Self { model })
    }

    /// Serialize the full workbook (version-history snapshot / cold-start payload).
    pub fn to_snapshot(&self) -> Vec<u8> {
        self.model.to_bytes()
    }

    /// Apply a batch of commands as one logical step, then drain and return the resulting diff bytes
    /// (the op-log delta to persist + broadcast). An empty batch returns the currently-queued diffs.
    ///
    /// IronCalc's `set_user_input` recalculates after **every** cell, so applying a large batch
    /// naively is O(N²) (a 50k-formula bulk load measured ~11 min). For multi-command batches we
    /// pause evaluation, apply all inputs, then recalc once — turning bulk load into O(N) + a single
    /// dependency-graph pass. The flushed diffs carry user inputs (computed values are derived), so
    /// pausing does not change the op-log payload.
    pub fn apply(&mut self, commands: &[Command]) -> Result<Vec<u8>, String> {
        let bulk = commands.len() > 1;
        if bulk {
            self.model.pause_evaluation();
        }
        let mut err = None;
        for c in commands {
            if let Err(e) = self.apply_one(c) {
                err = Some(e);
                break;
            }
        }
        if bulk {
            self.model.resume_evaluation();
            self.model.evaluate();
        }
        if let Some(e) = err {
            return Err(e);
        }
        Ok(self.flush_diffs())
    }

    /// Apply a single command (no flush). Most callers want [`SabEngine::apply`].
    pub fn apply_one(&mut self, c: &Command) -> Result<(), String> {
        match c {
            Command::SetCellInput { sheet, row, col, input } => {
                self.model.set_user_input(*sheet, *row, *col, input)
            }
            Command::ClearContents { range } => self.model.range_clear_contents(&area(*range)),
            Command::ClearAll { range } => self.model.range_clear_all(&area(*range)),
            Command::SetStyle { range, path, value } => {
                self.model.update_range_style(&area(*range), path, value)
            }
            Command::InsertRows { sheet, row, count } => {
                self.model.insert_rows(*sheet, *row, *count)
            }
            Command::InsertColumns { sheet, col, count } => {
                self.model.insert_columns(*sheet, *col, *count)
            }
            Command::DeleteRows { sheet, row, count } => {
                self.model.delete_rows(*sheet, *row, *count)
            }
            Command::DeleteColumns { sheet, col, count } => {
                self.model.delete_columns(*sheet, *col, *count)
            }
            Command::SetRowHeight { sheet, row, count, height } => {
                self.model.set_rows_height(*sheet, *row, *row + *count - 1, *height)
            }
            Command::SetColumnWidth { sheet, col, count, width } => {
                self.model.set_columns_width(*sheet, *col, *col + *count - 1, *width)
            }
            Command::SetFrozenRows { sheet, count } => {
                self.model.set_frozen_rows_count(*sheet, *count)
            }
            Command::SetFrozenColumns { sheet, count } => {
                self.model.set_frozen_columns_count(*sheet, *count)
            }
            Command::AutoFillRows { source, to_row } => {
                self.model.auto_fill_rows(&area(*source), *to_row)
            }
            Command::AutoFillColumns { source, to_col } => {
                self.model.auto_fill_columns(&area(*source), *to_col)
            }
            Command::PasteCsv { range, csv } => self.model.paste_csv_string(&area(*range), csv),
            Command::SortRange { range, key_col_offset, ascending, has_header } => {
                self.sort_range(*range, *key_col_offset, *ascending, *has_header)
            }
            Command::ReplaceAll { range, find, replace, match_case } => {
                self.replace_all(*range, find, replace, *match_case).map(|_| ())
            }
            Command::NewSheet => self.model.new_sheet(),
            Command::DeleteSheet { sheet } => self.model.delete_sheet(*sheet),
            Command::RenameSheet { sheet, name } => self.model.rename_sheet(*sheet, name),
            Command::SetSheetColor { sheet, color } => self.model.set_sheet_color(*sheet, color),
            Command::HideSheet { sheet } => self.model.hide_sheet(*sheet),
            Command::UnhideSheet { sheet } => self.model.unhide_sheet(*sheet),
            Command::SetShowGridLines { sheet, show } => {
                self.model.set_show_grid_lines(*sheet, *show)
            }
            Command::NewDefinedName { name, scope, formula } => {
                self.model.new_defined_name(name, *scope, formula)
            }
            Command::UpdateDefinedName { name, scope, new_name, new_scope, new_formula } => self
                .model
                .update_defined_name(name, *scope, new_name, *new_scope, new_formula),
            Command::DeleteDefinedName { name, scope } => {
                self.model.delete_defined_name(name, *scope)
            }
        }
    }

    /// Drain IronCalc's internal diff send-queue (bitcode-encoded `Vec<QueueDiffs>`).
    pub fn flush_diffs(&mut self) -> Vec<u8> {
        self.model.flush_send_queue()
    }

    /// Apply remote diff bytes from another engine (collab / server replay).
    pub fn apply_remote_diffs(&mut self, diffs: &[u8]) -> Result<(), String> {
        self.model.apply_external_diffs(diffs)
    }

    pub fn undo(&mut self) -> Result<(), String> {
        self.model.undo()
    }

    pub fn redo(&mut self) -> Result<(), String> {
        self.model.redo()
    }

    pub fn can_undo(&self) -> bool {
        self.model.can_undo()
    }

    pub fn can_redo(&self) -> bool {
        self.model.can_redo()
    }

    /// Formatted display string for a single cell (what the grid paints).
    pub fn formatted(&self, sheet: u32, row: i32, col: i32) -> Result<String, String> {
        self.model.get_formatted_cell_value(sheet, row, col)
    }

    /// Raw cell content (`=formula` or literal) for the formula bar.
    pub fn content(&self, sheet: u32, row: i32, col: i32) -> Result<String, String> {
        self.model.get_cell_content(sheet, row, col)
    }

    /// Read a rectangular viewport as materialized [`CellView`]s, skipping blanks. This is the hot
    /// path the calc worker answers for the canvas renderer.
    pub fn read_viewport(&self, r: RangeRef) -> Result<Vec<CellView>, String> {
        let mut out = Vec::new();
        for row in r.row..r.row + r.height {
            for col in r.col..r.col + r.width {
                let text = self.model.get_formatted_cell_value(r.sheet, row, col)?;
                if text.is_empty() {
                    continue;
                }
                let raw = self.model.get_cell_content(r.sheet, row, col)?;
                let formula = raw.strip_prefix('=').map(|_| raw.clone());
                let mut view = CellView {
                    row,
                    col,
                    text,
                    formula,
                    bold: None,
                    italic: None,
                    underline: None,
                    color: None,
                    fill: None,
                    align: None,
                };
                // A style read failure must not fail the whole viewport — just paint plain.
                if let Ok(style) = self.model.get_cell_style(r.sheet, row, col) {
                    apply_style(&mut view, &style);
                }
                out.push(view);
            }
        }
        Ok(out)
    }

    /// Number of sheets and their display properties (name, color, hidden, frozen panes).
    pub fn sheet_count(&self) -> usize {
        self.model.get_worksheets_properties().len()
    }

    /// Frozen pane counts for a sheet: `(frozen_rows, frozen_columns)`.
    pub fn frozen(&self, sheet: u32) -> (i32, i32) {
        let r = self.model.get_frozen_rows_count(sheet).unwrap_or(0);
        let c = self.model.get_frozen_columns_count(sheet).unwrap_or(0);
        (r, c)
    }

    /// Ordered worksheet metadata; the index in this list is the command `sheet` index.
    pub fn sheet_list(&self) -> Vec<SheetInfo> {
        self.model
            .get_worksheets_properties()
            .into_iter()
            .map(|p| SheetInfo { name: p.name, state: p.state, color: p.color })
            .collect()
    }

    /// Sort the rows of a range by one key column (0-based offset within the range). Reads raw cell
    /// content, sorts (numbers before text, blanks last), and writes back with evaluation paused so a
    /// large sort is a single recalc. Caveat: relative formula references move as text and are not yet
    /// re-based — fine for data tables; formula-heavy sorts are a P6 follow-up.
    fn sort_range(
        &mut self,
        r: RangeRef,
        key_col_offset: i32,
        ascending: bool,
        has_header: bool,
    ) -> Result<(), String> {
        if key_col_offset < 0 || key_col_offset >= r.width {
            return Err("sort key column out of range".into());
        }
        let first = if has_header { r.row + 1 } else { r.row };
        let last = r.row + r.height - 1;
        if first > last {
            return Ok(());
        }
        let key = key_col_offset as usize;

        let mut rows: Vec<Vec<String>> = Vec::new();
        for row in first..=last {
            let mut cells = Vec::with_capacity(r.width as usize);
            for col in r.col..r.col + r.width {
                cells.push(self.model.get_cell_content(r.sheet, row, col)?);
            }
            rows.push(cells);
        }

        rows.sort_by(|a, b| cmp_cell(&a[key], &b[key]));
        if !ascending {
            rows.reverse();
        }

        self.model.pause_evaluation();
        for (i, cells) in rows.iter().enumerate() {
            let row = first + i as i32;
            for (j, val) in cells.iter().enumerate() {
                self.model
                    .set_user_input(r.sheet, row, r.col + j as i32, val)?;
            }
        }
        self.model.resume_evaluation();
        self.model.evaluate();
        Ok(())
    }

    /// Replace `find` with `replace` across a range's raw content. Returns the number of cells changed.
    fn replace_all(
        &mut self,
        r: RangeRef,
        find: &str,
        replace: &str,
        match_case: bool,
    ) -> Result<u32, String> {
        if find.is_empty() {
            return Ok(0);
        }
        let mut count = 0u32;
        self.model.pause_evaluation();
        for row in r.row..r.row + r.height {
            for col in r.col..r.col + r.width {
                let content = self.model.get_cell_content(r.sheet, row, col)?;
                if content.is_empty() {
                    continue;
                }
                let next = if match_case {
                    content.replace(find, replace)
                } else {
                    replace_case_insensitive(&content, find, replace)
                };
                if next != content {
                    self.model.set_user_input(r.sheet, row, col, &next)?;
                    count += 1;
                }
            }
        }
        self.model.resume_evaluation();
        self.model.evaluate();
        Ok(count)
    }

    /// Serialize the workbook to `.xlsx` bytes (server-only; requires the `xlsx` feature).
    #[cfg(feature = "xlsx")]
    pub fn to_xlsx(&self) -> Result<Vec<u8>, String> {
        use std::io::Cursor;
        let model = self.model.get_model();
        let cursor = Cursor::new(Vec::new());
        let out = ironcalc::export::save_xlsx_to_writer(model, cursor)
            .map_err(|e| format!("xlsx export: {e:?}"))?;
        Ok(out.into_inner())
    }

    /// Build an engine from `.xlsx` bytes (server-only; requires the `xlsx` feature).
    #[cfg(feature = "xlsx")]
    pub fn from_xlsx(bytes: &[u8], name: &str) -> Result<Self, String> {
        use ironcalc_base::Model;
        let workbook = ironcalc::import::load_from_xlsx_bytes(bytes, name, LOCALE, TIMEZONE)
            .map_err(|e| format!("xlsx import: {e:?}"))?;
        let model = Model::from_workbook(workbook, LANGUAGE).map_err(|e| format!("xlsx model: {e:?}"))?;
        Ok(Self { model: UserModel::from_model(model) })
    }
}

/// Map an IronCalc [`Style`] onto a [`CellView`], setting only the non-default attributes the canvas
/// renderer cares about (bold/italic/underline, text color, fill, horizontal alignment). Anything at
/// its IronCalc default is left as `None` so plain cells serialize without style fields.
fn apply_style(view: &mut CellView, style: &Style) {
    let font = &style.font;
    if font.b {
        view.bold = Some(true);
    }
    if font.i {
        view.italic = Some(true);
    }
    if font.u {
        view.underline = Some(true);
    }
    if let Some(c) = &font.color {
        view.color = Some(c.clone());
    }
    // The ribbon sets the swatch via `fill.fg_color`, so that is the visible background.
    if let Some(bg) = &style.fill.fg_color {
        view.fill = Some(bg.clone());
    }
    if let Some(al) = &style.alignment {
        view.align = match al.horizontal {
            HorizontalAlignment::Left => Some("left".to_string()),
            HorizontalAlignment::Center | HorizontalAlignment::CenterContinuous => {
                Some("center".to_string())
            }
            HorizontalAlignment::Right => Some("right".to_string()),
            // General / Justify / Distributed / Fill: no explicit horizontal anchor to paint.
            _ => None,
        };
    }
}

/// Sort comparison: numeric cells order numerically and before text; blanks sort last.
fn cmp_cell(a: &str, b: &str) -> std::cmp::Ordering {
    use std::cmp::Ordering;
    let (ae, be) = (a.is_empty(), b.is_empty());
    if ae || be {
        return be.cmp(&ae); // non-empty before empty
    }
    match (a.parse::<f64>(), b.parse::<f64>()) {
        (Ok(x), Ok(y)) => x.partial_cmp(&y).unwrap_or(Ordering::Equal),
        (Ok(_), Err(_)) => Ordering::Less, // numbers before text
        (Err(_), Ok(_)) => Ordering::Greater,
        (Err(_), Err(_)) => a.cmp(b),
    }
}

/// Case-insensitive string replace (std `replace` is case-sensitive only). Char-based so it never
/// slices on a non-UTF-8 boundary.
fn replace_case_insensitive(haystack: &str, find: &str, replace: &str) -> String {
    let h: Vec<char> = haystack.chars().collect();
    let f: Vec<char> = find.chars().collect();
    if f.is_empty() {
        return haystack.to_string();
    }
    let mut out = String::with_capacity(haystack.len());
    let mut i = 0;
    while i < h.len() {
        if i + f.len() <= h.len() && (0..f.len()).all(|k| char_eq_ci(h[i + k], f[k])) {
            out.push_str(replace);
            i += f.len();
        } else {
            out.push(h[i]);
            i += 1;
        }
    }
    out
}

fn char_eq_ci(a: char, b: char) -> bool {
    a == b || a.to_lowercase().eq(b.to_lowercase())
}

/// `UserModel<'a>` borrows the workbook name for its lifetime. SabEngine is `'static`, so we leak the
/// name once at construction. Workbooks are long-lived (one engine per open workbook, LRU-evicted as
/// a whole), so this is a bounded, one-per-engine allocation — not a per-edit leak.
fn leak_name(name: &str) -> &'static str {
    Box::leak(name.to_string().into_boxed_str())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ops::Command;

    fn set(sheet: u32, row: i32, col: i32, input: &str) -> Command {
        Command::SetCellInput { sheet, row, col, input: input.to_string() }
    }

    #[test]
    fn apply_batch_and_recalc() {
        let mut e = SabEngine::new("t").unwrap();
        e.apply(&[
            set(0, 1, 1, "10"),
            set(0, 2, 1, "20"),
            set(0, 3, 1, "=SUM(A1:A2)"),
        ])
        .unwrap();
        assert_eq!(e.formatted(0, 3, 1).unwrap(), "30");
    }

    #[test]
    fn diffs_replay_into_peer() {
        let mut a = SabEngine::new("a").unwrap();
        let diffs = a.apply(&[set(0, 1, 1, "=1+1")]).unwrap();
        assert!(!diffs.is_empty());
        let mut b = SabEngine::new("b").unwrap();
        b.apply_remote_diffs(&diffs).unwrap();
        assert_eq!(b.formatted(0, 1, 1).unwrap(), a.formatted(0, 1, 1).unwrap());
    }

    #[test]
    fn snapshot_roundtrip() {
        let mut a = SabEngine::new("a").unwrap();
        a.apply(&[set(0, 1, 1, "=2*21")]).unwrap();
        let snap = a.to_snapshot();
        let b = SabEngine::from_snapshot(&snap).unwrap();
        assert_eq!(b.formatted(0, 1, 1).unwrap(), "42");
    }

    #[test]
    fn undo_redo() {
        let mut e = SabEngine::new("t").unwrap();
        e.apply(&[set(0, 1, 1, "1")]).unwrap();
        e.apply(&[set(0, 1, 1, "2")]).unwrap();
        assert_eq!(e.formatted(0, 1, 1).unwrap(), "2");
        e.undo().unwrap();
        assert_eq!(e.formatted(0, 1, 1).unwrap(), "1");
        e.redo().unwrap();
        assert_eq!(e.formatted(0, 1, 1).unwrap(), "2");
    }

    #[test]
    fn sort_range_numeric_and_text() {
        let mut e = SabEngine::new("t").unwrap();
        // Header + 3 data rows in A1:B4, sort by column B (offset 1) ascending.
        e.apply(&[
            set(0, 1, 1, "Name"),
            set(0, 1, 2, "Score"),
            set(0, 2, 1, "Alice"),
            set(0, 2, 2, "30"),
            set(0, 3, 1, "Bob"),
            set(0, 3, 2, "10"),
            set(0, 4, 1, "Cara"),
            set(0, 4, 2, "20"),
        ])
        .unwrap();
        e.apply(&[Command::SortRange {
            range: RangeRef { sheet: 0, row: 1, col: 1, width: 2, height: 4 },
            key_col_offset: 1,
            ascending: true,
            has_header: true,
        }])
        .unwrap();
        // Header pinned; data ordered by score 10,20,30.
        assert_eq!(e.formatted(0, 1, 1).unwrap(), "Name");
        assert_eq!(e.formatted(0, 2, 1).unwrap(), "Bob");
        assert_eq!(e.formatted(0, 3, 1).unwrap(), "Cara");
        assert_eq!(e.formatted(0, 4, 1).unwrap(), "Alice");
    }

    #[test]
    fn replace_all_case_insensitive() {
        let mut e = SabEngine::new("t").unwrap();
        e.apply(&[set(0, 1, 1, "Hello"), set(0, 2, 1, "HELLO world"), set(0, 3, 1, "nope")])
            .unwrap();
        e.apply(&[Command::ReplaceAll {
            range: RangeRef { sheet: 0, row: 1, col: 1, width: 1, height: 3 },
            find: "hello".into(),
            replace: "Hi".into(),
            match_case: false,
        }])
        .unwrap();
        assert_eq!(e.formatted(0, 1, 1).unwrap(), "Hi");
        assert_eq!(e.formatted(0, 2, 1).unwrap(), "Hi world");
        assert_eq!(e.formatted(0, 3, 1).unwrap(), "nope");
    }

    #[test]
    fn viewport_skips_blanks() {
        let mut e = SabEngine::new("t").unwrap();
        e.apply(&[set(0, 1, 1, "x"), set(0, 5, 3, "y")]).unwrap();
        let cells = e
            .read_viewport(RangeRef { sheet: 0, row: 1, col: 1, width: 10, height: 10 })
            .unwrap();
        assert_eq!(cells.len(), 2);
    }
}
