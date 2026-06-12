/**
 * SabSheet client calc worker.
 *
 * Loads the wasm engine published by `scripts/build-sabsheet-wasm.sh` (discovered via
 * `/sabsheet-engine/manifest.json`) and drives a single `WasmEngine` per workbook. Runs off the main
 * thread so heavy recalcs never block canvas paint. Instantiated as a module worker by
 * `worker-client.ts`.
 *
 * The wasm glue is imported by runtime URL (from the manifest), so the bundler does not try to
 * resolve it at build time — the published folder is content-hashed and served from /public.
 */
import type {
  EngineStatus,
  RequestMessage,
  ResponseMessage,
  WasmManifest,
} from "../../lib/sabsheet/engine/protocol.ts";

// Minimal shape of the wasm-bindgen `WasmEngine` class (kept local to avoid importing the generated
// d.ts, which lives under the gitignored /public output).
interface WasmEngineLike {
  apply(commands: unknown): Uint8Array;
  applyRemoteDiffs(diffs: Uint8Array): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  formatted(sheet: number, row: number, col: number): string;
  content(sheet: number, row: number, col: number): string;
  readViewport(sheet: number, row: number, col: number, width: number, height: number): unknown;
  toSnapshot(): Uint8Array;
  sheetCount(): number;
  sheetList(): unknown;
  frozen(sheet: number): Int32Array;
}
interface WasmModule {
  default: (opts: { module_or_path: string }) => Promise<unknown>;
  WasmEngine: {
    new (name: string): WasmEngineLike;
    fromSnapshot(bytes: Uint8Array): WasmEngineLike;
    functionCatalog(): unknown;
  };
}

let mod: WasmModule | null = null;
let engine: WasmEngineLike | null = null;

async function loadModule(): Promise<WasmModule> {
  if (mod) return mod;
  const manifest = (await fetch("/sabsheet-engine/manifest.json", { cache: "force-cache" }).then(
    (r) => r.json(),
  )) as WasmManifest;
  // Runtime-URL dynamic import: the bundler can't see the target, so it stays a native import.
  const loaded = (await import(/* webpackIgnore: true */ manifest.js)) as unknown as WasmModule;
  await loaded.default({ module_or_path: manifest.wasm });
  mod = loaded;
  return loaded;
}

function status(): EngineStatus {
  const e = engine!;
  return { canUndo: e.canUndo(), canRedo: e.canRedo(), sheetCount: e.sheetCount() };
}

self.onmessage = async (ev: MessageEvent<RequestMessage>) => {
  const { id, req } = ev.data;
  try {
    const res = await dispatch(req);
    (self as unknown as Worker).postMessage({ id, ok: true, res } satisfies ResponseMessage);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    (self as unknown as Worker).postMessage({ id, ok: false, error } satisfies ResponseMessage);
  }
};

async function dispatch(req: RequestMessage["req"]): Promise<Extract<ResponseMessage, { ok: true }>["res"]> {
  switch (req.kind) {
    case "init": {
      const m = await loadModule();
      engine =
        req.snapshot && req.snapshot.byteLength > 0
          ? m.WasmEngine.fromSnapshot(req.snapshot)
          : new m.WasmEngine(req.name);
      return { kind: "init", ok: true };
    }
    case "apply": {
      const diffs = engine!.apply(req.commands);
      return { kind: "apply", diffs, status: status() };
    }
    case "applyRemoteDiffs": {
      engine!.applyRemoteDiffs(req.diffs);
      return { kind: "applyRemoteDiffs", ok: true };
    }
    case "undo": {
      engine!.undo();
      return { kind: "undo", status: status() };
    }
    case "redo": {
      engine!.redo();
      return { kind: "redo", status: status() };
    }
    case "readViewport": {
      const cells = engine!.readViewport(req.sheet, req.row, req.col, req.width, req.height) as never;
      return { kind: "readViewport", cells };
    }
    case "formatted": {
      return { kind: "formatted", text: engine!.formatted(req.sheet, req.row, req.col) };
    }
    case "content": {
      return { kind: "content", text: engine!.content(req.sheet, req.row, req.col) };
    }
    case "sheetList": {
      return { kind: "sheetList", sheets: engine!.sheetList() as never };
    }
    case "frozen": {
      const f = engine!.frozen(req.sheet);
      return { kind: "frozen", rows: f[0] ?? 0, cols: f[1] ?? 0 };
    }
    case "functionCatalog": {
      const m = await loadModule();
      return { kind: "functionCatalog", names: m.WasmEngine.functionCatalog() as never };
    }
    case "toSnapshot": {
      return { kind: "toSnapshot", snapshot: engine!.toSnapshot() };
    }
    case "status": {
      return { kind: "status", status: status() };
    }
  }
}
