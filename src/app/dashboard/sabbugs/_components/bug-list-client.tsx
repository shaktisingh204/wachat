'use client';

import * as React from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

import {
  Alert,
  Button,
  IconButton,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Checkbox,
  Badge,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
} from '@/components/sabcrm/20ui';

import { listBugs, saveCurrentFilter, deleteSavedFilter } from '@/app/actions/bug-tracker.actions';
import type { BugDoc } from '@/lib/rust-client/sabbugs-bugs';
import type { BugSavedFilterDoc } from '@/lib/rust-client/sabbugs-saved-filters';

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
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Bugs</PageTitle>
          <PageDescription>
            Internal developer bug tracker. {bugs.length} result
            {bugs.length === 1 ? '' : 's'}
            {hasMore ? '+' : ''}
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card className="flex flex-col gap-4">
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
        <Alert tone="danger" title="Could not load bugs">
          {error}
        </Alert>
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
    <span className="inline-flex items-center gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] pl-1 pr-0.5">
      <Button variant="ghost" size="sm" onClick={onApply}>
        {filter.name}
        {filter.isShared ? ' · shared' : ''}
      </Button>
      <IconButton
        label={`Remove saved filter ${filter.name}`}
        icon={X}
        variant="ghost"
        size="sm"
        onClick={onDelete}
      />
    </span>
  );
}

function BugListTable({ bugs, loading }: { bugs: BugDoc[]; loading: boolean }) {
  if (loading && bugs.length === 0) {
    return (
      <Card className="text-sm text-[var(--st-text-secondary)]">Loading bugs...</Card>
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
    <Card padding="none" className="overflow-hidden">
      <Table>
        <THead>
          <Tr>
            <Th>Title</Th>
            <Th>Status</Th>
            <Th>Severity</Th>
            <Th>Priority</Th>
            <Th>Reported</Th>
          </Tr>
        </THead>
        <TBody>
          {bugs.map((b) => (
            <Tr key={b._id}>
              <Td>
                <Link
                  href={`/dashboard/sabbugs/${b._id}`}
                  className="font-medium text-[var(--st-text)] hover:underline"
                >
                  {bugTitle(b)}
                </Link>
                {b.labels && b.labels.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {b.labels.map((l) => (
                      <Badge key={l} tone="neutral" kind="soft">
                        {l}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </Td>
              <Td>
                <BugStatusBadge status={b.status} />
              </Td>
              <Td>
                <BugSeverityBadge severity={b.severity} />
              </Td>
              <Td>
                <BugPriorityBadge priority={b.priority} />
              </Td>
              <Td className="text-xs text-[var(--st-text-secondary)]">
                {b.createdAt
                  ? new Date(b.createdAt).toLocaleDateString()
                  : '-'}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

/**
 * Modal used to save the current filter set under a name.
 *
 * Kept as a top-level component (not nested inside the list client) per
 * the "no inline components" rule, but we mount it from the list client.
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
  const { toast } = useToast();

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
      toast.error(res.error);
      return;
    }
    if (res.filter) onSaved(res.filter);
    onOpenChange(false);
    setName('');
    setShared(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save current filter</DialogTitle>
          <DialogDescription>
            Pin this filter set so you can return to it later. Sharing makes it
            visible to everyone in your tenant.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. P1 open across mobile"
            />
          </Field>
          <Checkbox
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
            label="Share with everyone in my tenant"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
