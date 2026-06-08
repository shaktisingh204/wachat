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
import type { BadgeTone } from '@/components/sabcrm/20ui';

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

/* ─── Tone mappings (20ui BadgeTone) ────────────────────────────── */

/**
 * Severity → badge tone. Higher severity reads hotter so triage can scan a
 * list and spot blockers/criticals without reading every word.
 */
export function severityTone(s: BugSeverity): BadgeTone {
  switch (s) {
    case 'blocker':
    case 'critical':
      return 'danger';
    case 'major':
      return 'warning';
    case 'minor':
      return 'info';
    default:
      return 'neutral';
  }
}

/**
 * Status → badge tone. Open work is hot, in-progress is the accent, resolved
 * states cool to success, and closed sits neutral.
 */
export function statusTone(s: BugStatus): BadgeTone {
  switch (s) {
    case 'open':
    case 'reopened':
      return 'danger';
    case 'in_progress':
      return 'accent';
    case 'fixed':
    case 'verified':
      return 'success';
    default:
      return 'neutral';
  }
}

/** Coarse lifecycle bucket used for KPI strips. */
export type BugLifecycle = 'open' | 'in_progress' | 'resolved' | 'closed';

export function statusLifecycle(s: BugStatus): BugLifecycle {
  if (s === 'open' || s === 'reopened') return 'open';
  if (s === 'in_progress') return 'in_progress';
  if (s === 'fixed' || s === 'verified') return 'resolved';
  return 'closed';
}

export function prettyStatus(s: BugStatus): string {
  if (s === 'in_progress') return 'In progress';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function prettySeverity(s: BugSeverity): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function prettyPriority(p: BugPriority): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function bugTitle(bug: BugDoc): string {
  return bug.title || 'Untitled bug';
}

export interface ProjectOption {
  id: string;
  name: string;
}
