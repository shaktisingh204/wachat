import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Paperclip,
  Pencil } from 'lucide-react';

/**
 * Reconciliation detail — `/dashboard/crm/banking/reconciliation/[id]`.
 *
 * Server component. Hits `getReconciliationById` (Rust-backed).
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getReconciliationById } from '@/app/actions/crm-reconciliation.actions';
import type { CrmReconciliationStatus } from '@/lib/rust-client/crm-reconciliation';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/banking/reconciliation';

const STATUS_TONE: Record<CrmReconciliationStatus, StatusTone> = {
    in_progress: 'amber',
    completed: 'green',
    archived: 'neutral',
};

function fmtAmount(value: unknown): string {
    if (value == null || value === '') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(n);
}

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/**
 * Notes get a `statement: <url>` line appended by the server action.
 * Parse it out so the detail page can render it as a SabFile link.
 */
function extractStatementUrl(notes?: string): {
    statementUrl?: string;
    rest?: string;
} {
    if (!notes) return {};
    const m = notes.match(/(^|\n)statement:\s*(\S+)\s*$/);
    if (!m) return { rest: notes };
    const url = m[2];
    const rest = notes.replace(/(^|\n)statement:\s*\S+\s*$/, '').trim();
    return { statementUrl: url, rest: rest || undefined };
}

function Field({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-3 gap-3 border-b border-zoru-line/60 py-2 last:border-0">
            <dt className="col-span-1 text-[12.5px] text-zoru-ink-muted">{label}</dt>
            <dd className="col-span-2 text-[13px] text-zoru-ink">{value ?? '—'}</dd>
        </div>
    );
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ReconciliationDetailPage({ params }: PageProps) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const recon = await getReconciliationById(id);
    if (!recon) notFound();

    const tone = STATUS_TONE[recon.status] ?? 'neutral';
    const { statementUrl, rest } = extractStatementUrl(recon.notes);

    return (
        <EntityDetailShell
            eyebrow="RECONCILIATION"
            title={`Reconciliation · ${fmtDate(recon.periodStart)} – ${fmtDate(recon.periodEnd)}`}
            back={{ href: BASE, label: 'Reconciliation' }}
            actions={
                <ZoruButton asChild>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                    </Link>
                </ZoruButton>
            }
        >

            <ZoruCard>
                <ZoruCardHeader>
                    <div className="flex items-center justify-between">
                        <ZoruCardTitle>Overview</ZoruCardTitle>
                        <StatusPill
                            label={recon.status.replace(/_/g, ' ')}
                            tone={tone}
                        />
                    </div>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl>
                        <Field label="Account ID" value={recon.accountId} />
                        <Field
                            label="Period"
                            value={`${fmtDate(recon.periodStart)} – ${fmtDate(recon.periodEnd)}`}
                        />
                        <Field
                            label="Opening balance"
                            value={fmtAmount(recon.openingBalance)}
                        />
                        <Field
                            label="Closing balance"
                            value={fmtAmount(recon.closingBalance)}
                        />
                        <Field label="Matched" value={recon.matchedCount} />
                        <Field label="Unmatched" value={recon.unmatchedCount} />
                        <Field
                            label="Finalised"
                            value={fmtDate(recon.finalizedAt)}
                        />
                        <Field label="Created" value={fmtDate(recon.createdAt)} />
                    </dl>
                </ZoruCardContent>
            </ZoruCard>

            {statementUrl ? (
                <ZoruCard className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="flex items-center gap-2 text-[13px] text-zoru-ink">
                        <Paperclip className="h-4 w-4 text-zoru-ink-muted" />
                        Attached statement
                    </div>
                    <a
                        href={statementUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-full truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                    >
                        {statementUrl}
                    </a>
                </ZoruCard>
            ) : null}

            {rest ? (
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Notes</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
                            {rest}
                        </p>
                    </ZoruCardContent>
                </ZoruCard>
            ) : null}
        </EntityDetailShell>
    );
}
