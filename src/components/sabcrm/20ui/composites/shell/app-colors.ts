/**
 * appAccent — per-app brand gradients for the dock + Launchpad tiles.
 *
 * macOS docks read at a glance because every icon has its own colour.
 * Our app glyphs are monochrome strokes, so the colour lives on the tile:
 * each app gets a two-stop gradient (light → deep) with a white glyph.
 *
 * Well-known apps get curated hues (WaChat green, Email sky, SabPay
 * indigo…); everything else falls back to a 12-stop wheel picked by a
 * stable hash of the app id, so new apps are automatically colourful and
 * keep the same colour across sessions.
 */

export interface AppAccent {
  /** Gradient start (lighter). */
  from: string;
  /** Gradient end (deeper). */
  to: string;
}

const CURATED: Record<string, AppAccent> = {
  launchpad: { from: "#64748b", to: "#334155" },
  home: { from: "#818cf8", to: "#4f46e5" },
  wachat: { from: "#34d399", to: "#059669" },
  facebook: { from: "#60a5fa", to: "#2563eb" },
  "ad-manager": { from: "#38bdf8", to: "#0369a1" },
  sabflow: { from: "#fb923c", to: "#ea580c" },
  sabchat: { from: "#2dd4bf", to: "#0d9488" },
  telegram: { from: "#7dd3fc", to: "#0284c7" },
  instagram: { from: "#f472b6", to: "#c026d3" },
  team: { from: "#a78bfa", to: "#7c3aed" },
  email: { from: "#38bdf8", to: "#1d4ed8" },
  sabpay: { from: "#818cf8", to: "#4338ca" },
  sabsms: { from: "#4ade80", to: "#16a34a" },
  api: { from: "#94a3b8", to: "#475569" },
  url: { from: "#fbbf24", to: "#d97706" },
  qr: { from: "#2dd4bf", to: "#0f766e" },
  sabfiles: { from: "#fbbf24", to: "#ca8a04" },
  settings: { from: "#9ca3af", to: "#4b5563" },
};

/** Fallback wheel — distinct, saturated-but-tasteful pairs. */
const WHEEL: AppAccent[] = [
  { from: "#f87171", to: "#dc2626" }, // red
  { from: "#fb923c", to: "#ea580c" }, // orange
  { from: "#fbbf24", to: "#d97706" }, // amber
  { from: "#a3e635", to: "#65a30d" }, // lime
  { from: "#4ade80", to: "#16a34a" }, // green
  { from: "#2dd4bf", to: "#0d9488" }, // teal
  { from: "#22d3ee", to: "#0891b2" }, // cyan
  { from: "#38bdf8", to: "#0284c7" }, // sky
  { from: "#818cf8", to: "#4f46e5" }, // indigo
  { from: "#a78bfa", to: "#7c3aed" }, // violet
  { from: "#e879f9", to: "#a21caf" }, // fuchsia
  { from: "#fb7185", to: "#e11d48" }, // rose
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function appAccent(id: string): AppAccent {
  return CURATED[id] ?? WHEEL[hashId(id) % WHEEL.length];
}

/** CSS background for a tile. */
export function appAccentGradient(id: string): string {
  const { from, to } = appAccent(id);
  return `linear-gradient(145deg, ${from} 0%, ${to} 100%)`;
}
