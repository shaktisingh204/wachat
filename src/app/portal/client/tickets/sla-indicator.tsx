'use client';

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SlaIndicator({ dueBy, status }: { dueBy: string | null; status: string }) {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isOverdue, setIsOverdue] = useState(false);

    useEffect(() => {
        if (!dueBy || status === 'resolved' || status === 'closed') return;

        const update = () => {
            const due = new Date(dueBy).getTime();
            const now = Date.now();
            const diff = due - now;

            if (diff < 0) {
                setIsOverdue(true);
                setTimeLeft('Overdue');
                return;
            }

            const hrs = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            if (hrs > 24) {
                const days = Math.floor(hrs / 24);
                setTimeLeft(`${days}d ${hrs % 24}h`);
            } else {
                setTimeLeft(`${hrs}h ${mins}m`);
            }
        };

        update();
        const int = setInterval(update, 60000);
        return () => clearInterval(int);
    }, [dueBy, status]);

    if (!dueBy || status === 'resolved' || status === 'closed') return null;

    return (
        <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md",
            isOverdue ? "bg-zoru-surface-2 text-zoru-ink" : "bg-zoru-surface-2 text-zoru-ink"
        )}>
            <Clock className="w-3.5 h-3.5" />
            <span>{isOverdue ? 'SLA Overdue' : `Due in ${timeLeft}`}</span>
        </div>
    );
}
