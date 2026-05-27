/**
 * IAssistTransport — abstract carrier for SabAssist screen-share sessions.
 *
 * The UI talks to an implementation of this interface; the real WebRTC
 * transport (signalling over WebSockets, TURN/STUN, getDisplayMedia)
 * lives behind it and is intentionally deferred. {@link MockTransport}
 * is the in-browser stub used by the technician console and the customer
 * landing page during the integration phase — it records calls in
 * memory, emits synthetic events, and acks every API.
 *
 * No `'use server'` / `'use client'` directives here: this module is a
 * plain TypeScript surface usable from either side. Mount it from a
 * client component only.
 */

export type AnnotationKind = 'pen' | 'arrow' | 'highlight' | 'erase';

export interface AnnotationArgs {
  kind: AnnotationKind;
  /** Normalised 0–1 coordinates so the same payload renders at any size. */
  x: number;
  y: number;
  /** Optional segment terminus for arrow / line annotations. */
  x2?: number;
  y2?: number;
  color?: string;
  strokeWidth?: number;
}

export interface FileTransferArgs {
  /** Either a SabFile id (preferred) OR an inline data URL for live drops. */
  sabFileId?: string;
  fileName: string;
  sizeBytes?: number;
  direction: 'technician_to_customer' | 'customer_to_technician';
  /** Caller-supplied note shown to the receiver. */
  note?: string;
}

export interface TransportConnectResult {
  ok: boolean;
  sessionId: string;
  mode: 'attended' | 'unattended';
  /**
   * Implementations may attach a transport-specific channel handle here
   * (RTCPeerConnection wrapper, WebSocket, etc.). Treated as opaque by the
   * UI.
   */
  channel?: unknown;
}

export type TransportEvent =
  | { type: 'connected'; sessionId: string }
  | { type: 'disconnected'; sessionId: string; reason?: string }
  | { type: 'stream_started'; mediaStream?: MediaStream }
  | { type: 'stream_stopped' }
  | { type: 'annotation'; payload: AnnotationArgs }
  | { type: 'file_transfer'; payload: FileTransferArgs }
  | { type: 'error'; message: string };

export type TransportEventListener = (event: TransportEvent) => void;

/**
 * The transport surface the SabAssist UI binds against. All methods are
 * async — even the synchronous-looking ones — so a real WebRTC backend
 * can be wired without changing call sites.
 */
export interface IAssistTransport {
  /** Redeem an access token and bring the channel up. */
  connect(token: string, opts?: { pin?: string; deviceFingerprint?: string }): Promise<TransportConnectResult>;

  /** Tear the channel down. Idempotent. */
  disconnect(): Promise<void>;

  /** Begin streaming the remote screen into the technician console. */
  startScreenShare(): Promise<{ ok: boolean; mediaStream?: MediaStream }>;

  /** Stop streaming. Idempotent. */
  stopScreenShare(): Promise<void>;

  /** Draw an annotation on top of the remote screen. */
  sendAnnotation(args: AnnotationArgs): Promise<void>;

  /** Request a file transfer (in either direction). */
  requestFileTransfer(args: FileTransferArgs): Promise<{ ok: boolean; transferId: string }>;

  /** Subscribe to transport events. Returns an unsubscribe function. */
  on(listener: TransportEventListener): () => void;
}

/**
 * In-memory mock transport.
 *
 * Records every call into {@link MockTransport.log} so tests can assert
 * order. The customer landing page can construct a MockTransport directly
 * — the real implementation will be a drop-in replacement.
 */
export class MockTransport implements IAssistTransport {
  private listeners: TransportEventListener[] = [];
  private sessionId: string | null = null;
  private streaming = false;
  public readonly log: Array<{ method: string; args: unknown[] }> = [];

  private emit(event: TransportEvent) {
    for (const l of this.listeners) {
      try {
        l(event);
      } catch {
        // listener errors must not poison the transport loop
      }
    }
  }

  async connect(
    token: string,
    opts?: { pin?: string; deviceFingerprint?: string },
  ): Promise<TransportConnectResult> {
    this.log.push({ method: 'connect', args: [token, opts] });
    // Synthesise a session id derived from the token so test assertions
    // line up. Real implementations should call `redeemSabassistAccessToken`.
    this.sessionId = `mock-session-${token.slice(0, 8)}`;
    this.emit({ type: 'connected', sessionId: this.sessionId });
    return { ok: true, sessionId: this.sessionId, mode: 'attended' };
  }

  async disconnect(): Promise<void> {
    this.log.push({ method: 'disconnect', args: [] });
    if (this.streaming) {
      this.streaming = false;
      this.emit({ type: 'stream_stopped' });
    }
    if (this.sessionId) {
      this.emit({ type: 'disconnected', sessionId: this.sessionId });
      this.sessionId = null;
    }
  }

  async startScreenShare(): Promise<{ ok: boolean; mediaStream?: MediaStream }> {
    this.log.push({ method: 'startScreenShare', args: [] });
    this.streaming = true;
    this.emit({ type: 'stream_started' });
    return { ok: true };
  }

  async stopScreenShare(): Promise<void> {
    this.log.push({ method: 'stopScreenShare', args: [] });
    if (this.streaming) {
      this.streaming = false;
      this.emit({ type: 'stream_stopped' });
    }
  }

  async sendAnnotation(args: AnnotationArgs): Promise<void> {
    this.log.push({ method: 'sendAnnotation', args: [args] });
    this.emit({ type: 'annotation', payload: args });
  }

  async requestFileTransfer(
    args: FileTransferArgs,
  ): Promise<{ ok: boolean; transferId: string }> {
    this.log.push({ method: 'requestFileTransfer', args: [args] });
    const transferId = `mock-xfer-${Math.random().toString(36).slice(2, 10)}`;
    this.emit({ type: 'file_transfer', payload: args });
    return { ok: true, transferId };
  }

  on(listener: TransportEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

/**
 * Convenience factory. Switch this to a real WebRTC implementation when
 * the signalling backend lands — every call site uses this one entry.
 */
export function createAssistTransport(): IAssistTransport {
  return new MockTransport();
}
