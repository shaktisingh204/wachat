'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bug, CircleDot, KanbanSquare, Loader } from 'lucide-react';

import {
  Alert,
  Card,
  EmptyState,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  useToast,
} from '@/components/sabcrm/20ui';

import { updateBug } from '@/app/actions/bug-tracker.actions';
import type { BugDoc, BugStatus } from '@/lib/rust-client/sabbugs-bugs';

import {
  BUG_STATUSES,
  BugPriorityBadge,
  BugSeverityBadge,
  bugTitle,
  prettyStatus,
  statusLifecycle,
} from './bug-shared';

export function BugBoardClient({
  initialBugs,
  initialError,
}: {
  initialBugs: BugDoc[];
  initialError?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
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

  const counts = React.useMemo(() => {
    let open = 0;
    let inProgress = 0;
    let resolved = 0;
    for (const b of bugs) {
      const bucket = statusLifecycle(b.status);
      if (bucket === 'open') open += 1;
      else if (bucket === 'in_progress') inProgress += 1;
      else if (bucket === 'resolved') resolved += 1;
    }
    return { open, inProgress, resolved, total: bugs.length };
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
    <div className="flex flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Bug tracker</PageEyebrow>
          <PageTitle>Board</PageTitle>
          <PageDescription>
            Drag a bug through its lifecycle by setting its status. Closed bugs
            are hidden to keep the board focused on active work.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <section
        aria-label="Board summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatCard
          label="Open"
          value={<span className="tabular-nums">{counts.open}</span>}
          icon={CircleDot}
          accent="#dc2626"
        />
        <StatCard
          label="In progress"
          value={<span className="tabular-nums">{counts.inProgress}</span>}
          icon={Loader}
          accent="#2563eb"
        />
        <StatCard
          label="Resolved"
          value={<span className="tabular-nums">{counts.resolved}</span>}
          icon={Bug}
          accent="#16a34a"
        />
        <StatCard
          label="On board"
          value={<span className="tabular-nums">{counts.total}</span>}
          icon={KanbanSquare}
        />
      </section>

      {initialError ? (
        <Alert tone="danger" title="Could not load the board">
          {initialError}
        </Alert>
      ) : null}

      {bugs.length === 0 && !initialError ? (
        <EmptyState
          icon={KanbanSquare}
          title="The board is clear"
          description="No active bugs to triage. New reports land in the Open column."
        />
      ) : (
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
      )}
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
    <section
      aria-label={`${prettyStatus(status)} column`}
      className="flex flex-col gap-2 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3"
    >
      <header className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          {prettyStatus(status)}
        </span>
        <span className="rounded-full bg-[var(--st-bg)] px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--st-text-secondary)]">
          {bugs.length}
        </span>
      </header>
      <div className="flex flex-col gap-2">
        {bugs.length === 0 ? (
          <p className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] p-3 text-center text-xs text-[var(--st-text-secondary)]">
            Nothing here
          </p>
        ) : (
          bugs.map((b) => <BoardCard key={b._id} bug={b} onMove={onMove} />)
        )}
      </div>
    </section>
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
    <Card
      padding="sm"
      className="flex flex-col gap-2 transition-shadow duration-150 hover:shadow-[var(--st-shadow-sm)]"
    >
      <Link
        href={`/dashboard/sabbugs/${bug._id}`}
        className="rounded-[var(--st-radius)] text-sm font-medium text-[var(--st-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--st-bg)]"
      >
        {bugTitle(bug)}
      </Link>
      <div className="flex flex-wrap items-center gap-1">
        <BugSeverityBadge severity={bug.severity} />
        <BugPriorityBadge priority={bug.priority} />
      </div>
      <Select
        value={bug.status}
        onValueChange={(v) => onMove(bug, v as BugStatus)}
      >
        <SelectTrigger className="h-7 text-xs" aria-label="Move bug to status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BUG_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {prettyStatus(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
}
