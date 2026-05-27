/**
 * SabShow real-time collab transport.
 *
 * This is the abstraction the editor talks to so we can swap the concrete
 * transport (Y.js / yjs-websocket / Liveblocks / native WebSocket) later
 * without touching call sites. Today the only shipped implementation is
 * `MockTransport` — it loops events back to the local subscribers so the
 * editor stays exercised in dev. A future PR will ship the wire transport
 * once the API gateway exposes a WebSocket endpoint and we pick a CRDT.
 *
 * Connection lifecycle:
 *
 *   transport.connect(deckId)
 *     → all `sendElementUpdate` / `setCursor` calls are scoped to that deck
 *     → `subscribeElementUpdates` / `subscribePresence` start receiving events
 *   transport.disconnect()
 *     → unsubscribes everything and frees the underlying socket
 *
 * The shape intentionally avoids leaking Y.js types so we can pick a
 * different CRDT (Automerge, Loro) without breaking the contract.
 */

export interface ShowElementUpdate {
    /** Authoring user, so subscribers can filter their own echoes. */
    userId: string;
    /** Per-session id (cheaper than a UUID — picked at connect time). */
    sessionId: string;
    slideId: string;
    elementId: string;
    /**
     * Partial element diff — keys missing means "leave alone". The
     * editor merges this into local state.
     */
    patch: {
        x?: number;
        y?: number;
        w?: number;
        h?: number;
        rotation?: number;
        zIndex?: number;
        configJson?: unknown;
    };
    /** Sender-side ms timestamp; receivers may LWW with this. */
    sentAt: number;
}

export interface ShowPresenceUpdate {
    userId: string;
    sessionId: string;
    /** Stable per-session display color (hex). */
    color: string;
    slideId: string;
    cursor?: { x: number; y: number };
    selectedElementId?: string;
}

export type ShowElementUpdateHandler = (update: ShowElementUpdate) => void;
export type ShowPresenceHandler = (snapshot: ShowPresenceUpdate[]) => void;

/**
 * The interface every SabShow transport implements. Treat this as the
 * single source of truth — call sites should accept `IShowTransport`,
 * not a concrete class.
 */
export interface IShowTransport {
    /**
     * Open the transport against a deck. Safe to call again with a
     * different deckId to switch decks (the implementation must
     * implicitly disconnect the previous one first).
     */
    connect(deckId: string): Promise<void>;

    /**
     * Tear down the transport, unsubscribing all handlers.
     */
    disconnect(): Promise<void>;

    /**
     * Broadcast an element-level patch to other connected editors.
     */
    sendElementUpdate(args: Omit<ShowElementUpdate, 'sentAt'>): void;

    /**
     * Subscribe to remote element patches. Returns an unsubscribe fn.
     * Implementations MUST filter out the local session's own echoes
     * (callers should not have to dedupe).
     */
    subscribeElementUpdates(handler: ShowElementUpdateHandler): () => void;

    /**
     * Update the current user's cursor / focused slide. Throttle on the
     * call site — implementations may further throttle but won't add
     * meaningful latency.
     */
    setCursor(slideId: string, x: number, y: number): void;

    /**
     * Subscribe to the full presence roster for the current deck.
     * Handler receives the FULL snapshot (not a diff) every time
     * presence changes — easier for React. Returns an unsubscribe fn.
     */
    subscribePresence(handler: ShowPresenceHandler): () => void;
}

/* ─── Mock implementation ──────────────────────────────────────────────── */

/**
 * Local-only transport. Useful in dev (no backend round-trip) and in
 * unit tests. Events sent through `sendElementUpdate` are NOT broadcast
 * to other clients — they only fire local subscribers, which lets the
 * editor exercise its merge / echo-suppression code paths.
 */
export class MockTransport implements IShowTransport {
    private deckId: string | null = null;
    private readonly sessionId: string =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `mock-${Math.random().toString(36).slice(2)}`;
    private readonly elementHandlers = new Set<ShowElementUpdateHandler>();
    private readonly presenceHandlers = new Set<ShowPresenceHandler>();
    private presenceRoster: ShowPresenceUpdate[] = [];

    async connect(deckId: string): Promise<void> {
        this.deckId = deckId;
    }

    async disconnect(): Promise<void> {
        this.deckId = null;
        this.elementHandlers.clear();
        this.presenceHandlers.clear();
        this.presenceRoster = [];
    }

    sendElementUpdate(args: Omit<ShowElementUpdate, 'sentAt'>): void {
        if (!this.deckId) return;
        const update: ShowElementUpdate = { ...args, sentAt: Date.now() };
        // In a real transport these would be filtered out (it's our own
        // session); the mock fires them so dev tooling can introspect.
        this.elementHandlers.forEach((h) => h(update));
    }

    subscribeElementUpdates(handler: ShowElementUpdateHandler): () => void {
        this.elementHandlers.add(handler);
        return () => {
            this.elementHandlers.delete(handler);
        };
    }

    setCursor(slideId: string, x: number, y: number): void {
        // Mock keeps a single-user roster.
        this.presenceRoster = [
            {
                userId: 'me',
                sessionId: this.sessionId,
                color: '#22c55e',
                slideId,
                cursor: { x, y },
            },
        ];
        this.presenceHandlers.forEach((h) => h(this.presenceRoster));
    }

    subscribePresence(handler: ShowPresenceHandler): () => void {
        this.presenceHandlers.add(handler);
        // Replay current roster on subscribe.
        handler(this.presenceRoster);
        return () => {
            this.presenceHandlers.delete(handler);
        };
    }
}

/**
 * Default factory — swap this when a real transport lands.
 */
export function createShowTransport(): IShowTransport {
    return new MockTransport();
}
