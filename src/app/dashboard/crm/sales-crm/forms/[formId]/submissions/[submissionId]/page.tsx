import { notFound } from 'next/navigation';

import {
    Badge,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui';
import {
    EntityDetailShell,
    type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import {
    getCrmFormById,
    getFormSubmissionById,
} from '@/app/actions/crm-forms.actions';

import { SubmissionDetailActions } from './_actions';

export const dynamic = 'force-dynamic';

type StatusValue = 'new' | 'processed' | 'spam' | 'archived';

interface PageProps {
    params: Promise<{ formId: string; submissionId: string }>;
}

function statusTone(s?: string): EntityStatusTone {
    switch (s) {
        case 'processed':
            return 'green';
        case 'spam':
            return 'red';
        case 'archived':
            return 'neutral';
        case 'new':
        default:
            return 'amber';
    }
}

function fmtDateTime(v?: string | Date): string {
    if (!v) return '—';
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function renderValue(v: unknown): string {
    if (v == null) return '—';
    if (typeof v === 'object') {
        try {
            return JSON.stringify(v, null, 2);
        } catch {
            return String(v);
        }
    }
    return String(v);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                {label}
            </div>
            <div className="mt-1 break-words text-[13px] text-zoru-ink">{children}</div>
        </div>
    );
}

export default async function SubmissionDetailPage({ params }: PageProps) {
    const { formId, submissionId } = await params;

    const [form, submissionRaw] = await Promise.all([
        getCrmFormById(formId),
        getFormSubmissionById(submissionId),
    ]);
    if (!form || !submissionRaw) notFound();

    const submission = submissionRaw as unknown as {
        _id: string;
        formId?: string;
        data?: Record<string, unknown>;
        sourceUrl?: string;
        ipAddress?: string;
        userAgent?: string;
        referrer?: string;
        status?: StatusValue;
        processedAt?: string | Date;
        notes?: string;
        createdAt?: string | Date;
        submittedAt?: string | Date;
    };

    const status: StatusValue = (submission.status ?? 'new') as StatusValue;
    const data = (submission.data ?? {}) as Record<string, unknown>;

    const fieldDefs: Array<{ name: string; label?: string; type?: string }> = Array.isArray(form.fields)
        ? form.fields
              .map((f: any) => ({
                  name: typeof f?.name === 'string' ? f.name : typeof f?.id === 'string' ? f.id : '',
                  label: typeof f?.label === 'string' ? f.label : undefined,
                  type: typeof f?.type === 'string' ? f.type : undefined,
              }))
              .filter((f) => f.name)
        : [];

    const known = new Set(fieldDefs.map((f) => f.name));
    const extras = Object.keys(data).filter((k) => !known.has(k));

    const createdAt = submission.createdAt ?? submission.submittedAt;

    return (
        <EntityDetailShell
            title={form.name}
            eyebrow="FORM SUBMISSION"
            status={{ label: status, tone: statusTone(status) }}
            back={{
                href: `/dashboard/crm/sales-crm/forms/${formId}/submissions`,
                label: 'Back to submissions',
            }}
            actions={
                <SubmissionDetailActions submissionId={submissionId} formId={formId} />
            }
            rightRail={
                <>
                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Status</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-2 text-[12.5px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-zoru-ink-muted">Current</span>
                                    <ZoruBadge variant="outline">{status}</ZoruBadge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zoru-ink-muted">Submitted</span>
                                    <span>{fmtDateTime(createdAt)}</span>
                                </div>
                                {submission.processedAt ? (
                                    <div className="flex items-center justify-between">
                                        <span className="text-zoru-ink-muted">Processed</span>
                                        <span>{fmtDateTime(submission.processedAt)}</span>
                                    </div>
                                ) : null}
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>

                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Submitter context</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-3 text-[12.5px]">
                                <div>
                                    <div className="text-zoru-ink-muted">Source URL</div>
                                    <div className="mt-0.5 break-all text-zoru-ink">
                                        {submission.sourceUrl ? (
                                            <a
                                                href={submission.sourceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-zoru-primary hover:underline"
                                            >
                                                {submission.sourceUrl}
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-zoru-ink-muted">Referrer</div>
                                    <div className="mt-0.5 break-all text-zoru-ink">
                                        {submission.referrer || '—'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-zoru-ink-muted">IP address</div>
                                    <div className="mt-0.5 text-zoru-ink">
                                        {submission.ipAddress || '—'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-zoru-ink-muted">User agent</div>
                                    <div className="mt-0.5 break-words text-zoru-ink">
                                        {submission.userAgent || '—'}
                                    </div>
                                </div>
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>

                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Submission ID</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <code className="block break-all rounded bg-zoru-surface-2 px-2 py-1.5 text-[11.5px] text-zoru-ink-muted">
                                {submissionId}
                            </code>
                        </ZoruCardContent>
                    </ZoruCard>
                </>
            }
        >
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Response</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    {fieldDefs.length === 0 && extras.length === 0 ? (
                        <p className="text-[13px] text-zoru-ink-muted">
                            This submission has no recorded fields.
                        </p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {fieldDefs.map((f) => (
                                <Field key={f.name} label={f.label || f.name}>
                                    {renderValue(data[f.name])}
                                </Field>
                            ))}
                            {extras.map((k) => (
                                <Field key={k} label={k}>
                                    {renderValue(data[k])}
                                </Field>
                            ))}
                        </div>
                    )}
                </ZoruCardContent>
            </ZoruCard>

            {submission.notes || submission.processedAt ? (
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Activity</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="space-y-2 text-[13px]">
                            {submission.processedAt ? (
                                <div className="flex items-start gap-2">
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zoru-success" />
                                    <div>
                                        <div className="text-zoru-ink">Marked as processed</div>
                                        <div className="text-[11.5px] text-zoru-ink-muted">
                                            {fmtDateTime(submission.processedAt)}
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                            {submission.notes ? (
                                <p className="whitespace-pre-wrap text-zoru-ink">
                                    {submission.notes}
                                </p>
                            ) : null}
                        </div>
                    </ZoruCardContent>
                </ZoruCard>
            ) : null}
        </EntityDetailShell>
    );
}
