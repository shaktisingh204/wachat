export function compact(n: number | null | undefined): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return v.toString();
}

export function curr(n: number | null | undefined, c = "INR"): string {
  const sym = c === "INR" ? "₹" : "$";
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${sym}${(v / 1_000).toFixed(1)}k`;
  return `${sym}${v.toLocaleString()}`;
}

export function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

export function trend(cur: number, prev: number) {
  if (!prev) return { delta: cur > 0 ? 100 : 0, up: cur >= 0 };
  const delta = ((cur - prev) / prev) * 100;
  return { delta: Math.round(delta * 10) / 10, up: delta >= 0 };
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}
