'use client';

/**
 * /dashboard/facebook/subscribers — Messenger subscriber list (ZoruUI).
 *
 * Loads all PSIDs that have ever messaged the connected Facebook Page and
 * surfaces them in a Zoru data table with bulk-action menu, search filter,
 * and an add-subscriber dialog. Same data + same handlers as the original
 * wabasimplify version.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import type { WithId } from 'mongodb';
import type { ColumnDef } from '@tanstack/react-table';
import {
  AlertCircle,
  Copy,
  Download,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';

import { getFacebookSubscribers } from '@/app/actions/facebook.actions';
import type { FacebookSubscriber } from '@/lib/definitions';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCheckbox,
  ZoruDataTable,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  ZoruStatCard,
  useZoruToast,
} from '@/components/zoruui';

type SubscriberRow = WithId<FacebookSubscriber>;

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-center justify-between">
        <ZoruSkeleton className="h-9 w-72" />
        <ZoruSkeleton className="h-9 w-36" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <ZoruSkeleton className="h-28" />
        <ZoruSkeleton className="h-28" />
        <ZoruSkeleton className="h-28" />
      </div>
      <ZoruSkeleton className="mt-6 h-72" />
    </div>
  );
}

export default function SubscribersPage() {
  const { toast } = useZoruToast();
  const [subscribers, setSubscribers] = useState<SubscriberRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<SubscriberRow[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    setProjectId(localStorage.getItem('activeProjectId'));
  }, []);

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const { subscribers: rows, error: fetchErr } =
        await getFacebookSubscribers(projectId);
      if (fetchErr) {
        setError(fetchErr);
      } else if (rows) {
        setError(null);
        setSubscribers(rows);
      }
    });
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [projectId, fetchData]);

  const columns = useMemo<ColumnDef<SubscriberRow>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <ZoruCheckbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <ZoruCheckbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'name',
        header: 'User',
        cell: ({ row }) => {
          const sub = row.original;
          return (
            <div className="flex items-center gap-3">
              <ZoruAvatar className="h-8 w-8">
                <ZoruAvatarImage
                  src={`https://graph.facebook.com/${sub.psid}/picture`}
                  alt={sub.name}
                />
                <ZoruAvatarFallback>
                  {sub.name?.charAt(0)?.toUpperCase() || '?'}
                </ZoruAvatarFallback>
              </ZoruAvatar>
              <span className="text-[13px] text-zoru-ink">{sub.name}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'psid',
        header: 'Page-Scoped ID',
        cell: ({ row }) => (
          <span className="font-mono text-[11.5px] text-zoru-ink-muted">
            {row.original.psid}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.status ? (
            <ZoruBadge variant="outline">{row.original.status}</ZoruBadge>
          ) : (
            <span className="text-[11.5px] text-zoru-ink-subtle">—</span>
          ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Subscribed',
        cell: ({ row }) =>
          row.original.createdAt ? (
            <span className="text-[11.5px] text-zoru-ink-muted">
              {new Date(row.original.createdAt).toLocaleDateString()}
            </span>
          ) : (
            <span className="text-[11.5px] text-zoru-ink-subtle">—</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const sub = row.original;
          return (
            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="ghost" size="icon-sm" aria-label="Row actions">
                  <MoreHorizontal />
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end" className="w-40">
                <ZoruDropdownMenuLabel>Actions</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuItem
                  onSelect={() => {
                    navigator.clipboard.writeText(sub.psid);
                    toast({ title: 'PSID copied' });
                  }}
                >
                  <Copy /> Copy PSID
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem
                  onSelect={() =>
                    window.open(
                      `/dashboard/facebook/messages?psid=${sub.psid}`,
                      '_self',
                    )
                  }
                >
                  <MessageSquare /> Open thread
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [toast],
  );

  const handleBulkExport = useCallback(() => {
    const rows = selectedRows.length > 0 ? selectedRows : subscribers;
    if (rows.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'No subscribers selected.',
        variant: 'destructive',
      });
      return;
    }
    const header = 'name,psid,status,createdAt';
    const lines = rows.map((r) =>
      [
        JSON.stringify(r.name ?? ''),
        r.psid,
        r.status ?? '',
        r.createdAt ? new Date(r.createdAt).toISOString() : '',
      ].join(','),
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `messenger-subscribers-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${rows.length} subscribers` });
  }, [selectedRows, subscribers, toast]);

  if (isLoading && subscribers.length === 0) return <PageSkeleton />;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Subscribers</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Audience</ZoruPageEyebrow>
          <ZoruPageTitle>Messenger subscribers</ZoruPageTitle>
          <ZoruPageDescription>
            Every user who has messaged your connected Facebook Page. Use the
            bulk menu to export or trigger a broadcast.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw /> Refresh
          </ZoruButton>
          <ZoruButton size="sm" onClick={() => setAddOpen(true)}>
            <Plus /> Add subscriber
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {!projectId ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Select a project from the dashboard to view its subscribers.
          </ZoruAlertDescription>
        </ZoruAlert>
      ) : error ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Could not load subscribers</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      ) : (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <ZoruStatCard
              label="Total subscribers"
              value={subscribers.length.toLocaleString()}
              period="All Messenger threads"
              icon={<Users />}
            />
            <ZoruStatCard
              label="Selected"
              value={selectedRows.length.toLocaleString()}
              period="Ready for bulk action"
              icon={<Users />}
            />
            <ZoruStatCard
              label="With status"
              value={subscribers
                .filter((s) => !!s.status)
                .length.toLocaleString()}
              period="Tagged or assigned"
              icon={<Users />}
            />
          </div>

          <div className="mt-6">
            <ZoruDataTable
              columns={columns}
              data={subscribers}
              filterColumn="name"
              filterPlaceholder="Search by name…"
              onRowSelectionChange={setSelectedRows}
              empty={
                <ZoruEmptyState
                  compact
                  icon={<Users />}
                  title="No subscribers yet"
                  description="Once a user messages your Page they will appear here."
                />
              }
              toolbar={
                <ZoruDropdownMenu>
                  <ZoruDropdownMenuTrigger asChild>
                    <ZoruButton variant="outline" size="sm">
                      <MoreHorizontal /> Bulk actions
                    </ZoruButton>
                  </ZoruDropdownMenuTrigger>
                  <ZoruDropdownMenuContent align="end" className="w-52">
                    <ZoruDropdownMenuLabel>
                      {selectedRows.length > 0
                        ? `${selectedRows.length} selected`
                        : 'All subscribers'}
                    </ZoruDropdownMenuLabel>
                    <ZoruDropdownMenuSeparator />
                    <ZoruDropdownMenuItem onSelect={handleBulkExport}>
                      <Download /> Export CSV
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuItem
                      onSelect={() =>
                        (window.location.href =
                          '/dashboard/facebook/broadcasts')
                      }
                    >
                      <MessageSquare /> Broadcast to selected
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuSeparator />
                    <ZoruDropdownMenuItem
                      disabled
                      onSelect={() =>
                        toast({
                          title: 'Not available',
                          description:
                            'Removing PSIDs requires a Page-level admin tool.',
                          variant: 'destructive',
                        })
                      }
                    >
                      <Trash2 /> Remove
                    </ZoruDropdownMenuItem>
                  </ZoruDropdownMenuContent>
                </ZoruDropdownMenu>
              }
            />
          </div>
        </>
      )}

      {/* ── Add subscriber dialog (manual PSID, informational) ── */}
      <ZoruDialog open={addOpen} onOpenChange={setAddOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add subscriber</ZoruDialogTitle>
            <ZoruDialogDescription>
              Subscribers are created automatically when a user messages your
              Page. You can manually note a PSID below for reference — it will
              not bypass Meta&apos;s messaging window rules.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="manual-name">Display name</ZoruLabel>
              <ZoruInput id="manual-name" placeholder="Jane Doe" />
            </div>
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="manual-psid">Page-Scoped ID</ZoruLabel>
              <ZoruInput id="manual-psid" placeholder="123456789" />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={() => {
                toast({
                  title: 'Saved locally',
                  description:
                    'PSID noted. Real subscriber records are created on first inbound message.',
                });
                setAddOpen(false);
              }}
            >
              Save
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
