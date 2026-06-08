'use client';

import * as React from 'react';

import { Badge } from '@/components/sabcrm/20ui';
import type {
  BugPriority,
  BugSeverity,
  BugStatus,
} from '@/lib/rust-client/sabbugs-bugs';

/* ─── Server-safe constants + pure helpers ──────────────────────────
 * These now live in `bug-constants.ts` (outside the `'use client'`
 * boundary) so Server Components get the real values, not client-reference
 * proxies. Re-exported here so existing `from './bug-shared'` imports in
 * client components keep working unchanged. */
import {
  severityTone,
  statusTone,
  prettyStatus,
  prettySeverity,
  prettyPriority,
} from './bug-constants';

export {
  BUG_STATUSES,
  BUG_SEVERITIES,
  BUG_PRIORITIES,
  severityTone,
  statusTone,
  statusLifecycle,
  prettyStatus,
  prettySeverity,
  prettyPriority,
  bugTitle,
} from './bug-constants';
export type { ProjectOption, BugLifecycle } from './bug-constants';

/** Status badge — soft tone, with a leading dot for at-a-glance scanning. */
export function BugStatusBadge({ status }: { status: BugStatus }) {
  return (
    <Badge tone={statusTone(status)} dot>
      {prettyStatus(status)}
    </Badge>
  );
}

/** Severity badge — solid for the two hottest levels so they pop in a row. */
export function BugSeverityBadge({ severity }: { severity: BugSeverity }) {
  const hot = severity === 'blocker' || severity === 'critical';
  return (
    <Badge tone={severityTone(severity)} kind={hot ? 'solid' : 'soft'}>
      {prettySeverity(severity)}
    </Badge>
  );
}

/** Priority badge — quiet outline; severity carries the visual weight. */
export function BugPriorityBadge({ priority }: { priority: BugPriority }) {
  return (
    <Badge tone="neutral" kind="outline">
      {prettyPriority(priority)}
    </Badge>
  );
}
