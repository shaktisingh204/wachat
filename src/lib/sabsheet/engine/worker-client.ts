/**
 * Main-thread client for the SabSheet calc worker.
 *
 * Spawns `src/workers/sabsheet/calc.worker.ts` as a module worker and exposes a typed, promise-based
 * API. The React grid holds one `CalcEngineClient` per open workbook and calls `apply` / `readViewport`
 * imperatively (no per-cell React nodes). All heavy work happens in the worker.
 */
import type { Command, CellView } from "../commands/ops.ts";
import type {
  EngineRequest,
  EngineResult,
  EngineStatus,
  RequestMessage,
  ResponseMessage,
  SheetInfo,
} from "./protocol.ts";

type Pending = { resolve: (res: EngineResult) => void; reject: (err: Error) => void };

export class CalcEngineClient {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<number, Pending>();
  private ready: Promise<void>;

  constructor() {
    this.worker = new Worker(new URL("../../../workers/sabsheet/calc.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (ev: MessageEvent<ResponseMessage>) => this.onMessage(ev.data);
    this.ready = Promise.resolve();
  }

  private onMessage(msg: ResponseMessage) {
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.res);
    else p.reject(new Error(msg.error));
  }

  private call(req: EngineRequest): Promise<EngineResult> {
    const id = ++this.seq;
    return new Promise<EngineResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, req } satisfies RequestMessage);
    });
  }

  /** Load the wasm and create the workbook (fresh, or from a snapshot blob). */
  async init(name: string, snapshot: Uint8Array | null = null): Promise<void> {
    this.ready = this.call({ kind: "init", name, snapshot }).then(() => undefined);
    return this.ready;
  }

  /** Apply a command batch (one undo step); returns the diff blob to persist + broadcast. */
  async apply(commands: Command[]): Promise<{ diffs: Uint8Array; status: EngineStatus }> {
    await this.ready;
    const res = await this.call({ kind: "apply", commands });
    if (res.kind !== "apply") throw new Error("unexpected result");
    return { diffs: res.diffs, status: res.status };
  }

  /** Replay remote diff bytes (collab / server) into the local engine. */
  async applyRemoteDiffs(diffs: Uint8Array): Promise<void> {
    await this.ready;
    await this.call({ kind: "applyRemoteDiffs", diffs });
  }

  async undo(): Promise<EngineStatus> {
    await this.ready;
    const res = await this.call({ kind: "undo" });
    if (res.kind !== "undo") throw new Error("unexpected result");
    return res.status;
  }

  async redo(): Promise<EngineStatus> {
    await this.ready;
    const res = await this.call({ kind: "redo" });
    if (res.kind !== "redo") throw new Error("unexpected result");
    return res.status;
  }

  /** Materialized cells for a viewport rectangle (blanks skipped) — the grid's hot read. */
  async readViewport(
    sheet: number,
    row: number,
    col: number,
    width: number,
    height: number,
  ): Promise<CellView[]> {
    await this.ready;
    const res = await this.call({ kind: "readViewport", sheet, row, col, width, height });
    if (res.kind !== "readViewport") throw new Error("unexpected result");
    return res.cells;
  }

  /** Raw `=formula`/literal for the formula bar. */
  async content(sheet: number, row: number, col: number): Promise<string> {
    await this.ready;
    const res = await this.call({ kind: "content", sheet, row, col });
    if (res.kind !== "content") throw new Error("unexpected result");
    return res.text;
  }

  /** Ordered worksheet metadata (index = command sheet index). */
  async sheetList(): Promise<SheetInfo[]> {
    await this.ready;
    const res = await this.call({ kind: "sheetList" });
    if (res.kind !== "sheetList") throw new Error("unexpected result");
    return res.sheets;
  }

  /** Frozen pane counts for a sheet. */
  async frozen(sheet: number): Promise<{ rows: number; cols: number }> {
    await this.ready;
    const res = await this.call({ kind: "frozen", sheet });
    if (res.kind !== "frozen") throw new Error("unexpected result");
    return { rows: res.rows, cols: res.cols };
  }

  /** Full-workbook snapshot (autosave / version history). */
  async toSnapshot(): Promise<Uint8Array> {
    await this.ready;
    const res = await this.call({ kind: "toSnapshot" });
    if (res.kind !== "toSnapshot") throw new Error("unexpected result");
    return res.snapshot;
  }

  destroy() {
    this.worker.terminate();
    this.pending.clear();
  }
}
