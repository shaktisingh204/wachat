/**
 * Award program detail page.
 *
 * Server component. Loads a single document from `crm_award_programs`
 * and renders a "Program Details" card (2-column grid) with status badge,
 * nomination / winner counts, optional points/cash values, and a full-width
 * criteria / description row when present.
 *
 * Redirects to /dashboard/hrm/hr/awards when there is no session or the
 * document is not found.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { ArrowLeft, Trophy, PlusCircle } from 'lucide-react';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../../../crm/_components/crm-page-header';
import { getAwardProgramById } from '@/app/actions/crm-awards.actions';
import { getSession } from '@/app/actions/user.actions';

const AWARDS_LIST_HREF = '/dashboard/hrm/hr/awards';

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtINR(n: unknown): string {
    if (typeof n !== 'number' || isNaN(n)) return '—';
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
    } catch {
        return `₹${n}`;
    }
}

function statusVariant(status?: string): 'success' | 'ghost' | 'warning' | 'danger' {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'success';
    if (s === 'draft') return 'ghost';
    if (s === 'paused') return 'warning';
    if (s === 'closed' || s === 'archived') return 'danger';
    return 'ghost';
}

/* ------------------------------------------------------------------ */
/* Row helper for the details grid                                      */
/* ------------------------------------------------------------------ */

function DetailRow({
    label,
    children,
    fullWidth = false,
}: {
    label: string;
    children: React.ReactNode;
    fullWidth?: boolean;
}) {
    return (
        <div className={fullWidth ? 'col-span-2' : undefined}>
            <div className="text-[12px] text-zoru-ink-muted">{label}</div>
            <div className="mt-0.5 text-[13px] text-zoru-ink">{children}</div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default async function AwardProgramDetailPage({
    params,
}: {
    params: Promise<{ programId: string }>;
}) {
    const { programId } = await params;

    const session = await getSession();
    if (!session?.user) redirect(AWARDS_LIST_HREF);

    if (!ObjectId.isValid(programId)) redirect(AWARDS_LIST_HREF);

    const program = await getAwardProgramById(programId);
    if (!program) redirect(AWARDS_LIST_HREF);

    const p = program as Record<string, unknown>;

    const name = (p.name as string) || 'Untitled Program';
    const type = (p.type as string) || '—';
    const frequency = (p.frequency as string) || '—';
    const status = (p.status as string) || 'draft';
    const nominations = Array.isArray(p.nominations) ? p.nominations.length : 0;
    const winners = Array.isArray(p.winners) ? p.winners.length : 0;
    const pointsValue = typeof p.pointsValue === 'number' ? p.pointsValue : null;
    const cashValue = typeof p.cashValue === 'number' ? p.cashValue : null;
    const createdAt = p.createdAt;
    const criteria = (p.criteria as string) || (p.description as string) || '';

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={name}
                subtitle="Award program detail"
                icon={Trophy}
                actions={
                    <div className="flex items-center gap-2">
                        <Link href={AWARDS_LIST_HREF}>
                            <ZoruButton variant="outline">
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </ZoruButton>
                        </Link>
                        <ZoruButton variant="outline" disabled>
                            <PlusCircle className="h-4 w-4" />
                            Add Nomination
                        </ZoruButton>
                    </div>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-[15px] font-medium text-zoru-ink">Program Details</h2>
                    <ZoruBadge variant={statusVariant(status)}>{status}</ZoruBadge>
                </div>

                <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                    <DetailRow label="Program Name">{name}</DetailRow>
                    <DetailRow label="Program Type">{type}</DetailRow>
                    <DetailRow label="Cycle / Frequency">{frequency}</DetailRow>
                    <DetailRow label="Nominations">{nominations}</DetailRow>
                    <DetailRow label="Winners">{winners}</DetailRow>

                    {pointsValue !== null && (
                        <DetailRow label="Points Value">{pointsValue}</DetailRow>
                    )}

                    {cashValue !== null && (
                        <DetailRow label="Cash Value">{fmtINR(cashValue)}</DetailRow>
                    )}

                    <DetailRow label="Created">{fmtDate(createdAt)}</DetailRow>

                    {criteria ? (
                        <DetailRow label="Criteria / Description" fullWidth>
                            <span className="whitespace-pre-line">{criteria}</span>
                        </DetailRow>
                    ) : null}
                </div>
            </ZoruCard>
        </div>
    );
}
