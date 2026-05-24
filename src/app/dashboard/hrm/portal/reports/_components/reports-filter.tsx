import * as React from 'react';
import { Input, Button } from '@/components/zoruui';
import type { StatusFilter } from '../page';

export interface ReportsFilterProps {
  fromDate: string;
  setFromDate: (v: string) => void;
  toDate: string;
  setToDate: (v: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  workerSearch: string;
  setWorkerSearch: (v: string) => void;
  onApply: () => void;
}

export function ReportsFilter({
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  statusFilter,
  setStatusFilter,
  workerSearch,
  setWorkerSearch,
  onApply,
}: ReportsFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Date range */}
      <div className="flex items-center gap-2">
        <label className="text-[12px] text-zoru-ink-muted whitespace-nowrap">From</label>
        <Input
          type="date"
          className="h-8 text-[13px] w-36"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <label className="text-[12px] text-zoru-ink-muted whitespace-nowrap">To</label>
        <Input
          type="date"
          className="h-8 text-[13px] w-36"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
      </div>

      {/* Status chips */}
      <div className="flex items-center gap-1">
        {(['all', 'unacknowledged', 'acknowledged'] as StatusFilter[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}
            className="h-8 capitalize"
          >
            {s === 'all' ? 'All' : s === 'unacknowledged' ? 'Unacknowledged' : 'Acknowledged'}
          </Button>
        ))}
      </div>

      {/* Worker search */}
      <Input
        placeholder="Search by worker…"
        className="h-8 text-[13px] w-48"
        value={workerSearch}
        onChange={(e) => setWorkerSearch(e.target.value)}
      />

      {/* Apply filters */}
      <Button size="sm" variant="outline" onClick={onApply} className="h-8">
        Apply
      </Button>
    </div>
  );
}
