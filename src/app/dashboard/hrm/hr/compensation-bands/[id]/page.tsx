import { fmtINR } from "@/lib/utils";
import { Suspense } from 'react';
import { Badge, Button } from '@/components/sabcrm/20ui/compat';
import {
  notFound } from 'next/navigation';
import Link from 'next/link';
import {
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

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
}

const BASE = '/dashboard/hrm/hr/compensation-bands';

async function CompensationBandDetailPageContainer({ params }: PageProps) {
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
            <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-[var(--st-text)]">Compensation Range Overview</h3>
                <div className="relative pt-6 pb-2 w-full max-w-2xl">
                    <div className="h-4 rounded-full bg-[var(--st-bg-muted)] relative w-full overflow-hidden border border-[var(--st-border)]">
                        <div className="absolute top-0 bottom-0 left-[20%] right-[20%] bg-[var(--st-bg-muted)] opacity-50" />
                        <div className="absolute top-0 bottom-0 left-[49%] w-2 bg-[var(--st-text)] rounded" />
                    </div>
                    <div className="mt-2 flex justify-between text-[13px] font-medium text-[var(--st-text-secondary)]">
                        <div>
                           <div className="text-[var(--st-text)]">Min</div>
                           <div>{row.salaryMin ? fmtINR(Number(row.salaryMin)) : 'N/A'}</div>
                        </div>
                        <div className="text-center">
                           <div className="text-[var(--st-text)]">Mid</div>
                           <div>{row.salaryMid ? fmtINR(Number(row.salaryMid)) : 'N/A'}</div>
                        </div>
                        <div className="text-right">
                           <div className="text-[var(--st-text)]">Max</div>
                           <div>{row.salaryMax ? fmtINR(Number(row.salaryMax)) : 'N/A'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </EntityDetailShell>
    );
}

export default function CompensationBandDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CompensationBandDetailPageContainer params={params} />
    </Suspense>
  );
}
