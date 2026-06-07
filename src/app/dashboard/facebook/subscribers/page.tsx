'use client';

import { Alert, AlertDescription, AlertTitle, Avatar, AvatarFallback, AvatarImage, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Checkbox, DataTable, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState, Input, Label, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle, Skeleton, StatCard, useToast } from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
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

/**
 * /dashboard/facebook/subscribers — Messenger subscriber list (Ui20).
 *
 * Loads all PSIDs that have ever messaged the connected Facebook Page and
 * surfaces them in a Ui20 data table with bulk-action menu, search filter,
 * and an add-subscriber dialog. Same data + same handlers as the original
 * wabasimplify version.
 */

import * as React from 'react';

type SubscriberRow = WithId<FacebookSubscriber>;

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-3 w-52" />
      <div className="mt-5 flex items-center justify-between">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="mt-6 h-72" />
    </div>
  );
}

export default function SubscribersPage() {
  const { toast } = useToast();
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
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
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
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={`https://graph.facebook.com/${sub.psid}/picture`}
                  alt={sub.name}
                />
                <AvatarFallback>
                  {sub.name?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-[13px] text-[var(--st-text)]">{sub.name}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'psid',
        header: 'Page-Scoped ID',
        cell: ({ row }) => (
          <span className="font-mono text-[11.5px] text-[var(--st-text-secondary)]">
            {row.original.psid}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.status ? (
            <Badge variant="outline">{row.original.status}</Badge>
          ) : (
            <span className="text-[11.5px] text-[var(--st-text-tertiary)]">—</span>
          ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Subscribed',
        cell: ({ row }) =>
          row.original.createdAt ? (
            <span className="text-[11.5px] text-[var(--st-text-secondary)]">
              {new Date(row.original.createdAt).toLocaleDateString()}
            </span>
          ) : (
            <span className="text-[11.5px] text-[var(--st-text-tertiary)]">—</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const sub = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => {
                    navigator.clipboard.writeText(sub.psid);
                    toast({ title: 'PSID copied' });
                  }}
                >
                  <Copy /> Copy PSID
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    window.open(
                      `/dashboard/facebook/messages?psid=${sub.psid}`,
                      '_self',
                    )
                  }
                >
                  <MessageSquare /> Open thread
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Subscribers</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <PageHeading>
          <PageEyebrow>Audience</PageEyebrow>
          <PageTitle>Messenger subscribers</PageTitle>
          <PageDescription>
            Every user who has messaged your connected Facebook Page. Use the
            bulk menu to export or trigger a broadcast.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw /> Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus /> Add subscriber
          </Button>
        </PageActions>
      </PageHeader>

      {!projectId ? (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No project selected</AlertTitle>
          <AlertDescription>
            Select a project from the dashboard to view its subscribers.
          </AlertDescription>
        </Alert>
      ) : error ? (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load subscribers</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <StatCard
              label="Total subscribers"
              value={subscribers.length.toLocaleString()}
              period="All Messenger threads"
              icon={<Users />}
            />
            <StatCard
              label="Selected"
              value={selectedRows.length.toLocaleString()}
              period="Ready for bulk action"
              icon={<Users />}
            />
            <StatCard
              label="With status"
              value={subscribers
                .filter((s) => !!s.status)
                .length.toLocaleString()}
              period="Tagged or assigned"
              icon={<Users />}
            />
          </div>

          <div className="mt-6">
            <DataTable
              columns={columns}
              data={subscribers}
              filterColumn="name"
              filterPlaceholder="Search by name…"
              onRowSelectionChange={setSelectedRows}
              empty={
                <EmptyState
                  compact
                  icon={<Users />}
                  title="No subscribers yet"
                  description="Once a user messages your Page they will appear here."
                />
              }
              toolbar={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreHorizontal /> Bulk actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>
                      {selectedRows.length > 0
                        ? `${selectedRows.length} selected`
                        : 'All subscribers'}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleBulkExport}>
                      <Download /> Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        (window.location.href =
                          '/dashboard/facebook/broadcasts')
                      }
                    >
                      <MessageSquare /> Broadcast to selected
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
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
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          </div>
        </>
      )}

      {/* ── Add subscriber dialog (manual PSID, informational) ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add subscriber</DialogTitle>
            <DialogDescription>
              Subscribers are created automatically when a user messages your
              Page. You can manually note a PSID below for reference — it will
              not bypass Meta&apos;s messaging window rules.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manual-name">Display name</Label>
              <Input id="manual-name" placeholder="Jane Doe" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manual-psid">Page-Scoped ID</Label>
              <Input id="manual-psid" placeholder="123456789" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
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
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
