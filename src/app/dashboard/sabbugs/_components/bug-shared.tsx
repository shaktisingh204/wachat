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
  severityVariant,
  statusVariant,
  prettyStatus,
} from './bug-constants';

export {
  BUG_STATUSES,
  BUG_SEVERITIES,
  BUG_PRIORITIES,
  severityVariant,
  statusVariant,
  prettyStatus,
  bugTitle,
} from './bug-constants';
export type { ProjectOption } from './bug-constants';

export function BugStatusBadge({ status }: { status: BugStatus }) {
  return <Badge variant={statusVariant(status)}>{prettyStatus(status)}</Badge>;
}

export function BugSeverityBadge({ severity }: { severity: BugSeverity }) {
  return <Badge variant={severityVariant(severity)}>{severity}</Badge>;
}

export function BugPriorityBadge({ priority }: { priority: BugPriority }) {
  return <Badge variant="outline">{priority}</Badge>;
}
