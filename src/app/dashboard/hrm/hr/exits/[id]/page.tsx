/**
 * Exit detail page (§1D.2).
 *
 * Server component. Loads a single document from `hr_exits` for the
 * current tenant and renders an overview grid with every relevant
 * field, plus the audit timeline. Action group: Edit · Print
 * clearance · Confirm KT · Mark NOC (the last three are stubs — see
 * TODO 1D.2 markers).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
    LogOut,
    Pencil,
    Printer,
    CheckCircle2,
    FileSignature,
    ArrowLeft,
    Trash2,
} from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ZoruBadge, ZoruButton } from '@/components/zoruui';
import {
    getHrEntityById,
    fmtDate,
    fmtCurrency,
    fmtText,
    fmtShortId,
} from '../../_components/hr-detail-loader';
import { HrDetailGrid, HrDetailRow } from '../../_components/hr-detail-grid';
import { statusToTone } from '@/components/crm/status-pill';

interface PageProps {
    params: Promise<{ id: string }>;
}

const BASE = '/dashboard/hrm/hr/exits';

export default async function ExitDetailPage({ params }: PageProps) {
    const { id } = await params;
    const exit = await getHrEntityById('hr_exits', id);
    if (!exit) notFound();

    const e = exit as Record<string, unknown>;
    const reason = String(e.reason || '—');
    const clearance = String(e.clearance_status || 'pending');
    const fnf = String(e.fnf_status || 'pending');
    const employeeRef = e.employeeName || e.employeeId || '—';

    return (
        <EntityDetailShell
            title={`Exit · ${fmtShortId(employeeRef)}`}
            eyebrow="HR · EXIT"
            back={{ href: BASE, label: 'All exits' }}
            status={{ label: clearance, tone: statusToTone(clearance) }}
            actions={
                <>
                    <Link href={BASE}>
                        <ZoruButton variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </ZoruButton>
                    </Link>
                    <Link href={`${BASE}/${id}/edit`}>
                        <ZoruButton size="sm">
                            <Pencil className="h-4 w-4" /> Edit
                        </ZoruButton>
                    </Link>
                    {/* TODO 1D.2: wire Confirm KT to a status mutation. */}
                    <ZoruButton variant="outline" size="sm" disabled>
                        <CheckCircle2 className="h-4 w-4" /> Confirm KT
                    </ZoruButton>
                    {/* TODO 1D.2: wire Mark NOC to a status mutation. */}
                    <ZoruButton variant="outline" size="sm" disabled>
                        <FileSignature className="h-4 w-4" /> Mark NOC
                    </ZoruButton>
                    {/* TODO 1D.2: wire Print clearance to ?print=1 route. */}
                    <ZoruButton variant="outline" size="sm" disabled>
                        <Printer className="h-4 w-4" /> Print clearance
                    </ZoruButton>
                    {/* TODO 1D.2: wire Delete with ConfirmDialog. */}
                    <ZoruButton variant="ghost" size="sm" disabled>
                        <Trash2 className="h-4 w-4" />
                    </ZoruButton>
                </>
            }
            audit={{ entityKind: 'exit', entityId: id }}
        >
            <HrDetailGrid
                title="Exit details"
                titleSlot={
                    <div className="flex items-center gap-1.5">
                        <ZoruBadge variant="ghost">{reason}</ZoruBadge>
                        <ZoruBadge
                            variant={fnf === 'processed' ? 'success' : 'warning'}
                        >
                            FnF: {fnf}
                        </ZoruBadge>
                    </div>
                }
            >
                <HrDetailRow label="Employee">{fmtText(employeeRef)}</HrDetailRow>
                <HrDetailRow label="Reason">{reason}</HrDetailRow>
                <HrDetailRow label="Exit date">
                    {fmtDate(e.exit_date || e.lastWorkingDate)}
                </HrDetailRow>
                <HrDetailRow label="Notice start">
                    {fmtDate(e.noticeStartDate || e.resignationDate)}
                </HrDetailRow>
                <HrDetailRow label="Last working day">
                    {fmtDate(e.lastWorkingDate || e.exit_date)}
                </HrDetailRow>
                <HrDetailRow label="Exit interview date">
                    {fmtDate(e.exit_interview_date)}
                </HrDetailRow>
                <HrDetailRow label="Clearance status">
                    <ZoruBadge variant={clearance === 'cleared' ? 'success' : 'warning'}>
                        {clearance}
                    </ZoruBadge>
                </HrDetailRow>
                <HrDetailRow label="FnF status">
                    <ZoruBadge variant={fnf === 'processed' ? 'success' : 'warning'}>
                        {fnf}
                    </ZoruBadge>
                </HrDetailRow>
                <HrDetailRow label="FnF amount">
                    {fmtCurrency(e.fnfAmount)}
                </HrDetailRow>
                <HrDetailRow label="NOC status">
                    {fmtText(e.nocStatus)}
                </HrDetailRow>
                <HrDetailRow label="Asset return status">
                    {fmtText(e.assetReturnStatus)}
                </HrDetailRow>
                <HrDetailRow label="Knowledge transfer">
                    {fmtText(e.knowledgeTransfer)}
                </HrDetailRow>
                {e.notes ? (
                    <HrDetailRow label="Notes" fullWidth>
                        {String(e.notes)}
                    </HrDetailRow>
                ) : null}
                {e.exitInterviewNotes ? (
                    <HrDetailRow label="Exit interview notes" fullWidth>
                        {String(e.exitInterviewNotes)}
                    </HrDetailRow>
                ) : null}
            </HrDetailGrid>

            <LogOut className="hidden" />
        </EntityDetailShell>
    );
}
