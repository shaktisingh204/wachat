/**
 * RPC protocol between the main thread ([`worker-client.ts`]) and the calc worker
 * ([`src/workers/sabsheet/calc.worker.ts`]). One request → one response, correlated by `id`.
 *
 * Multi-second recalcs run in the worker so they never block canvas painting; the grid asks for
 * "viewport cells" and "apply this command batch → diff blob" and awaits the typed promise.
 */
import type { Command, CellView } from "../commands/ops.ts";

/** Display metadata for one worksheet — mirrors Rust `SheetInfo`. */
export interface SheetInfo {
  name: string;
  state: string;
  color: string | null;
}

export type EngineRequest =
  | { kind: "init"; name: string; snapshot: Uint8Array | null }
  | { kind: "apply"; commands: Command[] }
  | { kind: "applyRemoteDiffs"; diffs: Uint8Array }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "readViewport"; sheet: number; row: number; col: number; width: number; height: number }
  | { kind: "formatted"; sheet: number; row: number; col: number }
  | { kind: "content"; sheet: number; row: number; col: number }
  | { kind: "sheetList" }
  | { kind: "toSnapshot" }
  | { kind: "status" };

export interface EngineStatus {
  canUndo: boolean;
  canRedo: boolean;
  sheetCount: number;
}

export type EngineResult =
  | { kind: "init"; ok: true }
  | { kind: "apply"; diffs: Uint8Array; status: EngineStatus }
  | { kind: "applyRemoteDiffs"; ok: true }
  | { kind: "undo"; status: EngineStatus }
  | { kind: "redo"; status: EngineStatus }
  | { kind: "readViewport"; cells: CellView[] }
  | { kind: "formatted"; text: string }
  | { kind: "content"; text: string }
  | { kind: "sheetList"; sheets: SheetInfo[] }
  | { kind: "toSnapshot"; snapshot: Uint8Array }
  | { kind: "status"; status: EngineStatus };

/** Envelope main → worker. */
export interface RequestMessage {
  id: number;
  req: EngineRequest;
}

/** Envelope worker → main: either a typed result or an error string. */
export type ResponseMessage =
  | { id: number; ok: true; res: EngineResult }
  | { id: number; ok: false; error: string };

/** Shape of `/sabsheet-engine/manifest.json` emitted by build-sabsheet-wasm.sh. */
export interface WasmManifest {
  hash: string;
  dir: string;
  wasm: string;
  js: string;
  rawBytes: number;
  gzipBytes: number;
}
