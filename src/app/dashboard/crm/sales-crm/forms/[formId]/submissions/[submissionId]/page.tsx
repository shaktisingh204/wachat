import { notFound } from 'next/navigation';
import sanitizeHtml from 'sanitize-html';

import {
    Badge,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/sabcrm/20ui/compat';
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


function GenericFieldRenderer({ type, value }: { type?: string; value: unknown }) {
    if (value == null || value === '') return <span className="text-[var(--st-text-secondary)]">—</span>;

    if (type === 'email') {
        return (
            <a href={`mailto:${value}`} className="text-[var(--st-text)] hover:underline">
                {String(value)}
            </a>
        );
    }
    if (type === 'url') {
        return (
            <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-[var(--st-text)] hover:underline">
                {String(value)}
            </a>
        );
    }
    if (type === 'boolean' || type === 'checkbox') {
        return <Badge variant="outline">{value === true || value === 'true' ? 'Yes' : 'No'}</Badge>;
    }
    if (type === 'date') {
        const d = new Date(String(value));
        return <span>{Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString()}</span>;
    }

    let stringVal = '';
    if (typeof value === 'object') {
        try {
            stringVal = JSON.stringify(value, null, 2);
        } catch {
            stringVal = String(value);
        }
    } else {
        stringVal = String(value);
    }

    // Sanitize raw text to prevent XSS
    const cleanHtml = sanitizeHtml(stringVal, {
        allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
        allowedAttributes: {
            a: ['href'],
        },
    });

    return <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                {label}
            </div>
            <div className="mt-1 break-words text-[13px] text-[var(--st-text)]">{children}</div>
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
        <div id="submission-detail-content">
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
                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Status</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-2 text-[12.5px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-[var(--st-text-secondary)]">Current</span>
                                    <Badge variant="outline">{status}</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[var(--st-text-secondary)]">Submitted</span>
                                    <span>{fmtDateTime(createdAt)}</span>
                                </div>
                                {submission.processedAt ? (
                                    <div className="flex items-center justify-between">
                                        <span className="text-[var(--st-text-secondary)]">Processed</span>
                                        <span>{fmtDateTime(submission.processedAt)}</span>
                                    </div>
                                ) : null}
                            </div>
                        </ZoruCardContent>
                    </Card>

                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Submitter context</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-3 text-[12.5px]">
                                <div>
                                    <div className="text-[var(--st-text-secondary)]">Source URL</div>
                                    <div className="mt-0.5 break-all text-[var(--st-text)]">
                                        {submission.sourceUrl ? (
                                            <a
                                                href={submission.sourceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[var(--st-text)] hover:underline"
                                            >
                                                {submission.sourceUrl}
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[var(--st-text-secondary)]">Referrer</div>
                                    <div className="mt-0.5 break-all text-[var(--st-text)]">
                                        {submission.referrer || '—'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[var(--st-text-secondary)]">IP address</div>
                                    <div className="mt-0.5 text-[var(--st-text)]">
                                        {submission.ipAddress || '—'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[var(--st-text-secondary)]">User agent</div>
                                    <div className="mt-0.5 break-words text-[var(--st-text)]">
                                        {submission.userAgent || '—'}
                                    </div>
                                </div>
                            </div>
                        </ZoruCardContent>
                    </Card>

                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Submission ID</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <code className="block break-all rounded bg-[var(--st-bg-muted)] px-2 py-1.5 text-[11.5px] text-[var(--st-text-secondary)]">
                                {submissionId}
                            </code>
                        </ZoruCardContent>
                    </Card>
                </>
            }
        >
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Response</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    {fieldDefs.length === 0 && extras.length === 0 ? (
                        <p className="text-[13px] text-[var(--st-text-secondary)]">
                            This submission has no recorded fields.
                        </p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {fieldDefs.map((f) => (
                                <Field key={f.name} label={f.label || f.name}>
                                    <GenericFieldRenderer type={f.type} value={data[f.name]} />
                                </Field>
                            ))}
                            {extras.map((k) => (
                                <Field key={k} label={k}>
                                    <GenericFieldRenderer type="text" value={data[k]} />
                                </Field>
                            ))}
                        </div>
                    )}
                </ZoruCardContent>
            </Card>

            {submission.notes || submission.processedAt ? (
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Activity</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="space-y-2 text-[13px]">
                            {submission.processedAt ? (
                                <div className="flex items-start gap-2">
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--st-status-ok)]" />
                                    <div>
                                        <div className="text-[var(--st-text)]">Marked as processed</div>
                                        <div className="text-[11.5px] text-[var(--st-text-secondary)]">
                                            {fmtDateTime(submission.processedAt)}
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                            {submission.notes ? (
                                <p className="whitespace-pre-wrap text-[var(--st-text)]">
                                    {submission.notes}
                                </p>
                            ) : null}
                        </div>
                    </ZoruCardContent>
                </Card>
            ) : null}
        </EntityDetailShell>
        </div>
    );
}
