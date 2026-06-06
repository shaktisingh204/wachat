'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';

export function TicketFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentStatus = searchParams.get('status') || 'all';

    return (
        <div className="flex items-center gap-2">
            <Select
                value={currentStatus}
                onValueChange={(val) => {
                    const params = new URLSearchParams(searchParams.toString());
                    if (val === 'all') {
                        params.delete('status');
                    } else {
                        params.set('status', val);
                    }
                    router.push(`?${params.toString()}`);
                }}
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Tickets</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="waiting">Waiting on Staff</SelectItem>
                    <SelectItem value="awaiting_client">Awaiting Response</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
