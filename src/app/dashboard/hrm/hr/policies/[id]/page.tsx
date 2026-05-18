import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import {
  CheckSquare,
  Paperclip,
  Pencil,
  } from 'lucide-react';

/**
 * Policy detail page.
 *
 * Server component — fetches the policy by id via the Rust-backed
 * `getPolicyById` server action and renders a summary card + body +
 * acknowledgement banner. The attached document is shown as a SabFile
 * link; the form sets it via `<SabFilePickerButton>`, never via a
 * free-text URL paste (SabFiles policy).
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getPolicyById } from '@/app/actions/crm-policies.actions';
import type { CrmPolicyStatus } from '@/lib/rust-client/crm-policies';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/policies';

const STATUS_TONE: Record<CrmPolicyStatus, StatusTone> = {
    draft: 'amber',
    published: 'green',
    under_review: 'blue',
    archived: 'neutral',
    obsolete: 'red',
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

export default async function PolicyDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: policyId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const policy = await getPolicyById(policyId);
    if (!policy) notFound();

    const status = (policy.status ?? 'draft') as CrmPolicyStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';

    const tags = Array.isArray(policy.tags) ? policy.tags : [];
    const ackRequired = !!policy.acknowledgementRequired;
    const ackCount = policy.acknowledgementCount ?? 0;

    return (
        <EntityListShell
            title={policy.name}
            subtitle={policy.summary || 'Policy detail'}
            primaryAction={
                <ZoruButton asChild>
                    <Link href={`${BASE}/${policyId}/edit`}>
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
                    <StatusPill label={pretty(status)} tone={tone} />
                    {tags.map((t) => (
                        <ZoruBadge key={t} variant="ghost">
                            {t}
                        </ZoruBadge>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Version</div>
                        <div className="font-mono text-zoru-ink">
                            {policy.version || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Category</div>
                        <div className="capitalize text-zoru-ink">
                            {pretty(policy.category as string | undefined)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Effective date</div>
                        <div className="text-zoru-ink">
                            {fmtDate(policy.effectiveDate)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Review date</div>
                        <div className="text-zoru-ink">{fmtDate(policy.reviewDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Expiry date</div>
                        <div className="text-zoru-ink">{fmtDate(policy.expiryDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Owner</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {policy.ownerId || '—'}
                        </div>
                    </div>
                    {policy.summary ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Summary</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">
                                {policy.summary}
                            </div>
                        </div>
                    ) : null}
                </div>
            </ZoruCard>

            {/* Attached document */}
            {policy.documentUrl ? (
                <ZoruCard className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="flex items-center gap-2 text-[13px] text-zoru-ink">
                        <Paperclip className="h-4 w-4 text-zoru-ink-muted" />
                        Attached document
                    </div>
                    <a
                        href={policy.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-full truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                    >
                        {policy.documentUrl}
                    </a>
                </ZoruCard>
            ) : null}

            {/* Acknowledgement strip */}
            {ackRequired ? (
                <ZoruCard className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="flex items-center gap-2 text-[13px] text-zoru-ink">
                        <CheckSquare className="h-4 w-4 text-zoru-ink-muted" />
                        Employee acknowledgement required
                    </div>
                    <div className="text-[12.5px] text-zoru-ink-muted">
                        <span className="font-mono text-zoru-ink">{ackCount}</span>{' '}
                        acknowledgement{ackCount === 1 ? '' : 's'} recorded
                    </div>
                </ZoruCard>
            ) : null}

            {/* Inline content */}
            <ZoruCard className="p-6">
                <div className="mb-3 text-[15px] font-medium text-zoru-ink">
                    Content
                </div>
                {policy.content ? (
                    <pre className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4 font-sans text-[13px] text-zoru-ink">
                        {policy.content}
                    </pre>
                ) : (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No inline content for this policy.
                    </div>
                )}
            </ZoruCard>
        </EntityListShell>
    );
}
