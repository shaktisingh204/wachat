//! wasm-bindgen façade over [`sabsheet_engine::SabEngine`] for the client-side calc worker.
//!
//! The worker (`src/workers/sabsheet/calc.worker.ts`) loads the `.wasm` produced by
//! `scripts/build-sabsheet-wasm.sh` and drives this class. Commands and viewport results cross the
//! JS boundary as JSON (`serde-wasm-bindgen`); diff blobs cross as `Uint8Array` (`Vec<u8>`).

use sabsheet_engine::ops::{Command, RangeRef};
use sabsheet_engine::SabEngine;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmEngine {
    inner: SabEngine,
}

#[wasm_bindgen]
impl WasmEngine {
    /// Create an empty workbook.
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str) -> Result<WasmEngine, String> {
        Ok(WasmEngine { inner: SabEngine::new(name)? })
    }

    /// Rehydrate from a `to_snapshot` blob.
    #[wasm_bindgen(js_name = fromSnapshot)]
    pub fn from_snapshot(bytes: &[u8]) -> Result<WasmEngine, String> {
        Ok(WasmEngine { inner: SabEngine::from_snapshot(bytes)? })
    }

    /// Full-workbook snapshot bytes.
    #[wasm_bindgen(js_name = toSnapshot)]
    pub fn to_snapshot(&self) -> Vec<u8> {
        self.inner.to_snapshot()
    }

    /// Apply a batch of commands (JSON array of `Command`); returns the resulting diff blob to
    /// persist + broadcast.
    #[wasm_bindgen(js_name = apply)]
    pub fn apply(&mut self, commands_json: JsValue) -> Result<Vec<u8>, String> {
        let commands: Vec<Command> =
            serde_wasm_bindgen::from_value(commands_json).map_err(|e| e.to_string())?;
        self.inner.apply(&commands)
    }

    /// Apply remote diff bytes (collab / server replay).
    #[wasm_bindgen(js_name = applyRemoteDiffs)]
    pub fn apply_remote_diffs(&mut self, diffs: &[u8]) -> Result<(), String> {
        self.inner.apply_remote_diffs(diffs)
    }

    #[wasm_bindgen(js_name = undo)]
    pub fn undo(&mut self) -> Result<(), String> {
        self.inner.undo()
    }

    #[wasm_bindgen(js_name = redo)]
    pub fn redo(&mut self) -> Result<(), String> {
        self.inner.redo()
    }

    #[wasm_bindgen(js_name = canUndo)]
    pub fn can_undo(&self) -> bool {
        self.inner.can_undo()
    }

    #[wasm_bindgen(js_name = canRedo)]
    pub fn can_redo(&self) -> bool {
        self.inner.can_redo()
    }

    /// Formatted display string for a single cell.
    #[wasm_bindgen(js_name = formatted)]
    pub fn formatted(&self, sheet: u32, row: i32, col: i32) -> Result<String, String> {
        self.inner.formatted(sheet, row, col)
    }

    /// Raw content (`=formula` or literal) for the formula bar.
    #[wasm_bindgen(js_name = content)]
    pub fn content(&self, sheet: u32, row: i32, col: i32) -> Result<String, String> {
        self.inner.content(sheet, row, col)
    }

    /// Read a viewport rectangle; returns a JSON array of `CellView`.
    #[wasm_bindgen(js_name = readViewport)]
    pub fn read_viewport(
        &self,
        sheet: u32,
        row: i32,
        col: i32,
        width: i32,
        height: i32,
    ) -> Result<JsValue, String> {
        let cells = self
            .inner
            .read_viewport(RangeRef { sheet, row, col, width, height })?;
        serde_wasm_bindgen::to_value(&cells).map_err(|e| e.to_string())
    }

    #[wasm_bindgen(js_name = sheetCount)]
    pub fn sheet_count(&self) -> usize {
        self.inner.sheet_count()
    }

    /// Ordered worksheet metadata as a JSON array of `SheetInfo`.
    #[wasm_bindgen(js_name = sheetList)]
    pub fn sheet_list(&self) -> Result<JsValue, String> {
        serde_wasm_bindgen::to_value(&self.inner.sheet_list()).map_err(|e| e.to_string())
    }
}
