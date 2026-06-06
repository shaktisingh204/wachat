'use client';
import { fmtDate } from "@/lib/utils";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Card,
  Button,
  DateRangePicker,
  Input,
  Field,
  Badge,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ActivityLog } from '@/types/platform';
import { DateRange } from "react-day-picker";
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

  // Filters State
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

  // Update URL on filter changes
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
      params.set('page', '1'); // Reset to page 1 on filter change
      setIsPending(true);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [debouncedQuery, debouncedUserId, dateRange, pathname, router, searchParams]);

  // Remove isPending flag when searchParams updates
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

  const filters = (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Date range" className="w-64">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="Filter by date range"
          aria-label="Filter by date range"
        />
      </Field>
      <Field label="User ID" className="w-64">
        <Input
          placeholder="Filter by User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          aria-label="Filter by User ID"
        />
      </Field>
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
          Clear Filters
        </Button>
      )}
    </div>
  );

  const pagination = (
    <div className="flex items-center justify-between px-2 py-4">
      <div className="text-sm text-[var(--st-text-tertiary)]">
        Showing {total === 0 ? 0 : ((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} entries
      </div>
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
        <span className="text-sm text-[var(--st-text-tertiary)] px-2">Page {page} of {totalPages}</span>
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
  );

  return (
    <EntityListShell
      title="Platform Activity Logs"
      subtitle="Audit trail of all actions across the system."
      search={{ value: query, onChange: setQuery, placeholder: 'Search actions...' }}
      filters={filters}
      pagination={pagination}
      loading={isPending}
    >
      <Card
        padding="none"
        className={`overflow-hidden transition-opacity duration-200 ${isPending ? 'opacity-50' : 'opacity-100'}`}
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
                <Th>IP Address</Th>
              </Tr>
            </THead>
            <TBody>
              {initialData.map(item => (
                <Tr key={item.id}>
                  <Td className="text-sm text-[var(--st-text-tertiary)]">
                    {fmtDate(item.timestamp)}
                  </Td>
                  <Td className="font-medium text-[var(--st-text)]">{item.action}</Td>
                  <Td className="text-sm">
                    <Badge tone="neutral" className="mr-2">{item.entityType}</Badge>
                    <span className="text-[var(--st-text-tertiary)] font-mono text-xs">{item.entityId}</span>
                  </Td>
                  <Td className="font-mono text-xs">{item.userId || 'system'}</Td>
                  <Td className="text-sm">{item.ipAddress || '-'}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </EntityListShell>
  );
}
