import { TELEGRAM_ALLOWED_UPDATES } from "@/lib/rust-client/telegram-webhooks-shared";

export const ACCENT = "#229ED9";

export const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "destructive" | "ghost" | "info"
> = {
  received: "info",
  processed: "success",
  failed: "destructive",
  pending: "warning",
  retrying: "warning",
  failed_permanent: "destructive",
  resolved: "success",
};

export const EVENT_TYPE_OPTIONS = [
  { value: "all", label: "All events" },
  ...TELEGRAM_ALLOWED_UPDATES.map((v) => ({ value: v, label: v })),
];

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    // Fix hydration mismatch by using a deterministic format.
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toISOString().replace("T", " ").substring(0, 19) + " UTC";
  } catch {
    return iso;
  }
}

export function fmtNumber(n: number): string {
  return n.toLocaleString();
}

export function maskSecret(s?: string): string {
  if (!s) return "—";
  if (s.length <= 6) return "••••";
  return `${s.slice(0, 3)}…${s.slice(-3)}`;
}
