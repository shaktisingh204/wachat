export function formatDate(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export function formatValue(type: string | undefined, value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const t = (type || '').toLowerCase();
  if (t === 'percent' || t === 'percentage') return `${value}%`;
  return value.toLocaleString();
}

export function formatValidity(
  from: string | Date | undefined,
  to: string | Date | undefined,
): string {
  const f = formatDate(from);
  const t = formatDate(to);
  if (f === '—' && t === '—') return '—';
  return `${f} → ${t}`;
}
