/**
 * Award program detail page.
 *
 * Server component sibling of the awards list page. Renders the program
 * name header with a status badge, a period range card, the criteria
 * description, a nominations table, and a winners table when present.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { ArrowLeft, Trophy } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getAwardProgramById } from '@/app/actions/crm-awards.actions';
import { getSession } from '@/app/actions/user.actions';

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(n: unknown): string {
    if (typeof n !== 'number' || Number.isNaN(n)) return '—';
    return n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function statusVariant(status?: string): 'ghost' | 'success' | 'warning' | 'danger' {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'published' || s === 'approved' || s === 'won')
        return 'success';
    if (s === 'draft' || s === 'pending') return 'ghost';
    if (s === 'rejected' || s === 'cancelled' || s === 'closed') return 'danger';
    return 'warning';
}

function idToString(v: unknown): string {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof (v as any).toString === 'function') return (v as any).toString();
    return '';
}

interface Nomination {
    nomineeId?: unknown;
    nomineeName?: string;
    nominatedById?: unknown;
    nominatedByName?: string;
    score?: number;
    status?: string;
}

interface Winner {
    employeeId?: unknown;
    employeeName?: string;
    awardDate?: string | Date;
    payout?: number;
}

export default async function AwardProgramDetailPage({
    params,
}: {
    params: Promise<{ programId: string }>;
}) {
    const { programId } = await params;

    const session = await getSession();
    if (!session?.user) notFound();
    if (!ObjectId.isValid(programId)) notFound();

    const program = await getAwardProgramById(programId);
    if (!program) {
        notFound();
    }

    const name = ((program as any).name as string) || 'Untitled program';
    const status = ((program as any).status as string) || 'draft';
    const periodStart = (program as any).periodStart;
    const periodEnd = (program as any).periodEnd;
    const criteria = ((program as any).criteria as string) || '';
    const nominations: Nomination[] = Array.isArray((program as any).nominations)
        ? ((program as any).nominations as Nomination[])
        : [];
    const winners: Winner[] = Array.isArray((program as any).winners)
        ? ((program as any).winners as Winner[])
        : [];

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={name}
                subtitle="Award program detail"
                icon={Trophy}
                actions={
                    <Link href="/dashboard/hrm/hr/awards">
                        <ZoruButton variant="outline">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] text-zoru-ink">{name}</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                            {nominations.length} nomination
                            {nominations.length === 1 ? '' : 's'} • {winners.length} winner
                            {winners.length === 1 ? '' : 's'}
                        </p>
                    </div>
                    <ZoruBadge variant={statusVariant(status)}>{status}</ZoruBadge>
                </div>

                <div className="mt-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-4">
                    <div className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                        Period
                    </div>
                    <div className="mt-1 text-[16px] text-zoru-ink">
                        {fmtDate(periodStart)}
                        <span className="text-zoru-ink-muted"> – </span>
                        {fmtDate(periodEnd)}
                    </div>
                </div>

                {criteria && (
                    <div className="mt-4">
                        <div className="text-[12.5px] text-zoru-ink-muted">Criteria</div>
                        <div className="mt-1 text-[13px] text-zoru-ink whitespace-pre-line">
                            {criteria}
                        </div>
                    </div>
                )}
            </ZoruCard>

            <ZoruCard className="p-6">
                <div className="mb-2 text-[14px] text-zoru-ink">Nominations</div>
                {nominations.length === 0 ? (
                    <div className="text-[13px] text-zoru-ink-muted">No nominations yet.</div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Nominee</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Nominated by</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Score</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {nominations.map((n, i) => {
                                    const nominee =
                                        n.nomineeName || idToString(n.nomineeId) || '—';
                                    const nominator =
                                        n.nominatedByName || idToString(n.nominatedById) || '—';
                                    return (
                                        <ZoruTableRow
                                            key={`nomination-${i}`}
                                            className="border-zoru-line"
                                        >
                                            <ZoruTableCell className="text-zoru-ink">
                                                {nominee}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {nominator}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {typeof n.score === 'number' ? n.score : '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <ZoruBadge variant={statusVariant(n.status)}>
                                                    {n.status || 'pending'}
                                                </ZoruBadge>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                )}
            </ZoruCard>

            <ZoruCard className="p-6">
                <div className="mb-2 text-[14px] text-zoru-ink">Winners</div>
                {winners.length === 0 ? (
                    <div className="text-[13px] text-zoru-ink-muted">
                        No winners declared yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Award date</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Payout</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {winners.map((w, i) => {
                                    const employee =
                                        w.employeeName || idToString(w.employeeId) || '—';
                                    return (
                                        <ZoruTableRow
                                            key={`winner-${i}`}
                                            className="border-zoru-line"
                                        >
                                            <ZoruTableCell className="text-zoru-ink">
                                                {employee}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {fmtDate(w.awardDate)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {fmtMoney(w.payout)}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                )}
            </ZoruCard>
        </div>
    );
}
