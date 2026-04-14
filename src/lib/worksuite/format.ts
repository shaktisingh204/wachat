/** Shared formatting helpers used across Worksuite public portal pages. */

export function fmtCurrency(value: number | undefined, currency?: string): string {
  const n = Number(value || 0);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
    }).format(n);
  } catch {
    return `${currency || ''} ${n.toFixed(2)}`;
  }
}

export function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | number | Date);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function fmtDateTime(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | number | Date);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}
