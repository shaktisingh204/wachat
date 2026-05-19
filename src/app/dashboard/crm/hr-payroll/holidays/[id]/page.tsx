import { notFound } from 'next/navigation';
import Link from 'next/link';

/**
 * Holiday detail — `/dashboard/crm/hr-payroll/holidays/[id]`.
 *
 * Server component matching the canonical `<EntityDetailShell>`
 * pattern from `bookings/[id]/page.tsx` (§3.4 of CRM_PAGE_REDESIGN_PLAN):
 *   - Header: type pill, eyebrow, title (holiday name), Edit/Delete.
 *   - Main: Overview · Audience · Notes.
 *   - Right rail: Date card · Type badge · Recurring flag · Audience count.
 *   - Footer: <EntityAuditTimeline entityKind="holiday" />.
 *
 * Note: `applicableLocations` is the only "audience" axis the Rust DTO
 * exposes today (`Vec<String>` of country/state ids). Department-level
 * targeting is a backend gap — flagged in the report.
 */

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui';
import { ArrowLeft } from 'lucide-react';

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

import { getHoliday } from '@/app/actions/crm/holidays.actions';
import type { CrmHolidayType } from '@/lib/rust-client/crm-holidays';

import { HolidayDetailActions } from '../_components/holiday-detail-actions';

export const dynamic = 'force-dynamic';

function fmtDate(v?: string): string {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function typeTone(t?: CrmHolidayType): EntityStatusTone {
    switch (t) {
        case 'national':
            return 'blue';
        case 'regional':
            return 'amber';
        case 'religious':
            return 'green';
        case 'optional':
        case 'restricted':
            return 'neutral';
        default:
            return 'neutral';
    }
}

function dayOfWeek(v?: string): string {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime())
        ? '—'
        : d.toLocaleDateString(undefined, { weekday: 'long' });
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                {label}
            </div>
            <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
        </div>
    );
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function HolidayDetailPage({ params }: PageProps) {
    const { id } = await params;
    const { holiday, error } = await getHoliday(id);

    if (!holiday) {
        if (error) {
            return (
                <div className="flex w-full flex-col gap-4 p-6">
                    <p className="text-[14px] text-zoru-ink">
                        Couldn&apos;t load this holiday — {error}
                    </p>
                    <ZoruButton variant="outline" asChild>
                        <Link href="/dashboard/crm/hr-payroll/holidays">
                            <ArrowLeft className="h-4 w-4" /> All holidays
                        </Link>
                    </ZoruButton>
                </div>
            );
        }
        notFound();
    }

    const locations = holiday.applicableLocations ?? [];
    const type = holiday.holidayType ?? 'national';

    return (
        <EntityDetailShell
            title={holiday.name || 'Holiday'}
            eyebrow={`HOLIDAY · ${fmtDate(holiday.date)}`}
            status={{ label: type, tone: typeTone(holiday.holidayType) }}
            back={{
                href: '/dashboard/crm/hr-payroll/holidays',
                label: 'All holidays',
            }}
            actions={
                <HolidayDetailActions id={id} name={holiday.name || 'Holiday'} />
            }
            audit={<EntityAuditTimeline entityKind="holiday" entityId={id} />}
            rightRail={
                <>
                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Date</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div className="flex justify-between">
                                    <span className="text-zoru-ink-muted">Day</span>
                                    <span>{fmtDate(holiday.date)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zoru-ink-muted">Weekday</span>
                                    <span>{dayOfWeek(holiday.date)}</span>
                                </div>
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>

                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Classification</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-zoru-ink-muted">Type</span>
                                    <ZoruBadge variant="outline">{type}</ZoruBadge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zoru-ink-muted">Recurring</span>
                                    <span>{holiday.recurring ? 'Yes' : 'No'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zoru-ink-muted">Archived</span>
                                    <span>{holiday.archived ? 'Yes' : 'No'}</span>
                                </div>
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>

                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Audience</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div className="flex justify-between">
                                    <span className="text-zoru-ink-muted">Locations</span>
                                    <span>
                                        {locations.length === 0
                                            ? 'All locations'
                                            : `${locations.length}`}
                                    </span>
                                </div>
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>
                </>
            }
        >
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Overview</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Name">{holiday.name || '—'}</Field>
                        <Field label="Date">{fmtDate(holiday.date)}</Field>
                        <Field label="Type">
                            <ZoruBadge variant="outline">{type}</ZoruBadge>
                        </Field>
                        <Field label="Recurring">
                            {holiday.recurring ? 'Yes — repeats annually' : 'No'}
                        </Field>
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Audience</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    {locations.length === 0 ? (
                        <p className="text-[13px] text-zoru-ink-muted">
                            Applies to all employees across every location.
                        </p>
                    ) : (
                        <ul className="flex flex-wrap gap-2">
                            {locations.map((loc) => (
                                <li key={loc}>
                                    <ZoruBadge variant="outline">{loc}</ZoruBadge>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="mt-3 text-[11.5px] text-zoru-ink-muted">
                        Locations are stored as country and state identifiers on the
                        holiday record. Department- or employee-level targeting is not
                        yet supported by the backend.
                    </p>
                </ZoruCardContent>
            </ZoruCard>

            {holiday.notes ? (
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Notes</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
                            {holiday.notes}
                        </p>
                    </ZoruCardContent>
                </ZoruCard>
            ) : null}

            <p className="text-[11px] text-zoru-ink-muted">
                Created {fmtDate(holiday.createdAt ?? holiday.audit?.createdAt)} ·
                Updated {fmtDate(holiday.updatedAt ?? holiday.audit?.updatedAt)}
            </p>
        </EntityDetailShell>
    );
}
