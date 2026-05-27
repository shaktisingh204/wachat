/**
 * Team-chat real-time transport — interface + mock implementation.
 *
 * The current `page.tsx` polls Mongo every 3 s through server actions.
 * This module defines the seam we'll plug a real transport into
 * (SSE / WebSocket / Pusher / Ably) without touching the React tree.
 *
 * Until the Rust SabCliq crates expose a streaming surface, the default
 * `MockTransport` simply schedules `setInterval` callers, giving the
 * UI a single subscription API to refactor around.
 */

export type TeamChatEvent =
    | { type: 'message'; channelId: string; messageId: string }
    | { type: 'reaction'; channelId: string; messageId: string; emoji: string; userId: string }
    | { type: 'thread-reply'; channelId: string; rootMessageId: string; messageId: string }
    | { type: 'pin'; channelId: string; messageId: string }
    | { type: 'unpin'; channelId: string; messageId: string }
    | { type: 'presence'; userId: string; status: 'online' | 'away' | 'dnd' | 'offline' }
    | { type: 'huddle-started'; channelId: string; huddleId: string }
    | { type: 'huddle-ended'; channelId: string; huddleId: string };

export type TeamChatEventHandler = (event: TeamChatEvent) => void;

export interface ITeamChatTransport {
    /** Subscribe to all events for a given channel. Returns an unsubscribe. */
    subscribeChannel(channelId: string, handler: TeamChatEventHandler): () => void;
    /** Subscribe to global presence updates. */
    subscribePresence(handler: TeamChatEventHandler): () => void;
    /** Schedule a poll cycle. Real transports may treat this as a hint. */
    requestRefresh(channelId?: string): void;
    /** Mark this transport as torn down — releases timers etc. */
    dispose(): void;
}

/* ─── Mock implementation ─────────────────────────────────────────── */

export interface MockTransportOptions {
    /** Polling interval in ms — defaults to 3000. */
    intervalMs?: number;
    /** Invoked on each tick; consumers (page.tsx) re-fetch via server actions. */
    onTick?: (channelId?: string) => void;
}

export class MockTransport implements ITeamChatTransport {
    private readonly intervalMs: number;
    private readonly onTick?: MockTransportOptions['onTick'];
    private readonly channelHandlers = new Map<string, Set<TeamChatEventHandler>>();
    private readonly presenceHandlers = new Set<TeamChatEventHandler>();
    private timer: ReturnType<typeof setInterval> | null = null;
    private activeChannelId?: string;

    constructor(opts: MockTransportOptions = {}) {
        this.intervalMs = opts.intervalMs ?? 3000;
        this.onTick = opts.onTick;
        this.ensureTimer();
    }

    private ensureTimer(): void {
        if (this.timer) return;
        if (typeof window === 'undefined') return;
        this.timer = setInterval(() => {
            this.onTick?.(this.activeChannelId);
        }, this.intervalMs);
    }

    subscribeChannel(channelId: string, handler: TeamChatEventHandler) {
        let set = this.channelHandlers.get(channelId);
        if (!set) {
            set = new Set();
            this.channelHandlers.set(channelId, set);
        }
        set.add(handler);
        this.activeChannelId = channelId;
        return () => {
            set!.delete(handler);
            if (!set!.size) this.channelHandlers.delete(channelId);
        };
    }

    subscribePresence(handler: TeamChatEventHandler) {
        this.presenceHandlers.add(handler);
        return () => {
            this.presenceHandlers.delete(handler);
        };
    }

    requestRefresh(channelId?: string): void {
        if (channelId) this.activeChannelId = channelId;
        this.onTick?.(channelId ?? this.activeChannelId);
    }

    dispose(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        this.channelHandlers.clear();
        this.presenceHandlers.clear();
    }
}
