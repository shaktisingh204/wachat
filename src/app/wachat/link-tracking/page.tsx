'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  Modal,
  Pagination,
  Skeleton,
  StatCard,
  Table,
  TBody,
  Td,
  THead,
  Tr,
  Th,
  useToast,
} from '@/components/sabcrm/20ui';
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
} from 'lucide-react';
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { useProject } from '@/context/project-context';
import { getLinkClicks } from '@/app/actions/wachat-features.actions';
import { formatUTC } from '@/lib/utils';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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
  const { toast } = useToast();
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
          tone: 'danger',
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

  const columns = useMemo<DataTableColumn<GroupedLink>[]>(
    () => [
      {
        key: 'url',
        header: 'URL',
        render: (row) => (
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-[320px] items-center gap-1.5 truncate text-[13px] hover:underline"
            title={row.url}
          >
            <LinkIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {row.url.length > 50
                ? `${row.url.slice(0, 50)}…`
                : row.url}
            </span>
          </a>
        ),
      },
      {
        key: 'campaignName',
        header: 'Campaign',
        render: (row) => (
          <span className="text-[13px]">
            {row.campaignName || '—'}
          </span>
        ),
      },
      {
        key: 'count',
        header: 'Clicks',
        render: (row) => (
          <span className="font-mono tabular-nums">
            {row.count}
          </span>
        ),
      },
      {
        key: 'ctr',
        header: 'CTR',
        render: (row) => {
           if (!row.messagesSent) return <span className="u-text-secondary">—</span>;
           const ctr = (row.count / row.messagesSent) * 100;
           return <span className="font-mono">{ctr.toFixed(1)}%</span>;
        }
      },
      {
        key: 'lastClicked',
        header: 'Last clicked',
        render: (row) => (
          <span className="text-[12px] whitespace-nowrap u-text-secondary">
            {row.lastClicked
              ? formatUTC(row.lastClicked, true)
              : '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1">
            <IconButton
              variant="ghost"
              size="sm"
              label="View clicks"
              icon={Eye}
              onClick={() => {
                setViewing(row);
                setPage(1);
              }}
            />
            <IconButton
              variant="ghost"
              size="sm"
              label="Delete tracked link"
              icon={Trash2}
              onClick={() => setDeleteTarget(row)}
            />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        {
          label: activeProject?.name
            ? `${activeProject.name} · Link Tracking`
            : 'Link Tracking',
        },
      ]}
      eyebrow="WaChat · Tools"
      title="Link Tracking"
      description="Track clicks on links sent through WhatsApp messages, and measure campaign performance."
      width="wide"
      actions={
        <Button
          variant="outline"
          size="sm"
          iconLeft={RefreshCw}
          onClick={fetchData}
          disabled={isPending}
        >
          Refresh
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total Clicks"
            value={totalClicks}
            icon={MousePointerClick}
          />
          <StatCard
            label="Unique Links"
            value={uniqueLinks}
            icon={LinkIcon}
          />

          <Card padding="lg" className="sm:col-span-2 lg:col-span-1 flex flex-col justify-center min-h-[140px]">
             {chartData.length > 0 ? (
               <div className="h-full w-full flex flex-col">
                 <div className="mb-2 text-[11px] uppercase tracking-wide u-text-secondary">Clicks Over Time</div>
                 <div className="flex-1 min-h-[80px]">
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                       <defs>
                         <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="var(--st-accent)" stopOpacity={0.3} />
                           <stop offset="95%" stopColor="var(--st-accent)" stopOpacity={0} />
                         </linearGradient>
                       </defs>
                       <Tooltip
                         contentStyle={{ borderRadius: 'var(--st-radius)', fontSize: '12px', border: '1px solid var(--st-border)', background: 'var(--st-bg)', color: 'var(--st-text)' }}
                         labelFormatter={(label) => formatUTC(label, false)}
                         itemStyle={{ color: 'var(--st-text)' }}
                       />
                       <Area
                         type="monotone"
                         dataKey="count"
                         stroke="var(--st-accent)"
                         fillOpacity={1}
                         fill="url(#colorCount)"
                       />
                     </AreaChart>
                   </ResponsiveContainer>
                 </div>
               </div>
             ) : (
               <div className="flex h-full flex-col items-center justify-center text-[13px] u-text-secondary">
                 No chart data available
               </div>
             )}
          </Card>
        </div>

        {isPending && grouped.length === 0 ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={48} />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={MousePointerClick}
            title="No link clicks yet"
            description="Once your messages get clicks, they'll show up here grouped by URL."
          />
        ) : (
          <Card padding="sm">
            <DataTable
              columns={columns}
              rows={grouped}
              getRowId={(row) => (row.campaignName ? `${row.url}|${row.campaignName}` : row.url)}
            />
          </Card>
        )}
      </div>

      {/* View clicks dialog */}
      <Modal
        open={viewing !== null}
        onClose={() => {
          setViewing(null);
          setPage(1);
        }}
        size="lg"
        title="Click history"
        description={viewing?.url}
      >
        {viewing && viewing.campaignName && (
           <div className="text-[13px]">
             <span className="font-medium">Campaign:</span> {viewing.campaignName}
             {viewing.messagesSent && (
                <span className="ml-4 u-text-secondary">
                   CTR: {((viewing.count / viewing.messagesSent) * 100).toFixed(1)}% ({viewing.count}/{viewing.messagesSent} clicks)
                </span>
             )}
           </div>
        )}

        {viewing ? (
          <div className="flex flex-col gap-3">
            <div className="max-h-[50vh] overflow-y-auto">
              <Table>
                <THead>
                  <Tr>
                    <Th>#</Th>
                    <Th>When</Th>
                  </Tr>
                </THead>
                <TBody>
                  {paginatedClicks.map((c, idx) => {
                    const ts = c.clickedAt || c.createdAt || '';
                    const absoluteIdx = (page - 1) * pageSize + idx + 1;
                    return (
                      <Tr key={`${ts}-${absoluteIdx}`}>
                        <Td className="tabular-nums u-text-secondary">
                          {absoluteIdx}
                        </Td>
                        <Td className="whitespace-nowrap">
                          {ts ? formatUTC(ts, true) : '—'}
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-[12px] u-text-secondary">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, viewing.clicks.length)} of {viewing.clicks.length}
                </div>
                <Pagination
                  page={page}
                  pageCount={totalPages}
                  onPageChange={setPage}
                  size="compact"
                />
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Delete-confirm alert */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tracked link?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes click analytics for{' '}
              <span className="break-all font-mono">
                {deleteTarget?.url}
              </span>
              . The link itself will continue to work in any messages already
              sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              intent="danger"
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
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WachatPage>
  );
}
