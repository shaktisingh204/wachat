import { Badge, type ZoruBadgeProps } from '@/components/zoruui';
/**
 * <StatusPill /> — thin convenience wrapper over <ZoruBadge> for the
 * recurring `{ label, tone }` shape used across CRM / HRM tables.
 *
 * Pure render — no client directive required.
 *
 * @example
 * ```tsx
 * <StatusPill label="Paid" tone="green" />
 *
 * // Or, derive tone from a raw status string from the API:
 * <StatusPill label={invoice.status} tone={statusToTone(invoice.status)} />
 * ```
 */

/* ─── Types ──────────────────────────────────────────────────────────── */

export type StatusTone = 'green' | 'amber' | 'red' | 'blue' | 'neutral';

const TONE_TO_VARIANT: Record<StatusTone, ZoruBadgeProps['variant']> = {
    green: 'success' as ZoruBadgeProps['variant'],
    amber: 'warning' as ZoruBadgeProps['variant'],
    red: 'danger' as ZoruBadgeProps['variant'],
    blue: 'info' as ZoruBadgeProps['variant'],
    neutral: 'secondary' as ZoruBadgeProps['variant'],
};

export interface StatusPillProps {
    label: string;
    tone?: StatusTone;
}

/* ─── Component ──────────────────────────────────────────────────────── */

/**
 * Render a status badge given an explicit tone.
 *
 * @example
 * ```tsx
 * <StatusPill label="Overdue" tone="red" />
 * ```
 */
export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
    return <ZoruBadge variant={TONE_TO_VARIANT[tone]}>{label}</ZoruBadge>;
}

/**
 * Convenience mapper from common status strings to a tone.
 * Unknown statuses fall back to `'neutral'`.
 *
 * @example
 * ```tsx
 * statusToTone('paid');           // 'green'
 * statusToTone('PARTIALLY_PAID'); // 'amber'
 * statusToTone('overdue');        // 'red'
 * statusToTone('new');            // 'blue'
 * statusToTone('unknown');        // 'neutral'
 * ```
 */
export function statusToTone(status: string | undefined): StatusTone {
    const s = (status ?? '').toLowerCase();
    if (['active', 'paid', 'completed', 'approved', 'won', 'open', 'cleared', 'resolved'].includes(s)) return 'green';
    if (['pending', 'draft', 'sent', 'in_progress', 'partially_paid', 'partial', 'submitted'].includes(s)) return 'amber';
    if (['cancelled', 'rejected', 'overdue', 'voided', 'failed', 'lost', 'closed', 'archived', 'terminated', 'resigned'].includes(s)) return 'red';
    if (['new', 'qualified', 'awarded', 'converted'].includes(s)) return 'blue';
    return 'neutral';
}
