/**
 * Client-safe formatting + small mappers shared across SabBigin surfaces.
 *
 * Mirrors the server-only helpers in
 * `src/app/dashboard/sabbigin/_components/sabbigin-data.ts` but without the
 * `server-only` import so client components (board, list, drawers) can use
 * them too.
 */

export function formatCurrency(value: number, currency = 'INR'): string {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      notation: value >= 1_00_00_000 ? 'compact' : 'standard',
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return 'No date';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return 'No date';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function relativeTime(value?: string | Date | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  const diff = Date.now() - d.getTime();
  if (Number.isNaN(diff)) return '';
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return mins <= 0 ? 'just now' : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (Math.abs(days) < 30) return `${days}d ago`;
  return formatDate(d);
}

export type StageTone = 'success' | 'danger' | 'info' | 'warning' | 'neutral';

export function stageTone(stage?: string | null): StageTone {
  const s = (stage ?? '').toLowerCase();
  if (!s) return 'neutral';
  if (/(won|closed won|deal done|complete)/.test(s)) return 'success';
  if (/(lost|dead|not serviceable|cancel|closed lost)/.test(s)) return 'danger';
  if (/(negotiat|proposal|qualif)/.test(s)) return 'warning';
  return 'info';
}

/** Map a stage tone to a 20ui Badge `tone`/`variant` value. */
export function badgeToneForStage(stage?: string | null): StageTone {
  return stageTone(stage);
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** True when a stage name reads as a terminal win. */
export function isWonStage(stage?: string | null): boolean {
  return /(won|closed won|deal done|complete)/i.test(stage ?? '');
}

/** True when a stage name reads as a terminal loss. */
export function isLostStage(stage?: string | null): boolean {
  return /(lost|dead|not serviceable|cancel|closed lost)/i.test(stage ?? '');
}
