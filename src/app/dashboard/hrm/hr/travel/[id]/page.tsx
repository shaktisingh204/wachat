import { Badge, Button } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import Link from 'next/link';
import {
    Plane,
  Pencil,
  Check,
  X,
  Ticket,
  Printer,
  ArrowLeft,
  } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

/**
 * Travel request detail page (§1D.2).
 *
 * Loads a single document from `hr_travel_requests` and renders an
 * overview grid. Actions: Edit · Approve · Reject · Book travel · Print
 * (stubs).
 */

import { statusToTone } from '@/components/crm/status-pill';
import {
    getHrEntityById,
    fmtDate,
    fmtText,
    fmtCurrency,
    fmtShortId,
} from '../../_components/hr-detail-loader';
import { HrDetailGrid, HrDetailRow } from '../../_components/hr-detail-grid';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import {
    approveTravelRequest,
    rejectTravelRequest,
    markTravelComplete,
} from '@/app/actions/hr-status-flow.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

interface PageProps {
    params: Promise<{ id: string }>;
}

const BASE = '/dashboard/hrm/hr/travel';

export default async function TravelDetailPage({ params }: PageProps) {
    const { id } = await params;
    const doc = await getHrEntityById('hr_travel_requests', id);
    if (!doc) notFound();

    const t = doc as Record<string, unknown>;
    const status = String(t.status || 'pending');
    const purpose = (t.purpose as string) || (t.destination as string) || 'Travel request';
    const employeeRef = (t.employeeName as string) || (t.employeeId as string) || '—';
    const currency = (t.currency as string) || 'INR';
    const fromCity = (t.fromCity as string) || (t.origin as string) || '—';
    const toCity = (t.toCity as string) || (t.destination as string) || '—';

    return (
        <EntityDetailShell
            title={`${purpose} · ${fmtShortId(employeeRef)}`}
            eyebrow="HR · TRAVEL"
            back={{ href: BASE, label: 'All travel requests' }}
            status={{ label: status, tone: statusToTone(status) }}
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
                    <a href={`${BASE}/${id}?print=1`} target="_blank" rel="noopener noreferrer">
                        <ZoruButton variant="outline" size="sm">
                            <Printer className="h-4 w-4" /> Print
                        </ZoruButton>
                    </a>
                    <HrActionButtons
                        actions={[
                            {
                                key: 'approve',
                                kind: 'action',
                                label: 'Approve',
                                icon: <Check className="h-4 w-4" />,
                                onRun: () => approveTravelRequest(id),
                            },
                            {
                                key: 'reject',
                                kind: 'prompt',
                                label: 'Reject',
                                icon: <X className="h-4 w-4" />,
                                variant: 'destructive',
                                promptTitle: 'Reject travel request',
                                promptDescription: 'Provide a reason for rejection.',
                                submitLabel: 'Reject',
                                fields: [
                                    {
                                        name: 'reason',
                                        label: 'Reason',
                                        type: 'textarea',
                                        required: true,
                                    },
                                ],
                                onRun: (v) => rejectTravelRequest(id, v.reason ?? ''),
                            },
                            {
                                key: 'complete',
                                kind: 'action',
                                label: 'Mark complete',
                                icon: <Ticket className="h-4 w-4" />,
                                onRun: () => markTravelComplete(id),
                            },
                        ]}
                    />
                </>
            }
            audit={<EntityAuditTimeline entityKind="travel" entityId={id} />}
        >
            <HrDetailGrid title="Trip details">
                <HrDetailRow label="Employee">{fmtText(employeeRef)}</HrDetailRow>
                <HrDetailRow label="Purpose">{fmtText(t.purpose)}</HrDetailRow>
                <HrDetailRow label="Mode">{fmtText(t.mode)}</HrDetailRow>
                <HrDetailRow label="From">{fromCity}</HrDetailRow>
                <HrDetailRow label="To">{toCity}</HrDetailRow>
                <HrDetailRow label="From date">{fmtDate(t.fromDate)}</HrDetailRow>
                <HrDetailRow label="To date">{fmtDate(t.toDate)}</HrDetailRow>
                <HrDetailRow label="Estimated cost">
                    {fmtCurrency(t.estimatedCost, currency)}
                </HrDetailRow>
                <HrDetailRow label="Advance amount">
                    {fmtCurrency(t.advanceAmount, currency)}
                </HrDetailRow>
                <HrDetailRow label="Status">
                    <ZoruBadge variant={status === 'approved' ? 'success' : 'warning'}>
                        {status}
                    </ZoruBadge>
                </HrDetailRow>
                <HrDetailRow label="Approver">
                    {fmtText(t.approverName || t.approverId)}
                </HrDetailRow>
                <HrDetailRow label="Submitted">{fmtDate(t.createdAt)}</HrDetailRow>
                {t.itinerary ? (
                    <HrDetailRow label="Itinerary" fullWidth>
                        {String(t.itinerary)}
                    </HrDetailRow>
                ) : null}
                {t.notes ? (
                    <HrDetailRow label="Notes" fullWidth>
                        {String(t.notes)}
                    </HrDetailRow>
                ) : null}
            </HrDetailGrid>

            <Plane className="hidden" />
        </EntityDetailShell>
    );
}
