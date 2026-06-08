import {
  Field,
  Input,
  IconButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui';
import { Search, RefreshCw } from 'lucide-react';

export type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
export type FilterType = 'ALL' | 'CREDIT' | 'DEBIT';
export type FilterStatus = 'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED';

interface TransactionFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filterType: FilterType;
  setFilterType: (val: FilterType) => void;
  filterStatus: FilterStatus;
  setFilterStatus: (val: FilterStatus) => void;
  sortOption: SortOption;
  setSortOption: (val: SortOption) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function TransactionFilters({
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  sortOption,
  setSortOption,
  onRefresh,
  isRefreshing
}: TransactionFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Field label="Search transactions" className="flex-1 [&_.u-field__label]:sr-only">
        <Input
          placeholder="Search descriptions..."
          iconLeft={Search}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </Field>

      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={filterType} onValueChange={(val) => setFilterType(val as FilterType)}>
          <SelectTrigger aria-label="Filter by type" className="w-full sm:w-[130px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="CREDIT">Credit</SelectItem>
            <SelectItem value="DEBIT">Debit</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val as FilterStatus)}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="SUCCESS">Success</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortOption} onValueChange={(val) => setSortOption(val as SortOption)}>
          <SelectTrigger aria-label="Sort transactions" className="w-full sm:w-[150px]">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Newest First</SelectItem>
            <SelectItem value="date-asc">Oldest First</SelectItem>
            <SelectItem value="amount-desc">Amount: High to Low</SelectItem>
            <SelectItem value="amount-asc">Amount: Low to High</SelectItem>
          </SelectContent>
        </Select>

        <IconButton
          variant="outline"
          icon={RefreshCw}
          label="Refresh transactions"
          onClick={onRefresh}
          disabled={isRefreshing}
          className={isRefreshing ? '[&_svg]:animate-spin' : undefined}
        />
      </div>
    </div>
  );
}
