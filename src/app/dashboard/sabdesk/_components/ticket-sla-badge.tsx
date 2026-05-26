'use client';

import { Badge } from '@/components/zoruui';
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react';

/**
 * <TicketSlaBadge> — prominent SLA countdown for the ticket detail
 * page (§1D.2 / §6.4).
 *
 * On mount, calls the `getApplicableSlaRule` server action which:
 *   1. Resolves the best-matching `crm_slas` rule for this ticket.
 *   2. Computes live first-response and resolution due-by timestamps
 *      through the pure functions in `src/lib/sla/engine.ts`.
 *
 * Refreshes every 30 seconds via `setInterval` so the wall-clock
 * countdown stays accurate without re-fetching the ticket. The badge
 * picks the next-due clock (first-response if pending, otherwise
 * resolution), shows the relative time, and colour-codes:
 *
 *   • green  — more than 50% of the SLA budget remaining
 *   • amber  — within the last 50% of the budget
 *   • red    — breached
 *
 * Falls back to the legacy static `dueBy` prop if no SLA rule is
 * configured for the tenant.
 */

import * as React from 'react';

import { getApplicableSlaRule } from '@/app/actions/crm-sla.actions';

interface TicketSlaBadgeProps {
    /** Ticket id (used to fetch the applicable rule). Optional for legacy callers. */
    ticketId?: string;
    /** Static dueBy fallback — used when no SLA rule is loaded yet. */
    dueBy?: string;
    /** Current status, used to short-circuit when the ticket is closed. */
    status?: string;
}

interface SlaState {
    loading: boolean;
    hasRule: boolean;
    firstResponseDueBy?: number;
    resolutionDueBy?: number;
    firstResponseAt?: number;
    resolvedAt?: number;
    createdAt?: number;
    firstResponseMinutes?: number;
    resolutionMinutes?: number;
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

function toMs(v: string | undefined | null): number | undefined {
    if (!v) return undefined;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : undefined;
}

export function TicketSlaBadge({ ticketId, dueBy, status }: TicketSlaBadgeProps) {
    const [now, setNow] = React.useState(() => Date.now());
    const [sla, setSla] = React.useState<SlaState>({ loading: Boolean(ticketId), hasRule: false });

    // 30-second tick (per §6.4).
    React.useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(id);
    }, []);

    // One-shot fetch of the applicable SLA rule.
    React.useEffect(() => {
        let cancelled = false;
        if (!ticketId) {
            setSla({ loading: false, hasRule: false });
            return;
        }
        (async () => {
            try {
                const res = await getApplicableSlaRule(ticketId);
                if (cancelled) return;
                if (!res?.rule) {
                    setSla({ loading: false, hasRule: false });
                    return;
                }
                setSla({
                    loading: false,
                    hasRule: true,
                    firstResponseDueBy: toMs(res.firstResponseDueBy),
                    resolutionDueBy: toMs(res.resolutionDueBy),
                    firstResponseAt: toMs(res.firstResponseAt),
                    resolvedAt: toMs(res.resolvedAt),
                    createdAt: toMs(res.createdAt),
                    firstResponseMinutes: res.rule.firstResponseMinutes,
                    resolutionMinutes: res.rule.resolutionMinutes,
                });
            } catch {
                if (!cancelled) setSla({ loading: false, hasRule: false });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [ticketId]);

    const lowered = String(status ?? '').toLowerCase();
    if (lowered === 'resolved' || lowered === 'closed') {
        return (
            <Badge variant="success">
                <CheckCircle2 className="h-3 w-3" /> SLA closed
            </Badge>
        );
    }

    if (sla.loading) {
        return (
            <Badge variant="ghost">
                <Loader2 className="h-3 w-3 animate-spin" /> SLA…
            </Badge>
        );
    }

    // SLA-rule-driven path.
    if (sla.hasRule) {
        // Pick the active clock: first-response is only relevant until
        // an agent has replied.
        const useFirstResponse =
            sla.firstResponseDueBy !== undefined && sla.firstResponseAt === undefined;
        const dueAt = useFirstResponse ? sla.firstResponseDueBy : sla.resolutionDueBy;
        const totalMins = useFirstResponse ? sla.firstResponseMinutes : sla.resolutionMinutes;
        const label = useFirstResponse ? 'First response' : 'Resolution';

        if (!dueAt) return <Badge variant="ghost">No SLA target</Badge>;

        const delta = dueAt - now;
        const overdue = delta < 0;
        // Budget elapsed >50% = warning. Computed against the SLA's
        // notional budget (`totalMins`) rather than wall-clock since
        // business-hours-only rules stretch elapsed time differently.
        let tone: 'success' | 'warning' | 'danger' = 'success';
        if (overdue) tone = 'danger';
        else if (totalMins && delta < totalMins * 60_000 * 0.5) tone = 'warning';

        return (
            <Badge variant={tone}>
                {overdue ? (
                    <AlertTriangle className="h-3 w-3" />
                ) : (
                    <Clock className="h-3 w-3" />
                )}
                {overdue
                    ? `${label} overdue by ${relTime(delta)}`
                    : `${label} due in ${relTime(delta)}`}
            </Badge>
        );
    }

    // Legacy/no-rule fallback: free-text `dueBy`.
    if (!dueBy) {
        return <Badge variant="ghost">No due-by</Badge>;
    }
    const dueMs = new Date(dueBy).getTime();
    if (!Number.isFinite(dueMs)) {
        return <Badge variant="ghost">No due-by</Badge>;
    }
    const delta = dueMs - now;
    const overdue = delta < 0;
    const tone: 'warning' | 'danger' | 'success' = overdue
        ? 'danger'
        : delta < 60 * 60_000
        ? 'warning'
        : 'success';

    return (
        <Badge variant={tone}>
            {overdue ? (
                <AlertTriangle className="h-3 w-3" />
            ) : (
                <Clock className="h-3 w-3" />
            )}
            {overdue ? `Overdue by ${relTime(delta)}` : `Due in ${relTime(delta)}`}
        </Badge>
    );
}

export default TicketSlaBadge;
