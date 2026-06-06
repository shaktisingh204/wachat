import { Badge, Button, Card } from '@/components/sabcrm/20ui/compat';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Email template detail page.
 *
 * Server component — fetches the template via the Rust-backed
 * `getEmailTemplateById` action and renders a preview-style card with
 * subject, HTML body and merge variables.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getEmailTemplateById } from '@/app/actions/crm-email-templates.actions';
import type { CrmEmailTemplateStatus } from '@/lib/rust-client/crm-email-templates';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/settings/email-templates';

const STATUS_TONE: Record<CrmEmailTemplateStatus, StatusTone> = {
    active: 'green',
    archived: 'neutral',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default async function EmailTemplateDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: templateId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const template = await getEmailTemplateById(templateId);
    if (!template) notFound();

    const status = (template.status ?? 'active') as CrmEmailTemplateStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';
    const variables = Array.isArray(template.variables) ? template.variables : [];

    return (
        <EntityDetailShell
            eyebrow="EMAIL TEMPLATE"
            title={template.name}
            status={{ label: status, tone }}
            back={{ href: BASE, label: 'Email Templates' }}
            actions={
                <Button asChild>
                    <Link href={`${BASE}/${templateId}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >
            {/* Summary card */}
            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">
                        Overview
                    </div>
                    <StatusPill label={status} tone={tone} />
                    {template.isActive ? (
                        <Badge variant="success">In picker</Badge>
                    ) : (
                        <Badge variant="ghost">Hidden</Badge>
                    )}
                    {template.category ? (
                        <Badge variant="outline" className="capitalize">
                            {template.category}
                        </Badge>
                    ) : null}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Subject</div>
                        <div className="text-zoru-ink">{template.subject}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Last updated</div>
                        <div className="text-zoru-ink">{fmtDate(template.updatedAt)}</div>
                    </div>
                </div>
            </Card>

            {/* Variables */}
            {variables.length > 0 ? (
                <Card className="p-4">
                    <div className="mb-2 text-[13px] font-medium text-zoru-ink">
                        Merge variables
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {variables.map((v) => (
                            <Badge key={v} variant="outline" className="font-mono">
                                {`{{${v}}}`}
                            </Badge>
                        ))}
                    </div>
                </Card>
            ) : null}

            {/* HTML body preview */}
            <Card className="p-6">
                <div className="mb-3 text-[15px] font-medium text-zoru-ink">
                    Body (HTML source)
                </div>
                <pre className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4 font-mono text-[12.5px] text-zoru-ink">
                    {template.body}
                </pre>
            </Card>

            {/* Plain text fallback */}
            {template.textBody ? (
                <Card className="p-6">
                    <div className="mb-3 text-[15px] font-medium text-zoru-ink">
                        Plain-text fallback
                    </div>
                    <pre className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4 text-[12.5px] text-zoru-ink">
                        {template.textBody}
                    </pre>
                </Card>
            ) : null}
        </EntityDetailShell>
    );
}
