'use client';

import { useEffect, useState } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Table, ZoruTableHeader, ZoruTableBody, ZoruTableRow, ZoruTableHead, ZoruTableCell, Card, Button, ZoruDateRangePicker, Input } from '@/components/zoruui';
import { getActivityLogs } from '@/app/actions/platform/activity-logs.actions';
import type { ActivityLog } from '@/types/platform';
import { DateRange } from "react-day-picker";

export default function ActivityLogsPage() {
  const [data, setData] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Filters & Pagination state
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  
  const [userId, setUserId] = useState('');
  const [debouncedUserId, setDebouncedUserId] = useState('');
  
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Debounce inputs
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
      setDebouncedUserId(userId);
      setPage(1); // Reset to first page on filter change
    }, 500);
    return () => clearTimeout(handler);
  }, [query, userId]);

  // Reset page when date range changes
  useEffect(() => {
    setPage(1);
  }, [dateRange]);

  // Fetch data
  useEffect(() => {
    let ignore = false;
    setLoading(true);

    const startDate = dateRange?.from ? dateRange.from.toISOString() : undefined;
    const endDate = dateRange?.to ? dateRange.to.toISOString() : undefined;

    getActivityLogs({
      page,
      pageSize,
      query: debouncedQuery,
      userId: debouncedUserId,
      startDate,
      endDate
    }).then(res => {
      if (!ignore) {
        setData(res.data);
        setTotal(res.total);
        setLoading(false);
      }
    }).catch(err => {
      console.error(err);
      if (!ignore) setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [page, pageSize, debouncedQuery, debouncedUserId, dateRange]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-64">
        <ZoruDateRangePicker
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
      <div className="text-sm text-zoru-ink-light">
        Showing {total === 0 ? 0 : ((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} entries
      </div>
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setPage(p => Math.max(1, p - 1))} 
          disabled={page <= 1}
        >
          Previous
        </Button>
        <span className="text-sm text-zoru-ink-light px-2">Page {page} of {totalPages}</span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
          disabled={page >= totalPages}
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
      loading={loading}
    >
      <Card className="border-zoru-line bg-zoru-bg overflow-hidden">
        <Table>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead>Timestamp</ZoruTableHead>
              <ZoruTableHead>Action</ZoruTableHead>
              <ZoruTableHead>Entity</ZoruTableHead>
              <ZoruTableHead>User ID</ZoruTableHead>
              <ZoruTableHead>IP Address</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {data.map(item => (
              <ZoruTableRow key={item.id}>
                <ZoruTableCell className="text-sm text-zoru-ink-light">
                  {new Date(item.timestamp).toLocaleString()}
                </ZoruTableCell>
                <ZoruTableCell className="font-medium text-zoru-ink">{item.action}</ZoruTableCell>
                <ZoruTableCell className="text-sm">
                  <span className="bg-zoru-neutral-hover px-2 py-1 rounded-md mr-2">{item.entityType}</span>
                  <span className="text-zoru-ink-light font-mono text-xs">{item.entityId}</span>
                </ZoruTableCell>
                <ZoruTableCell className="font-mono text-xs">{item.userId || 'system'}</ZoruTableCell>
                <ZoruTableCell className="text-sm">{item.ipAddress || '—'}</ZoruTableCell>
              </ZoruTableRow>
            ))}
            {data.length === 0 && !loading && (
              <ZoruTableRow>
                <ZoruTableCell colSpan={5} className="text-center py-8 text-zoru-ink-light">No logs found.</ZoruTableCell>
              </ZoruTableRow>
            )}
          </ZoruTableBody>
        </Table>
      </Card>
    </EntityListShell>
  );
}
