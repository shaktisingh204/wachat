'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Select, ZoruSelectTrigger, ZoruSelectValue, SelectContent, ZoruSelectItem } from '@/components/sabcrm/20ui/compat';

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
                <ZoruSelectTrigger className="w-[180px]">
                    <ZoruSelectValue placeholder="Filter timeline" />
                </ZoruSelectTrigger>
                <SelectContent>
                    <ZoruSelectItem value="all">All Activity</ZoruSelectItem>
                    <ZoruSelectItem value="manual">Manual Edits</ZoruSelectItem>
                    <ZoruSelectItem value="system">System Triggers</ZoruSelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
