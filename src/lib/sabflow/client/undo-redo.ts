/**
 * SabFlow — CRDT-aware client undo/redo manager.
 *
 * Phase 5 sub-task 6 of the Track A real-time-collab plan. Replaces the
 * whole-document snapshot stack at
 * `src/components/sabflow/editor/EditorPage.tsx` (lines 67–102) with a
 * `Y.UndoManager`-backed manager scoped to the SabFlow doc shape:
 *
 *     doc.getArray('nodes')      // Y.Array<Y.Map>
 *     doc.getArray('edges')      // Y.Array<Y.Map>
 *     doc.getMap('viewport')     // Y.Map<{x,y,zoom}>
 *
 * Per ADR docs/adr/sabflow-state-management.md §3.2 we prefer Yjs's built-in
 * `UndoManager` over a hand-rolled history stack: it produces per-user undo
 * that survives concurrent remote operations (remote ops are NOT undoable),
 * coalesces bursts via `captureTimeout`, and integrates with the awareness
 * protocol later in Phase 7.
 *
 * Ownership: this file is the ONLY owner of the client-side undo manager.
 * Sibling Phase 5 modules (`useSabFlowDoc`, offline queue, optimistic apply,
 * schema-migration runner, telemetry) live in their own files.
 *
 * No `yjs` import here. The `YDocLike` / `YUndoManagerLike` interfaces below
 * forward-declare the shape we depend on, matching the pattern used by
 * `src/lib/sabflow/persistence/compaction.ts`. Sibling Phase 1 sub-task 5
 * picks the concrete library; wiring lands in a later sub-task that owns
 * the runtime factory.
 *
 * Track A · Phase 5 · sub-task #6 of 10.
 */

// -----------------------------------------------------------------------------
// Forward-declared Yjs contracts (sibling sub-tasks own the implementations)
// -----------------------------------------------------------------------------

/**
 * Opaque abstract type — what `Y.Doc#getArray` and `Y.Doc#getMap` return.
 * The `UndoManager` accepts either a single abstract type or an array of
 * them as its tracking scope. We only need the nominal-type witness here.
 */
export interface YAbstractTypeLike {
    /** Brand to keep the structural type from collapsing to `unknown`. */
    readonly _yAbstractType?: never;
}

/**
 * Minimal subset of `Y.Doc` we need: the two getters that produce the
 * shared types scoped by `SabFlowUndoManager`. We do NOT depend on the
 * full Y.Doc surface (transactions, observers, encoding) — that lives in
 * the doc-runtime sibling.
 */
export interface YDocLike {
    getArray(name: string): YAbstractTypeLike;
    getMap(name: string): YAbstractTypeLike;
}

/**
 * Constructor options for `Y.UndoManager`. Mirrors the upstream Yjs shape.
 *
 * - `trackedOrigins`: only transactions whose `origin` is `=== `-equal to a
 *   member of this set produce undo entries. Per Yjs semantics, any
 *   transaction whose origin is NOT in the set (eg. remote applies tagged
 *   `'from server'`) is silently skipped — that is exactly the property we
 *   want for collab.
 * - `captureTimeout`: merge multiple transactions into one undo step when
 *   they fire within this many ms. Defaults to 500 (Yjs default), matching
 *   the n8n "burst typing" feel without surprising the user.
 */
export interface YUndoManagerOptions {
    trackedOrigins?: Set<unknown>;
    captureTimeout?: number;
}

/** Yjs lifecycle event names emitted by `UndoManager`. */
export type YUndoManagerEvent =
    | 'stack-item-added'
    | 'stack-item-popped'
    | 'stack-cleared';

/**
 * Minimal `Y.UndoManager` surface we wrap. The real class has more (filters,
 * stack-item metadata, `addToScope`) — we only forward what `SabFlowUndoManager`
 * needs so a test double is trivial to write.
 */
export interface YUndoManagerLike {
    undo(): unknown;
    redo(): unknown;
    clear(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    on(event: YUndoManagerEvent, fn: () => void): void;
    off(event: YUndoManagerEvent, fn: () => void): void;
    destroy(): void;
    /**
     * Underlying push-down stacks. We read `length` to enforce the 100-entry
     * cap mandated by Phase 5 sub-task 6 (point 6).
     */
    readonly undoStack: { length: number; shift(): unknown };
    readonly redoStack: { length: number; shift(): unknown };
}

/**
 * Factory the consumer must supply. Keeps this module pure-TS and
 * `yjs`-free: callers either pass the upstream `Y.UndoManager` constructor
 * (`(scope, opts) => new Y.UndoManager(scope, opts)`) or a test double.
 * Sibling sub-task 5's chosen lib decides whether this is the JS Yjs
 * package or a `yrs`-wasm shim — the consumer wires it up.
 */
export type YUndoManagerFactory = (
    typeScope: YAbstractTypeLike[],
    options: YUndoManagerOptions,
) => YUndoManagerLike;

// -----------------------------------------------------------------------------
// Public configuration
// -----------------------------------------------------------------------------

/**
 * Sentinel origin tag for transactions produced by the local editor session.
 * Local writes that should be undoable MUST be wrapped in a transaction
 * whose `origin` is exactly this value. The doc-runtime sibling re-exports
 * this so all client writers share the same tag.
 *
 * Remote writes are tagged `'from server'` upstream — that string is NOT
 * in our default `trackedOrigins`, so remote ops are NOT undoable (matches
 * Yjs UndoManager semantics and the property we want for collab).
 */
export const SABFLOW_LOCAL_ORIGIN: unique symbol = Symbol.for(
    'sabflow.local.origin',
);

/**
 * Maximum number of entries kept on the undo *and* redo stacks. Yjs has no
 * native cap — without one a long editing session leaks memory. 100 entries
 * is the value spec'd by Phase 5 sub-task 6 (point 6) and matches the
 * "Cmd+Z 100 times" expectation users have from desktop editors.
 */
export const SABFLOW_UNDO_STACK_CAP = 100;

/** Default `captureTimeout` per spec — see {@link YUndoManagerOptions}. */
export const SABFLOW_DEFAULT_CAPTURE_TIMEOUT_MS = 500;

export interface SabFlowUndoManagerOptions {
    /**
     * Origins whose transactions count as undoable. Defaults to a
     * single-member set: `{ SABFLOW_LOCAL_ORIGIN }`. Pass a custom set to
     * also track, eg., a recipe-installer origin tag.
     */
    trackedOrigins?: Set<unknown>;
    /** See {@link YUndoManagerOptions.captureTimeout}. Defaults to 500 ms. */
    captureTimeout?: number;
    /** Factory for the underlying `Y.UndoManager` (DI seam — see module doc). */
    factory: YUndoManagerFactory;
}

/** Event names emitted by {@link SabFlowUndoManager}. */
export type SabFlowUndoEvent = 'stack-changed';

// -----------------------------------------------------------------------------
// SabFlowUndoManager
// -----------------------------------------------------------------------------

/**
 * Wraps `Y.UndoManager` for the SabFlow doc shape and adds three things the
 * raw Yjs API doesn't give us out of the box:
 *
 * 1. **Multi-type scope**: the UndoManager is bound to `nodes`, `edges`, AND
 *    `viewport` simultaneously, so a single Cmd+Z rolls back whichever of
 *    those last changed (matching the user's mental model of "undo my last
 *    move").
 * 2. **Hard 100-entry cap**: trims the oldest entry off `undoStack` /
 *    `redoStack` whenever they overflow.
 * 3. **Unified `'stack-changed'` event** plus a keyboard helper, so React
 *    components don't have to subscribe to three Yjs events.
 *
 * Note: the underlying `Y.UndoManager` already excludes remote-origin
 * transactions, so we get "remote writes (`from server`) NOT undoable"
 * for free.
 */
export class SabFlowUndoManager {
    private readonly um: YUndoManagerLike;
    private readonly listeners = new Set<() => void>();
    /** Bound handler kept on the instance so `off()` can detach the same fn. */
    private readonly onStackChange = (): void => {
        this.enforceCap();
        for (const fn of this.listeners) fn();
    };

    constructor(doc: YDocLike, options: SabFlowUndoManagerOptions) {
        const {
            factory,
            trackedOrigins = new Set<unknown>([SABFLOW_LOCAL_ORIGIN]),
            captureTimeout = SABFLOW_DEFAULT_CAPTURE_TIMEOUT_MS,
        } = options;

        // Doc shape per ADR §3 / Phase 6 sub-task: nodes + edges as
        // Y.Array, viewport as Y.Map. All three are siblings of the same
        // UndoManager so one Cmd+Z reverses whichever was most recent.
        const scope: YAbstractTypeLike[] = [
            doc.getArray('nodes'),
            doc.getArray('edges'),
            doc.getMap('viewport'),
        ];

        this.um = factory(scope, { trackedOrigins, captureTimeout });
        this.um.on('stack-item-added', this.onStackChange);
        this.um.on('stack-item-popped', this.onStackChange);
        this.um.on('stack-cleared', this.onStackChange);
    }

    /** Undo the last local transaction within the SabFlow tracked scope. */
    undo(): void {
        this.um.undo();
    }

    /** Redo the last undone local transaction. */
    redo(): void {
        this.um.redo();
    }

    /** Drop both undo and redo stacks; emits `'stack-changed'` once. */
    clear(): void {
        this.um.clear();
    }

    canUndo(): boolean {
        return this.um.canUndo();
    }

    canRedo(): boolean {
        return this.um.canRedo();
    }

    /**
     * Subscribe to stack-changed events. Returns an unsubscribe function so
     * React effects can clean up without juggling the original callback.
     */
    on(event: SabFlowUndoEvent, fn: () => void): () => void {
        if (event !== 'stack-changed') {
            // Future-proof: throw on unknown event so a typo is loud.
            throw new Error(
                `[sabflow.undo] unknown event "${String(event)}"`,
            );
        }
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    /** Detach all Yjs listeners and clear local listeners. */
    destroy(): void {
        this.um.off('stack-item-added', this.onStackChange);
        this.um.off('stack-item-popped', this.onStackChange);
        this.um.off('stack-cleared', this.onStackChange);
        this.um.destroy();
        this.listeners.clear();
    }

    /**
     * Attach Cmd/Ctrl+Z (undo) and Cmd/Ctrl+Shift+Z (redo) to `target`.
     * Returns a detach function. Default target is `window` — pass a DOM
     * element to scope the binding to just the editor surface.
     *
     * Handler ignores events whose target is an editable form control so
     * we don't hijack undo inside `<input>` / `<textarea>` / contenteditable
     * (where the browser's native undo is the right behaviour).
     */
    attachKeyboardShortcuts(target?: KeyboardShortcutTarget): () => void {
        const resolved =
            target ?? (typeof window !== 'undefined' ? window : undefined);
        if (!resolved) {
            // SSR / Node — nothing to attach to. Return a no-op detach so
            // callers don't have to guard.
            return () => undefined;
        }

        const handler = (rawEvent: Event): void => {
            const event = rawEvent as KeyboardEvent;
            // Cmd on macOS, Ctrl on Windows/Linux.
            const mod = event.metaKey || event.ctrlKey;
            if (!mod) return;
            if (event.key !== 'z' && event.key !== 'Z') return;
            if (isEditableTarget(event.target)) return;

            event.preventDefault();
            if (event.shiftKey) {
                this.redo();
            } else {
                this.undo();
            }
        };

        resolved.addEventListener('keydown', handler as EventListener);
        return () =>
            resolved.removeEventListener('keydown', handler as EventListener);
    }

    /**
     * Trim the underlying stacks to {@link SABFLOW_UNDO_STACK_CAP}. Yjs's
     * `UndoManager` itself has no max — we drop the *oldest* entries
     * because those are the least likely to be undone next.
     */
    private enforceCap(): void {
        while (this.um.undoStack.length > SABFLOW_UNDO_STACK_CAP) {
            this.um.undoStack.shift();
        }
        while (this.um.redoStack.length > SABFLOW_UNDO_STACK_CAP) {
            this.um.redoStack.shift();
        }
    }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Minimal subset of `EventTarget` accepted by
 * {@link SabFlowUndoManager.attachKeyboardShortcuts}. Structural so both
 * `window` and arbitrary DOM elements satisfy it without dragging in the
 * full `lib.dom.d.ts` overload set.
 */
export interface KeyboardShortcutTarget {
    addEventListener(type: 'keydown', listener: EventListener): void;
    removeEventListener(type: 'keydown', listener: EventListener): void;
}

/**
 * Returns true when the keyboard event originated in a form control or
 * contenteditable element — there we let the native browser undo win so we
 * don't break typing UX inside the node-config panel.
 */
function isEditableTarget(target: EventTarget | null): boolean {
    if (!target || typeof (target as { tagName?: unknown }).tagName !== 'string') {
        return false;
    }
    const el = target as unknown as {
        tagName: string;
        isContentEditable?: boolean;
        readOnly?: boolean;
    };
    const tag = el.tagName.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return !el.readOnly;
    }
    return el.isContentEditable === true;
}
