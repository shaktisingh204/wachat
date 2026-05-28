'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  DataTable,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import {
  Link as LinkIcon,
  MousePointerClick,
  RefreshCw,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { useProject } from '@/context/project-context';
import { getLinkClicks } from '@/app/actions/wachat-features.actions';
import * as React from 'react';

type ClickRecord = {
  url?: string;
  link?: string;
  clickedAt?: string;
  createdAt?: string;
  campaignName?: string;
  messagesSent?: number;
};

type GroupedLink = {
  url: string;
  count: number;
  lastClicked: string;
  clicks: ClickRecord[];
  campaignName?: string;
  messagesSent?: number;
};

export default function LinkTrackingPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [clicks, setClicks] = useState<ClickRecord[]>([]);
  const [viewing, setViewing] = useState<GroupedLink | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupedLink | null>(null);
  
  const [page, setPage] = useState(1);
  const pageSize = 20;

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
      { count: number; lastClicked: string; clicks: ClickRecord[]; campaignName?: string; messagesSent?: number }
    >();
    for (const c of clicks) {
      const url = c.url || c.link || '';
      const ts = c.clickedAt || c.createdAt || '';
      
      const key = c.campaignName ? `${url}|${c.campaignName}` : url;
      
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.clicks.push(c);
        if (ts > existing.lastClicked) existing.lastClicked = ts;
        if (c.messagesSent && (!existing.messagesSent || c.messagesSent > existing.messagesSent)) {
           existing.messagesSent = c.messagesSent;
        }
      } else {
        map.set(key, { 
           count: 1, 
           lastClicked: ts, 
           clicks: [c],
           campaignName: c.campaignName,
           messagesSent: c.messagesSent
        });
      }
    }
    return Array.from(map.entries())
      .map(([key, data]) => {
          const url = data.clicks[0]?.url || data.clicks[0]?.link || '';
          return { url, ...data };
      })
      .sort((a, b) => b.count - a.count);
  }, [clicks]);

  const chartData = useMemo(() => {
     const dateMap = new Map<string, number>();
     for (const c of clicks) {
         const ts = c.clickedAt || c.createdAt;
         if (!ts) continue;
         const d = new Date(ts);
         if (isNaN(d.getTime())) continue;
         const dStr = d.toISOString().split('T')[0];
         dateMap.set(dStr, (dateMap.get(dStr) || 0) + 1);
     }
     return Array.from(dateMap.entries())
       .sort((a, b) => a[0].localeCompare(b[0]))
       .map(([date, count]) => ({ date, count }));
  }, [clicks]);

  const totalClicks = clicks.length;
  const uniqueLinks = grouped.length;
  
  const paginatedClicks = useMemo(() => {
    if (!viewing) return [];
    const start = (page - 1) * pageSize;
    return viewing.clicks.slice(start, start + pageSize);
  }, [viewing, page]);
  
  const totalPages = viewing ? Math.ceil(viewing.clicks.length / pageSize) : 0;

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
            className="inline-flex max-w-[320px] items-center gap-1.5 truncate text-[13px] text-zoru-ink hover:underline"
            title={row.original.url}
          >
            <LinkIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {row.original.url.length > 50
                ? `${row.original.url.slice(0, 50)}…`
                : row.original.url}
            </span>
          </a>
        ),
      },
      {
        accessorKey: 'campaignName',
        header: 'Campaign',
        cell: ({ row }) => (
          <span className="text-zoru-ink text-[13px]">
            {row.original.campaignName || '—'}
          </span>
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
        id: 'ctr',
        header: 'CTR',
        cell: ({ row }) => {
           if (!row.original.messagesSent) return <span className="text-zoru-ink-muted">—</span>;
           const ctr = (row.original.count / row.original.messagesSent) * 100;
           return <span className="font-mono text-zoru-ink">{ctr.toFixed(1)}%</span>;
        }
      },
      {
        accessorKey: 'lastClicked',
        header: 'Last clicked',
        cell: ({ row }) => (
          <span className="text-[12px] text-zoru-ink-muted whitespace-nowrap">
            {row.original.lastClicked
              ? formatUTC(row.original.lastClicked, true)
              : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="View clicks"
              onClick={() => {
                setViewing(row.original);
                setPage(1);
              }}
            >
              <Eye />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete tracked link"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
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
      </Breadcrumb>

      <PageHeader className="mt-2">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat · Tools</ZoruPageEyebrow>
          <ZoruPageTitle>Link Tracking</ZoruPageTitle>
          <ZoruPageDescription>
            Track clicks on links sent through WhatsApp messages, and measure campaign performance.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isPending}
          >
            <RefreshCw className={isPending ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5 flex flex-col justify-center">
          <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            Total Clicks
          </div>
          <div className="mt-1 text-[28px] tabular-nums text-zoru-ink">
            {totalClicks}
          </div>
        </Card>
        <Card className="p-5 flex flex-col justify-center">
          <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            Unique Links
          </div>
          <div className="mt-1 text-[28px] tabular-nums text-zoru-ink">
            {uniqueLinks}
          </div>
        </Card>
        
        <Card className="p-5 sm:col-span-2 lg:col-span-1 flex flex-col justify-center min-h-[140px]">
           {chartData.length > 0 ? (
             <div className="h-full w-full flex flex-col">
               <div className="mb-2 text-[11px] uppercase tracking-wide text-zoru-ink-muted">Clicks Over Time</div>
               <div className="flex-1 min-h-[80px]">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="var(--zoru-brand)" stopOpacity={0.3} />
                         <stop offset="95%" stopColor="var(--zoru-brand)" stopOpacity={0} />
                       </linearGradient>
                     </defs>
                     <Tooltip 
                       contentStyle={{ borderRadius: 'var(--zoru-radius)', fontSize: '12px', border: '1px solid var(--zoru-line)', background: 'var(--zoru-surface)', color: 'var(--zoru-ink)' }}
                       labelFormatter={(label) => formatUTC(label, false)}
                       itemStyle={{ color: 'var(--zoru-ink)' }}
                     />
                     <Area 
                       type="monotone" 
                       dataKey="count" 
                       stroke="var(--zoru-brand)" 
                       fillOpacity={1} 
                       fill="url(#colorCount)" 
                     />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
             </div>
           ) : (
             <div className="flex h-full flex-col items-center justify-center text-zoru-ink-muted text-[13px]">
               No chart data available
             </div>
           )}
        </Card>
      </div>

      {isPending && grouped.length === 0 ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={<MousePointerClick />}
          title="No link clicks yet"
          description="Once your messages get clicks, they'll show up here grouped by URL."
        />
      ) : (
        <Card className="p-4">
          <DataTable
            columns={columns}
            data={grouped}
            filterColumn="url"
            filterPlaceholder="Filter URLs…"
          />
        </Card>
      )}

      {/* View clicks dialog */}
      <Dialog
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewing(null);
            setPage(1);
          }
        }}
      >
        <ZoruDialogContent className="max-w-2xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Click history</ZoruDialogTitle>
            <ZoruDialogDescription className="break-all">
              {viewing?.url}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          
          {viewing && viewing.campaignName && (
             <div className="text-[13px] text-zoru-ink">
               <span className="font-medium">Campaign:</span> {viewing.campaignName}
               {viewing.messagesSent && (
                  <span className="ml-4 text-zoru-ink-muted">
                     CTR: {((viewing.count / viewing.messagesSent) * 100).toFixed(1)}% ({viewing.count}/{viewing.messagesSent} clicks)
                  </span>
               )}
             </div>
          )}

          {viewing ? (
            <div className="flex flex-col gap-3">
              <div className="max-h-[50vh] overflow-y-auto rounded-[var(--zoru-radius)] border border-zoru-line">
                <table className="w-full text-[13px]">
                  <thead className="border-b border-zoru-line bg-zoru-surface text-[11px] uppercase tracking-wide text-zoru-ink-muted sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-left">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zoru-line">
                    {paginatedClicks.map((c, idx) => {
                      const ts = c.clickedAt || c.createdAt || '';
                      const absoluteIdx = (page - 1) * pageSize + idx + 1;
                      return (
                        <tr key={`${ts}-${absoluteIdx}`}>
                          <td className="px-4 py-2 text-zoru-ink-muted tabular-nums">
                            {absoluteIdx}
                          </td>
                          <td className="px-4 py-2 text-zoru-ink whitespace-nowrap">
                            {ts ? formatUTC(ts, true) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-[12px] text-zoru-ink-muted">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, viewing.clicks.length)} of {viewing.clicks.length}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={page === 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-[13px] text-zoru-ink font-medium px-2">
                       {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={page === totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </ZoruDialogContent>
      </Dialog>

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
