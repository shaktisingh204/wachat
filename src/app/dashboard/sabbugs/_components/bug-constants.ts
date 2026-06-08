/**
 * Server-safe bug-tracker constants and pure helpers.
 *
 * These live OUTSIDE the `'use client'` boundary so that Server Components
 * (e.g. the severity-matrix dashboard) can import the real array/function
 * values. Importing them from `bug-shared.tsx` (a client module) would hand a
 * Server Component an opaque client-reference proxy instead of the array,
 * which is why `BUG_SEVERITIES.flatMap` blew up with "is not a function".
 *
 * `bug-shared.tsx` re-exports everything here, so client components keep their
 * existing `import { … } from './bug-shared'` paths unchanged.
 */
import type {
  BugDoc,
  BugPriority,
  BugSeverity,
  BugStatus,
} from '@/lib/rust-client/sabbugs-bugs';

/* ─── Constants reused across list / detail / board ─────────────── */

export const BUG_STATUSES: BugStatus[] = [
  'open',
  'in_progress',
  'fixed',
  'verified',
  'reopened',
  'closed',
];

export const BUG_SEVERITIES: BugSeverity[] = [
  'trivial',
  'minor',
  'major',
  'critical',
  'blocker',
];

export const BUG_PRIORITIES: BugPriority[] = ['low', 'medium', 'high', 'urgent'];

export function severityVariant(
  s: BugSeverity,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'blocker' || s === 'critical') return 'destructive';
  if (s === 'major') return 'default';
  return 'secondary';
}

export function statusVariant(
  s: BugStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'open' || s === 'reopened') return 'destructive';
  if (s === 'in_progress') return 'default';
  if (s === 'fixed' || s === 'verified') return 'secondary';
  return 'outline';
}

export function prettyStatus(s: BugStatus): string {
  if (s === 'in_progress') return 'In progress';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function bugTitle(bug: BugDoc): string {
  return bug.title || 'Untitled bug';
}

export interface ProjectOption {
  id: string;
  name: string;
}
