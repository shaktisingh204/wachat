/**
 * `MockTransport` — deterministic in-process stub of `ILensTransport`.
 *
 * Real WebRTC + getUserMedia / getDisplayMedia + datachannel signalling is
 * deferred. Until then, this class:
 *
 *   1. Generates synthetic colour-bar SVG-as-data-URL "camera" frames at
 *      ~2 FPS once `connectAsTechnician` is called. Each frame's pixel
 *      content is seeded by `sessionId` so re-renders are stable in tests.
 *
 *   2. Routes annotations, chat, and snapshot-requests through a
 *      `BroadcastChannel` keyed by `sablens:<sessionId>` so the technician
 *      and customer tabs of the same browser see each other.
 *
 * TODOs (deferred):
 *   - Real WebRTC peer connection + ICE.
 *   - `getUserMedia({ video: { facingMode: 'environment' } })` →
 *     publish track over the peer-connection from the customer side.
 *   - Mobile AR overlay via WebXR / 8th Wall / model-viewer for the
 *     spatial annotations (today they project as 2-D SVG only).
 */

import type {
  ILensTransport,
  LensAnnotation,
  LensChatMessage,
  LensFrame,
  Unsubscribe,
} from './transport';

type Role = 'technician' | 'customer' | 'idle';

interface BroadcastEnvelope {
  kind: 'annotation' | 'chat' | 'snapshot_request';
  payload: LensAnnotation | LensChatMessage | { sessionId: string; ts: number };
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function makeFrameSvg(sessionId: string, tick: number): string {
  const seed = hashSeed(sessionId);
  const hue = (seed + tick * 7) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue}, 70%, 35%)" />
        <stop offset="100%" stop-color="hsl(${(hue + 90) % 360}, 70%, 18%)" />
      </linearGradient>
    </defs>
    <rect width="640" height="360" fill="url(#g)" />
    <text x="20" y="40" font-family="monospace" font-size="22" fill="#fff" opacity="0.9">SabLens — mock camera</text>
    <text x="20" y="68" font-family="monospace" font-size="14" fill="#fff" opacity="0.7">session ${sessionId.slice(0, 8)}…  tick ${tick}</text>
    <circle cx="${320 + Math.sin(tick / 5) * 180}" cy="${180 + Math.cos(tick / 5) * 80}" r="42" fill="#fff" opacity="0.18" />
    <rect x="${480 + Math.sin(tick / 8) * 100}" y="${230 + Math.cos(tick / 11) * 50}" width="60" height="60" rx="8" fill="#fff" opacity="0.12" />
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export class MockTransport implements ILensTransport {
  private role: Role = 'idle';
  private sessionId = '';
  private channel: BroadcastChannel | null = null;
  private frameTimer: ReturnType<typeof setInterval> | null = null;
  private tick = 0;

  private frameHandlers = new Set<(f: LensFrame) => void>();
  private annotationHandlers = new Set<(a: LensAnnotation) => void>();
  private chatHandlers = new Set<(m: LensChatMessage) => void>();
  private snapshotHandlers = new Set<() => void>();

  async connectAsTechnician(sessionId: string): Promise<void> {
    this.role = 'technician';
    this.sessionId = sessionId;
    this.openChannel();
    // Start synthetic frame stream — 2 FPS.
    this.frameTimer = setInterval(() => {
      this.tick += 1;
      const frame: LensFrame = {
        ts: Date.now(),
        imageUrl: makeFrameSvg(sessionId, this.tick),
        deviceOrientation: 0,
        sensorInfoJson: { mock: true, tick: this.tick },
      };
      for (const h of this.frameHandlers) h(frame);
    }, 500);
  }

  async connectAsCustomer(token: string): Promise<void> {
    this.role = 'customer';
    this.sessionId = `customer:${token}`;
    this.openChannel();
    // The real customer side would call getUserMedia and publish frames
    // over WebRTC here. In mock mode there's nothing to stream — the
    // technician renders synthetic frames on its own.
  }

  disconnect(): void {
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.frameHandlers.clear();
    this.annotationHandlers.clear();
    this.chatHandlers.clear();
    this.snapshotHandlers.clear();
    this.role = 'idle';
  }

  subscribeFrames(handler: (frame: LensFrame) => void): Unsubscribe {
    this.frameHandlers.add(handler);
    return () => this.frameHandlers.delete(handler);
  }

  subscribeAnnotations(handler: (a: LensAnnotation) => void): Unsubscribe {
    this.annotationHandlers.add(handler);
    return () => this.annotationHandlers.delete(handler);
  }

  publishAnnotation(args: Omit<LensAnnotation, 'localId' | 'ts'>): void {
    const annotation: LensAnnotation = {
      ...args,
      localId: uid(),
      ts: Date.now(),
    };
    // Local echo so the publishing side sees its own ink immediately.
    for (const h of this.annotationHandlers) h(annotation);
    this.channel?.postMessage({
      kind: 'annotation',
      payload: annotation,
    } satisfies BroadcastEnvelope);
  }

  requestSnapshot(): void {
    this.channel?.postMessage({
      kind: 'snapshot_request',
      payload: { sessionId: this.sessionId, ts: Date.now() },
    } satisfies BroadcastEnvelope);
  }

  sendChat(args: Omit<LensChatMessage, 'localId' | 'ts'>): void {
    const msg: LensChatMessage = {
      ...args,
      localId: uid(),
      ts: Date.now(),
    };
    for (const h of this.chatHandlers) h(msg);
    this.channel?.postMessage({
      kind: 'chat',
      payload: msg,
    } satisfies BroadcastEnvelope);
  }

  subscribeChat(handler: (m: LensChatMessage) => void): Unsubscribe {
    this.chatHandlers.add(handler);
    return () => this.chatHandlers.delete(handler);
  }

  /** Customer-side hook used by the public page to know when the
   *  technician asked for a snapshot. Not part of the formal interface
   *  but handy for the mock. */
  onSnapshotRequest(handler: () => void): Unsubscribe {
    this.snapshotHandlers.add(handler);
    return () => this.snapshotHandlers.delete(handler);
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private openChannel(): void {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      // Non-browser environment — nothing to wire up.
      return;
    }
    const channelName = `sablens:${this.normalisedChannelKey()}`;
    this.channel = new BroadcastChannel(channelName);
    this.channel.onmessage = (ev: MessageEvent<BroadcastEnvelope>) => {
      const env = ev.data;
      if (!env) return;
      if (env.kind === 'annotation') {
        for (const h of this.annotationHandlers) h(env.payload as LensAnnotation);
      } else if (env.kind === 'chat') {
        for (const h of this.chatHandlers) h(env.payload as LensChatMessage);
      } else if (env.kind === 'snapshot_request') {
        for (const h of this.snapshotHandlers) h();
      }
    };
  }

  /** Strip the `customer:` prefix so both ends share the same channel. */
  private normalisedChannelKey(): string {
    return this.sessionId.replace(/^customer:/, '');
  }
}
