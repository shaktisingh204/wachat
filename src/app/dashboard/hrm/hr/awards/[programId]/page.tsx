import {
  Badge,
  Button,
  Card,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  redirect } from 'next/navigation';
import Link from 'next/link';
import { ObjectId } from 'mongodb';
import {
  Trophy,
  PlusCircle,
  Pencil } from 'lucide-react';

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

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getAwardProgramById } from '@/app/actions/crm-awards.actions';
import { getSession } from '@/app/actions/user.actions';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import {
    recordAwardVote,
    declareAwardWinner,
    sendAwardCashToPayroll,
} from '@/app/actions/hr-status-flow.actions';

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
    const nominationsList = Array.isArray(p.nominations) ? (p.nominations as Array<Record<string, unknown>>) : [];
    const winnersList = Array.isArray(p.winners) ? (p.winners as Array<Record<string, unknown>>) : [];
    const nominations = nominationsList.length;
    const winners = winnersList.length;
    const pointsValue = typeof p.pointsValue === 'number' ? p.pointsValue : null;
    const cashValue = typeof p.cashValue === 'number' ? p.cashValue : null;
    const createdAt = p.createdAt;
    const criteria = (p.criteria as string) || (p.description as string) || '';

    return (
        <EntityListShell
            title={name}
            subtitle="Award program detail"
            primaryAction={
                <div className="flex items-center gap-2">
                <Button variant="outline" asChild>
                    <Link href={`/dashboard/hrm/hr/awards/${programId}/nominate`}>
                        <PlusCircle className="h-4 w-4 mr-2" /> Share nomination link
                    </Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link href={`/dashboard/hrm/hr/awards/${programId}/edit`}>
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                    </Link>
                </Button>
                <HrActionButtons
                            actions={[
                                {
                                    key: 'vote',
                                    kind: 'prompt',
                                    label: 'Submit nomination',
                                    icon: <PlusCircle className="h-4 w-4" />,
                                    promptTitle: 'Submit a nomination',
                                    promptDescription:
                                        'Record a nomination for a peer.',
                                    submitLabel: 'Submit',
                                    fields: [
                                        {
                                            name: 'nomineeRef',
                                            label: 'Nominee (employee id or name)',
                                            required: true,
                                        },
                                        {
                                            name: 'reason',
                                            label: 'Reason',
                                            type: 'textarea',
                                            required: true,
                                            placeholder: 'Why does this person deserve the award?',
                                        },
                                    ],
                                    onRun: (v) =>
                                        recordAwardVote(programId, v.nomineeRef ?? '', v.reason ?? undefined),
                                },
                                {
                                    key: 'winner',
                                    kind: 'prompt',
                                    label: 'Declare winner',
                                    icon: <Trophy className="h-4 w-4" />,
                                    promptTitle: 'Declare winner',
                                    promptDescription:
                                        'Pick the winner for this program. The program will be marked closed.',
                                    submitLabel: 'Declare',
                                    fields: [
                                        {
                                            name: 'winnerRef',
                                            label: 'Winner (employee id or name)',
                                            required: true,
                                        },
                                        {
                                            name: 'citation',
                                            label: 'Citation',
                                            type: 'textarea',
                                            placeholder: 'Why this person was chosen',
                                        },
                                    ],
                                    onRun: (v) =>
                                        declareAwardWinner(
                                            programId,
                                            v.winnerRef ?? '',
                                            v.citation ?? undefined,
                                        ),
                                },
                                ...(cashValue && cashValue > 0 ? [{
                                    key: 'payroll',
                                    kind: 'confirm' as const,
                                    label: 'Send to payroll',
                                    icon: <Trophy className="h-4 w-4" />,
                                    confirmTitle: 'Send cash reward to payroll?',
                                    confirmDescription: 'This will notify payroll to process the cash value for the declared winners.',
                                    onRun: () => sendAwardCashToPayroll(programId),
                                }] : [])
                            ]}
                        />
                </div>
            }
        >

            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-[15px] font-medium text-zoru-ink">Program Details</h2>
                    <Badge variant={statusVariant(status)}>{status}</Badge>
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
            </Card>

            {/* Nominations */}
            <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[15px] font-medium text-zoru-ink">Nominations</h2>
                    <span className="text-[12px] text-zoru-ink-muted">{nominations} total</span>
                </div>
                {nominationsList.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No nominations yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Nominee</ZoruTableHead>
                                    <ZoruTableHead>Nominated by</ZoruTableHead>
                                    <ZoruTableHead>Reason</ZoruTableHead>
                                    <ZoruTableHead>Submitted</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {nominationsList.map((n, i) => (
                                    <ZoruTableRow key={i}>
                                        <ZoruTableCell>
                                            {String(n.nomineeName || n.nomineeId || '—')}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {String(n.nominatorName || n.nominatorId || '—')}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="max-w-[320px] truncate">
                                            {String(n.reason || n.notes || '—')}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {fmtDate(n.submittedAt || n.createdAt)}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </Table>
                    </div>
                )}
            </Card>

            {/* Winners */}
            <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[15px] font-medium text-zoru-ink">Winners</h2>
                    <span className="text-[12px] text-zoru-ink-muted">{winners} total</span>
                </div>
                {winnersList.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No winners declared yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Winner</ZoruTableHead>
                                    <ZoruTableHead>Award date</ZoruTableHead>
                                    <ZoruTableHead>Citation</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {winnersList.map((w, i) => (
                                    <ZoruTableRow key={i}>
                                        <ZoruTableCell>
                                            {String(w.employeeName || w.employeeId || '—')}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {fmtDate(w.awardedAt || w.date)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="max-w-[320px] truncate">
                                            {String(w.citation || w.reason || '—')}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </Table>
                    </div>
                )}
            </Card>
        </EntityListShell>
    );
}
