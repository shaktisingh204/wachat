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
} from '@/components/sabcrm/20ui/compat';
import {
  notFound } from 'next/navigation';
import Link from 'next/link';
import {
    Users,
  Pencil,
  CheckCircle2,
  ArrowUpCircle,
  ArrowLeft,
  } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

/**
 * Succession plan detail page (§1D.2).
 *
 * Loads a single document from `hr_succession_plans` and renders an
 * overview grid + a candidates / successors table when present.
 * Actions: Edit · Mark reviewed · Promote (stubs).
 */

import { statusToTone } from '@/components/crm/status-pill';
import {
    getHrEntityById,
    fmtDate,
    fmtText,
    fmtShortId,
} from '../../_components/hr-detail-loader';
import { HrDetailGrid, HrDetailRow } from '../../_components/hr-detail-grid';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import {
    markSuccessionReviewed,
    promoteSuccessor,
} from '@/app/actions/hr-status.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

interface PageProps {
    params: Promise<{ id: string }>;
}

const BASE = '/dashboard/hrm/hr/succession';

interface Successor {
    employeeId?: string;
    employeeName?: string;
    readiness?: string;
    notes?: string;
}

export default async function SuccessionDetailPage({ params }: PageProps) {
    const { id } = await params;
    const doc = await getHrEntityById('hr_succession_plans', id);
    if (!doc) notFound();

    const p = doc as Record<string, unknown>;
    const role = (p.role as string) || (p.position as string) || 'Succession plan';
    const status = String(p.status || 'active');
    const incumbent =
        (p.incumbentName as string) ||
        (p.incumbentEmployeeId as string) ||
        (p.employeeId as string) ||
        '—';
    const successors: Successor[] = Array.isArray(p.successors)
        ? (p.successors as Successor[])
        : Array.isArray(p.candidates)
            ? (p.candidates as Successor[])
            : [];

    return (
        <EntityDetailShell
            title={`${role} · ${fmtShortId(incumbent)}`}
            eyebrow="HR · SUCCESSION"
            back={{ href: BASE, label: 'All plans' }}
            status={{ label: status, tone: statusToTone(status) }}
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
                    <HrActionButtons
                        actions={[
                            {
                                key: 'reviewed',
                                kind: 'action',
                                label: 'Mark reviewed',
                                icon: <CheckCircle2 className="h-4 w-4" />,
                                onRun: () => markSuccessionReviewed(id),
                            },
                            {
                                key: 'promote',
                                kind: 'prompt',
                                label: 'Promote successor',
                                icon: <ArrowUpCircle className="h-4 w-4" />,
                                promptTitle: 'Promote successor',
                                promptDescription:
                                    'Enter the employee id or name of the successor to promote.',
                                submitLabel: 'Promote',
                                fields: [
                                    {
                                        name: 'successorRef',
                                        label: 'Successor (employee id or name)',
                                        required: true,
                                    },
                                ],
                                onRun: (v) =>
                                    promoteSuccessor(id, v.successorRef ?? ''),
                            },
                        ]}
                    />
                </>
            }
            audit={<EntityAuditTimeline entityKind="succession" entityId={id} />}
        >
            <HrDetailGrid title="Overview">
                <HrDetailRow label="Role / Position">{role}</HrDetailRow>
                <HrDetailRow label="Department">{fmtText(p.department)}</HrDetailRow>
                <HrDetailRow label="Incumbent">{fmtText(incumbent)}</HrDetailRow>
                <HrDetailRow label="Successor (primary)">
                    {fmtText(p.successorId || p.primarySuccessorId)}
                </HrDetailRow>
                <HrDetailRow label="Readiness">
                    {fmtText(p.readiness)}
                </HrDetailRow>
                <HrDetailRow label="Review date">{fmtDate(p.reviewDate)}</HrDetailRow>
                <HrDetailRow label="Status">
                    <Badge variant={status === 'active' ? 'success' : 'ghost'}>
                        {status}
                    </Badge>
                </HrDetailRow>
                {p.notes ? (
                    <HrDetailRow label="Notes" fullWidth>
                        {String(p.notes)}
                    </HrDetailRow>
                ) : null}
            </HrDetailGrid>

            <Card className="p-6">
                <div className="mb-4 text-[15px] font-medium text-zoru-ink">Successors / candidates</div>
                {successors.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No successors listed.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Employee</ZoruTableHead>
                                    <ZoruTableHead>Readiness</ZoruTableHead>
                                    <ZoruTableHead>Notes</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {successors.map((c, idx) => (
                                    <ZoruTableRow key={idx}>
                                        <ZoruTableCell>
                                            {fmtText(c.employeeName || c.employeeId)}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <Badge variant="ghost">{c.readiness || '—'}</Badge>
                                        </ZoruTableCell>
                                        <ZoruTableCell>{fmtText(c.notes)}</ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </Table>
                    </div>
                )}
            </Card>

            <Users className="hidden" />
        </EntityDetailShell>
    );
}
