export const dynamic = 'force-dynamic';
import { Badge, Button } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
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

/**
 * Exit detail page (§1D.2).
 *
 * Server component. Loads a single document from `hr_exits` for the
 * current tenant and renders an overview grid with every relevant
 * field, plus the audit timeline. Action group: Edit · Print
 * clearance · Confirm KT · Mark NOC (the last three are stubs — see
 * TODO 1D.2 markers).
 */

import {
    getHrEntityById,
    fmtDate,
    fmtCurrency,
    fmtText,
    fmtShortId,
} from '../../_components/hr-detail-loader';
import { HrDetailGrid, HrDetailRow } from '../../_components/hr-detail-grid';
import { statusToTone } from '@/components/crm/status-pill';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import {
    confirmExitKt,
    markExitNoc,
} from '@/app/actions/hr-status.actions';
import { deleteExit } from '@/app/actions/hr.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { ExitStepper } from '../_components/exit-stepper';

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
    const noc = String(e.nocStatus || 'pending');
    const employeeRef = e.employeeName || e.employeeId || '—';

    let currentStep: 'resignation' | 'clearance' | 'noc' | 'fnf' | 'done' = 'resignation';
    if (clearance === 'cleared') {
      currentStep = 'noc';
      if (noc === 'issued' || noc === 'na') {
        currentStep = 'fnf';
        if (fnf === 'processed') {
          currentStep = 'done';
        }
      }
    }

    return (
        <EntityDetailShell
            title={`Exit · ${fmtShortId(employeeRef)}`}
            eyebrow="HR · EXIT"
            back={{ href: BASE, label: 'All exits' }}
            status={{ label: clearance, tone: statusToTone(clearance) }}
            actions={
                <>
                    <Link href={BASE}>
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </Button>
                    </Link>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Button size="sm">
                            <Pencil className="h-4 w-4" /> Edit
                        </Button>
                    </Link>
                    <a href={`${BASE}/${id}?print=1`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                            <Printer className="h-4 w-4" /> Print clearance
                        </Button>
                    </a>
                    <HrActionButtons
                        actions={[
                            {
                                key: 'confirm-kt',
                                kind: 'action',
                                label: 'Confirm KT',
                                icon: <CheckCircle2 className="h-4 w-4" />,
                                onRun: () => confirmExitKt(id),
                            },
                            {
                                key: 'mark-noc',
                                kind: 'prompt',
                                label: 'Mark NOC',
                                icon: <FileSignature className="h-4 w-4" />,
                                promptTitle: 'Mark NOC status',
                                promptDescription:
                                    'Set the NOC (No Objection Certificate) status for this exit.',
                                submitLabel: 'Save',
                                fields: [
                                    {
                                        name: 'nocStatus',
                                        label: 'NOC status',
                                        defaultValue: 'issued',
                                        placeholder: 'issued | na',
                                        required: true,
                                    },
                                ],
                                onRun: (v) => {
                                    const next =
                                        v.nocStatus === 'na' ? 'na' : 'issued';
                                    return markExitNoc(id, next);
                                },
                            },
                            {
                                key: 'delete',
                                kind: 'confirm',
                                label: 'Delete',
                                icon: <Trash2 className="h-4 w-4" />,
                                variant: 'destructive',
                                confirmTitle: 'Delete this exit record?',
                                confirmDescription:
                                    'This soft-deletes the exit. You can restore it from the archive list.',
                                confirmLabel: 'Delete',
                                onRun: async () => {
                                    const r = await deleteExit(id);
                                    if (r.success) {
                                        return { message: 'Exit deleted.' };
                                    }
                                    return { error: r.error || 'Delete failed.' };
                                },
                            },
                        ]}
                    />
                </>
            }
            audit={<EntityAuditTimeline entityKind="exit" entityId={id} />}
        >
            <div className="mb-6 rounded-lg border border-zoru-line p-6 bg-zoru-surface">
              <ExitStepper status={currentStep} />
            </div>

            <HrDetailGrid
                title="Exit details"
                titleSlot={
                    <div className="flex items-center gap-1.5">
                        <Badge variant="ghost">{reason}</Badge>
                        <Badge
                            variant={fnf === 'processed' ? 'success' : 'warning'}
                        >
                            FnF: {fnf}
                        </Badge>
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
                    <Badge variant={clearance === 'cleared' ? 'success' : 'warning'}>
                        {clearance}
                    </Badge>
                </HrDetailRow>
                <HrDetailRow label="FnF status">
                    <Badge variant={fnf === 'processed' ? 'success' : 'warning'}>
                        {fnf}
                    </Badge>
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
