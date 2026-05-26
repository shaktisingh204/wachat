'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Card,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';

import { updateBug } from '@/app/actions/bug-tracker.actions';
import type { BugDoc, BugStatus } from '@/lib/rust-client/bug-tracker-bugs';

import {
  BUG_STATUSES,
  BugPriorityBadge,
  BugSeverityBadge,
  bugTitle,
} from './bug-shared';

export function BugBoardClient({
  initialBugs,
  initialError,
}: {
  initialBugs: BugDoc[];
  initialError?: string;
}) {
  const router = useRouter();
  const toast = useZoruToast();
  const [bugs, setBugs] = React.useState(initialBugs);

  const grouped = React.useMemo(() => {
    const out: Record<BugStatus, BugDoc[]> = {
      open: [],
      in_progress: [],
      fixed: [],
      verified: [],
      reopened: [],
      closed: [],
    };
    for (const b of bugs) out[b.status]?.push(b);
    return out;
  }, [bugs]);

  async function move(bug: BugDoc, status: BugStatus) {
    setBugs((prev) =>
      prev.map((b) => (b._id === bug._id ? { ...b, status } : b)),
    );
    const res = await updateBug(bug._id, { status });
    if (res.error) {
      toast?.error?.(res.error);
      setBugs((prev) =>
        prev.map((b) => (b._id === bug._id ? { ...b, status: bug.status } : b)),
      );
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-[var(--zoru-ink)]">
        Bug board
      </h1>
      {initialError ? (
        <Card className="border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {initialError}
        </Card>
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {BUG_STATUSES.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            bugs={grouped[status]}
            onMove={move}
          />
        ))}
      </div>
    </div>
  );
}

function BoardColumn({
  status,
  bugs,
  onMove,
}: {
  status: BugStatus;
  bugs: BugDoc[];
  onMove: (bug: BugDoc, next: BugStatus) => void;
}) {
  return (
    <Card className="flex flex-col gap-2 p-3">
      <header className="flex items-center justify-between text-xs uppercase tracking-wide text-[var(--zoru-ink-muted)]">
        <span>{status.replace('_', ' ')}</span>
        <span>{bugs.length}</span>
      </header>
      <div className="flex flex-col gap-2">
        {bugs.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--zoru-divider)] p-3 text-center text-xs text-[var(--zoru-ink-muted)]">
            Empty
          </p>
        ) : (
          bugs.map((b) => <BoardCard key={b._id} bug={b} onMove={onMove} />)
        )}
      </div>
    </Card>
  );
}

function BoardCard({
  bug,
  onMove,
}: {
  bug: BugDoc;
  onMove: (bug: BugDoc, next: BugStatus) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--zoru-divider)] bg-[var(--zoru-surface)] p-2 text-sm">
      <Link
        href={`/dashboard/sabbugs/${bug._id}`}
        className="font-medium text-[var(--zoru-ink)] hover:underline"
      >
        {bugTitle(bug)}
      </Link>
      <div className="flex items-center gap-1">
        <BugSeverityBadge severity={bug.severity} />
        <BugPriorityBadge priority={bug.priority} />
      </div>
      <Select
        value={bug.status}
        onValueChange={(v) => onMove(bug, v as BugStatus)}
      >
        <ZoruSelectTrigger className="h-7 text-xs">
          <ZoruSelectValue />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          {BUG_STATUSES.map((s) => (
            <ZoruSelectItem key={s} value={s}>
              Move to {s}
            </ZoruSelectItem>
          ))}
        </ZoruSelectContent>
      </Select>
    </div>
  );
}
