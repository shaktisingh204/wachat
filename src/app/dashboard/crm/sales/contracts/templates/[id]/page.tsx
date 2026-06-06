import { Badge, Button, Card } from '@/components/sabcrm/20ui';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Contract template detail page — server component.
 *
 * Fetches the template by id and renders an overview card plus the body
 * (markdown, preformatted) and the variables list.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';

import {
    getContractTemplateById,
    type CrmContractTemplateStatus,
} from '@/app/actions/crm-contract-templates.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/contracts/templates';

const STATUS_TONE: Record<CrmContractTemplateStatus, StatusTone> = {
    draft: 'amber',
    active: 'green',
    archived: 'neutral',
};

function pretty(s?: string): string {
    if (!s) return '—';
    return s.replace(/_/g, ' ');
}

export default async function ContractTemplateDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const template = await getContractTemplateById(id);
    if (!template) notFound();

    const status = (template.status ?? 'draft') as CrmContractTemplateStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';
    const variables = template.variables ?? [];

    return (
        <EntityDetailShell
            eyebrow="CONTRACT TEMPLATE"
            title={template.name}
            back={{ href: BASE, label: 'Templates' }}
            actions={
                <Button asChild>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >

            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-[var(--st-text)]">
                        Overview
                    </div>
                    <StatusPill label={pretty(status)} tone={tone} />
                    <Badge variant="ghost" className="uppercase font-mono">
                        {template.type}
                    </Badge>
                    {template.isActive ? (
                        <Badge variant="success">Available</Badge>
                    ) : (
                        <Badge variant="ghost">Hidden</Badge>
                    )}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Default term</div>
                        <div className="font-mono text-[var(--st-text)]">
                            {template.defaultTermMonths != null
                                ? `${template.defaultTermMonths} month(s)`
                                : '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">
                            Default auto-renew
                        </div>
                        <div className="text-[var(--st-text)]">
                            {template.defaultAutoRenew ? 'Yes' : 'No'}
                        </div>
                    </div>
                </div>
            </Card>

            {variables.length > 0 ? (
                <Card className="p-6">
                    <div className="mb-3 text-[15px] font-medium text-[var(--st-text)]">
                        Variables
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {variables.map((v) => (
                            <Badge
                                key={v}
                                variant="ghost"
                                className="font-mono text-[12px]"
                            >
                                {`{{${v}}}`}
                            </Badge>
                        ))}
                    </div>
                </Card>
            ) : null}

            <Card className="p-6">
                <div className="mb-3 text-[15px] font-medium text-[var(--st-text)]">
                    Body (markdown)
                </div>
                {template.body ? (
                    <pre className="whitespace-pre-wrap rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4 font-mono text-[12.5px] text-[var(--st-text)]">
                        {template.body}
                    </pre>
                ) : (
                    <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                        No body content yet.
                    </div>
                )}
            </Card>
        </EntityDetailShell>
    );
}
