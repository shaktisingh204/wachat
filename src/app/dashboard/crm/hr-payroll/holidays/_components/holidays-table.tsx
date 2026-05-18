'use client';

export interface HolidayRow {
  _id?: string;
  date: Date | string;
  name: string;
  type: string;
  recurring: boolean;
  locations: string[];
  notes?: string;
}

export function locationsText(locations: string[]): string {
  return locations.join(', ');
}

export function HolidaysTable(_props: any): null {
  return null;
}
