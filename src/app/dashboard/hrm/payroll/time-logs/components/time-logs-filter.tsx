import { Filter } from 'lucide-react';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';

interface TimeLogsFilterProps {
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  fromDate: string;
  setFromDate: (val: string) => void;
  toDate: string;
  setToDate: (val: string) => void;
  onApply: () => void;
  isPending: boolean;
}

export function TimeLogsFilter({
  statusFilter,
  setStatusFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  onApply,
  isPending,
}: TimeLogsFilterProps) {
  const hasActiveFilters = fromDate || toDate || statusFilter !== 'all';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-9 w-[130px] text-[13px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="running">Running</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>

      <Filter className="h-4 w-4 shrink-0 text-zoru-ink-muted ml-2" />
      <Input
        type="date"
        value={fromDate}
        onChange={(e) => setFromDate(e.target.value)}
        className="h-9 w-[140px] rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
        aria-label="From date"
      />
      <span className="text-[12px] text-zoru-ink-muted">to</span>
      <Input
        type="date"
        value={toDate}
        onChange={(e) => setToDate(e.target.value)}
        className="h-9 w-[140px] rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
        aria-label="To date"
      />
      <Button variant="outline" onClick={onApply} disabled={isPending}>
        Apply
      </Button>
      {hasActiveFilters && (
        <Button variant="outline" onClick={() => { setFromDate(''); setToDate(''); setStatusFilter('all'); }}>
          Clear
        </Button>
      )}
    </div>
  );
}
