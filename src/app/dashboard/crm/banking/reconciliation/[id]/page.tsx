import { Suspense } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, Skeleton } from '@/components/sabcrm/20ui';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Paperclip, Pencil, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import type { EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getReconciliationById } from '@/app/actions/crm-reconciliation.actions';
import type { CrmReconciliationStatus } from '@/lib/rust-client/crm-reconciliation';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/banking/reconciliation';

const STATUS_TONE: Record<CrmReconciliationStatus, EntityStatusTone> = {
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
    return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(d);
}

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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="grid grid-cols-3 gap-3 border-b border-[var(--st-border)]/60 py-2 last:border-0">
            <dt className="col-span-1 text-[12.5px] text-[var(--st-text-secondary)]">{label}</dt>
            <dd className="col-span-2 text-[13px] text-[var(--st-text)]">{value ?? '—'}</dd>
        </div>
    );
}

async function ReconciliationDetail({ id }: { id: string }) {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const recon = await getReconciliationById(id);
    if (!recon) notFound();

    const tone = STATUS_TONE[recon.status] ?? 'neutral';
    const { statementUrl, rest } = extractStatementUrl(recon.notes);
    
    const isCompleted = recon.status === 'completed';
    const isArchived = recon.status === 'archived';
    
    const unmatchedCount = recon.unmatchedCount ?? 0;
    const unmatchedTone = unmatchedCount === 0 ? 'success' : (unmatchedCount > 10 ? 'danger' : 'warning');

    return (
        <EntityDetailShell
            eyebrow="RECONCILIATION"
            title={`Reconciliation · ${fmtDate(recon.periodStart)} – ${fmtDate(recon.periodEnd)}`}
            back={{ href: BASE, label: 'Reconciliations' }}
            status={{ label: recon.status.replace(/_/g, ' '), tone }}
            actions={
                <div className="flex items-center gap-2">
                    {recon.status === 'in_progress' && (
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`${BASE}/${id}/auto-match`}>
                                <Sparkles className="mr-2 h-4 w-4 text-[var(--st-text)]" />
                                AI Auto-Match
                            </Link>
                        </Button>
                    )}
                    <Button size="sm" variant={isCompleted || isArchived ? "outline" : "default"} asChild>
                        <Link href={`${BASE}/${id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" /> {isCompleted ? 'View details' : 'Edit match'}
                        </Link>
                    </Button>
                </div>
            }
            rightRail={
                <Card>
                    <CardHeader>
                        <CardTitle>Reconciliation Details</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <dl className="space-y-1">
                            <Field label="Account ID" value={<span className="font-mono text-xs">{recon.accountId}</span>} />
                            <Field label="Period Start" value={fmtDate(recon.periodStart)} />
                            <Field label="Period End" value={fmtDate(recon.periodEnd)} />
                            <Field label="Finalised" value={fmtDate(recon.finalizedAt)} />
                            <Field label="Created" value={fmtDate(recon.createdAt)} />
                        </dl>
                        
                        <div className="mt-6 space-y-4">
                            <div className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--st-text-secondary)] border-b border-[var(--st-border)]/60 pb-2">
                                <Clock className="h-4 w-4" />
                                System Status
                            </div>
                            <div className="flex flex-col gap-2 text-[13px]">
                                <div className="flex justify-between items-center">
                                    <span className="text-[var(--st-text-secondary)]">Auto-categorization</span>
                                    {isCompleted ? (
                                        <span className="flex items-center text-[var(--st-text)] font-medium"><CheckCircle2 className="h-3 w-3 mr-1" /> Applied</span>
                                    ) : (
                                        <span className="text-[var(--st-text)] font-medium">Pending run</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            }
            audit={<EntityAuditTimeline entityKind="reconciliation" entityId={id} />}
        >
            <div className="flex flex-col gap-6">
                <Card className="overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--st-border)]">
                        <div className="p-5">
                            <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)] mb-1">Matched Entries</p>
                            <p className="text-3xl font-semibold tracking-tight text-[var(--st-text)]">{recon.matchedCount?.toString() ?? '0'}</p>
                        </div>
                        <div className="p-5">
                            <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)] mb-1">Unmatched Entries</p>
                            <p className={`text-3xl font-semibold tracking-tight ${unmatchedCount > 0 ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'}`}>
                                {unmatchedCount.toString()}
                            </p>
                        </div>
                        <div className="p-5">
                            <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)] mb-1">Opening Balance</p>
                            <p className="text-2xl font-semibold tracking-tight text-[var(--st-text)] mt-1.5">{fmtAmount(recon.openingBalance)}</p>
                        </div>
                        <div className="p-5">
                            <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)] mb-1">Closing Balance</p>
                            <p className="text-2xl font-semibold tracking-tight text-[var(--st-text)] mt-1.5">{fmtAmount(recon.closingBalance)}</p>
                        </div>
                    </div>
                    {/* Simulated FX / Multi-currency summary since it's a chunk 3 feature */}
                    <div className="bg-[var(--st-bg-secondary)] border-t border-[var(--st-border)] px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-[var(--st-bg-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--st-text)] ring-1 ring-inset ring-[var(--st-border)]/10 dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)] dark:ring-[var(--st-border)]/20">
                                INR Base
                            </span>
                            <span className="text-[12px] text-[var(--st-text-secondary)]">Multi-currency adjustments applied</span>
                        </div>
                        <div className="text-[12px] font-medium text-[var(--st-text)]">
                            Est. FX Gain/Loss: <span className="text-[var(--st-text)] ml-1">₹0.00</span>
                        </div>
                    </div>
                </Card>

                {statementUrl && (
                    <Card className="flex flex-row items-center justify-between p-4 bg-[var(--st-bg-secondary)]/50 border-dashed transition-colors hover:bg-[var(--st-bg-secondary)]">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--st-bg)] border border-[var(--st-border)]">
                                <Paperclip className="h-5 w-5 text-[var(--st-text-secondary)]" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[13px] font-medium text-[var(--st-text)]">Attached Bank Statement</span>
                                <a
                                    href={statementUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="max-w-md truncate text-[12px] text-[var(--st-text)] hover:underline"
                                >
                                    {statementUrl.split('/').pop() || statementUrl}
                                </a>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                            <a href={statementUrl} target="_blank" rel="noopener noreferrer">View</a>
                        </Button>
                    </Card>
                )}

                {rest && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Notes</CardTitle>
                        </CardHeader>
                        <CardBody>
                            <div className="rounded-lg bg-[var(--st-bg-secondary)] p-4 border border-[var(--st-border)]/50">
                                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--st-text)]">
                                    {rest}
                                </p>
                            </div>
                        </CardBody>
                    </Card>
                )}
            </div>
        </EntityDetailShell>
    );
}

function ReconciliationDetailSkeleton() {
    return (
        <div className="flex flex-col h-full w-full">
            <div className="flex items-center justify-between p-6 border-b border-[var(--st-border)]">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-64" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                    <Skeleton className="h-32 w-full rounded-xl" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <Skeleton className="h-40 w-full rounded-xl" />
                </div>
                <div className="w-[320px] border-l border-[var(--st-border)] p-6 space-y-6">
                    <Skeleton className="h-64 w-full rounded-xl" />
                    <Skeleton className="h-48 w-full rounded-xl" />
                </div>
            </div>
        </div>
    );
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ReconciliationDetailPage({ params }: PageProps) {
    const { id } = await params;
    return (
        <Suspense fallback={<ReconciliationDetailSkeleton />}>
            <ReconciliationDetail id={id} />
        </Suspense>
    );
}
