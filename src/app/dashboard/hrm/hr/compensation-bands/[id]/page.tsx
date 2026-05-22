import { Badge, Button } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import Link from 'next/link';
import { LineChart,
  Pencil,
  Copy,
  Archive,
  ArrowLeft } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

/**
 * Compensation band detail page (§1D.2).
 *
 * Loads a single document from `hr_compensation_bands` and renders an
 * overview grid. Action: Edit (other actions deferred — see TODO 1D.2).
 */

import {
    getHrEntityById,
    fmtDate,
    fmtText,
    fmtCurrency,
} from '../../_components/hr-detail-loader';
import { HrDetailGrid, HrDetailRow } from '../../_components/hr-detail-grid';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import { archiveCompensationBand } from '@/app/actions/hr-status.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

interface PageProps {
    params: Promise<{ id: string }>;
}

const BASE = '/dashboard/hrm/hr/compensation-bands';

export default async function CompensationBandDetailPage({ params }: PageProps) {
    const { id } = await params;
    const doc = await getHrEntityById('hr_compensation_bands', id);
    if (!doc) notFound();

    const b = doc as Record<string, unknown>;
    const title = (b.title as string) || 'Untitled band';
    const level = String(b.level || '—');
    const isActive =
        b.isActive === true ||
        b.isActive === 'yes' ||
        b.isActive === undefined;
    const currency = (b.currency as string) || 'INR';

    return (
        <EntityDetailShell
            title={`${title} · ${level}`}
            eyebrow="HR · COMP BAND"
            back={{ href: BASE, label: 'All bands' }}
            status={{
                label: isActive ? 'active' : 'inactive',
                tone: isActive ? 'green' : 'neutral',
            }}
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
                    <Link href={`${BASE}/new?duplicateOf=${id}`}>
                        <Button variant="outline" size="sm">
                            <Copy className="h-4 w-4" /> Duplicate
                        </Button>
                    </Link>
                    <HrActionButtons
                        actions={[
                            {
                                key: 'archive',
                                kind: 'confirm',
                                label: 'Archive',
                                icon: <Archive className="h-4 w-4" />,
                                variant: 'destructive',
                                confirmTitle: 'Archive this compensation band?',
                                confirmDescription:
                                    'Archived bands are marked inactive but kept for historical reference.',
                                confirmLabel: 'Archive',
                                onRun: () => archiveCompensationBand(id),
                            },
                        ]}
                    />
                </>
            }
            audit={<EntityAuditTimeline entityKind="compensation_band" entityId={id} />}
        >
            <HrDetailGrid title="Band">
                <HrDetailRow label="Role / Designation">{title}</HrDetailRow>
                <HrDetailRow label="Level">{level}</HrDetailRow>
                <HrDetailRow label="Department">{fmtText(b.department)}</HrDetailRow>
                <HrDetailRow label="Band version">{fmtText(b.bandVersion)}</HrDetailRow>
                <HrDetailRow label="Active">
                    <Badge variant={isActive ? 'success' : 'ghost'}>
                        {isActive ? 'Yes' : 'No'}
                    </Badge>
                </HrDetailRow>
            </HrDetailGrid>

            <HrDetailGrid title="Salary">
                <HrDetailRow label="Min salary">
                    {fmtCurrency(b.min_salary || b.minSalary, currency)}
                </HrDetailRow>
                <HrDetailRow label="Mid salary">
                    {fmtCurrency(b.midSalary, currency)}
                </HrDetailRow>
                <HrDetailRow label="Max salary">
                    {fmtCurrency(b.max_salary || b.maxSalary, currency)}
                </HrDetailRow>
                <HrDetailRow label="Currency">{currency}</HrDetailRow>
                <HrDetailRow label="Currency type">{fmtText(b.currency_type)}</HrDetailRow>
                <HrDetailRow label="Bonus %">{fmtText(b.bonusPercentage)}</HrDetailRow>
                <HrDetailRow label="Stock eligible">{fmtText(b.stockEligible)}</HrDetailRow>
            </HrDetailGrid>

            <HrDetailGrid title="Experience & Location">
                <HrDetailRow label="Experience min (yrs)">
                    {fmtText(b.experienceMin)}
                </HrDetailRow>
                <HrDetailRow label="Experience max (yrs)">
                    {fmtText(b.experienceMax)}
                </HrDetailRow>
                <HrDetailRow label="Location">{fmtText(b.location)}</HrDetailRow>
                <HrDetailRow label="Geography multiplier">
                    {fmtText(b.geographyMultiplier)}
                </HrDetailRow>
            </HrDetailGrid>

            <HrDetailGrid title="Validity">
                <HrDetailRow label="Effective date">{fmtDate(b.effectiveDate)}</HrDetailRow>
                <HrDetailRow label="Expires at">{fmtDate(b.expiresAt)}</HrDetailRow>
                <HrDetailRow label="Review cycle">{fmtText(b.reviewCycle)}</HrDetailRow>
                {b.notes ? (
                    <HrDetailRow label="Notes" fullWidth>
                        {String(b.notes)}
                    </HrDetailRow>
                ) : null}
            </HrDetailGrid>

            <LineChart className="hidden" />
        </EntityDetailShell>
    );
}
