/**
 * SabSheet realtime transport interface.
 *
 * The grid talks to *some* live channel — WebSocket / SSE / OT server — for
 * cell edits + presence. We don't have an OT/CRDT layer yet, so the actual
 * implementation is stubbed (see {@link MockTransport}), but every consumer
 * goes through this interface so we can swap in the real transport later
 * without touching the UI.
 *
 * Public surface kept intentionally tiny:
 *
 *   - connect(workbookId)   open the channel for a workbook
 *   - disconnect()          tear down
 *   - sendCellEdit(args)    fire a cell-set event over the wire
 *   - subscribeCellEdits()  inbound cell-set events from peers
 *   - setSelection(args)    publish my cursor / selection
 *   - subscribePresence()   inbound presence updates from peers
 */

export interface SabsheetCellEditEvent {
  workbookId: string;
  sheetId: string;
  row: number;
  col: number;
  /** Raw user input (starts with `=` for a formula). `null` clears. */
  valueOrFormula: string | null;
  /** User id that authored the edit. */
  userId: string;
  /** Client-generated UTC ISO timestamp. */
  ts: string;
}

export interface SabsheetPresenceEvent {
  workbookId: string;
  sheetId: string;
  userId: string;
  selection: {
    row: number;
    col: number;
    anchorRow: number;
    anchorCol: number;
  };
  color: string;
  ts: string;
}

export type SabsheetCellEditHandler = (e: SabsheetCellEditEvent) => void;
export type SabsheetPresenceHandler = (e: SabsheetPresenceEvent) => void;
export type Unsubscribe = () => void;

export interface ISheetTransport {
  /** Open the live channel for a workbook. Idempotent. */
  connect(workbookId: string): Promise<void> | void;

  /** Tear down. Subscribers stop receiving events after this returns. */
  disconnect(): Promise<void> | void;

  /** Broadcast a cell edit. */
  sendCellEdit(args: SabsheetCellEditEvent): Promise<void> | void;

  /** Subscribe to inbound cell edits from other clients. */
  subscribeCellEdits(handler: SabsheetCellEditHandler): Unsubscribe;

  /** Publish my current selection / cursor. */
  setSelection(args: SabsheetPresenceEvent): Promise<void> | void;

  /** Subscribe to presence updates from other clients. */
  subscribePresence(handler: SabsheetPresenceHandler): Unsubscribe;
}

/**
 * Default development transport. Polls server actions on an interval until
 * a real OT/CRDT channel is shipped.
 *
 * TODO(realtime): replace with a WebSocket / SSE adapter that hooks into a
 * future `sabsheet-realtime` Rust crate. The interface above MUST stay
 * stable so the UI doesn't change.
 */
export class MockTransport implements ISheetTransport {
  private workbookId: string | null = null;
  private cellEditHandlers = new Set<SabsheetCellEditHandler>();
  private presenceHandlers = new Set<SabsheetPresenceHandler>();
  // BroadcastChannel lets us at least sync between tabs of the same user
  // during local dev.
  private channel: BroadcastChannel | null = null;

  connect(workbookId: string): void {
    this.workbookId = workbookId;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const ch = new BroadcastChannel(`sabsheet:${workbookId}`);
      ch.onmessage = (msg) => {
        const payload = msg.data as
          | { kind: 'cell-edit'; data: SabsheetCellEditEvent }
          | { kind: 'presence'; data: SabsheetPresenceEvent };
        if (payload.kind === 'cell-edit') {
          this.cellEditHandlers.forEach((h) => h(payload.data));
        } else if (payload.kind === 'presence') {
          this.presenceHandlers.forEach((h) => h(payload.data));
        }
      };
      this.channel = ch;
    }
  }

  disconnect(): void {
    this.channel?.close();
    this.channel = null;
    this.workbookId = null;
    this.cellEditHandlers.clear();
    this.presenceHandlers.clear();
  }

  sendCellEdit(args: SabsheetCellEditEvent): void {
    this.channel?.postMessage({ kind: 'cell-edit', data: args });
  }

  subscribeCellEdits(handler: SabsheetCellEditHandler): Unsubscribe {
    this.cellEditHandlers.add(handler);
    return () => this.cellEditHandlers.delete(handler);
  }

  setSelection(args: SabsheetPresenceEvent): void {
    this.channel?.postMessage({ kind: 'presence', data: args });
  }

  subscribePresence(handler: SabsheetPresenceHandler): Unsubscribe {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }
}

let _defaultTransport: ISheetTransport | null = null;

/** Get the process-wide default transport (Mock in dev). */
export function getDefaultSheetTransport(): ISheetTransport {
  if (!_defaultTransport) {
    _defaultTransport = new MockTransport();
  }
  return _defaultTransport;
}
