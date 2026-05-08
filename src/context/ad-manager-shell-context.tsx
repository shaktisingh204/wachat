'use client';

import * as React from 'react';
import type { DateRange } from 'react-day-picker';

export type AdManagerShellState = {
  search: string;
  setSearch: (s: string) => void;
  date: DateRange | undefined;
  setDate: (d: DateRange | undefined) => void;
  preset: string;
  setPreset: (p: string) => void;
};

export const AdManagerShellContext =
  React.createContext<AdManagerShellState | null>(null);

export function useAdManagerShell() {
  const ctx = React.useContext(AdManagerShellContext);
  if (!ctx) throw new Error('useAdManagerShell must be used inside ad-manager layout');
  return ctx;
}
