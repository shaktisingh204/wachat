'use client';

/**
 * <TicketSlaBadge> — prominent SLA countdown for the ticket detail
 * page (§1D.2).
 *
 * Computes the absolute delta between `dueBy` and now, refreshing every
 * minute. Renders as a coloured badge:
 *   • Overdue (past): danger tone
 *   • < 1 hour to go: warning tone
 *   • > 1 hour: info tone
 *   • No due-by: neutral
 *   • Resolved/closed: success
 */

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

import { ZoruBadge } from '@/components/zoruui';

interface TicketSlaBadgeProps {
    dueBy?: string;
    status?: string;
}

function relTime(ms: number): string {
    const abs = Math.abs(ms);
    const mins = Math.floor(abs / 60_000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remM = mins % 60;
    if (hours < 24) return remM > 0 ? `${hours}h ${remM}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
}

export function TicketSlaBadge({ dueBy, status }: TicketSlaBadgeProps) {
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    const lowered = String(status ?? '').toLowerCase();
    if (lowered === 'resolved' || lowered === 'closed') {
        return (
            <ZoruBadge variant="success">
                <CheckCircle2 className="h-3 w-3" /> SLA closed
            </ZoruBadge>
        );
    }

    if (!dueBy) {
        return <ZoruBadge variant="ghost">No due-by</ZoruBadge>;
    }

    const dueMs = new Date(dueBy).getTime();
    if (!Number.isFinite(dueMs)) {
        return <ZoruBadge variant="ghost">No due-by</ZoruBadge>;
    }
    const delta = dueMs - now;
    const overdue = delta < 0;
    const tone: 'warning' | 'danger' | 'info' = overdue
        ? 'danger'
        : delta < 60 * 60_000
        ? 'warning'
        : 'info';

    return (
        <ZoruBadge variant={tone}>
            {overdue ? (
                <AlertTriangle className="h-3 w-3" />
            ) : (
                <Clock className="h-3 w-3" />
            )}
            {overdue ? `Overdue by ${relTime(delta)}` : `Due in ${relTime(delta)}`}
        </ZoruBadge>
    );
}

export default TicketSlaBadge;
