import {
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruButton
} from '@/components/sabcrm/20ui/compat';
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zoru-ink-muted" />
        <ZoruInput 
          placeholder="Search descriptions..." 
          className="pl-9 bg-zoru-surface/50"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <div className="flex flex-col sm:flex-row gap-2">
        <ZoruSelect value={filterType} onValueChange={(val) => setFilterType(val as FilterType)}>
          <ZoruSelectTrigger className="w-full sm:w-[130px] bg-zoru-surface/50">
            <ZoruSelectValue placeholder="Type" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="ALL">All Types</ZoruSelectItem>
            <ZoruSelectItem value="CREDIT">Credit</ZoruSelectItem>
            <ZoruSelectItem value="DEBIT">Debit</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>

        <ZoruSelect value={filterStatus} onValueChange={(val) => setFilterStatus(val as FilterStatus)}>
          <ZoruSelectTrigger className="w-full sm:w-[130px] bg-zoru-surface/50">
            <ZoruSelectValue placeholder="Status" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="ALL">All Status</ZoruSelectItem>
            <ZoruSelectItem value="SUCCESS">Success</ZoruSelectItem>
            <ZoruSelectItem value="PENDING">Pending</ZoruSelectItem>
            <ZoruSelectItem value="FAILED">Failed</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>

        <ZoruSelect value={sortOption} onValueChange={(val) => setSortOption(val as SortOption)}>
          <ZoruSelectTrigger className="w-full sm:w-[150px] bg-zoru-surface/50">
            <ZoruSelectValue placeholder="Sort By" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="date-desc">Newest First</ZoruSelectItem>
            <ZoruSelectItem value="date-asc">Oldest First</ZoruSelectItem>
            <ZoruSelectItem value="amount-desc">Amount: High-Low</ZoruSelectItem>
            <ZoruSelectItem value="amount-asc">Amount: Low-High</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>

        <ZoruButton 
          variant="outline" 
          size="icon" 
          onClick={onRefresh} 
          disabled={isRefreshing}
          title="Refresh transactions"
          className="bg-zoru-surface/50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </ZoruButton>
      </div>
    </div>
  );
}
