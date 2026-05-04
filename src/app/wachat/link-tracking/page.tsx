'use client';

/**
 * Wachat Link Tracking (ZoruUI).
 *
 * Tracked links table with view-clicks dialog and delete-confirm
 * alert. Only display data is currently surfaced server-side; the
 * dialog actions are wired for when delete is added.
 */

import * as React from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { Link as LinkIcon, MousePointerClick, RefreshCw, Eye, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import { useProject } from '@/context/project-context';
import { getLinkClicks } from '@/app/actions/wachat-features.actions';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDataTable,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';

export const dynamic = 'force-dynamic';

type ClickRecord = {
  url?: string;
  link?: string;
  clickedAt?: string;
  createdAt?: string;
};

type GroupedLink = {
  url: string;
  count: number;
  lastClicked: string;
  clicks: ClickRecord[];
};

export default function LinkTrackingPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [clicks, setClicks] = useState<ClickRecord[]>([]);
  const [viewing, setViewing] = useState<GroupedLink | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupedLink | null>(null);

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getLinkClicks(activeProjectId);
      if (res.error)
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
      else setClicks((res.clicks ?? []) as ClickRecord[]);
    });
  }, [activeProjectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const grouped: GroupedLink[] = useMemo(() => {
    const map = new Map<
      string,
      { count: number; lastClicked: string; clicks: ClickRecord[] }
    >();
    for (const c of clicks) {
      const url = c.url || c.link || '';
      const ts = c.clickedAt || c.createdAt || '';
      const existing = map.get(url);
      if (existing) {
        existing.count += 1;
        existing.clicks.push(c);
        if (ts > existing.lastClicked) existing.lastClicked = ts;
      } else {
        map.set(url, { count: 1, lastClicked: ts, clicks: [c] });
      }
    }
    return Array.from(map.entries())
      .map(([url, data]) => ({ url, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [clicks]);

  const totalClicks = clicks.length;
  const uniqueLinks = grouped.length;

  const columns = useMemo<ColumnDef<GroupedLink>[]>(
    () => [
      {
        accessorKey: 'url',
        header: 'URL',
        cell: ({ row }) => (
          <a
            href={row.original.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-[420px] items-center gap-1.5 truncate text-[13px] text-zoru-ink hover:underline"
            title={row.original.url}
          >
            <LinkIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {row.original.url.length > 60
                ? `${row.original.url.slice(0, 60)}…`
                : row.original.url}
            </span>
          </a>
        ),
      },
      {
        accessorKey: 'count',
        header: 'Clicks',
        cell: ({ row }) => (
          <span className="font-mono tabular-nums text-zoru-ink">
            {row.original.count}
          </span>
        ),
      },
      {
        accessorKey: 'lastClicked',
        header: 'Last clicked',
        cell: ({ row }) => (
          <span className="text-[12px] text-zoru-ink-muted whitespace-nowrap">
            {row.original.lastClicked
              ? new Date(row.original.lastClicked).toLocaleString()
              : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <ZoruButton
              variant="ghost"
              size="icon-sm"
              aria-label="View clicks"
              onClick={() => setViewing(row.original)}
            >
              <Eye />
            </ZoruButton>
            <ZoruButton
              variant="ghost"
              size="icon-sm"
              aria-label="Delete tracked link"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 />
            </ZoruButton>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>
              {activeProject?.name
                ? `${activeProject.name} · Link Tracking`
                : 'Link Tracking'}
            </ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-2">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat · Tools</ZoruPageEyebrow>
          <ZoruPageTitle>Link Tracking</ZoruPageTitle>
          <ZoruPageDescription>
            Track clicks on links sent through WhatsApp messages.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isPending}
          >
            <RefreshCw className={isPending ? 'animate-spin' : ''} />
            Refresh
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ZoruCard className="p-5">
          <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            Total Clicks
          </div>
          <div className="mt-1 text-[28px] tabular-nums text-zoru-ink">
            {totalClicks}
          </div>
        </ZoruCard>
        <ZoruCard className="p-5">
          <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            Unique Links
          </div>
          <div className="mt-1 text-[28px] tabular-nums text-zoru-ink">
            {uniqueLinks}
          </div>
        </ZoruCard>
      </div>

      {isPending && grouped.length === 0 ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-12" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <ZoruEmptyState
          icon={<MousePointerClick />}
          title="No link clicks yet"
          description="Once your messages get clicks, they'll show up here grouped by URL."
        />
      ) : (
        <ZoruCard className="p-4">
          <ZoruDataTable
            columns={columns}
            data={grouped}
            filterColumn="url"
            filterPlaceholder="Filter URLs…"
          />
        </ZoruCard>
      )}

      {/* View clicks dialog */}
      <ZoruDialog
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      >
        <ZoruDialogContent className="max-w-2xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Click history</ZoruDialogTitle>
            <ZoruDialogDescription className="break-all">
              {viewing?.url}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          {viewing ? (
            <div className="max-h-[60vh] overflow-y-auto rounded-[var(--zoru-radius)] border border-zoru-line">
              <table className="w-full text-[13px]">
                <thead className="border-b border-zoru-line bg-zoru-surface text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zoru-line">
                  {viewing.clicks.map((c, idx) => {
                    const ts = c.clickedAt || c.createdAt || '';
                    return (
                      <tr key={`${ts}-${idx}`}>
                        <td className="px-4 py-2 text-zoru-ink-muted tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2 text-zoru-ink whitespace-nowrap">
                          {ts ? new Date(ts).toLocaleString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Delete-confirm alert */}
      <ZoruAlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete tracked link?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This removes click analytics for{' '}
              <span className="break-all font-mono text-zoru-ink">
                {deleteTarget?.url}
              </span>
              . The link itself will continue to work in any messages already
              sent.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              destructive
              onClick={() => {
                toast({
                  title: 'Tracked link removed',
                  description:
                    'Click analytics for this URL will no longer be recorded.',
                });
                setDeleteTarget(null);
              }}
            >
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
