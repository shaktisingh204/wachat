'use client';
import { fmtDate } from "@/lib/utils";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Table, THead, TBody, Tr, Th, Td, Card, Button, DateRangePicker, Input } from '@/components/sabcrm/20ui/compat';
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

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-64">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="Filter by date range"
        />
      </div>
      <div className="w-64">
        <Input 
          placeholder="Filter by User ID" 
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
      </div>
      {(dateRange || userId || query) && (
        <Button variant="ghost" size="sm" onClick={() => {
          setDateRange(undefined);
          setUserId('');
          setQuery('');
        }}>
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
          onClick={() => handlePageChange(Math.max(1, page - 1))} 
          disabled={page <= 1 || isPending}
        >
          Previous
        </Button>
        <span className="text-sm text-[var(--st-text-tertiary)] px-2">Page {page} of {totalPages}</span>
        <Button 
          variant="outline" 
          size="sm" 
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
      <Card className="border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden opacity-100 transition-opacity duration-200" style={{ opacity: isPending ? 0.5 : 1 }}>
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
                  <span className="bg-[var(--st-hover)] px-2 py-1 rounded-md mr-2">{item.entityType}</span>
                  <span className="text-[var(--st-text-tertiary)] font-mono text-xs">{item.entityId}</span>
                </Td>
                <Td className="font-mono text-xs">{item.userId || 'system'}</Td>
                <Td className="text-sm">{item.ipAddress || '—'}</Td>
              </Tr>
            ))}
            {initialData.length === 0 && !isPending && (
              <Tr>
                <Td colSpan={5} className="text-center py-8 text-[var(--st-text-tertiary)]">No logs found.</Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </Card>
    </EntityListShell>
  );
}
