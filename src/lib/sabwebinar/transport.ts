/**
 * IWebinarTransport — pluggable live-stream + presence + chat contract.
 *
 * The webinar admin "Live" console and the public attendee `/live` view
 * both talk to an `IWebinarTransport` implementation for:
 *
 *   - `connect(webinarId)` — bootstrap the realtime session.
 *   - `disconnect()` — tear it down.
 *   - `getLiveStreamUrl(args)` — return an HLS (or RTMP/WebRTC) URL the
 *     `<video>` element can play.
 *   - `subscribeChat(handler)` / `subscribePresence(handler)` — push-based
 *     fan-out of new chat messages and attendee count updates.
 *
 * Persistence (Mongo writes for chat, polls, q&a, registrations,
 * sessions) lives in the server actions and Rust crates — the transport
 * only handles the **real-time** plane.
 *
 * Today: ship `MockTransport` which returns a stubbed HLS URL and emits
 * a deterministic synthetic presence count so the UI is exercisable end
 * to end. A real Mux / Cloudflare Stream / LiveKit Egress integration
 * (or RTMP relay) plugs in later behind the same contract.
 *
 * TODO(live-stream integrator): provide a `MuxTransport`,
 * `CloudflareStreamTransport`, or `LiveKitEgressTransport`. The
 * implementation should consume the `streamUrl` / `sfuRoomId` fields on
 * the `Session` entity (Rust crate `sabwebinar-sessions`).
 */

export interface WebinarPresence {
  /** Currently-watching attendees. */
  current: number;
  /** Highest watching-count seen this session. */
  peak: number;
}

export interface WebinarChatMessage {
  id: string;
  webinarId: string;
  senderName: string;
  body: string;
  /** Unix ms. */
  at: number;
}

export type WebinarChatHandler = (message: WebinarChatMessage) => void;
export type WebinarPresenceHandler = (presence: WebinarPresence) => void;

export interface GetLiveStreamUrlArgs {
  webinarId: string;
  /** Stable opaque token bound to the registration (for gated webinars). */
  joinToken?: string;
}

export interface IWebinarTransport {
  /** Bootstrap the realtime session for `webinarId`. */
  connect(webinarId: string): Promise<void>;
  /** Tear it down. Safe to call multiple times. */
  disconnect(): Promise<void>;
  /** Subscribe to live chat. Returns an unsubscribe fn. */
  subscribeChat(handler: WebinarChatHandler): () => void;
  /** Subscribe to attendee count updates. Returns an unsubscribe fn. */
  subscribePresence(handler: WebinarPresenceHandler): () => void;
  /** Get the playable stream URL (HLS by default; can be RTMP / WebRTC). */
  getLiveStreamUrl(args: GetLiveStreamUrlArgs): Promise<string>;
}

/* ─── MockTransport ───────────────────────────────────────────────── */

/**
 * Synthetic transport — generates a stubbed HLS URL and emits a
 * deterministic synthetic presence count. Useful for UI development
 * before a real live-stream provider is wired.
 */
export class MockTransport implements IWebinarTransport {
  private webinarId: string | null = null;
  private chatHandlers = new Set<WebinarChatHandler>();
  private presenceHandlers = new Set<WebinarPresenceHandler>();
  private presenceTimer: ReturnType<typeof setInterval> | null = null;
  private peak = 0;

  async connect(webinarId: string): Promise<void> {
    this.webinarId = webinarId;
    let current = 1;
    this.presenceTimer = setInterval(() => {
      // Random walk between 1..~120 to exercise the UI.
      current = Math.max(1, Math.min(120, current + Math.round((Math.random() - 0.4) * 5)));
      if (current > this.peak) this.peak = current;
      const snapshot: WebinarPresence = { current, peak: this.peak };
      for (const h of this.presenceHandlers) h(snapshot);
    }, 3000);
  }

  async disconnect(): Promise<void> {
    if (this.presenceTimer) clearInterval(this.presenceTimer);
    this.presenceTimer = null;
    this.chatHandlers.clear();
    this.presenceHandlers.clear();
    this.webinarId = null;
  }

  subscribeChat(handler: WebinarChatHandler): () => void {
    this.chatHandlers.add(handler);
    return () => this.chatHandlers.delete(handler);
  }

  subscribePresence(handler: WebinarPresenceHandler): () => void {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }

  async getLiveStreamUrl(args: GetLiveStreamUrlArgs): Promise<string> {
    // Public Big-Buck-Bunny test stream — replace with the real HLS URL
    // once a provider (Mux / Cloudflare Stream / LiveKit Egress) is wired.
    return `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8?webinar=${encodeURIComponent(
      args.webinarId,
    )}`;
  }
}

/** Default singleton — swap to a real provider in production. */
export const webinarTransport: IWebinarTransport = new MockTransport();
