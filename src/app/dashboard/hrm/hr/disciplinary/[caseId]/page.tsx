/**
 * Disciplinary case detail page.
 *
 * Server component sibling of the disciplinary list page. Renders the
 * case-no header with severity + status badges, metadata grid (type,
 * raised by, raised at, decision), a hearings table (date, panel,
 * outcome) and an evidence list when present.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { ArrowLeft, Gavel } from 'lucide-react';

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
import { getDisciplinaryCaseById } from '@/app/actions/crm-disciplinary.actions';
import { getSession } from '@/app/actions/user.actions';

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtDateTime(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function statusVariant(status?: string): 'ghost' | 'success' | 'warning' | 'danger' {
    const s = (status || '').toLowerCase();
    if (s === 'resolved' || s === 'closed_resolved' || s === 'approved') return 'success';
    if (s === 'open' || s === 'draft' || s === 'pending') return 'ghost';
    if (
        s === 'rejected' ||
        s === 'cancelled' ||
        s === 'high' ||
        s === 'critical' ||
        s === 'closed' ||
        s === 'severe'
    )
        return 'danger';
    return 'warning';
}

function idToString(v: unknown): string {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof (v as any).toString === 'function') return (v as any).toString();
    return '';
}

interface Hearing {
    date?: string | Date;
    panel?: string | string[];
    outcome?: string;
    notes?: string;
}

interface Evidence {
    label?: string;
    title?: string;
    type?: string;
    url?: string;
    addedAt?: string | Date;
    description?: string;
}

export default async function DisciplinaryCaseDetailPage({
    params,
}: {
    params: Promise<{ caseId: string }>;
}) {
    const { caseId } = await params;

    const session = await getSession();
    if (!session?.user) notFound();
    if (!ObjectId.isValid(caseId)) notFound();

    const c = await getDisciplinaryCaseById(caseId);
    if (!c) {
        notFound();
    }

    const caseNo = ((c as any).caseNo as string) || idToString((c as any)._id) || 'Case';
    const employee =
        ((c as any).employeeName as string) ||
        idToString((c as any).employeeId) ||
        '—';
    const severity = ((c as any).severity as string) || 'minor';
    const type = ((c as any).type as string) || '—';
    const raisedBy =
        ((c as any).raisedByName as string) ||
        idToString((c as any).raisedById) ||
        '—';
    const decision = ((c as any).decision as string) || '—';
    const status = ((c as any).status as string) || 'open';
    const raisedAt = (c as any).raisedAt ?? (c as any).createdAt;
    const hearings: Hearing[] = Array.isArray((c as any).hearings)
        ? ((c as any).hearings as Hearing[])
        : [];
    const evidence: Evidence[] = Array.isArray((c as any).evidence)
        ? ((c as any).evidence as Evidence[])
        : [];

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={caseNo}
                subtitle={`Disciplinary case for ${employee}`}
                icon={Gavel}
                actions={
                    <Link href="/dashboard/hrm/hr/disciplinary">
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
                        <h2 className="font-mono text-[16px] text-zoru-ink">{caseNo}</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                            Employee: {employee}
                            {raisedAt ? ` • Raised ${fmtDateTime(raisedAt)}` : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ZoruBadge variant={statusVariant(severity)}>{severity}</ZoruBadge>
                        <ZoruBadge variant={statusVariant(status)}>{status}</ZoruBadge>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Type</div>
                        <div className="text-zoru-ink">{type}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Raised by</div>
                        <div className="text-zoru-ink">{raisedBy}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Raised at</div>
                        <div className="text-zoru-ink">{fmtDateTime(raisedAt)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Decision</div>
                        <div className="text-zoru-ink">{decision}</div>
                    </div>
                </div>
            </ZoruCard>

            {hearings.length > 0 && (
                <ZoruCard className="p-6">
                    <div className="mb-2 text-[14px] text-zoru-ink">Hearings</div>
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Panel</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Outcome</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {hearings.map((h, i) => {
                                    const panel = Array.isArray(h.panel)
                                        ? h.panel.filter(Boolean).join(', ')
                                        : h.panel || '—';
                                    return (
                                        <ZoruTableRow key={`hearing-${i}`} className="border-zoru-line">
                                            <ZoruTableCell className="text-zoru-ink">
                                                {fmtDate(h.date)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">{panel}</ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {h.outcome || '—'}
                                                {h.notes && (
                                                    <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                                                        {h.notes}
                                                    </div>
                                                )}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </ZoruCard>
            )}

            {evidence.length > 0 && (
                <ZoruCard className="p-6">
                    <div className="mb-2 text-[14px] text-zoru-ink">Evidence</div>
                    <ul className="space-y-2 text-[13px] text-zoru-ink">
                        {evidence.map((e, i) => {
                            const label = e.label || e.title || e.type || `Evidence ${i + 1}`;
                            return (
                                <li
                                    key={`evidence-${i}`}
                                    className="rounded-md border border-zoru-line bg-zoru-surface-2 px-2.5 py-1.5"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium text-zoru-ink">{label}</span>
                                        {e.addedAt && (
                                            <span className="text-[11.5px] text-zoru-ink-muted">
                                                {fmtDateTime(e.addedAt)}
                                            </span>
                                        )}
                                    </div>
                                    {e.description && (
                                        <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                                            {e.description}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </ZoruCard>
            )}
        </div>
    );
}
