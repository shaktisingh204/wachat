'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/sabcrm/20ui/compat';

export function TimelineFilter() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const type = searchParams.get('type') || 'all';

    return (
        <div className="mb-4 flex justify-end">
            <Select
                value={type}
                onValueChange={(val) => {
                    const params = new URLSearchParams(searchParams.toString());
                    if (val === 'all') params.delete('type');
                    else params.set('type', val);
                    router.push(`?${params.toString()}`, { scroll: false });
                }}
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter timeline" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Activity</SelectItem>
                    <SelectItem value="manual">Manual Edits</SelectItem>
                    <SelectItem value="system">System Triggers</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
