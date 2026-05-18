import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import {
  ExternalLink,
  Pencil,
  } from 'lucide-react';

/**
 * Job detail page — §1B canonical contract.
 *
 * Server component. Renders summary + role description + requirements +
 * dates and openings cards.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import type { EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getJobById } from '@/app/actions/crm-jobs.actions';
import type { CrmJobStatus } from '@/lib/rust-client/crm-jobs';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/jobs';

const STATUS_TONE: Record<CrmJobStatus, EntityStatusTone> = {
    draft: 'amber',
    open: 'green',
    on_hold: 'amber',
    filled: 'blue',
    closed: 'red',
    archived: 'neutral',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function pretty(s?: string): string {
    if (!s) return '—';
    return s.replace(/_/g, ' ');
}

function fmtMoney(amt?: number, currency?: string): string {
    if (amt == null) return '—';
    const ccy = currency ?? 'INR';
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: ccy,
            maximumFractionDigits: 0,
        }).format(amt);
    } catch {
        return `${ccy} ${amt}`;
    }
}

export default async function JobDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: jobId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const job = await getJobById(jobId);
    if (!job) notFound();

    const status = (job.status ?? 'draft') as CrmJobStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';
    const tags = Array.isArray(job.tags) ? job.tags : [];

    return (
        <EntityDetailShell
            eyebrow="JOB"
            title={job.title}
            status={{ label: pretty(status), tone }}
            back={{ href: BASE, label: 'Jobs' }}
            actions={
                <ZoruButton asChild>
                    <Link href={`${BASE}/${jobId}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </ZoruButton>
            }
        >
            {/* Summary card */}
            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">
                        Overview
                    </div>
                    {tags.map((t) => (
                        <ZoruBadge key={t} variant="ghost">
                            {t}
                        </ZoruBadge>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Employment type</div>
                        <div className="capitalize text-zoru-ink">
                            {pretty(job.employmentType as string)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Work mode</div>
                        <div className="capitalize text-zoru-ink">
                            {pretty(job.remotePolicy as string | undefined)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Location</div>
                        <div className="text-zoru-ink">{job.location || '—'}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Openings (filled / total)</div>
                        <div className="font-mono text-zoru-ink">
                            {job.filled ?? 0} / {job.openings ?? 0}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Experience</div>
                        <div className="text-zoru-ink">
                            {job.experienceMin ?? 0}–{job.experienceMax ?? 0} yrs
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Salary range</div>
                        <div className="text-zoru-ink">
                            {fmtMoney(job.salaryMin, job.currency)} –{' '}
                            {fmtMoney(job.salaryMax, job.currency)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Publish at</div>
                        <div className="text-zoru-ink">{fmtDate(job.publishAt)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Close at</div>
                        <div className="text-zoru-ink">{fmtDate(job.closeAt)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Hiring manager</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {job.hiringManagerId || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Department</div>
                        <div className="text-zoru-ink">
                            {job.departmentName || job.departmentId || '—'}
                        </div>
                    </div>
                </div>
            </ZoruCard>

            {/* Public posting link */}
            {job.publishUrl ? (
                <ZoruCard className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="flex items-center gap-2 text-[13px] text-zoru-ink">
                        <ExternalLink className="h-4 w-4 text-zoru-ink-muted" />
                        Public posting
                    </div>
                    <a
                        href={job.publishUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-full truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                    >
                        {job.publishUrl}
                    </a>
                </ZoruCard>
            ) : null}

            {/* Description */}
            <ZoruCard className="p-6">
                <div className="mb-3 text-[15px] font-medium text-zoru-ink">
                    Description
                </div>
                {job.description ? (
                    <pre className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4 font-sans text-[13px] text-zoru-ink">
                        {job.description}
                    </pre>
                ) : (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No description.
                    </div>
                )}
            </ZoruCard>

            {/* Responsibilities */}
            {job.responsibilities ? (
                <ZoruCard className="p-6">
                    <div className="mb-3 text-[15px] font-medium text-zoru-ink">
                        Responsibilities
                    </div>
                    <pre className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4 font-sans text-[13px] text-zoru-ink">
                        {job.responsibilities}
                    </pre>
                </ZoruCard>
            ) : null}

            {/* Requirements */}
            {job.requirements ? (
                <ZoruCard className="p-6">
                    <div className="mb-3 text-[15px] font-medium text-zoru-ink">
                        Requirements
                    </div>
                    <pre className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4 font-sans text-[13px] text-zoru-ink">
                        {job.requirements}
                    </pre>
                </ZoruCard>
            ) : null}
        </EntityDetailShell>
    );
}
