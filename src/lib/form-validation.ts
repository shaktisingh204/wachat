export function hasNegativeNumber(
  data: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const raw = data[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const value = Number(raw);
    if (Number.isFinite(value) && value < 0) return key;
  }
  return null;
}

export function isDateBefore(
  data: Record<string, unknown>,
  startKey: string,
  endKey: string,
): boolean {
  const startRaw = data[startKey];
  const endRaw = data[endKey];
  if (!startRaw || !endRaw) return false;

  const start = new Date(startRaw as any);
  const end = new Date(endRaw as any);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  return end.getTime() < start.getTime();
}
