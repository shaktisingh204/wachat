/**
 * Localization, Regions & Tax — barrel export.
 *
 * Import directly from this file in app code:
 *
 *   import { t, formatCurrency, calculateTax } from '@/lib/i18n';
 *
 * For React components, prefer the hook in `@/lib/i18n/client`:
 *
 *   import { useT } from '@/lib/i18n/client';
 *
 * For Server Components / Server Actions, prefer `@/lib/i18n/server`:
 *
 *   import { getT } from '@/lib/i18n/server';
 *
 * (Both server.ts and client.tsx are intentionally NOT re-exported here
 * so the barrel stays safe to import from any runtime — `client.tsx`
 * pulls in React and `server.ts` is `server-only`.)
 */

export * from './types';
export * from './registry';
export * from './formatter';
export * from './translate';
export * from './rtl';
export * from './regions';
export * from './currency';
export * from './tax';
export * from './timezone';
