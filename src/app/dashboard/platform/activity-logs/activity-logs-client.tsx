'use client';
import { fmtDate } from '@/lib/utils';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Card,
  CardHeader,
  CardTitle,
  Button,
  DateRangePicker,
  Input,
  Field,
  Badge,
  StatCard,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';
import {
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Search,
  Activity,
  Users,
  Layers,
} from 'lucide-react';
import type { ActivityLog } from '@/types/platform';
import { DateRange } from 'react-day-picker';
import { useDebounce } from 'use-debounce';

export function ActivityLogsClient({
  initialData,
  total,
  page,
  pageSize,
}: {
  initialData: ActivityLog[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialQuery = searchParams.get('query') || '';
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery] = useDebounce(query, 500);

  const initialUserId = searchParams.get('userId') || '';
  const [userId, setUserId] = useState(initialUserId);
  const [debouncedUserId] = useDebounce(userId, 500);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get('startDate');
    const to = searchParams.get('endDate');
    if (from || to) {
      return {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      };
    }
    return undefined;
  });

  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (debouncedQuery !== (searchParams.get('query') || '')) {
      if (debouncedQuery) params.set('query', debouncedQuery);
      else params.delete('query');
      changed = true;
    }

    if (debouncedUserId !== (searchParams.get('userId') || '')) {
      if (debouncedUserId) params.set('userId', debouncedUserId);
      else params.delete('userId');
      changed = true;
    }

    const startDateStr = dateRange?.from ? dateRange.from.toISOString() : '';
    const endDateStr = dateRange?.to ? dateRange.to.toISOString() : '';

    if (startDateStr !== (searchParams.get('startDate') || '')) {
      if (startDateStr) params.set('startDate', startDateStr);
      else params.delete('startDate');
      changed = true;
    }

    if (endDateStr !== (searchParams.get('endDate') || '')) {
      if (endDateStr) params.set('endDate', endDateStr);
      else params.delete('endDate');
      changed = true;
    }

    if (changed) {
      params.set('page', '1');
      setIsPending(true);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [debouncedQuery, debouncedUserId, dateRange, pathname, router, searchParams]);

  useEffect(() => {
    setIsPending(false);
  }, [searchParams]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    setIsPending(true);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(dateRange || userId || query);

  const stats = useMemo(() => {
    const distinctActions = new Set(initialData.map((d) => d.action)).size;
    const distinctActors = new Set(initialData.map((d) => d.userId || 'system')).size;
    return { distinctActions, distinctActors };
  }, [initialData]);

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Platform</PageEyebrow>
          <PageTitle>Activity logs</PageTitle>
          <PageDescription>
            An immutable audit trail of every action taken across the platform.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total entries" value={total.toLocaleString()} icon={ScrollText} />
        <StatCard label="Actions (page)" value={stats.distinctActions} icon={Activity} />
        <StatCard label="Actors (page)" value={stats.distinctActors} icon={Users} />
      </div>

      <Card padding="none" className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 border-b border-[var(--st-border)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
              <CardTitle>Audit trail</CardTitle>
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateRange(undefined);
                  setUserId('');
                  setQuery('');
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Search actions" className="min-w-[14rem] flex-1">
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search actions…"
                iconLeft={Search}
                aria-label="Search actions"
              />
            </Field>
            <Field label="Date range" className="w-60">
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                placeholder="Any date"
                aria-label="Filter by date range"
              />
            </Field>
            <Field label="User ID" className="w-56">
              <Input
                placeholder="Filter by user ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                aria-label="Filter by user ID"
              />
            </Field>
          </div>
        </CardHeader>

        <div
          className={`transition-opacity duration-200 ${isPending ? 'opacity-50' : 'opacity-100'}`}
        >
          {initialData.length === 0 && !isPending ? (
            <EmptyState
              icon={ScrollText}
              title="No logs found"
              description="No activity matches the current filters. Adjust the search or date range to see more."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Timestamp</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>User ID</Th>
                  <Th>IP address</Th>
                </Tr>
              </THead>
              <TBody>
                {initialData.map((item) => (
                  <Tr key={item.id}>
                    <Td className="whitespace-nowrap text-sm text-[var(--st-text-tertiary)]">
                      {fmtDate(item.timestamp)}
                    </Td>
                    <Td className="font-medium text-[var(--st-text)]">{item.action}</Td>
                    <Td className="text-sm">
                      <Badge tone="neutral" kind="soft" className="mr-2">
                        {item.entityType}
                      </Badge>
                      <span className="font-mono text-xs text-[var(--st-text-tertiary)]">
                        {item.entityId}
                      </span>
                    </Td>
                    <Td className="font-mono text-xs">{item.userId || 'system'}</Td>
                    <Td className="font-mono text-xs text-[var(--st-text-tertiary)]">
                      {item.ipAddress || '—'}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--st-border)] px-4 py-3 sm:flex-row">
          <span className="text-sm text-[var(--st-text-tertiary)]">
            Showing {total === 0 ? 0 : (page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, total)} of {total} entries
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              iconLeft={ChevronLeft}
              onClick={() => handlePageChange(Math.max(1, page - 1))}
              disabled={page <= 1 || isPending}
            >
              Previous
            </Button>
            <span className="px-2 text-sm text-[var(--st-text-tertiary)]">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              iconRight={ChevronRight}
              onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || isPending}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
