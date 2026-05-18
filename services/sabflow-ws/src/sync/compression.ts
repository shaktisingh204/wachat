/**
 * WebSocket permessage-deflate negotiation + per-frame compression policy.
 *
 * Scope: SabFlow WS sync channel (Track A Phase 4 §7).
 *
 * Notes
 * -----
 * - We DO NOT implement DEFLATE here. The `ws` library performs the actual
 *   compression/decompression once we hand it a negotiated config. This
 *   module only:
 *     1. Parses the client's `Sec-WebSocket-Extensions` offer.
 *     2. Picks our chosen parameters (with sane defaults).
 *     3. Emits the matching response header.
 *     4. Decides on a per-frame basis whether compression is worth it.
 *
 * - Yjs sync update frames are already lib0-varint-packed and typically
 *   incompressible (see ADR §5). We therefore skip compression for the
 *   small/binary "SYNC update" tag regardless of size.
 *
 * - Frame tags (kept in sync with the wire protocol; declared here as
 *   plain constants so this file stays standalone and easy to test):
 */

import type { IncomingMessage } from "node:http";

// -----------------------------------------------------------------------------
// Wire protocol frame tags (mirror of services/sabflow-ws/src/sync/protocol.ts)
// -----------------------------------------------------------------------------

export const FRAME_TAG = {
  /** Acknowledgement of a received update (tiny). */
  ACK: 0x01,
  /** Negative acknowledgement (tiny). */
  NACK: 0x02,
  /** Yjs sync update (already varint-packed binary). */
  SYNC_UPDATE: 0x10,
  /** Awareness update. */
  AWARENESS: 0x11,
  /** Server-side batched envelope (may carry many ops). */
  SERVER_BATCH: 0x20,
  /** Generic JSON control frame. */
  CONTROL_JSON: 0x30,
} as const;

export type FrameTag = (typeof FRAME_TAG)[keyof typeof FRAME_TAG];

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/** Minimum payload size (bytes) eligible for compression. */
export const DEFAULT_COMPRESSION_THRESHOLD = 1024;

/** SERVER_BATCH-specific threshold — only compress big batches. */
export const SERVER_BATCH_COMPRESSION_THRESHOLD = 4 * 1024;

/** Resolved permessage-deflate configuration for a single connection. */
export interface CompressionConfig {
  /** Always "permessage-deflate" — kept explicit for response building. */
  readonly extension: "permessage-deflate";
  /** LZ77 sliding window size (server -> client direction). */
  readonly serverMaxWindowBits: number;
  /** LZ77 sliding window size (client -> server direction). */
  readonly clientMaxWindowBits: number;
  /** If true, server resets its compression context between messages. */
  readonly serverNoContextTakeover: boolean;
  /** If true, client resets its compression context between messages. */
  readonly clientNoContextTakeover: boolean;
  /** Below this many bytes we send uncompressed. */
  readonly threshold: number;
}

const DEFAULT_CONFIG: CompressionConfig = {
  extension: "permessage-deflate",
  serverMaxWindowBits: 15,
  clientMaxWindowBits: 15,
  serverNoContextTakeover: false,
  clientNoContextTakeover: false,
  threshold: DEFAULT_COMPRESSION_THRESHOLD,
};

// -----------------------------------------------------------------------------
// Extension header parser
// -----------------------------------------------------------------------------

interface ParsedOffer {
  name: string;
  params: Map<string, string | true>;
}

function parseExtensionsHeader(raw: string): ParsedOffer[] {
  const offers: ParsedOffer[] = [];
  // Top-level offers are comma-separated; params within an offer are ;-separated.
  for (const chunk of raw.split(",")) {
    const parts = chunk.split(";").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    const name = parts[0]!.toLowerCase();
    const params = new Map<string, string | true>();
    for (let i = 1; i < parts.length; i += 1) {
      const eq = parts[i]!.indexOf("=");
      if (eq === -1) {
        params.set(parts[i]!.toLowerCase(), true);
      } else {
        const key = parts[i]!.slice(0, eq).trim().toLowerCase();
        let value = parts[i]!.slice(eq + 1).trim();
        // Strip surrounding quotes if present (RFC 7692 §7.1 allows quoting).
        if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        params.set(key, value);
      }
    }
    offers.push({ name, params });
  }
  return offers;
}

function clampWindowBits(raw: string | true | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  // `client_max_window_bits` may appear bare (no value) — that means the client
  // simply *supports* the parameter; we get to pick. Use our fallback.
  if (raw === true) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  // RFC 7692 §7.1.2 — valid range is [8, 15].
  if (n < 8) return 8;
  if (n > 15) return 15;
  return n;
}

/**
 * Inspect the upgrade request and, if the client offers permessage-deflate,
 * return a resolved config. Otherwise return null (no compression).
 */
export function negotiateCompression(
  req: Pick<IncomingMessage, "headers">,
): CompressionConfig | null {
  const headerRaw = req.headers["sec-websocket-extensions"];
  if (!headerRaw) return null;
  const header = Array.isArray(headerRaw) ? headerRaw.join(",") : headerRaw;
  const offers = parseExtensionsHeader(header);
  const pmd = offers.find((o) => o.name === "permessage-deflate");
  if (!pmd) return null;

  return {
    extension: "permessage-deflate",
    serverMaxWindowBits: clampWindowBits(
      pmd.params.get("server_max_window_bits"),
      DEFAULT_CONFIG.serverMaxWindowBits,
    ),
    clientMaxWindowBits: clampWindowBits(
      pmd.params.get("client_max_window_bits"),
      DEFAULT_CONFIG.clientMaxWindowBits,
    ),
    // If the client *requests* no-context-takeover we must honour it; otherwise
    // stick to our default (false = keep context for better ratio).
    serverNoContextTakeover:
      pmd.params.has("server_no_context_takeover") ||
      DEFAULT_CONFIG.serverNoContextTakeover,
    clientNoContextTakeover:
      pmd.params.has("client_no_context_takeover") ||
      DEFAULT_CONFIG.clientNoContextTakeover,
    threshold: DEFAULT_CONFIG.threshold,
  };
}

/**
 * Build the value for the `Sec-WebSocket-Extensions` response header that
 * confirms the negotiated parameters back to the client.
 */
export function responseExtensionHeader(cfg: CompressionConfig): string {
  const parts: string[] = [cfg.extension];
  parts.push(`server_max_window_bits=${cfg.serverMaxWindowBits}`);
  parts.push(`client_max_window_bits=${cfg.clientMaxWindowBits}`);
  if (cfg.serverNoContextTakeover) parts.push("server_no_context_takeover");
  if (cfg.clientNoContextTakeover) parts.push("client_no_context_takeover");
  return parts.join("; ");
}

// -----------------------------------------------------------------------------
// Per-frame compression decisions
// -----------------------------------------------------------------------------

/**
 * Cheap heuristic: does this binary buffer look already-compressed?
 *
 * We sample the leading bytes for common magic numbers (gzip, zlib, zstd,
 * brotli streams, common media containers). Returning `true` means: skip
 * deflate, we'd only add overhead.
 */
function looksAlreadyCompressed(buf: Buffer): boolean {
  if (buf.length < 2) return false;
  const b0 = buf[0]!;
  const b1 = buf[1]!;

  // gzip
  if (b0 === 0x1f && b1 === 0x8b) return true;
  // zlib (any of the common CMF/FLG combinations)
  if (b0 === 0x78 && (b1 === 0x01 || b1 === 0x5e || b1 === 0x9c || b1 === 0xda)) {
    return true;
  }
  // zstd
  if (buf.length >= 4 && b0 === 0x28 && b1 === 0xb5 && buf[2] === 0x2f && buf[3] === 0xfd) {
    return true;
  }
  // PNG / JPEG / WEBP-ish — defensive, sync channel shouldn't carry these but
  // SERVER_BATCH could embed assets.
  if (b0 === 0x89 && b1 === 0x50) return true; // PNG
  if (b0 === 0xff && b1 === 0xd8) return true; // JPEG
  return false;
}

/**
 * Generic size+kind gate. Used when the caller doesn't know the frame tag
 * (e.g. raw `WebSocket.send` from a non-protocol path).
 */
export function shouldCompress(payloadSize: number, isBinary: boolean): boolean {
  if (payloadSize < DEFAULT_COMPRESSION_THRESHOLD) return false;
  // Binary payloads are presumed compact (Yjs varint, msgpack, etc.) unless
  // the caller can prove otherwise via `decideForFrame`.
  if (isBinary) return false;
  return true;
}

/**
 * Tag-aware decision used by the sync writer.
 *
 * Rules (mirroring ADR §5):
 *   - ACK / NACK         → never compress (tiny + chatty).
 *   - SYNC_UPDATE        → never compress (Yjs lib0-varint is already compact).
 *   - AWARENESS          → never compress (small + frequent).
 *   - SERVER_BATCH       → compress only if payload > 4 KiB AND not already
 *                          a compressed blob.
 *   - CONTROL_JSON       → standard threshold (>= 1 KiB).
 *   - anything else      → fall back to `shouldCompress`.
 */
export function decideForFrame(tag: number, payload: Buffer): boolean {
  switch (tag) {
    case FRAME_TAG.ACK:
    case FRAME_TAG.NACK:
    case FRAME_TAG.SYNC_UPDATE:
    case FRAME_TAG.AWARENESS:
      return false;
    case FRAME_TAG.SERVER_BATCH:
      if (payload.length <= SERVER_BATCH_COMPRESSION_THRESHOLD) return false;
      if (looksAlreadyCompressed(payload)) return false;
      return true;
    case FRAME_TAG.CONTROL_JSON:
      return payload.length >= DEFAULT_COMPRESSION_THRESHOLD;
    default:
      return shouldCompress(payload.length, /* isBinary */ true);
  }
}

// -----------------------------------------------------------------------------
// Stats exporter (consumed by the sibling metrics module)
// -----------------------------------------------------------------------------

export interface CompressionStatsSnapshot {
  /** Total bytes the application handed to the writer (pre-compression). */
  rawBytes: number;
  /** Total bytes actually placed on the wire (post-compression). */
  wireBytes: number;
  /** Bytes saved = rawBytes − wireBytes (may be negative if overhead wins). */
  bytesSaved: number;
  /** wireBytes / rawBytes — 1.0 means no benefit, < 1.0 means net savings. */
  ratio: number;
  /** Number of frames considered for compression. */
  framesTotal: number;
  /** Number of frames actually compressed. */
  framesCompressed: number;
  /** Number of frames sent through uncompressed (below threshold or skipped). */
  framesSkipped: number;
}

export interface CompressionStatsExporter {
  /** Record a frame that was sent (compressed or not). */
  record(opts: { raw: number; wire: number; compressed: boolean }): void;
  /** Read a stable point-in-time snapshot. */
  snapshot(): CompressionStatsSnapshot;
  /** Reset to zero — primarily for tests. */
  reset(): void;
}

/**
 * Factory for a process-local stats accumulator. We deliberately keep this
 * in-memory and non-async — the metrics sibling polls `snapshot()` on its
 * own scrape interval and forwards to Prom/OTel.
 */
export function compressionStatsExporter(): CompressionStatsExporter {
  let rawBytes = 0;
  let wireBytes = 0;
  let framesTotal = 0;
  let framesCompressed = 0;

  return {
    record({ raw, wire, compressed }) {
      // Defensive: ignore obvious garbage so a single bad call can't poison
      // the running ratio.
      if (!Number.isFinite(raw) || !Number.isFinite(wire)) return;
      if (raw < 0 || wire < 0) return;
      rawBytes += raw;
      wireBytes += wire;
      framesTotal += 1;
      if (compressed) framesCompressed += 1;
    },
    snapshot() {
      const ratio = rawBytes === 0 ? 1 : wireBytes / rawBytes;
      return {
        rawBytes,
        wireBytes,
        bytesSaved: rawBytes - wireBytes,
        ratio,
        framesTotal,
        framesCompressed,
        framesSkipped: framesTotal - framesCompressed,
      };
    },
    reset() {
      rawBytes = 0;
      wireBytes = 0;
      framesTotal = 0;
      framesCompressed = 0;
    },
  };
}
