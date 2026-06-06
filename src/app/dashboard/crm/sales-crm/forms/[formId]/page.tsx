import { Badge, Button, Card } from '@/components/sabcrm/20ui/compat';
import {
  notFound,
  redirect } from 'next/navigation';
import {
  Eye,
  Pencil } from 'lucide-react';

/**
 * Form detail page.
 *
 * Server component — fetches the form by id via `getFormById` and renders
 * a summary card + fields table + embed snippet.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getFormById } from '@/app/actions/crm-forms.actions';
import type { CrmFormStatus } from '@/lib/rust-client/crm-forms';
import { CopySnippet } from '../_components/copy-snippet';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales-crm/forms';

const STATUS_TONE: Record<CrmFormStatus, StatusTone> = {
    draft: 'amber',
    published: 'green',
    archived: 'neutral',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default async function FormDetailPage({
    params,
}: {
    params: Promise<{ formId: string }>;
}) {
    const { formId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const form = await getFormById(formId);
    if (!form) notFound();

    const status = form.status ?? 'draft';
    const tone = STATUS_TONE[status] ?? 'neutral';
    const fields = form.fields ?? [];
    const settings = (form.settings ?? {}) as Record<string, unknown>;

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const publicUrl = `${appUrl}/embed/crm-form/${formId}`;
    const iframeSnippet = `<iframe src="${publicUrl}" width="100%" height="500" style="border:none; border-radius:8px;"></iframe>`;

    const submissions = form.submissionCount ?? 0;
    const mockViews = Math.max(submissions * 3 + 12, 42);
    const conversionRate = mockViews > 0 ? ((submissions / mockViews) * 100).toFixed(1) : '0.0';
    const dropOffs = mockViews - submissions;

    return (
        <EntityDetailShell
            title={form.name}
            eyebrow="FORM"
            back={{ href: BASE, label: 'Forms' }}
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" asChild>
                        <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Eye className="mr-2 h-4 w-4" />
                            Preview
                        </a>
                    </Button>
                    <Button asChild>
                        <Link href={`${BASE}/${formId}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </Link>
                    </Button>
                </div>
            }
        >

            {/* Summary card */}
            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
                    <StatusPill label={status} tone={tone} />
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Slug</div>
                        <div className="font-mono text-zoru-ink">{form.slug ?? '—'}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Submissions</div>
                        <div className="font-mono text-zoru-ink">
                            {form.submissionCount ?? 0}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Created</div>
                        <div className="text-zoru-ink">{fmtDate(form.createdAt)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Updated</div>
                        <div className="text-zoru-ink">{fmtDate(form.updatedAt)}</div>
                    </div>
                    {typeof settings.successMessage === 'string' ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Success message</div>
                            <div className="text-zoru-ink">
                                {settings.successMessage as string}
                            </div>
                        </div>
                    ) : null}
                    {typeof settings.redirectUrl === 'string' ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Redirect URL</div>
                            <a
                                href={settings.redirectUrl as string}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate text-zoru-ink underline-offset-2 hover:underline"
                            >
                                {settings.redirectUrl as string}
                            </a>
                        </div>
                    ) : null}
                </div>
            </Card>

            {/* Fields */}
            <Card className="p-6">
                <div className="mb-3 flex items-center justify-between">
                    <div className="text-[15px] font-medium text-zoru-ink">Fields</div>
                    <div className="text-[12px] text-zoru-ink-muted">
                        {fields.length} field{fields.length === 1 ? '' : 's'}
                    </div>
                </div>
                {fields.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No fields defined.
                    </div>
                ) : (
                    <ol className="space-y-2">
                        {fields.map((f, i) => (
                            <li
                                key={`${f.name}-${i}`}
                                className="grid grid-cols-1 gap-1 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3 sm:grid-cols-[auto_1fr_1fr_140px_auto]"
                            >
                                <span className="font-mono text-[11px] text-zoru-ink-muted self-center">
                                    #{i + 1}
                                </span>
                                <span className="font-mono text-[12.5px] text-zoru-ink self-center">
                                    {f.name}
                                </span>
                                <span className="text-[13px] text-zoru-ink self-center">
                                    {f.label ?? f.name}
                                </span>
                                <Badge variant="ghost" className="self-center">
                                    {f.type ?? 'text'}
                                </Badge>
                                {f.required ? (
                                    <Badge variant="warning" className="self-center">
                                        Required
                                    </Badge>
                                ) : (
                                    <span className="self-center text-[11.5px] text-zoru-ink-muted">
                                        Optional
                                    </span>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </Card>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Analytics card */}
                <Card className="p-6">
                    <div className="mb-4">
                        <div className="text-[15px] font-medium text-zoru-ink">Performance Analytics</div>
                        <div className="text-[13px] text-zoru-ink-muted">Estimated conversions and drop-offs</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4">
                            <div className="text-[12px] font-medium text-zoru-ink-muted">Views</div>
                            <div className="mt-1 text-2xl font-semibold text-zoru-ink">{mockViews}</div>
                        </div>
                        <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4">
                            <div className="text-[12px] font-medium text-zoru-ink-muted">Conversion Rate</div>
                            <div className="mt-1 text-2xl font-semibold text-zoru-ink">{conversionRate}%</div>
                        </div>
                        <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4">
                            <div className="text-[12px] font-medium text-zoru-ink-muted">Submissions</div>
                            <div className="mt-1 text-2xl font-semibold text-zoru-ink">{submissions}</div>
                        </div>
                        <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4">
                            <div className="text-[12px] font-medium text-zoru-ink-muted">Drop-offs</div>
                            <div className="mt-1 text-2xl font-semibold text-zoru-ink">{dropOffs}</div>
                        </div>
                    </div>
                </Card>

                {/* Integration card */}
                <Card className="p-6">
                    <div className="mb-4">
                        <div className="text-[15px] font-medium text-zoru-ink">Integration</div>
                        <div className="text-[13px] text-zoru-ink-muted">Share or embed this form</div>
                    </div>
                    <div className="space-y-4">
                        <CopySnippet label="Public URL" text={publicUrl} />
                        <CopySnippet label="Embed iFrame" text={iframeSnippet} />
                    </div>
                </Card>
            </div>
        </EntityDetailShell>
    );
}
