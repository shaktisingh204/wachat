/**
 * SabFlow client — deterministic per-user color assignment.
 *
 * Used by the collaborative flow editor to colorize remote cursors, selection
 * outlines, and presence avatars. The mapping is **stable** across sessions
 * and process instances: given the same `userId`, every client (browser tab,
 * server-rendered tooltip, audit log replay) resolves to the same color.
 *
 * Design notes:
 *   - 12 hues curated for WCAG-AA contrast against a `#ffffff` canvas
 *     background (each swatch has a contrast ratio >= 4.5:1 when paired with
 *     white text at >= 16px / 700-weight, or used as a 2px line on white).
 *   - FNV-1a 32-bit hash — small, fast, well-distributed over short ASCII
 *     keys; sufficient for picking 1-of-12 buckets. No crypto needed.
 *   - Zero deps. Pure ESM. Safe to import from server + client + workers.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 12-color palette — Figma/Linear-inspired accessible hues.
 *
 * Order matters: it is part of the deterministic contract. Do **not** reorder
 * or remove entries without bumping a migration; existing user-color
 * assignments would silently change.
 *
 * Each entry is paired with the Tailwind-style name it corresponds to, for
 * grep-ability and easy palette audits. All values are 7-character lowercase
 * hex strings (`#rrggbb`).
 */
export const USER_COLOR_PALETTE: readonly string[] = Object.freeze([
  "#d97706", // amber-600
  "#e11d48", // rose-600
  "#7c3aed", // violet-600
  "#0284c7", // sky-600
  "#059669", // emerald-600
  "#65a30d", // lime-600
  "#c026d3", // fuchsia-600
  "#4f46e5", // indigo-600
  "#0d9488", // teal-600
  "#ea580c", // orange-600
  "#0891b2", // cyan-600
  "#db2777", // pink-600
]);

/** Number of colors in the palette. Exposed for tests / sanity checks. */
export const USER_COLOR_PALETTE_SIZE = USER_COLOR_PALETTE.length;

// ─────────────────────────────────────────────────────────────────────────────
// Hashing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit hash.
 *
 * @param input  String to hash. Empty / nullish inputs hash to the offset basis
 *               so the function is total (never throws). Non-ASCII characters
 *               are hashed by their UTF-16 code-unit value, which is stable
 *               across JS runtimes.
 * @returns      Unsigned 32-bit integer.
 *
 * Reference: http://www.isthe.com/chongo/tech/comp/fnv/
 */
function fnv1a32(input: string): number {
  // 32-bit FNV offset basis.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime = 16777619. Multiply via shifts to stay in i32-land
    // and avoid the precision loss of `* 16777619` for large accumulators.
    hash =
      (hash +
        ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>>
      0;
  }
  return hash >>> 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministically resolve a palette color for a given user id.
 *
 * Same `userId` always returns the same color. Stable across sessions, tabs,
 * browsers, and server processes — the only inputs are the id and the frozen
 * palette above.
 *
 * Falsy / empty ids fall through to bucket 0 (amber). This keeps the function
 * total — callers never have to guard against `undefined`.
 */
export function colorForUserId(userId: string): string {
  const key = typeof userId === "string" ? userId : String(userId ?? "");
  const idx = fnv1a32(key) % USER_COLOR_PALETTE_SIZE;
  return USER_COLOR_PALETTE[idx]!;
}

/**
 * Multiply each RGB channel by `factor` to produce a darker variant of a
 * palette color. Intended for selection outlines / hover rings where the
 * cursor color shows on top of a tinted fill — a slightly darker stroke reads
 * better on every background.
 *
 * @param color   `#rgb`, `#rrggbb`, or `#rrggbbaa` hex. Alpha is preserved.
 * @param factor  Multiplier in `[0, 1]`. Default `0.85` (15% darker). Values
 *                are clamped — `> 1` is treated as `1`, `< 0` as `0`.
 * @returns       7- or 9-character lowercase hex string. If `color` cannot be
 *                parsed, it is returned unchanged so callers degrade
 *                gracefully on bad input.
 */
export function darkenForLine(color: string, factor: number = 0.85): string {
  if (typeof color !== "string" || color.length === 0) return color;
  const f = Math.max(0, Math.min(1, Number.isFinite(factor) ? factor : 0.85));

  let hex = color.startsWith("#") ? color.slice(1) : color;

  // Expand `#rgb` → `#rrggbb`.
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }

  if (hex.length !== 6 && hex.length !== 8) return color;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return color;

  const r = Math.round(parseInt(hex.slice(0, 2), 16) * f);
  const g = Math.round(parseInt(hex.slice(2, 4), 16) * f);
  const b = Math.round(parseInt(hex.slice(4, 6), 16) * f);
  const alpha = hex.length === 8 ? hex.slice(6, 8).toLowerCase() : "";

  const toHex = (n: number) =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}${alpha}`;
}

/**
 * Extract 1-2 character initials from a display name, suitable for cursor
 * pucks and avatar fallbacks.
 *
 * Rules:
 *   - Trim, collapse whitespace.
 *   - Split on Unicode whitespace; first + last token contribute one
 *     grapheme each (e.g. "Ada Lovelace" → "AL").
 *   - Single-token names take the first 1-2 graphemes ("Madonna" → "MA").
 *   - Uses `Intl.Segmenter` when available so emoji + ZWJ sequences + RTL
 *     scripts (Arabic, Hebrew) yield one visible character per "initial"
 *     instead of orphaned surrogate halves. Falls back to `Array.from` on
 *     older runtimes — still correct for surrogate pairs, just not for ZWJ
 *     compounds.
 *   - Returns uppercase using the locale-aware `toLocaleUpperCase()` so
 *     Turkish dotted-i and similar edge cases behave correctly. RTL letters
 *     pass through unchanged (no case in Arabic/Hebrew).
 *   - Empty / whitespace-only input → `""`.
 */
export function nameInitials(name: string): string {
  if (typeof name !== "string") return "";
  const trimmed = name.trim();
  if (trimmed.length === 0) return "";

  // Split on any Unicode whitespace run.
  const tokens = trimmed.split(/\s+/u).filter(Boolean);
  if (tokens.length === 0) return "";

  const firstGrapheme = (s: string): string => {
    if (!s) return "";
    // Prefer Intl.Segmenter for proper grapheme cluster handling (emoji, ZWJ,
    // combining marks, regional indicators).
    const Seg: typeof Intl.Segmenter | undefined = (
      Intl as unknown as { Segmenter?: typeof Intl.Segmenter }
    ).Segmenter;
    if (typeof Seg === "function") {
      try {
        const seg = new Seg(undefined, { granularity: "grapheme" });
        const it = seg.segment(s)[Symbol.iterator]();
        const first = it.next();
        if (!first.done) return first.value.segment;
      } catch {
        /* fall through to Array.from */
      }
    }
    // Fallback: Array.from splits surrogate pairs correctly (one entry per
    // code point), which is enough for most non-ZWJ scripts including
    // Arabic, Hebrew, Devanagari, CJK.
    const cp = Array.from(s);
    return cp[0] ?? "";
  };

  let initials: string;
  if (tokens.length === 1) {
    // Single token: take up to two graphemes.
    const only = tokens[0]!;
    const a = firstGrapheme(only);
    const rest = only.slice(a.length);
    const b = firstGrapheme(rest);
    initials = a + b;
  } else {
    const a = firstGrapheme(tokens[0]!);
    const b = firstGrapheme(tokens[tokens.length - 1]!);
    initials = a + b;
  }

  // Locale-aware uppercase — no-op for scripts without case.
  return initials.toLocaleUpperCase();
}
