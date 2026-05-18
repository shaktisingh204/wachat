'use client';

export type HolidaysKpiKey = 'total' | 'national' | 'regional' | 'optional' | 'recurring';

export interface HolidaysKpiSnapshot {
  total: number;
  national: number;
  regional: number;
  optional: number;
  recurring: number;
}

export function HolidaysKpiStrip(_props: any): null {
  return null;
}
