/**
 * Collaboration presence — live cursors/selections of other people in the same workbook.
 *
 * Clients heartbeat their cursor to `/api/sabsheet/presence`; the SSE stream fans out everyone else's
 * cursor as a `presence` event. The grid paints remote selections on the overlay canvas. This module
 * is the shared (server + client) type + a deterministic per-user color.
 */

export interface PresenceBox {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface PresenceCursor {
  userId: string;
  name: string;
  color: string;
  /** 0-based sheet index the cursor is on. */
  sheet: number;
  /** Active cell (1-based). */
  row: number;
  col: number;
  /** Selection box (1-based) — equals the active cell for a single-cell selection. */
  box: PresenceBox;
}

/** What a client posts (the server stamps userId/name/color). */
export type PresenceInput = Omit<PresenceCursor, "userId" | "name" | "color">;

const PALETTE = [
  "#1a73e8", "#e8710a", "#188038", "#a142f4", "#d93025",
  "#129eaf", "#c5221f", "#b06000", "#9334e6", "#1967d2",
];

/** Stable color for a user id (so the same person is the same color everywhere). */
export function colorForUser(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
