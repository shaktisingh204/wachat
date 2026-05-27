/**
 * SabLens — real-time transport contract.
 *
 * `ILensTransport` is the abstract media + signalling channel between the
 * technician console and the customer's phone. Two ends of the same
 * interface:
 *
 *   * Technician  ─→ `connectAsTechnician(sessionId)`
 *       receives the customer's camera frames (`subscribeFrames`)
 *       receives annotation/chat messages back from the customer
 *       publishes annotations via `publishAnnotation()`
 *
 *   * Customer    ─→ `connectAsCustomer(token)`
 *       publishes the camera stream (handled at the WebRTC layer
 *       outside this contract — we only specify the JSON channel here)
 *       receives technician-drawn annotations (`subscribeAnnotations`)
 *
 * Today we ship `MockTransport`, a deterministic stub that:
 *   - hands the technician synthetic colour-bar frames at ~2 FPS,
 *   - echoes published annotations back through the annotation channel,
 *   - relays chat between both ends locally.
 *
 * The real implementation (WebRTC datachannel + getUserMedia) is deferred
 * — see TODOs in `mock-transport.ts`.
 */

export interface LensFrame {
  /** ms since UNIX epoch. */
  ts: number;
  /** Data URL or blob URL of the JPEG frame. */
  imageUrl: string;
  /** 0|90|180|270 */
  deviceOrientation?: number;
  sensorInfoJson?: Record<string, unknown>;
}

export interface LensAnnotationGeometry {
  points: [number, number][];
  text?: string;
  size?: number;
}

export type LensAnnotationKind =
  | 'arrow'
  | 'circle'
  | 'rect'
  | 'freehand'
  | 'text';

export interface LensAnnotation {
  /** Client-side id — server roundtrip mints a real one. */
  localId: string;
  sessionId: string;
  ts: number;
  kind: LensAnnotationKind;
  geometry: LensAnnotationGeometry;
  color: string;
  strokeWidth: number;
  persistent: boolean;
  authorKind: 'user' | 'guest';
}

export interface LensChatMessage {
  localId: string;
  sessionId: string;
  ts: number;
  body: string;
  senderKind: 'user' | 'guest';
  attachmentIds?: string[];
}

export interface LensSnapshotRequest {
  sessionId: string;
  ts: number;
}

export type Unsubscribe = () => void;

export interface ILensTransport {
  connectAsTechnician(sessionId: string): Promise<void>;
  connectAsCustomer(token: string): Promise<void>;
  disconnect(): void;

  /** Technician-only — receives the customer's camera frames. */
  subscribeFrames(handler: (frame: LensFrame) => void): Unsubscribe;

  /** Both sides — receives annotations drawn on the customer view. */
  subscribeAnnotations(handler: (a: LensAnnotation) => void): Unsubscribe;

  /** Both sides — publish a new annotation. */
  publishAnnotation(args: Omit<LensAnnotation, 'localId' | 'ts'>): void;

  /** Technician-only — ask the customer end to capture a snapshot now. */
  requestSnapshot(): void;

  /** Both sides. */
  sendChat(args: Omit<LensChatMessage, 'localId' | 'ts'>): void;
  subscribeChat(handler: (m: LensChatMessage) => void): Unsubscribe;
}
