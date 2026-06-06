import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button } from '@/components/sabcrm/20ui/compat';
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
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--st-text-secondary)]" />
        <Input 
          placeholder="Search descriptions..." 
          className="pl-9 bg-[var(--st-bg-secondary)]/50"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={filterType} onValueChange={(val) => setFilterType(val as FilterType)}>
          <SelectTrigger className="w-full sm:w-[130px] bg-[var(--st-bg-secondary)]/50">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="CREDIT">Credit</SelectItem>
            <SelectItem value="DEBIT">Debit</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val as FilterStatus)}>
          <SelectTrigger className="w-full sm:w-[130px] bg-[var(--st-bg-secondary)]/50">
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
          <SelectTrigger className="w-full sm:w-[150px] bg-[var(--st-bg-secondary)]/50">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Newest First</SelectItem>
            <SelectItem value="date-asc">Oldest First</SelectItem>
            <SelectItem value="amount-desc">Amount: High-Low</SelectItem>
            <SelectItem value="amount-asc">Amount: Low-High</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          variant="outline" 
          size="icon" 
          onClick={onRefresh} 
          disabled={isRefreshing}
          title="Refresh transactions"
          className="bg-[var(--st-bg-secondary)]/50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
