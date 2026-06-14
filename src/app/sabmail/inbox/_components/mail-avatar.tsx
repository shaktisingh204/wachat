"use client";

import * as React from "react";

/* Decorative avatar palette (Gmail-style colored initials). These are
 * intentionally fixed hues — they read on both light + dark backgrounds. */
const PALETTE: ReadonlyArray<readonly [string, string]> = [
  ["#0e9f6e", "#ffffff"], // emerald
  ["#2563eb", "#ffffff"], // blue
  ["#7c3aed", "#ffffff"], // violet
  ["#db2777", "#ffffff"], // pink
  ["#ea580c", "#ffffff"], // orange
  ["#0891b2", "#ffffff"], // cyan
  ["#ca8a04", "#1b1b18"], // amber
  ["#dc2626", "#ffffff"], // red
  ["#4f46e5", "#ffffff"], // indigo
  ["#16a34a", "#ffffff"], // green
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function deriveInitials(name: string, email: string): string {
  const base = (name || email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function MailAvatar({
  name,
  email,
  src,
  size = 36,
  ring = false,
  status,
  className = "",
}: {
  name?: string;
  email?: string;
  src?: string | null;
  size?: number;
  /** Draw a thin surface-colored ring (used on the reading-pane avatar). */
  ring?: boolean;
  /** Small status dot (e.g. "online") in the corner. */
  status?: "online" | "away" | null;
  className?: string;
}) {
  const key = (email || name || "?").toLowerCase();
  const [bg, fg] = PALETTE[hashString(key) % PALETTE.length];
  const inits = deriveInitials(name ?? "", email ?? "");
  const [broken, setBroken] = React.useState(false);
  const showImg = !!src && !broken;

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-visible rounded-full ${
        ring ? "ring-2 ring-[var(--st-bg)]" : ""
      } ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt=""
          width={size}
          height={size}
          onError={() => setBroken(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          className="grid h-full w-full place-items-center rounded-full font-semibold"
          style={{
            background: bg,
            color: fg,
            fontSize: Math.max(10, Math.round(size * 0.38)),
          }}
        >
          {inits}
        </span>
      )}
      {status ? (
        <span
          className="absolute bottom-0 right-0 block rounded-full ring-2 ring-[var(--st-bg)]"
          style={{
            width: Math.max(8, Math.round(size * 0.28)),
            height: Math.max(8, Math.round(size * 0.28)),
            background: status === "online" ? "#10b981" : "#f59e0b",
          }}
        />
      ) : null}
    </span>
  );
}
