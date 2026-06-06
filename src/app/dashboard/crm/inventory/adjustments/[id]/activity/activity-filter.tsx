'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';

export function ActivityFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const currentEventType = searchParams.get('eventType') || 'all';

  const handleValueChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      params.set('eventType', value);
    } else {
      params.delete('eventType');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="eventType" className="text-sm font-medium text-[var(--st-text)]">
        Filter by event:
      </label>
      <Select value={currentEventType} onValueChange={handleValueChange}>
        <SelectTrigger id="eventType" className="w-[180px]">
          <SelectValue placeholder="All events" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All events</SelectItem>
          <SelectItem value="create">Created</SelectItem>
          <SelectItem value="update">Updated</SelectItem>
          <SelectItem value="status_change">Status Changed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
