import { fmtDate, fmtINR } from '@/lib/utils';
import { Badge, Button, Card } from '@/components/sabcrm/20ui/compat';
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



function pretty(s?: string): string {
    if (!s) return '—';
    return s.replace(/_/g, ' ');
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
                <Button asChild>
                    <Link href={`${BASE}/${jobId}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >
            {/* Summary card */}
            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-[var(--st-text)]">
                        Overview
                    </div>
                    {tags.map((t) => (
                        <Badge key={t} variant="ghost">
                            {t}
                        </Badge>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Employment type</div>
                        <div className="capitalize text-[var(--st-text)]">
                            {pretty(job.employmentType as string)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Work mode</div>
                        <div className="capitalize text-[var(--st-text)]">
                            {pretty(job.remotePolicy as string | undefined)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Location</div>
                        <div className="text-[var(--st-text)]">{job.location || '—'}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Openings (filled / total)</div>
                        <div className="font-mono text-[var(--st-text)]">
                            {job.filled ?? 0} / {job.openings ?? 0}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Experience</div>
                        <div className="text-[var(--st-text)]">
                            {job.experienceMin ?? 0}–{job.experienceMax ?? 0} yrs
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Salary range</div>
                        <div className="text-[var(--st-text)]">
                            {fmtINR(job.salaryMin, job.currency)} –{' '}
                            {fmtINR(job.salaryMax, job.currency)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Publish at</div>
                        <div className="text-[var(--st-text)]">{fmtDate(job.publishAt)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Close at</div>
                        <div className="text-[var(--st-text)]">{fmtDate(job.closeAt)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Hiring manager</div>
                        <div className="font-mono text-[12px] text-[var(--st-text)]">
                            {job.hiringManagerId || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Department</div>
                        <div className="text-[var(--st-text)]">
                            {job.departmentName || job.departmentId || '—'}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Public posting link */}
            {job.publishUrl ? (
                <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="flex items-center gap-2 text-[13px] text-[var(--st-text)]">
                        <ExternalLink className="h-4 w-4 text-[var(--st-text-secondary)]" />
                        Public posting
                    </div>
                    <a
                        href={job.publishUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-full truncate text-[12.5px] text-[var(--st-text)] underline-offset-2 hover:underline"
                    >
                        {job.publishUrl}
                    </a>
                </Card>
            ) : null}

            {/* Description */}
            <Card className="p-6">
                <div className="mb-3 text-[15px] font-medium text-[var(--st-text)]">
                    Description
                </div>
                {job.description ? (
                    <div className="prose prose-sm prose-zoru max-w-none text-[13px] text-[var(--st-text)] p-4 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)]" 
                         dangerouslySetInnerHTML={{ __html: job.description }} 
                    />
                ) : (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                        No description.
                    </div>
                )}
            </Card>

            {/* Responsibilities */}
            {job.responsibilities ? (
                <Card className="p-6">
                    <div className="mb-3 text-[15px] font-medium text-[var(--st-text)]">
                        Responsibilities
                    </div>
                    <div className="prose prose-sm prose-zoru max-w-none text-[13px] text-[var(--st-text)] p-4 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)]" 
                         dangerouslySetInnerHTML={{ __html: job.responsibilities }} 
                    />
                </Card>
            ) : null}

            {/* Requirements */}
            {job.requirements ? (
                <Card className="p-6">
                    <div className="mb-3 text-[15px] font-medium text-[var(--st-text)]">
                        Requirements
                    </div>
                    <div className="prose prose-sm prose-zoru max-w-none text-[13px] text-[var(--st-text)] p-4 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)]" 
                         dangerouslySetInnerHTML={{ __html: job.requirements }} 
                    />
                </Card>
            ) : null}
        </EntityDetailShell>
    );
}
