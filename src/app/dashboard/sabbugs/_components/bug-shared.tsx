'use client';

import * as React from 'react';

import { Badge } from '@/components/zoruui';
import type {
  BugDoc,
  BugPriority,
  BugSeverity,
  BugStatus,
} from '@/lib/rust-client/bug-tracker-bugs';

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

export function BugStatusBadge({ status }: { status: BugStatus }) {
  return <Badge variant={statusVariant(status)}>{prettyStatus(status)}</Badge>;
}

export function BugSeverityBadge({ severity }: { severity: BugSeverity }) {
  return <Badge variant={severityVariant(severity)}>{severity}</Badge>;
}

export function BugPriorityBadge({ priority }: { priority: BugPriority }) {
  return <Badge variant="outline">{priority}</Badge>;
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
