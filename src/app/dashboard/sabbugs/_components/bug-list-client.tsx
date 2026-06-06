'use client';

import * as React from 'react';
import Link from 'next/link';

import {
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Checkbox,
  Label,
  EmptyState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';

import { listBugs, saveCurrentFilter, deleteSavedFilter } from '@/app/actions/bug-tracker.actions';
import type { BugDoc } from '@/lib/rust-client/bug-tracker-bugs';
import type { BugSavedFilterDoc } from '@/lib/rust-client/bug-tracker-saved-filters';

import {
  BugPriorityBadge,
  BugSeverityBadge,
  BugStatusBadge,
  bugTitle,
  type ProjectOption,
} from './bug-shared';
import { BugFilters, toListParams, type BugFiltersValue } from './bug-filters';

export interface BugListClientProps {
  initialBugs: BugDoc[];
  initialError?: string;
  initialHasMore: boolean;
  savedFilters: BugSavedFilterDoc[];
  projectOptions: ProjectOption[];
}

export function BugListClient({
  initialBugs,
  initialError,
  initialHasMore,
  savedFilters,
  projectOptions,
}: BugListClientProps) {
  const [bugs, setBugs] = React.useState<BugDoc[]>(initialBugs);
  const [error, setError] = React.useState<string | undefined>(initialError);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [filters, setFilters] = React.useState<BugFiltersValue>({});
  const [loading, setLoading] = React.useState(false);
  const [filtersList, setFiltersList] = React.useState(savedFilters);
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false);

  // Refetch whenever filters change (debounced via setTimeout).
  React.useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      const res = await listBugs({ ...toListParams(filters), page: 0, limit: 20 });
      if (cancelled) return;
      setBugs(res.bugs);
      setError(res.error);
      setHasMore(res.hasMore);
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [filters]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--st-text)]">Bugs</h1>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Internal developer bug tracker — {bugs.length} result
            {bugs.length === 1 ? '' : 's'}
            {hasMore ? '+' : ''}
          </p>
        </div>
      </div>

      <Card className="flex flex-col gap-4 p-4">
        <BugFilters
          value={filters}
          onChange={setFilters}
          projectOptions={projectOptions}
          onSaveCurrent={() => setSaveDialogOpen(true)}
        />

        {filtersList.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
              Saved:
            </span>
            {filtersList.map((f) => (
              <SavedFilterChip
                key={f._id}
                filter={f}
                onApply={() => setFilters((f.queryJson as BugFiltersValue) ?? {})}
                onDelete={async () => {
                  const res = await deleteSavedFilter(f._id);
                  if (res.deleted) {
                    setFiltersList((prev) => prev.filter((x) => x._id !== f._id));
                  }
                }}
              />
            ))}
          </div>
        ) : null}
      </Card>

      {error ? (
        <Card className="border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4 text-sm text-[var(--st-text)]">
          {error}
        </Card>
      ) : null}

      <BugListTable bugs={bugs} loading={loading} />

      <SaveFilterDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        filters={filters}
        onSaved={(f) => setFiltersList((prev) => [f, ...prev])}
      />
    </div>
  );
}

function SavedFilterChip({
  filter,
  onApply,
  onDelete,
}: {
  filter: BugSavedFilterDoc;
  onApply: () => void;
  onDelete: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--zoru-divider)] bg-[var(--st-bg-muted)] px-2 py-1 text-xs">
      <button
        type="button"
        className="text-[var(--st-text)] hover:underline"
        onClick={onApply}
      >
        {filter.name}
        {filter.isShared ? ' · shared' : ''}
      </button>
      <button
        type="button"
        aria-label={`Remove saved filter ${filter.name}`}
        className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
        onClick={onDelete}
      >
        ×
      </button>
    </span>
  );
}

function BugListTable({ bugs, loading }: { bugs: BugDoc[]; loading: boolean }) {
  if (loading && bugs.length === 0) {
    return (
      <Card className="p-6 text-sm text-[var(--st-text-secondary)]">Loading bugs…</Card>
    );
  }
  if (bugs.length === 0) {
    return (
      <EmptyState
        title="No bugs found"
        description="Try clearing your filters, or report a new bug."
      />
    );
  }
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Reported</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bugs.map((b) => (
            <TableRow key={b._id}>
              <TableCell>
                <Link
                  href={`/dashboard/sabbugs/${b._id}`}
                  className="font-medium text-[var(--st-text)] hover:underline"
                >
                  {bugTitle(b)}
                </Link>
                {b.labels && b.labels.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {b.labels.map((l) => (
                      <span
                        key={l}
                        className="rounded bg-[var(--st-bg-muted)] px-1.5 py-0.5 text-[10px] text-[var(--st-text-secondary)]"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                ) : null}
              </TableCell>
              <TableCell>
                <BugStatusBadge status={b.status} />
              </TableCell>
              <TableCell>
                <BugSeverityBadge severity={b.severity} />
              </TableCell>
              <TableCell>
                <BugPriorityBadge priority={b.priority} />
              </TableCell>
              <TableCell className="text-xs text-[var(--st-text-secondary)]">
                {b.createdAt
                  ? new Date(b.createdAt).toLocaleDateString()
                  : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/**
 * Modal used to save the current filter set under a name.
 *
 * Kept as a top-level component (not nested inside the list client) per
 * the "no inline components" rule — but we mount it from the list client.
 */
export function SaveFilterDialog({
  open,
  onOpenChange,
  filters,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  filters: BugFiltersValue;
  onSaved: (f: BugSavedFilterDoc) => void;
}) {
  const [name, setName] = React.useState('');
  const [shared, setShared] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const toast = useZoruToast();

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await saveCurrentFilter({
      name: name.trim(),
      queryJson: filters as unknown as Record<string, unknown>,
      isShared: shared,
    });
    setBusy(false);
    if (res.error) {
      toast?.error?.(res.error);
      return;
    }
    if (res.filter) onSaved(res.filter);
    onOpenChange(false);
    setName('');
    setShared(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Save current filter</ZoruDialogTitle>
          <ZoruDialogDescription>
            Pin this filter set so you can return to it later. Sharing makes it
            visible to everyone in your tenant.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="bug-filter-name">Name</Label>
            <Input
              id="bug-filter-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. P1 open across mobile"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={shared}
              onCheckedChange={(v) => setShared(Boolean(v))}
            />
            Share with everyone in my tenant
          </label>
        </div>
        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
